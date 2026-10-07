import test from 'node:test';
import assert from 'node:assert/strict';

test('archived MX13-001 specimen independently verifies 39 signatures and explicitly denies live HTTP proof',async()=>{
  const {verifyEvidenceFile}=await import('../scripts/verify-evidence.ts');
  const report=await verifyEvidenceFile(new URL('../evidence/mx13-001.local.json',import.meta.url));
  assert.equal(report.ok,true);
  assert.equal(report.verifiedCrossings,13);
  assert.equal(report.verifiedHolds,13);
  assert.equal(report.verifiedDispositions,13);
  assert.equal(report.liveHostCrossingProven,false);
});
