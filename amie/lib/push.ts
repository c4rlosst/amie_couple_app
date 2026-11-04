import {buildPushPayload} from '@block65/webcrypto-web-push';
import {digest} from './account-auth.ts';

export type PushEnv={DB?:D1Database;VAPID_PUBLIC_KEY?:string;VAPID_PRIVATE_KEY?:string;VAPID_SUBJECT?:string};
type SubscriptionRow={id:string;account_id:string;endpoint:string;p256dh:string;auth:string;vapid_key:string};
type Notice={title:string;body:string;tag:string};
const reply=(data:unknown,status=200)=>Response.json(data,{status});
const tokens=new Map<string,{authorization:string;until:number}>();
export function pushReady(env:PushEnv){return !!(env.VAPID_PUBLIC_KEY&&env.VAPID_PRIVATE_KEY&&env.VAPID_SUBJECT);}
export function validEndpoint(value:unknown):value is string{
  if(typeof value!=='string'||value.length>2048)return false;
  try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&!u.hash&&(
    u.hostname==='web.push.apple.com'||u.hostname.endsWith('.push.apple.com')||u.hostname==='fcm.googleapis.com'||u.hostname==='updates.push.services.mozilla.com'||u.hostname.endsWith('.notify.windows.com'));
  }catch{return false;}
}
function decode(value:string){return Uint8Array.from(atob(value.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));}

export async function sendPush(env:PushEnv,row:SubscriptionRow,notice:Notice,transport:typeof fetch=fetch){
  if(!pushReady(env)||!validEndpoint(row.endpoint)||row.vapid_key!==env.VAPID_PUBLIC_KEY)return false;
  const payload=await buildPushPayload({data:notice,options:{ttl:3600,urgency:'high'}},{endpoint:row.endpoint,expirationTime:null,keys:{p256dh:row.p256dh,auth:row.auth}},{subject:env.VAPID_SUBJECT!,publicKey:env.VAPID_PUBLIC_KEY!,privateKey:env.VAPID_PRIVATE_KEY!});
  const cacheKey=`${env.VAPID_PUBLIC_KEY}:${new URL(row.endpoint).origin}`;const cached=tokens.get(cacheKey);
  if(cached&&cached.until>Date.now())payload.headers.authorization=cached.authorization;
  else{if(tokens.size>16)tokens.clear();tokens.set(cacheKey,{authorization:payload.headers.authorization,until:Date.now()+3600000});}
  const response=await transport(row.endpoint,{...payload,redirect:'manual',signal:AbortSignal.timeout(8000)});
  if(response.status===404||response.status===410){await env.DB!.prepare('DELETE FROM push_subscriptions WHERE id=? AND account_id=?').bind(row.id,row.account_id).run();return false;}
  if(!response.ok)throw new Error(`Push provider returned ${response.status}`);
  return true;
}

