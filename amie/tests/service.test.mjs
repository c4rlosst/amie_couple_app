import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { handleAmie, getPhoto } from '../lib/service.ts';

// Real SQLite, with only the D1 transport adapted for a fast local integration test.
function fixture() {
  const sqlite=new DatabaseSync(':memory:');
  sqlite.exec(readFileSync(new URL('../drizzle/0000_parched_annihilus.sql',import.meta.url),'utf8'));
  const wrap=(sql,args=[])=>({
    bind(...values){return wrap(sql,values);},
    async first(){return sqlite.prepare(sql).get(...args)||null;},
    async all(){return {results:sqlite.prepare(sql).all(...args)};},
    async run(){const r=sqlite.prepare(sql).run(...args);return {meta:{changes:Number(r.changes)}};},
  });
  const objects=new Map();
  const env={DB:{prepare:wrap,async batch(statements){sqlite.exec('BEGIN');try {const results=[];for(const s of statements)results.push(await s.run());sqlite.exec('COMMIT');return results;}catch(e){sqlite.exec('ROLLBACK');throw e;}}},BUCKET:{async put(k,v){objects.set(k,v);},async get(k){return objects.has(k)?{body:objects.get(k)}:null;},async delete(k){objects.delete(k);}}};
  async function call(uid,body,headers={}) {const request=new Request('https://amie.test/api/amie',body?{method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(body)}:{});const res=await handleAmie(request,env,uid,'Person');return {status:res.status,...await res.json()};}
  async function paired() {const created=await call('a',{action:'create',name:'Alex'});await call('b',{action:'join',name:'Bea',code:created.code});return created;}
  return {call,paired,env,sqlite};
}
test('authentication and cross-origin writes are rejected',async()=>{const {call}=fixture();assert.equal((await call(null)).status,401);assert.equal((await call('a',{action:'create',name:'Alex'},{Origin:'https://other.test'})).status,403);});
test('pairing is one-use, limited to two, and invite hashes never leak',async()=>{const {call}=fixture();const created=await call('a',{action:'create',name:'Alex'});assert.equal(created.status,200);assert.match(created.code,/^[A-F0-9]{20}$/);assert.equal((await call('b',{action:'join',name:'Bea',code:created.code})).status,200);assert.equal((await call('c',{action:'join',name:'Cam',code:created.code})).status,400);const a=await call('a');assert.equal(a.partner.name,'Bea');assert.equal(a.space.invite_hash,undefined);assert.equal((await call('b')).partner.name,'Alex');assert.equal((await call('a',{action:'create',name:'Other'})).status,400);});
test('expired and replaced invitation codes are rejected',async()=>{const {call,sqlite}=fixture();const c=await call('a',{action:'create',name:'Alex'});const fresh=await call('a',{action:'invite'});assert.equal((await call('b',{action:'join',name:'Bea',code:c.code})).status,400);sqlite.exec('UPDATE spaces SET invite_expires = 0');assert.equal((await call('b',{action:'join',name:'Bea',code:fresh.code})).status,400);});
test('messages sync between partners, deduplicate retries, and stay out of other spaces',async()=>{const {call,paired}=fixture();await paired();const id=crypto.randomUUID();await call('a',{action:'message',id,body:'Hello ♡'});await call('a',{action:'message',id,body:'Hello ♡'});const b=await call('b');assert.equal(b.messages.length,1);assert.equal(b.messages[0].body,'Hello ♡');await call('c',{action:'create',name:'Cam'});assert.equal((await call('c')).messages.length,0);assert.equal((await call('d',{action:'message',id:crypto.randomUUID(),body:'No access'})).status,403);});
test('mood, bedtime and heartbeat are separate from device inactivity',async()=>{const {call,paired}=fixture();await paired();await call('a',{action:'checkin',mood:'tired',status:'sleeping'});await call('a',{action:'heartbeat'});const b=await call('b');assert.equal(b.partner.status,'sleeping');assert.equal(b.partner.mood,'tired');assert.ok(b.partner.last_seen);assert.equal((await call('a',{action:'checkin',mood:'invalid'})).status,400);});
test('location validation and removal apply to the current user only',async()=>{const {call,paired}=fixture();await paired();assert.equal((await call('a',{action:'location',latitude:200,longitude:120,accuracy:5})).status,400);await call('a',{action:'location',latitude:14.6,longitude:121,accuracy:8});assert.equal((await call('b')).partner.latitude,14.6);await call('a',{action:'stop-location'});const b=await call('b');assert.equal(b.partner.latitude,null);assert.equal(b.partner.location_at,null);});
test('anniversary rejects future and impossible dates',async()=>{const {call,paired}=fixture();await paired();assert.equal((await call('a',{action:'anniversary',date:'2099-01-01'})).status,400);assert.equal((await call('a',{action:'anniversary',date:'2025-02-30'})).status,400);assert.equal((await call('a',{action:'anniversary',date:'2025-02-14'})).status,200);assert.equal((await call('b')).space.anniversary,'2025-02-14');});
test('photo uploads enforce type and photo retrieval enforces space membership',async()=>{const {call,paired,env}=fixture();await paired();const form=new FormData();form.set('photo',new Blob([new Uint8Array([255,216,255,224,1,2,3])],{type:'image/jpeg'}),'photo.jpg');form.set('caption','Our moment');const upload=await handleAmie(new Request('https://amie.test/api/amie',{method:'POST',body:form}),env,'a');assert.equal(upload.status,200);const {id}=await upload.json();assert.equal((await getPhoto(env,'b',id)).status,200);await call('c',{action:'create',name:'Cam'});assert.equal((await getPhoto(env,'c',id)).status,404);assert.equal((await getPhoto(env,null,id)).status,401);const invalid=new FormData();invalid.set('photo',new Blob(['<svg/>'],{type:'image/svg+xml'}),'bad.svg');assert.equal((await handleAmie(new Request('https://amie.test/api/amie',{method:'POST',body:invalid}),env,'a')).status,400);});
