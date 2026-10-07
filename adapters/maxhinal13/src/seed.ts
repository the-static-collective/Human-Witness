import type {MeshStore,OutboxRecord,PayloadRecord} from './store.ts';
import {keyMaterial} from './worker.ts';
import {sealCrossingEnvelope} from './relatte_v0.ts';
import {sha256Address} from './payload.ts';

const INVITATION_SHA='sha256:af82b9a3b2d5eeb1ce3d58038b3415ca62f0815bd6f0a04662ec8cf5b773d171';
const INVITATION_BYTES=670478;
const FIRST_NODE='mx13:01-witness' as const;

/** Source custody + pending signed HTTP self-crossing; neither step admits. */
export async function seedMx13001(store:MeshStore, bytes:Uint8Array):Promise<OutboxRecord>{
  if(bytes.length!==INVITATION_BYTES||(await sha256Address(bytes))!==INVITATION_SHA)
    throw new Error('INVITATION_PARTICULAR_MISMATCH');
  const payload:PayloadRecord={
    address:INVITATION_SHA,bytes:new Uint8Array(bytes),byteLength:bytes.length,
    observedName:'1000018575.png',detectedMediaType:'image/jpeg',
  };
  const keys=await keyMaterial(await store.loadNodeKey(FIRST_NODE));
  const crossing=await sealCrossingEnvelope({
    schema:'relatte.crossing-envelope/v0',protocol_version:'0',source_particular:payload.address,
    source_world:FIRST_NODE,source_history_head:null,parents:[],declared_kind:'MX13_INVITATION',
    payload_refs:[{address:payload.address,byte_length:payload.byteLength,role:'particular',
      observed_name:payload.observedName,media_type:payload.detectedMediaType}],
    requested_effect:{destination_disposition:'local'},capability_ref:null,
    privacy_policy:{field:'bounded',retention:'decay-after-export'},
    audience_policy:{destination:FIRST_NODE},return_address:FIRST_NODE,created_at:new Date().toISOString(),
    extensions:{mx13:{route_index:0,seed_custody_only:true,claim_limit:'signed loopback seed; no local admission'}},
  },keys);
  await store.putPayload(FIRST_NODE,payload);
  return store.enqueueOutbox(FIRST_NODE,{
    crossingId:crossing.crossing_id,destinationNodeId:FIRST_NODE,envelope:crossing,payloadAddress:payload.address,
  });
}
