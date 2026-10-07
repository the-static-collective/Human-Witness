import test from 'node:test';
import assert from 'node:assert/strict';

test('http body reader rejects oversized requests before json parse',async()=>{
 const {readBoundedJson}=await import('../src/http.ts');
 const req=new Request('https://example.com',{method:'POST',body:JSON.stringify({bytes:'X'.repeat(50)})});
 await assert.rejects(()=>readBoundedJson(req,20),/HTTP_BODY_TOO_LARGE/);
});
test('http body reader rejects malformed json',async()=>{
 const {readBoundedJson}=await import('../src/http.ts');
 const req=new Request('https://example.com',{method:'POST',body:'{'});
 await assert.rejects(()=>readBoundedJson(req,1024),/INVALID_JSON_BODY/);
});
test('http body reader returns exact json',async()=>{
 const {readBoundedJson}=await import('../src/http.ts');
 const req=new Request('https://example.com',{method:'POST',body:JSON.stringify({schema:'maxhinal13.bootstrap/v0'})});
 assert.deepEqual(await readBoundedJson(req,1024),{schema:'maxhinal13.bootstrap/v0'});
});
