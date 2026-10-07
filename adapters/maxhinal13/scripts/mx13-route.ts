/**
 * Local two-fault-domain simulation of the approved MAXHINAL-13 route.
 * NOT A LIVE SUPABASE CROSSING; fake HTTP is used for every logical hop.
 */
import {Buffer} from 'node:buffer';
import {FakeMeshStore} from '../src/store.ts';
import {generateP256KeyPair,publicKeyFingerprint,sealCrossingEnvelope,sealReceipt,verifyCrossingEnvelope,verifyReceipt} from '../src/relatte_v0.ts';
import {sha256Address} from '../src/payload.ts';
import {NODE_DEFINITIONS,nodeDefinition} from '../src/nodes.ts';
import {handleIngress} from '../src/ingress.ts';
import {enqueueForward,pumpOne,ROUTE} from '../src/worker.ts';
import {seedMx13001} from '../src/seed.ts';
import type {NodeId,P256KeyMaterial,ReceiptV0} from '../src/model.ts';
import type {PayloadRecord} from '../src/store.ts';

const EXPECTED_ADDRESS='sha256:af82b9a3b2d5eeb1ce3d58038b3415ca62f0815bd6f0a04662ec8cf5b773d171';
const EXPECTED_LENGTH=670478;
const REFS={WITNESS:'edxoiynjspjtxjauxhlz','pantry-gate':'kbhqacsdvjsstzyplqij'} as const;
export function countHostBoundaries(hosts:readonly string[]):number{
  return hosts.slice(1).reduce((total,host,index)=>total+(host!==hosts[index]?1:0),0);
}
const urlFor=(host:keyof typeof REFS)=>`https://${REFS[host]}.supabase.co/functions/v1/mx13-ingress`;
export interface LocalEvidence {
  schema:'maxhinal13.local-simulation/v0';
  hosted_project_calls_observed:false;
  particular:{address:string;byte_length:number;observed_name:string;detected_media_type:string};
  cross_host_boundaries:number;
  route:Array<{node_id:NodeId;host:string;crossing_id:string;hold_receipt_id:string;disposition_receipt_id:string;
    signer_fingerprint:string;disposition:string;hold_verified:boolean;disposition_verified:boolean;address_verified:boolean;
    signed_crossing:any;signed_hold:any;signed_disposition:any}>;
  laws_preserved:boolean;
}
export async function runMx13001Local(bytes:Uint8Array):Promise<LocalEvidence>{
  const address=await sha256Address(bytes);
  if(address!==EXPECTED_ADDRESS||bytes.length!==EXPECTED_LENGTH)throw new Error('INVITATION_PARTICULAR_MISMATCH');
  const hosts={WITNESS:new FakeMeshStore(),'pantry-gate':new FakeMeshStore()};
  const keys=new Map<NodeId,P256KeyMaterial>();
  for(const n of NODE_DEFINITIONS){
    const kp=await generateP256KeyPair();keys.set(n.id,kp);
    const privateJwk=await crypto.subtle.exportKey('jwk',kp.privateKey);
    const local=hosts[n.host];local.hostId=n.host;local.localNodeIds.push(n.id);
    local.keys.set(n.id,{nodeId:n.id,keyVersion:1,publicJwk:kp.publicKeyJwk,privateJwk,fingerprint:publicKeyFingerprint(kp.publicKeyJwk)});
  }
  for(const n of NODE_DEFINITIONS){
    const kp=keys.get(n.id)!;
    for(const host of Object.values(hosts)){
      host.peers.set(n.id,{nodeId:n.id,hostId:n.host,publicJwk:kp.publicKeyJwk,fingerprint:publicKeyFingerprint(kp.publicKeyJwk),ingressUrl:urlFor(n.host),active:true});
    }
  }
  const payload:PayloadRecord={address,bytes,byteLength:bytes.length,observedName:'1000018575.png',detectedMediaType:'image/jpeg'};
  const first=ROUTE[0],firstStore=hosts.WITNESS;
  const seeded=await seedMx13001(firstStore,bytes); // Signed 01→01 HTTP loopback; never direct admission.
  const network=async(url:string,opt:any)=>{
    const body=JSON.parse(opt.body);
    const destination=body.destination_node_id as NodeId;
    const target=nodeDefinition(destination);
    if(url!==urlFor(target.host))throw new Error('SIMULATED_WRONG_PROJECT_ENDPOINT');
    const response=await handleIngress(body,{store:hosts[target.host]});
    return {ok:true,status:200,json:async()=>response};
  };
  const results:LocalEvidence['route']=[];
  const firstDelivery=await pumpOne(first,{store:firstStore,fetch:network as any});
  if(!firstDelivery.ok)throw new Error(`SIMULATED_SEED_DELIVERY_FAILED:${firstDelivery.error}`);
  const firstInbound=await firstStore.getInbound(first,seeded.crossingId);
  if(!firstInbound?.dispositionReceiptId)throw new Error('SIMULATED_SEED_UNRESOLVED');
  const initial={crossing_id:seeded.crossingId,
    hold_receipt:await firstStore.getReceipt(first,firstInbound.holdReceiptId),
    disposition_receipt:await firstStore.getReceipt(first,firstInbound.dispositionReceiptId),state:firstInbound.state};
  let latest=initial.disposition_receipt as ReceiptV0;
  for(let index=0;index<ROUTE.length;index++){
    const current=ROUTE[index];const localHost=nodeDefinition(current).host;
    const targetStore=hosts[localHost];
    let ingress:any;
    let envelope:any;
    if(index===0){ingress=initial;envelope=seeded.envelope;}
    else {
      const parent=ROUTE[index-1], parentHost=nodeDefinition(parent).host;
      const sourceStore=hosts[parentHost];
      const out=await enqueueForward(parent,current,latest.receipt_id,index,sourceStore);
      const result=await pumpOne(parent,{store:sourceStore,fetch:network as any});
      if(!result.ok)throw new Error(`SIMULATED_TRANSPORT_FAILURE:${result.error}`);
      envelope=out.envelope;
      const inbound=await targetStore.getInbound(current,out.crossingId);
      if(!inbound?.dispositionReceiptId)throw new Error('SIMULATED_DESTINATION_UNRESOLVED');
      ingress={crossing_id:out.crossingId,
        hold_receipt:await targetStore.getReceipt(current,inbound.holdReceiptId),
        disposition_receipt:await targetStore.getReceipt(current,inbound.dispositionReceiptId),state:inbound.state};
      latest=ingress.disposition_receipt;
    }
    const observed=await targetStore.getPayload(current,address);
    const hold=ingress.hold_receipt;const disp=ingress.disposition_receipt;
    results.push({node_id:current,host:localHost,crossing_id:envelope.crossing_id,
      hold_receipt_id:hold.receipt_id,disposition_receipt_id:disp.receipt_id,
      signer_fingerprint:publicKeyFingerprint(disp.signing.public_key),disposition:disp.extensions.mx13.disposition,
      signed_crossing:envelope,signed_hold:hold,signed_disposition:disp,
      hold_verified:await verifyReceipt(hold) && hold.extensions.mx13.mandatory_hold===true && hold.semantic_effect==='none',
      disposition_verified:await verifyReceipt(disp) && disp.pre_state_ref===hold.receipt_id,
      address_verified:observed?.address===address && (await sha256Address(observed?.bytes??new Uint8Array()))===address});
  }
  const witnessOracl=results[10].disposition==='FORWARD';
  const ferryDoesNotAdmit=results[11].disposition==='FORWARD';
  const returnsRemainReturns=results[4].disposition==='RETURN'&&results[7].disposition==='REFUSE';
  return {schema:'maxhinal13.local-simulation/v0',hosted_project_calls_observed:false,
    particular:{address,byte_length:bytes.length,observed_name:payload.observedName,detected_media_type:payload.detectedMediaType},
    cross_host_boundaries:countHostBoundaries(results.map(x=>x.host)),route:results,
    laws_preserved:returnsRemainReturns&&ferryDoesNotAdmit&&witnessOracl&&results.every(x=>x.hold_verified&&x.disposition_verified&&x.address_verified)};
}
