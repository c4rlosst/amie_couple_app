import test from 'node:test';
import assert from 'node:assert/strict';
import {handleBackend} from '../backend/index.ts';

test('standalone API accepts Pages preflight without allowing arbitrary origins',async()=>{
  const allowed=await handleBackend(new Request('https://amie-api.test/api/amie',{method:'OPTIONS',headers:{Origin:'https://c4rlosst.github.io','Access-Control-Request-Headers':'authorization,content-type'}}),{});
  assert.equal(allowed.status,204);assert.equal(allowed.headers.get('access-control-allow-origin'),'https://c4rlosst.github.io');
  const denied=await handleBackend(new Request('https://amie-api.test/api/amie',{method:'OPTIONS',headers:{Origin:'https://untrusted.test'}}),{});
  assert.equal(denied.status,403);assert.equal(denied.headers.get('access-control-allow-origin'),null);
});
test('shared-data and photo routes reject anonymous and spoofed platform identities',async()=>{
  for(const path of ['/api/amie','/api/photos/11111111-1111-4111-8111-111111111111']){
    const result=await handleBackend(new Request(`https://amie-api.test${path}`,{headers:{'oai-authenticated-user-id':'fake-owner'}}),{DB:{}});
    assert.equal(result.status,401);
  }
});
test('standalone API fails safely when storage is absent and rejects unknown methods',async()=>{
  assert.equal((await handleBackend(new Request('https://amie-api.test/api/amie'),{})).status,503);
  assert.equal((await handleBackend(new Request('https://amie-api.test/api/auth',{method:'DELETE'}),{})).status,405);
  assert.equal((await handleBackend(new Request('https://amie-api.test/no-such-route'),{})).status,404);
});
test('authentication requests have a body-size limit even without Content-Length',async()=>{
  const result=await handleBackend(new Request('https://amie-api.test/api/auth',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:'x'.repeat(17000)})}),{});
  assert.equal(result.status,413);
});
