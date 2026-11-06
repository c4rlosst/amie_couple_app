import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { handleAmie, getPhoto, getAvatar } from '../lib/service.ts';

// Real SQLite, with only the D1 transport adapted for a fast local integration test.
function fixture() {
  const sqlite=new DatabaseSync(':memory:');
  sqlite.exec(readFileSync(new URL('../drizzle/0000_parched_annihilus.sql',import.meta.url),'utf8'));
  sqlite.exec(readFileSync(new URL('../drizzle/0002_profile_photos.sql',import.meta.url),'utf8'));
  sqlite.exec(readFileSync(new URL('../drizzle/0005_chat_revision.sql',import.meta.url),'utf8'));
  const wrap=(sql,args=[])=>({
    bind(...values){return wrap(sql,values);},
    async first(){return sqlite.prepare(sql).get(...args)||null;},
    async all(){return {results:sqlite.prepare(sql).all(...args)};},
    async run(){const r=sqlite.prepare(sql).run(...args);return {meta:{changes:Number(r.changes)}};},
  });
  const objects=new Map();
  const env={DB:{prepare:wrap,async batch(statements){sqlite.exec('BEGIN');try {const results=[];for(const s of statements)results.push(await s.run());sqlite.exec('COMMIT');return results;}catch(e){sqlite.exec('ROLLBACK');throw e;}}},BUCKET:{async put(k,v,options){objects.set(k,{body:v,httpMetadata:options?.httpMetadata});},async get(k){return objects.get(k)||null;},async delete(k){objects.delete(k);}}};
  async function call(uid,body,headers={}) {const request=new Request('https://amie.test/api/amie',body?{method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(body)}:{});const res=await handleAmie(request,env,uid,'Person');return {status:res.status,...await res.json()};}
  async function paired() {const created=await call('a',{action:'create',name:'Alex'});await call('b',{action:'join',name:'Bea',code:created.code});return created;}
  return {call,paired,env,sqlite};
}
test('authentication and cross-origin writes are rejected',async()=>{const {call}=fixture();assert.equal((await call(null)).status,401);assert.equal((await call('a',{action:'create',name:'Alex'},{Origin:'https://other.test'})).status,403);});
test('pairing is one-use, limited to two, and invite hashes never leak',async()=>{const {call}=fixture();const created=await call('a',{action:'create',name:'Alex'});assert.equal(created.status,200);assert.match(created.code,/^[A-F0-9]{20}$/);assert.equal((await call('b',{action:'join',name:'Bea',code:created.code})).status,200);assert.equal((await call('c',{action:'join',name:'Cam',code:created.code})).status,400);const a=await call('a');assert.equal(a.partner.name,'Bea');assert.equal(a.space.invite_hash,undefined);assert.equal((await call('b')).partner.name,'Alex');assert.equal((await call('a',{action:'create',name:'Other'})).status,400);});
test('expired and replaced invitation codes are rejected',async()=>{const {call,sqlite}=fixture();const c=await call('a',{action:'create',name:'Alex'});const fresh=await call('a',{action:'invite'});assert.equal((await call('b',{action:'join',name:'Bea',code:c.code})).status,400);sqlite.exec('UPDATE spaces SET invite_expires = 0');assert.equal((await call('b',{action:'join',name:'Bea',code:fresh.code})).status,400);});
test('messages sync between partners, deduplicate retries, and stay out of other spaces',async()=>{const {call,paired}=fixture();await paired();const id=crypto.randomUUID();await call('a',{action:'message',id,body:'Hello ♡'});await call('a',{action:'message',id,body:'Hello ♡'});const b=await call('b');assert.equal(b.messages.length,1);assert.equal(b.messages[0].body,'Hello ♡');await call('c',{action:'create',name:'Cam'});assert.equal((await call('c')).messages.length,0);assert.equal((await call('d',{action:'message',id:crypto.randomUUID(),body:'No access'})).status,403);});
test('mood, bedtime and heartbeat are separate from device inactivity',async()=>{const {call,paired}=fixture();await paired();await call('a',{action:'checkin',mood:'tired',status:'sleeping'});await call('a',{action:'heartbeat'});const b=await call('b');assert.equal(b.partner.status,'sleeping');assert.equal(b.partner.mood,'tired');assert.ok(b.partner.last_seen);assert.equal((await call('a',{action:'checkin',mood:'invalid'})).status,400);});
test('chat polls skip history only when the current space revision matches',async()=>{
  const {call,paired,env,sqlite}=fixture();
  await paired();
  const first=await call('b');
  const poll=async(version,uid='b')=>{
    const response=await handleAmie(new Request(`https://amie.test/api/amie?messageVersion=${encodeURIComponent(version)}`),env,uid);
    assert.equal(response.status,200);
    return response.json();
  };
  await call('a',{action:'checkin',status:'busy'});
  const unchanged=await poll(first.messageVersion);
  assert.equal(unchanged.messages,null);
  assert.equal(unchanged.partner.status,'busy');
  const id=crypto.randomUUID();
  await call('a',{action:'message',id,body:'A new message'});
  const changed=await poll(first.messageVersion);
  assert.deepEqual(changed.messages.map(message=>message.id),[id]);
  await call('a',{action:'message',id,body:'A retry'});
  assert.equal((await poll(changed.messageVersion)).messages,null);
  sqlite.prepare('UPDATE messages SET body = ?, created_at = ? WHERE id = ?').run('Edited',1,id);
  const edited=await poll(changed.messageVersion);
  assert.equal(edited.messages[0].body,'Edited');
  sqlite.prepare('DELETE FROM messages WHERE id = ?').run(id);
  assert.deepEqual((await poll(edited.messageVersion)).messages,[]);
  await call('c',{action:'create',name:'Cam'});
  assert.deepEqual((await poll(first.messageVersion,'c')).messages,[]);
});
test('location validation and removal apply to the current user only',async()=>{const {call,paired}=fixture();await paired();assert.equal((await call('a',{action:'location',latitude:200,longitude:120,accuracy:5})).status,400);await call('a',{action:'location',latitude:14.6,longitude:121,accuracy:8});assert.equal((await call('b')).partner.latitude,14.6);await call('a',{action:'stop-location'});const b=await call('b');assert.equal(b.partner.latitude,null);assert.equal(b.partner.location_at,null);});
test('anniversary rejects future and impossible dates',async()=>{const {call,paired}=fixture();await paired();assert.equal((await call('a',{action:'anniversary',date:'2099-01-01'})).status,400);assert.equal((await call('a',{action:'anniversary',date:'2025-02-30'})).status,400);assert.equal((await call('a',{action:'anniversary',date:'2025-02-14'})).status,200);assert.equal((await call('b')).space.anniversary,'2025-02-14');});
test('photo uploads enforce type and photo retrieval enforces space membership',async()=>{const {call,paired,env}=fixture();await paired();const form=new FormData();form.set('photo',new Blob([new Uint8Array([255,216,255,224,1,2,3])],{type:'image/jpeg'}),'photo.jpg');form.set('caption','Our moment');const upload=await handleAmie(new Request('https://amie.test/api/amie',{method:'POST',body:form}),env,'a');assert.equal(upload.status,200);const {id}=await upload.json();assert.equal((await getPhoto(env,'b',id)).status,200);await call('c',{action:'create',name:'Cam'});assert.equal((await getPhoto(env,'c',id)).status,404);assert.equal((await getPhoto(env,null,id)).status,401);const invalid=new FormData();invalid.set('photo',new Blob(['<svg/>'],{type:'image/svg+xml'}),'bad.svg');assert.equal((await handleAmie(new Request('https://amie.test/api/amie',{method:'POST',body:invalid}),env,'a')).status,400);});

