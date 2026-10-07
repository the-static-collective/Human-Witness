/** Run against the exact user-supplied INVITATION bytes; never calls hosted Supabase. */
import { readFile,writeFile,mkdir } from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import { runMx13001Local } from './mx13-route.ts';
import {verifyEvidence} from './verify-evidence.ts';

const path=process.argv[2];
if(!path){console.error('Usage: node --experimental-strip-types scripts/run-mx13-local.ts <INVITATION-byte-file> [evidence-output]');process.exit(2);}
const output=resolve(process.argv[3]??'evidence/mx13-001.local.json');
const bytes=new Uint8Array(await readFile(path));
const evidence=await runMx13001Local(bytes);
const result=await verifyEvidence(evidence);
if(!result.ok)throw Error(`PROOF_VERIFICATION_FAILED:${result.errors.join(',')}`);
await mkdir(dirname(output),{recursive:true});
await writeFile(output,JSON.stringify({...evidence,verification:result,claim_limits:{
  live_cross_project_http_proven:false,
  physically_isolated_nodes_proven:false,
  raw_bytes_vendored_in_repository:false,
  actual_supabardo_live_membrane_proven:false,
  external_original_required_for_byte_rehash:true,
}},null,2)+'\n');
console.log(JSON.stringify({out:output,signatures:result.verifiedCrossings+result.verifiedHolds+result.verifiedDispositions,
  simulated_hops:evidence.route.length,hosted_calls:false}));
