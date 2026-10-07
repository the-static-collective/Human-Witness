import test from 'node:test';
import assert from 'node:assert/strict';

async function loadStore() {
  try { return await import('../src/store.ts'); }
  catch (error) { assert.fail(`store module unavailable: ${error}`); }
}

const node='mx13:01-witness';
const crossing='relatte-crossing-v0:'+'a'.repeat(64);
const hold={receipt_id:'relatte-receipt-v0:'+'b'.repeat(64),kind:'MX13_HOLD'};
const disposition={receipt_id:'relatte-receipt-v0:'+'c'.repeat(64),kind:'MX13_FORWARD'};
const payload={address:'sha256:'+'d'.repeat(64),bytes:new Uint8Array([1,2,3]),byteLength:3,observedName:'x.bin',detectedMediaType:'application/octet-stream'};

test('beginHold is idempotent and preserves the first HOLD receipt', async () => {
  const {FakeMeshStore}=await loadStore();
  const store=new FakeMeshStore();
  const first=await store.beginHold(node,{crossingId:crossing,sourceNodeId:'mx13:13-misspeldd-maxhinal',envelope:{crossing_id:crossing},payload,holdReceipt:hold});
  const second=await store.beginHold(node,{crossingId:crossing,sourceNodeId:'mx13:13-misspeldd-maxhinal',envelope:{crossing_id:crossing},payload,holdReceipt:{...hold,receipt_id:'relatte-receipt-v0:'+'e'.repeat(64)}});
  assert.equal(first.created,true);
  assert.equal(second.created,false);
  assert.equal(second.inbound.holdReceiptId,hold.receipt_id);
});

test('terminal disposition cannot be overwritten', async () => {
  const {FakeMeshStore}=await loadStore();
  const store=new FakeMeshStore();
  await store.beginHold(node,{crossingId:crossing,sourceNodeId:'mx13:13-misspeldd-maxhinal',envelope:{crossing_id:crossing},payload,holdReceipt:hold});
  await store.persistDisposition(node,crossing,disposition,[],[]);
  await assert.rejects(()=>store.persistDisposition(node,crossing,{...disposition,receipt_id:'relatte-receipt-v0:'+'f'.repeat(64)},[],[]),/TERMINAL_DISPOSITION_IMMUTABLE/);
});

test('payload address cannot alias different bytes', async () => {
  const {FakeMeshStore}=await loadStore();
  const store=new FakeMeshStore();
  await store.putPayload(node,payload);
  await store.putPayload(node,payload);
  await assert.rejects(()=>store.putPayload(node,{...payload,bytes:new Uint8Array([9,9,9])}),/PAYLOAD_ADDRESS_COLLISION/);
});

test('failed outbox attempt remains pending and increments attempts', async () => {
  const {FakeMeshStore}=await loadStore();
  const store=new FakeMeshStore();
  await store.enqueueOutbox(node,{crossingId:crossing,destinationNodeId:'mx13:02-gate',envelope:{crossing_id:crossing},payloadAddress:payload.address});
  await store.recordAttempt(node,crossing,{ok:false,error:'destination unavailable'});
  const item=await store.claimOutbox(node,crossing);
  assert.equal(item.state,'PENDING');
  assert.equal(item.attempts,1);
  assert.equal(item.lastError,'destination unavailable');
  assert.equal(item.attemptHistory.length,1);
  assert.equal(item.attemptHistory[0].ok,false);
});
