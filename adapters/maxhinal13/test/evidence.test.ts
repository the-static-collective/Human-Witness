import {invitationTestPath,invitationSkipReason} from './fixtures/invitation-test-path.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runMx13001Local} from '../scripts/mx13-route.ts';

test('independent evidence verifier checks all thirteen historical signatures and route ancestry',{skip:invitationSkipReason},async()=>{
  const {verifyEvidence}=await import('../scripts/verify-evidence.ts');
  const evidence=await runMx13001Local(new Uint8Array(await readFile(invitationTestPath)));
  const result=await verifyEvidence(evidence);
  assert.equal(result.ok,true);
  assert.equal(result.verifiedCrossings,13);
  assert.equal(result.verifiedHolds,13);
  assert.equal(result.verifiedDispositions,13);
});
test('independent evidence verifier rejects signature tamper and false hosted proof',{skip:invitationSkipReason},async()=>{
  const {verifyEvidence}=await import('../scripts/verify-evidence.ts');
  const evidence:any=await runMx13001Local(new Uint8Array(await readFile(invitationTestPath)));
  evidence.route[3].signed_crossing.declared_kind='FABRICATED_EFFECT';
  assert.equal((await verifyEvidence(evidence)).ok,false);
  const other:any=await runMx13001Local(new Uint8Array(await readFile(invitationTestPath)));
  other.hosted_project_calls_observed=true;
  assert.equal((await verifyEvidence(other)).ok,false);
});
