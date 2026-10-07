import {invitationTestPath,invitationSkipReason} from './fixtures/invitation-test-path.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {generateP256KeyPair,publicKeyFingerprint,verifyCrossingEnvelope} from '../src/relatte_v0.ts';
import {FakeMeshStore} from '../src/store.ts';


test('seed queues exact INVITATION for signed 01→01 HTTP ingress without local admission',{skip:invitationSkipReason},async()=>{
  const {seedMx13001}=await import('../src/seed.ts');
  const b=new Uint8Array(await readFile(invitationTestPath));
  const store=new FakeMeshStore();const k=await generateP256KeyPair();
  store.keys.set('mx13:01-witness',{nodeId:'mx13:01-witness',keyVersion:1,publicJwk:k.publicKeyJwk,
    privateJwk:await crypto.subtle.exportKey('jwk',k.privateKey),fingerprint:publicKeyFingerprint(k.publicKeyJwk)});
  const result=await seedMx13001(store,b);
  assert.equal(await verifyCrossingEnvelope(result.envelope),true);
  assert.equal(result.destinationNodeId,'mx13:01-witness');
  assert.equal(result.envelope.audience_policy.destination,'mx13:01-witness');
  assert.deepEqual(result.envelope.parents,[]);
  assert.equal(result.state,'PENDING');
  assert.equal((await store.getPayload('mx13:01-witness',result.payloadAddress))?.byteLength,670478);
  assert.equal(await store.getInbound('mx13:01-witness',result.crossingId),null);
});
test('seed refuses changed or oversized particulars before any custody write',{skip:invitationSkipReason},async()=>{
  const {seedMx13001}=await import('../src/seed.ts');
  const b=new Uint8Array(await readFile(invitationTestPath));b[0]^=0x01;
  const store=new FakeMeshStore();
  await assert.rejects(seedMx13001(store,b),/INVITATION_PARTICULAR_MISMATCH/);
  assert.equal(store.payloads.size,0);
});
