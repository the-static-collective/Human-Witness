import assert from 'node:assert/strict';
import {FakeMeshStore, PostgresMeshStore} from '../../src/store.ts';
import {generateP256KeyPair, publicKeyFingerprint, sealCrossingEnvelope} from '../../src/relatte_v0.ts';
import {handleIngress} from '../../src/ingress.ts';
import {pumpOne} from '../../src/worker.ts';
import {sha256Address} from '../../src/payload.ts';
import {Buffer} from 'node:buffer';

export async function pairFixture(){
 const a='mx13:01-witness', b='mx13:02-gate';
 const stores=[new FakeMeshStore(),new FakeMeshStore()];
 const keys=await Promise.all([generateP256KeyPair(),generateP256KeyPair()]);
 const ids=[a,b] as const;
 for(let i=0;i<2;i++){
  stores[i].hostId=i===0?'WITNESS':'pantry-gate';stores[i].localNodeIds=[ids[i]];
  stores[i].keys.set(ids[i],{nodeId:ids[i],keyVersion:1,publicJwk:keys[i].publicKeyJwk,
    privateJwk:await crypto.subtle.exportKey('jwk',keys[i].privateKey),fingerprint:publicKeyFingerprint(keys[i].publicKeyJwk)});
  for(let j=0;j<2;j++) stores[i].peers.set(ids[j],{nodeId:ids[j],hostId:j===0?'WITNESS':'pantry-gate',
    publicJwk:keys[j].publicKeyJwk,fingerprint:publicKeyFingerprint(keys[j].publicKeyJwk),active:true,
    ingressUrl:`https://${j===0?'edxoiynjspjtxjauxhlz':'kbhqacsdvjsstzyplqij'}.supabase.co/functions/v1/mx13-ingress`});
 }
 const bytes=Buffer.from('bounded synthetic two-world transport probe');const address=await sha256Address(bytes);
 const envelope=await sealCrossingEnvelope({schema:'relatte.crossing-envelope/v0',protocol_version:'0',source_particular:address,
   source_world:a,source_history_head:null,parents:[],declared_kind:'MX13_TWO_WORLD_PROBE',
   payload_refs:[{address,byte_length:bytes.length,role:'particular',media_type:'text/plain',observed_name:'synthetic-probe.txt'}],
   requested_effect:{destination_disposition:'local'},capability_ref:null,privacy_policy:null,audience_policy:{destination:b},
   return_address:a,created_at:new Date().toISOString(),extensions:{mx13:{route_index:1}}},keys[0]);
 await stores[0].putPayload(a,{address,bytes,byteLength:bytes.length,observedName:'synthetic-probe.txt',detectedMediaType:'text/plain'});
 await stores[0].enqueueOutbox(a,{crossingId:envelope.crossing_id,destinationNodeId:b,envelope,payloadAddress:address});
 const network=async(_url:any,options:any)=>{
  assert.equal(options.redirect,'error');
  assert.equal(options.headers['x-mx13-operator'],undefined);
  const response=await handleIngress(JSON.parse(options.body),{store:stores[1]});
  return new Response(JSON.stringify(response),{headers:{'Content-Type':'application/json'}});
 };
 return {a,b,stores,keys,bytes,address,envelope,network};
}