test('photo retries keep one chat item and one notification, including simultaneous attempts',async()=>{
  const {call,paired,env}=fixture();
  await paired();
  const id=crypto.randomUUID();
  const events=[];
  const send=(uid,byte)=>{
    const form=new FormData();
    form.set('id',id);
    form.set('photo',new Blob([new Uint8Array([255,216,255,224,byte])],{type:'image/jpeg'}),'photo.jpg');
    return handleAmie(new Request('https://amie.test/api/amie',{method:'POST',body:form}),env,uid,'Person',(...event)=>events.push(event));
  };
  const results=await Promise.all([send('a',1),send('a',1)]);
  assert.deepEqual(results.map(result=>result.status),[200,200]);
  assert.equal((await results[0].json()).id,id);
  assert.equal((await results[1].json()).id,id);
  assert.equal((await send('b',2)).status,409);
  const saved=await getPhoto(env,'b',id);
  assert.equal(new Uint8Array(await saved.arrayBuffer()).at(-1),1);
  assert.equal((await call('b')).messages.length,1);
  assert.deepEqual(events,[[id,'photo']]);
});

async function uploadAvatar(env,uid,bytes=new Uint8Array([255,216,255,224,1,2,3])){
  const form=new FormData();form.set('purpose','avatar');form.set('photo',new Blob([bytes],{type:'image/jpeg'}),'profile.jpg');
  form.set('member_id','b'); // Client-supplied owner fields must never choose the edited profile.
  return handleAmie(new Request('https://amie.test/api/amie',{method:'POST',body:form}),env,uid);
}
test('the calendar retrieves older photos within its time range and space',async()=>{
  const {call,paired,sqlite,env}=fixture();
  await paired();
  await call('c',{action:'create',name:'Other space'});
  const space=(await call('a')).space.id;
  const other=(await call('c')).space.id;
  const from=Date.UTC(2025,0,1), to=Date.UTC(2025,1,1);
  const insert=sqlite.prepare('INSERT INTO messages (id,space_id,sender_id,kind,body,created_at) VALUES (?,?,?,?,?,?)');
  for(const [id,owner,sender,kind,time] of [['first',space,'a','photo',from],['last',space,'b','photo',to-1],['next',space,'b','photo',to],['private',other,'c','photo',from],['text',space,'b','text',from]]) {
    insert.run(id,owner,sender,kind,'',time);
  }
  for(let i=0;i<200;i++)insert.run(`new-${i}`,space,'a','text','',to+i+1);
  assert.equal((await call('a')).messages.some(message=>message.id==='first'),false);
  const request=new Request(`https://amie.test/api/amie?momentsFrom=${from}&momentsTo=${to}`);
  assert.equal((await handleAmie(request,env,null)).status,401);
  assert.deepEqual((await (await handleAmie(request,env,'b')).json()).photos.map(photo=>photo.id),['last','first']);
  assert.deepEqual((await (await handleAmie(request,env,'c')).json()).photos.map(photo=>photo.id),['private']);
  assert.equal((await handleAmie(new Request(`https://amie.test/api/amie?momentsFrom=${from}&momentsTo=${to+32*86400000}`),env,'b')).status,400);
});
test('profile photos work before pairing and are private to their owner and partner',async()=>{
  const {call,env}=fixture();
  assert.equal((await uploadAvatar(env,'a')).status,200);
  const a=await call('a');assert.ok(a.me.avatar_version);assert.equal(a.messages.length,0);
  assert.equal((await getAvatar(env,'a','a')).status,200);
  assert.equal((await getAvatar(env,null,'a')).status,401);
  await call('c');assert.equal((await getAvatar(env,'c','a')).status,404);
  const created=await call('a',{action:'create',name:'Alex'});
  await call('b',{action:'join',name:'Bea',code:created.code});
  assert.equal((await getAvatar(env,'b','a')).status,200);
  assert.equal((await call('b')).me.avatar_version,null);
  assert.equal((await call('b')).partner.avatar_version,a.me.avatar_version);
});
test('replacing and removing a profile photo affect only the signed-in person',async()=>{
  const {call,paired,env}=fixture();await paired();
  await uploadAvatar(env,'a');await uploadAvatar(env,'b');
  const a=(await call('a')).me;const b=(await call('b')).me;
  assert.equal((await uploadAvatar(env,'a',new TextEncoder().encode('<svg/>'))).status,400);
  assert.equal((await call('a')).me.avatar_version,a.avatar_version);
  await uploadAvatar(env,'a');const replacement=(await call('a')).me.avatar_version;
  assert.notEqual(replacement,a.avatar_version);
  assert.equal(await env.BUCKET.get(`avatars/a/${a.avatar_version}`),null);
  assert.equal((await call('a',{action:'remove-avatar',member_id:'b'})).status,200);
  assert.equal((await call('a')).me.avatar_version,null);
  assert.equal(await env.BUCKET.get(`avatars/a/${replacement}`),null);
  assert.equal((await getAvatar(env,'a','a')).status,404);
  assert.equal((await getAvatar(env,'a','b')).status,200);
  assert.equal((await call('b')).me.avatar_version,b.avatar_version);
});

test('notification events follow persisted messages and ignore duplicate sends and profile changes',async()=>{
  const {paired,env}=fixture();await paired();const events=[];const callback=(id,kind)=>events.push({id,kind});
  const id=crypto.randomUUID();const request=()=>new Request('https://amie.test/api/amie',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'message',id,body:'Private chat text'})});
  await handleAmie(request(),env,'a','A',callback);await handleAmie(request(),env,'a','A',callback);
  assert.deepEqual(events,[{id,kind:'message'}]);
  const form=new FormData();form.set('photo',new Blob([new Uint8Array([255,216,255,224,1,2,3])],{type:'image/jpeg'}),'photo.jpg');
  assert.equal((await handleAmie(new Request('https://amie.test/api/amie',{method:'POST',body:form}),env,'a','A',callback)).status,200);
  assert.equal(events[1].kind,'photo');
});
