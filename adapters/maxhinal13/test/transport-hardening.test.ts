import test from 'node:test';
import assert from 'node:assert/strict';
import {PostgresMeshStore} from '../src/store.ts';
import {pumpOne} from '../src/worker.ts';
import {pairFixture} from './fixtures/pair.ts';
test('returned HOLD and disposition are durable in sender custody before COMPLETE',async()=>{
 const f=await pairFixture();
 const result=await pumpOne(f.a,{store:f.stores[0],fetch:f.network});assert.equal(result.ok,true);
 const trace=await f.stores[0].readTrace(f.a,f.envelope.crossing_id);
 assert.ok(trace.signed_hold);assert.ok(trace.signed_disposition);
 assert.equal(trace.signed_disposition.pre_state_ref,trace.signed_hold.receipt_id);
 assert.equal((await f.stores[0].claimOutbox(f.a,f.envelope.crossing_id)).state,'COMPLETE');
});
test('a lost reply preserves pending state and retry obtains original destination receipts',async()=>{
 const f=await pairFixture();let lost:any;
 const first=await pumpOne(f.a,{store:f.stores[0],fetch:async(u,o)=>{
  lost=await (await f.network(u,o)).json();throw Error('HOST_UNREACHABLE');
 }});
 assert.equal(first.ok,false);assert.equal((await f.stores[0].claimOutbox(f.a,f.envelope.crossing_id)).state,'PENDING');
 assert.equal((await pumpOne(f.a,{store:f.stores[0],fetch:f.network})).ok,true);
 const trace=await f.stores[0].readTrace(f.a,f.envelope.crossing_id);
 assert.equal(trace.signed_hold.receipt_id,lost.hold_receipt.receipt_id);
 assert.equal(trace.signed_disposition.receipt_id,lost.disposition_receipt.receipt_id);
 assert.equal(trace.attempts[0].ok,false);assert.equal(trace.attempts[1].ok,true);
});
test('Postgres access cannot reach another host node schema or signing key',async()=>{
 const sql={unsafe:async()=>{throw Error('foreign schema reached SQL')}};
 const store=new PostgresMeshStore(sql,'WITNESS',['mx13:01-witness']);
 for(const op of [()=>store.getReceipt('mx13:02-gate','x'),()=>store.loadNodeKey('mx13:02-gate'),()=>store.getPayload('mx13:02-gate','x')])
  await assert.rejects(op,/NODE_KEY_SCOPE_VIOLATION/);
});