export async function pushRoute(request:Request,env:PushEnv,uid:string|null,transport:typeof fetch=fetch):Promise<Response>{
  if(!uid)return reply({error:'Sign in to manage notifications.'},401);
  if(!env.DB)return reply({error:'The database is unavailable.'},503);
  if(request.method==='GET')return reply({configured:pushReady(env),publicKey:pushReady(env)?env.VAPID_PUBLIC_KEY:null});
  let body:Record<string,unknown>;try{body=await request.json() as Record<string,unknown>;}catch{return reply({error:'Invalid request.'},400);}
  if(!body||!validEndpoint(body.endpoint))return reply({error:'This push service is not supported.'},400);
  const endpoint=body.endpoint;const id=await digest(endpoint);
  if(body.action==='unsubscribe'){
    await env.DB.prepare('DELETE FROM push_subscriptions WHERE id=? AND account_id=?').bind(id,uid).run();return reply({ok:true});
  }
  const existing=await env.DB.prepare('SELECT * FROM push_subscriptions WHERE id=?').bind(id).first<SubscriptionRow>();
  if(body.action==='status')return reply({enabled:!!existing&&existing.account_id===uid&&existing.vapid_key===env.VAPID_PUBLIC_KEY});
  if(!pushReady(env))return reply({error:'Notifications are not configured yet.'},503);
  if(body.action==='test'){
    if(!existing||existing.account_id!==uid)return reply({error:'Enable notifications on this device first.'},404);
    const changed=await env.DB.prepare('UPDATE push_subscriptions SET last_test_at=? WHERE id=? AND account_id=? AND last_test_at<?').bind(Date.now(),id,uid,Date.now()-30000).run();
    if(!changed.meta.changes)return reply({error:'Wait 30 seconds before sending another test.'},429);
    try{return await sendPush(env,existing,{title:'Amie',body:'You’re connected. Notifications are ready.',tag:'amie-test'},transport)?reply({ok:true}):reply({error:'This subscription expired. Enable notifications again.'},410);}
    catch{return reply({error:'The push service could not accept this test. Try again.'},502);}
  }
  if(body.action!=='subscribe')return reply({error:'Unknown notification action.'},400);
  if(existing&&existing.account_id!==uid)return reply({error:'This device subscription belongs to another account. Enable notifications again.'},409);
  const keys=body.keys as Record<string,unknown>|undefined;
  try{
    if(!keys||typeof keys.p256dh!=='string'||typeof keys.auth!=='string'||!/^[\w-]{87}$/.test(keys.p256dh)||!/^[\w-]{22}$/.test(keys.auth))throw new Error();
    const publicKey=decode(keys.p256dh);if(publicKey.length!==65||publicKey[0]!==4||decode(keys.auth).length!==16)throw new Error();
    await crypto.subtle.importKey('raw',publicKey,{name:'ECDH',namedCurve:'P-256'},false,[]);
  }catch{return reply({error:'Invalid push subscription keys.'},400);}
  const count=await env.DB.prepare('SELECT COUNT(*) AS total FROM push_subscriptions WHERE account_id=?').bind(uid).first<{total:number}>();
  if(!existing&&(count?.total??0)>=10)return reply({error:'Too many notification devices are registered.'},400);
  const saved=await env.DB.prepare('INSERT INTO push_subscriptions (id,account_id,endpoint,p256dh,auth,vapid_key,created_at,last_test_at) VALUES (?,?,?,?,?,?,?,0) ON CONFLICT(id) DO UPDATE SET p256dh=excluded.p256dh,auth=excluded.auth,vapid_key=excluded.vapid_key WHERE push_subscriptions.account_id=excluded.account_id').bind(id,uid,endpoint,keys!.p256dh,keys!.auth,env.VAPID_PUBLIC_KEY,Date.now()).run();
  if(!saved.meta.changes)return reply({error:'This subscription belongs to another account. Enable notifications again.'},409);
  return reply({ok:true});
}

export async function notifyPartner(env:PushEnv,uid:string,messageId:string,kind:'message'|'photo'|'tap',transport:typeof fetch=fetch){
  if(!env.DB||!pushReady(env))return;
  const {results}=await env.DB.prepare('SELECT p.* FROM push_subscriptions p JOIN members recipient ON recipient.id=p.account_id JOIN members sender ON sender.space_id=recipient.space_id WHERE sender.id=? AND recipient.id!=sender.id AND sender.space_id IS NOT NULL LIMIT 10').bind(uid).all<SubscriptionRow>();
  const body=kind==='photo'?'Your person shared a photo.':kind==='tap'?'Your person is thinking of you.':'You have a new message from your person.';
  const deliveries=await Promise.allSettled(results.map(row=>sendPush(env,row,{title:'Amie',body,tag:`amie-${messageId}`},transport)));
  if(deliveries.some(result=>result.status==='rejected'))console.warn('Some push deliveries were not accepted');
}
