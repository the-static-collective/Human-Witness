/** Independent verifier for the simulated MAXHINAL-13 signed route.
 * The returned result NEVER attests to live hosted-project calls or independently rehashes
 * the unavailable source bytes; that observation was made by the local witness runner.
 */
import { NODE_DEFINITIONS } from '../src/nodes.ts';
import { publicKeyFingerprint,verifyCrossingEnvelope,verifyReceipt } from '../src/relatte_v0.ts';
import type { LocalEvidence } from './mx13-route.ts';

const PARTICULAR='sha256:af82b9a3b2d5eeb1ce3d58038b3415ca62f0815bd6f0a04662ec8cf5b773d171';
export interface VerificationReport {ok:boolean;verifiedCrossings:number;verifiedHolds:number;verifiedDispositions:number;errors:string[]}

export async function verifyEvidence(evidence:LocalEvidence):Promise<VerificationReport>{
  const errors:string[]=[];
  const refuse=(m:string)=>errors.push(m);
  let crossings=0,holds=0,dispositions=0;
  try{
    if(evidence?.schema!=='maxhinal13.local-simulation/v0'||evidence.hosted_project_calls_observed!==false)
      refuse('INVALID_EVIDENCE_PROVENANCE');
    if(evidence.particular?.address!==PARTICULAR||evidence.particular?.byte_length!==670478 ||
      evidence.particular?.observed_name!=='1000018575.png'||evidence.particular?.detected_media_type!=='image/jpeg')
      refuse('SOURCE_IDENTITY_DRIFT');
    if(evidence.cross_host_boundaries!==12||evidence.route?.length!==13||evidence.laws_preserved!==true)
      refuse('ROUTE_SHAPE_DRIFT');
    if(JSON.stringify(evidence).match(/"(?:private_jwk|private_key|raw_operator_capability|service_role|supabase_db_url|payload_b64)"\s*:/i))
      refuse('SECRET_OR_PAYLOAD_LEAK');
    const fingerprints=new Set<string>();
    let prior:any=null;
    for(let i=0;i<13;i++){
      const step=evidence.route?.[i];const expected=NODE_DEFINITIONS[i];
      if(!step||!expected){refuse('MISSING_ROUTE_HOP');break;}
      const x=step.signed_crossing,h=step.signed_hold,d=step.signed_disposition;
      if(step.node_id!==expected.id||step.host!==expected.host||step.crossing_id!==x?.crossing_id||
        step.hold_receipt_id!==h?.receipt_id||step.disposition_receipt_id!==d?.receipt_id)
        refuse(`HOP_${i}_IDENTITY_MISMATCH`);
      if((await verifyCrossingEnvelope(x))){crossings++;}else refuse(`HOP_${i}_CROSSING_SIGNATURE`);
      if((await verifyReceipt(h))){holds++;}else refuse(`HOP_${i}_HOLD_SIGNATURE`);
      if((await verifyReceipt(d))){dispositions++;}else refuse(`HOP_${i}_DISPOSITION_SIGNATURE`);
      if(x?.audience_policy?.destination!==expected.id ||
        x?.payload_refs?.[0]?.address!==PARTICULAR||x?.payload_refs?.[0]?.byte_length!==670478||
        x?.extensions?.mx13?.route_index!==i)
        refuse(`HOP_${i}_ROUTE_OR_PAYLOAD`);
      if(h?.world_id!==expected.id||h?.crossing_id!==x?.crossing_id||h?.kind!=='MX13_HOLD'||
        h?.semantic_effect!=='none'||h?.extensions?.mx13?.mandatory_hold!==true||
        h?.extensions?.mx13?.destination_disposition!==null)
        refuse(`HOP_${i}_INVALID_HOLD`);
      if(d?.world_id!==expected.id||d?.crossing_id!==x?.crossing_id||d?.pre_state_ref!==h?.receipt_id||
        d?.kind!==`MX13_${step.disposition}`||d?.extensions?.mx13?.stage!=='LOCAL_DISPOSITION')
        refuse(`HOP_${i}_DISPOSITION_COLLAPSE`);
      const signedFingerprint=publicKeyFingerprint(d?.signing?.public_key);
      if(step.signer_fingerprint!==signedFingerprint||
        publicKeyFingerprint(h?.signing?.public_key)!==signedFingerprint)
        refuse(`HOP_${i}_MIXED_DESTINATION_AUTHORITY`);
      fingerprints.add(signedFingerprint);
      if(i===0){
        if(x?.source_world!==expected.id||x?.parents?.length!==0)refuse('INVALID_BOOTSTRAP_SEED');
      }else if(x?.source_world!==NODE_DEFINITIONS[i-1].id||
          !x?.parents?.includes(prior?.signed_disposition?.receipt_id)||
          publicKeyFingerprint(x?.signing?.public_key)!==prior?.signer_fingerprint)
        refuse(`HOP_${i}_BROKEN_ANCESTRY`);
      if(step.hold_verified!==true||step.disposition_verified!==true||step.address_verified!==true)
        refuse(`HOP_${i}_EXECUTION_EVIDENCE_MISSING`);
      prior=step;
    }
    if(fingerprints.size!==13)refuse('DUPLICATE_LOGICAL_WORLD_IDENTITY');
    if(evidence.route?.[4]?.disposition!=='RETURN'||evidence.route?.[7]?.disposition!=='REFUSE'||
      evidence.route?.[10]?.disposition!=='FORWARD'||evidence.route?.[11]?.disposition!=='FORWARD')
      refuse('CONSTITUTION_RESTRICTION_LOST');
  }catch(error){refuse(`MALFORMED_EVIDENCE:${error instanceof Error?error.message:'unknown'}`);}
  return {ok:errors.length===0,verifiedCrossings:crossings,verifiedHolds:holds,verifiedDispositions:dispositions,errors};
}

/** Reverify the archived signed trace without needing the source bytes.
 * This establishes signatures/ancestry, NOT an independent exact-byte rehash.
 */
export async function verifyEvidenceFile(path:string|URL):Promise<VerificationReport & {liveHostCrossingProven:false}>{
  const {readFile}=await import('node:fs/promises');
  const value=JSON.parse(await readFile(path,'utf8'));
  const report=await verifyEvidence(value);
  const limits=value?.claim_limits;
  if(limits?.live_cross_project_http_proven!==false||
     limits?.physically_isolated_nodes_proven!==false||
     limits?.raw_bytes_vendored_in_repository!==false||
     limits?.actual_supabardo_live_membrane_proven!==false||
     limits?.external_original_required_for_byte_rehash!==true)
    report.errors.push('CLAIM_LIMITS_PROMOTED');
  report.ok=report.errors.length===0;
  return {...report,liveHostCrossingProven:false};
}
