import test from 'node:test';
import assert from 'node:assert/strict';
import { FakeMeshStore } from '../src/store.ts';
import { NODE_DEFINITIONS } from '../src/nodes.ts';

test('status returns only bounded public operations and unresolved HOLD stays unresolved', async () => {
  const { readHostStatus }=await import('../src/status.ts');
  const store=new FakeMeshStore();
  store.hostId='WITNESS';
  store.localNodeIds=NODE_DEFINITIONS.filter(n=>n.host==='WITNESS').map(n=>n.id);
  store.inbound.set('mx13:01-witness\0'+'relatte-crossing-v0:'+'1'.repeat(64),{
    crossingId:'relatte-crossing-v0:'+'1'.repeat(64),sourceNodeId:'mx13:01-witness',state:'HOLD',
    holdReceiptId:'relatte-receipt-v0:'+'2'.repeat(64),dispositionReceiptId:null,envelope:{},
  });
  const status=await readHostStatus(store);
  assert.equal(status.hostId,'WITNESS');
  assert.equal(status.localNodeIds.length,7);
  assert.equal(status.unresolvedHoldCount,1);
  const json=JSON.stringify(status).toLowerCase();
  for (const leak of ['private_jwk','service_role','supabase_db_url','operator_capability','payload_b64','privatekey']) {
    assert.equal(json.includes(leak),false,`leaked ${leak}`);
  }
});

test('safe operator status projects whitelisted fields and refuses foreign node identity',async()=>{
 const {sanitizePublicStatus,readHostStatus}=await import('../src/status.ts');
 const store=new FakeMeshStore();store.hostId='WITNESS';store.localNodeIds=['mx13:01-witness'];
 const input={...await readHostStatus(store),private_jwk:{d:'SECRET'},operator_capability:'SECRET',payload_b64:'SECRET'};
 assert.equal(JSON.stringify(sanitizePublicStatus(input,'WITNESS')).includes('SECRET'),false);
 input.localNodeIds=['mx13:02-gate'];assert.throws(()=>sanitizePublicStatus(input,'WITNESS'),/INVALID_PUBLIC_STATUS/);
});
