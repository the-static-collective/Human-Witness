import {invitationTestPath,invitationSkipReason} from './fixtures/invitation-test-path.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Buffer} from 'node:buffer';
import {FakeMeshStore} from '../src/store.ts';
import {generateP256KeyPair,publicKeyFingerprint} from '../src/relatte_v0.ts';

test('operator worker seed is limited to WITNESS, signs a self-crossing, and does not admit',{skip:invitationSkipReason},async()=>{
  const {runWorkerCommand}=await import('../src/commands.ts');
  const store=new FakeMeshStore();
  const key=await generateP256KeyPair();
  store.keys.set('mx13:01-witness',{nodeId:'mx13:01-witness',keyVersion:1,
    publicJwk:key.publicKeyJwk,privateJwk:await crypto.subtle.exportKey('jwk',key.privateKey),fingerprint:publicKeyFingerprint(key.publicKeyJwk)});
  const cmd={schema:'maxhinal13.worker/v0',action:'seed',payload_b64:Buffer.from(await readFile(invitationTestPath)).toString('base64')};
  await assert.rejects(runWorkerCommand(store,'pantry-gate',cmd,fetch),/SOURCE_NODE_NOT_ON_HOST/);
  const result:any=await runWorkerCommand(store,'WITNESS',cmd,fetch);
  assert.equal(result.action,'seed');
  assert.equal(result.destination_node_id,'mx13:01-witness');
  assert.equal(result.outbox_state,'PENDING');
  assert.equal((await store.claimOutbox('mx13:01-witness'))?.destinationNodeId,'mx13:01-witness');
  assert.equal(store.inbound.size,0);
});

test('operator worker refuses to pump a node that belongs on the other Supabase host',async()=>{
  const {runWorkerCommand}=await import('../src/commands.ts');
  await assert.rejects(runWorkerCommand(new FakeMeshStore(),'WITNESS',{
    schema:'maxhinal13.worker/v0',action:'pump',source_node_id:'mx13:02-gate',
  },fetch),/SOURCE_NODE_NOT_ON_HOST/);
});

test('operator worker advance refuses off-route destinations',async()=>{
  const {runWorkerCommand}=await import('../src/commands.ts');
  await assert.rejects(runWorkerCommand(new FakeMeshStore(),'WITNESS',{
    schema:'maxhinal13.worker/v0',action:'advance',source_node_id:'mx13:01-witness',
    inbound_crossing_id:'relatte-crossing-v0:'+'1'.repeat(64),next_node_id:'mx13:03-dead-letter',
  },fetch),/ROUTE_NEXT_NODE_MISMATCH/);
});
