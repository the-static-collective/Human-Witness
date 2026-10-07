import {invitationTestPath,invitationSkipReason} from './fixtures/invitation-test-path.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';


test('MX13-001 simulated two-host route contains thirteen HOLDs, twelve host changes, and exact original bytes',{skip:invitationSkipReason},async()=>{
 const {runMx13001Local}=await import('../scripts/mx13-route.ts');
 const bytes=new Uint8Array(await readFile(invitationTestPath));
 const evidence=await runMx13001Local(bytes);
 assert.equal(evidence.schema,'maxhinal13.local-simulation/v0');
 assert.equal(evidence.hosted_project_calls_observed,false);
 assert.equal(evidence.particular.address,'sha256:af82b9a3b2d5eeb1ce3d58038b3415ca62f0815bd6f0a04662ec8cf5b773d171');
 assert.equal(evidence.particular.byte_length,670478);
 assert.equal(evidence.route.length,13);
 assert.equal(evidence.route.filter((x:any)=>x.hold_verified).length,13);
 assert.equal(evidence.route.filter((x:any)=>x.disposition_verified).length,13);
 assert.equal(evidence.route.filter((x:any)=>x.address_verified).length,13);
 assert.equal(new Set(evidence.route.map((x:any)=>x.signer_fingerprint)).size,13);
 assert.equal(evidence.cross_host_boundaries,12);
 assert.equal(evidence.laws_preserved,true);
});
test('MX13-001 retains RETURN and REFUSE as separate local semantics even when forwarding',{skip:invitationSkipReason},async()=>{
 const {runMx13001Local}=await import('../scripts/mx13-route.ts');
 const bytes=new Uint8Array(await readFile(invitationTestPath));
 const e=await runMx13001Local(bytes);
 assert.equal(e.route[4].disposition,'RETURN');
 assert.equal(e.route[7].disposition,'REFUSE');
 assert.equal(e.route[11].disposition,'FORWARD');
 assert.equal(e.route[12].disposition,'ADMIT');
 assert.equal(e.route[0].disposition,'FORWARD');
});
test('route host-boundary count is computed from actual host sequence, not hardcoded',async()=>{
 const {countHostBoundaries}=await import('../scripts/mx13-route.ts');
 assert.equal(countHostBoundaries(['WITNESS','WITNESS','pantry-gate','pantry-gate','WITNESS']),2);
 assert.equal(countHostBoundaries(['WITNESS','WITNESS']),0);
});
