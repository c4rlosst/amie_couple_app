import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {pushRoute,notifyPartner,validEndpoint} from '../lib/push.ts';

const b64=value=>Buffer.from(value).toString('base64url');
async function keys(){const pair=await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']);return {VAPID_PUBLIC_KEY:b64(await crypto.subtle.exportKey('raw',pair.publicKey)),VAPID_PRIVATE_KEY:(await crypto.subtle.exportKey('jwk',pair.privateKey)).d,VAPID_SUBJECT:'https://c4rlosst.github.io/couple_app/'};}
async function subscription(id){const pair=await crypto.subtle.generateKey({name:'ECDH',namedCurve:'P-256'},true,['deriveBits']);return {pair,endpoint:`https://web.push.apple.com/${id}`,keys:{p256dh:b64(await crypto.subtle.exportKey('raw',pair.publicKey)),auth:b64(crypto.getRandomValues(new Uint8Array(16)))}};}
async function fixture(){
  const sqlite=new DatabaseSync(':memory:');
  for(const file of ['0000_parched_annihilus','0001_funny_molten_man','0002_profile_photos','0003_push_subscriptions'])sqlite.exec(readFileSync(new URL(`../drizzle/${file}.sql`,import.meta.url),'utf8'));
  const wrap=(sql,args=[])=>({bind(...a){return wrap(sql,a);},async first(){return sqlite.prepare(sql).get(...args)||null;},async all(){return {results:sqlite.prepare(sql).all(...args)};},async run(){const r=sqlite.prepare(sql).run(...args);return {meta:{changes:Number(r.changes)}};}});
  for(const id of ['a','b','c'])sqlite.prepare('INSERT INTO accounts VALUES (?,?,?,?,?,?)').run(id,id,id,'salt','hash',0);
  return {sqlite,env:{DB:{prepare:wrap},...await keys()}};
}
const request=body=>new Request('https://api.test/api/push',body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{});
const register=(env,uid,s)=>pushRoute(request({action:'subscribe',endpoint:s.endpoint,keys:s.keys}),env,uid);

test('push subscriptions require authentication, valid endpoints and valid encryption keys',async()=>{
  const {env}=await fixture();const s=await subscription('one');
  assert.equal((await pushRoute(request(),env,null)).status,401);
  for(const endpoint of ['http://web.push.apple.com/a','https://127.0.0.1/a','https://web.push.apple.com.evil.test/a','https://web.push.apple.com:8443/a','https://user:pass@web.push.apple.com/a'])assert.equal(validEndpoint(endpoint),false);
  assert.equal((await register(env,'a',{...s,endpoint:'https://private.test/'})).status,400);
  assert.equal((await register(env,'a',{...s,keys:{p256dh:'bad',auth:'bad'}})).status,400);
  assert.equal((await register(env,'a',s)).status,200);
  const config=await (await pushRoute(request(),env,'a')).json();assert.equal(config.publicKey,env.VAPID_PUBLIC_KEY);assert.equal(config.VAPID_PRIVATE_KEY,undefined);
});

test('another account cannot replace, test or unsubscribe a device subscription',async()=>{
  const {env,sqlite}=await fixture();const s=await subscription('owned');await register(env,'a',s);
  assert.equal((await register(env,'b',s)).status,409);
  assert.equal((await pushRoute(request({action:'test',endpoint:s.endpoint}),env,'b')).status,404);
  await pushRoute(request({action:'unsubscribe',endpoint:s.endpoint}),env,'b');assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM push_subscriptions').get().n,1);
  await pushRoute(request({action:'unsubscribe',endpoint:s.endpoint}),env,'a');assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM push_subscriptions').get().n,0);
});

async function decrypt(payload,s){
  const body=new Uint8Array(payload.body);assert.equal(body.length,4096);assert.equal(payload.headers['content-encoding'],'aes128gcm');
  const salt=body.slice(0,16);const length=body[20];const sender=body.slice(21,21+length);
  const remote=await crypto.subtle.importKey('raw',sender,{name:'ECDH',namedCurve:'P-256'},false,[]);
  const secret=await crypto.subtle.deriveBits({name:'ECDH',public:remote},s.pair.privateKey,256);
  const join=(...parts)=>Buffer.concat(parts.map(p=>Buffer.from(p)));
  const hkdf=async(value,salt,info,length)=>{const key=await crypto.subtle.importKey('raw',value,'HKDF',false,['deriveBits']);return crypto.subtle.deriveBits({name:'HKDF',hash:'SHA-256',salt,info},key,length*8);};
  const ikm=await hkdf(secret,Buffer.from(s.keys.auth,'base64url'),join(new TextEncoder().encode('WebPush: info\0'),Buffer.from(s.keys.p256dh,'base64url'),sender),32);
  const key=await crypto.subtle.importKey('raw',await hkdf(ikm,salt,new TextEncoder().encode('Content-Encoding: aes128gcm\0'),16),'AES-GCM',false,['decrypt']);
  const nonce=await hkdf(ikm,salt,new TextEncoder().encode('Content-Encoding: nonce\0'),12);
  const plain=new Uint8Array(await crypto.subtle.decrypt({name:'AES-GCM',iv:nonce},key,body.slice(21+length)));
  let end=plain.length-1;while(plain[end]===0)end--;assert.equal(plain[end],2);return JSON.parse(new TextDecoder().decode(plain.slice(0,end)));
}

test('partner delivery is encrypted, generic, correctly signed and does not notify unrelated accounts',async()=>{
  const {env,sqlite}=await fixture();
  sqlite.exec("INSERT INTO spaces (id,owner_id,partner_id,created_at) VALUES ('pair','a','b',0); INSERT INTO members (id,space_id,name,status_at,last_seen) VALUES ('a','pair','A',0,0),('b','pair','B',0,0),('c',NULL,'C',0,0);");
  const own=await subscription('own'),partner=await subscription('partner'),other=await subscription('other');
  for(const [uid,s] of [['a',own],['b',partner],['c',other]])await register(env,uid,s);
  const sent=[];const transport=async(url,payload)=>{sent.push({url,payload});return new Response(null,{status:201});};
  await notifyPartner(env,'a','test-id','message',transport);assert.equal(sent.length,1);assert.equal(sent[0].url,partner.endpoint);
  const payload=sent[0].payload;const notice=await decrypt(payload,partner);assert.equal(notice.body,'You have a new message from your person.');assert.equal(notice.tag,'amie-test-id');assert.equal(payload.redirect,'manual');
  const auth=payload.headers.authorization.match(/^vapid t=([^,]+), k=(.+)$/);assert.equal(auth[2],env.VAPID_PUBLIC_KEY);
  const [header,claims,signature]=auth[1].split('.');const jwt=JSON.parse(Buffer.from(claims,'base64url'));assert.equal(jwt.aud,'https://web.push.apple.com');assert.equal(jwt.sub,env.VAPID_SUBJECT);
  const key=await crypto.subtle.importKey('raw',Buffer.from(env.VAPID_PUBLIC_KEY,'base64url'),{name:'ECDSA',namedCurve:'P-256'},false,['verify']);assert.equal(await crypto.subtle.verify({name:'ECDSA',hash:'SHA-256'},key,Buffer.from(signature,'base64url'),new TextEncoder().encode(`${header}.${claims}`)),true);
  await notifyPartner(env,'a','photo','photo',transport);assert.equal((await decrypt(sent[1].payload,partner)).body,'Your person shared a photo.');assert.equal(sent[1].payload.headers.authorization,payload.headers.authorization);
  await notifyPartner(env,'a','tap','tap',transport);assert.equal((await decrypt(sent[2].payload,partner)).body,'Your person is thinking of you.');
});

test('expired subscriptions are removed and test delivery is throttled per device',async()=>{
  const {env,sqlite}=await fixture();const s=await subscription('expired');await register(env,'a',s);
  const body={action:'test',endpoint:s.endpoint};const transport=async()=>new Response(null,{status:201});
  assert.equal((await pushRoute(request(body),env,'a',transport)).status,200);
  assert.equal((await pushRoute(request(body),env,'a',transport)).status,429);
  sqlite.exec('UPDATE push_subscriptions SET last_test_at=0');
  assert.equal((await pushRoute(request(body),env,'a',async()=>new Response(null,{status:410}))).status,410);
  assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM push_subscriptions').get().n,0);
});

test('service worker always displays received pushes and opens only the Amie conversation',async()=>{
  const handlers={};const shown=[];const posted=[];const opened=[];
  const self={registration:{scope:'https://c4rlosst.github.io/couple_app/',showNotification:async(...args)=>shown.push(args)},addEventListener:(name,fn)=>handlers[name]=fn,clients:{matchAll:async()=>[],openWindow:async url=>opened.push(url)}};
  vm.runInNewContext(readFileSync(new URL('../public/sw.js',import.meta.url),'utf8'),{self,URL});
  let pending;handlers.push({data:{json:()=>({body:'New photo',tag:'photo-1',url:'https://evil.test'})},waitUntil:p=>pending=p});await pending;assert.equal(shown[0][0],'Amie');assert.equal(shown[0][1].body,'New photo');
  handlers.push({data:{json:()=>{throw new Error();}},waitUntil:p=>pending=p});await pending;assert.equal(shown.length,2);
  handlers.notificationclick({notification:{close(){}},waitUntil:p=>pending=p});await pending;assert.equal(opened[0],'https://c4rlosst.github.io/couple_app/#messages');
  self.clients.matchAll=async()=>[{url:'https://c4rlosst.github.io/couple_app/',postMessage:message=>posted.push(message),focus:async()=>{}}];
  handlers.notificationclick({notification:{close(){}},waitUntil:p=>pending=p});await pending;assert.equal(posted[0].type,'AMIE_OPEN_MESSAGES');assert.equal(opened.length,1);
});
