/** Optional ephemeral observations. Never needed by ingress, admission, or cold replay. */
import type {ReceiptV0,NodeId} from './model.ts';
import type {MeshStore} from './store.ts';
import {sealReceipt,verifyReceipt,publicKeyFingerprint} from './relatte_v0.ts';
import {keyMaterial} from './worker.ts';
import {isNodeId} from './nodes.ts';

export interface Pulse {
 node_id:NodeId;boot_id:string;observed_at:string;status_epoch:number;
 held_count:number;outbox_pending_count:number;last_receipt_id:string|null;
 activity_label:'HOLD'|'OUTBOX'|null;
}
export type Estimation='PULSING'|'QUIET'|'UNKNOWN'|'RECOVERING';
export const POLL_INTERVAL_MS=60000, PULSE_TTL_MS=120000;
export async function pulse(store:MeshStore,node:NodeId,boot:string,epoch:number,now=new Date()):Promise<ReceiptV0>{
 const state=await store.readNodeStatus(node), keys=await keyMaterial(await store.loadNodeKey(node),node);
 const observation:Pulse={node_id:node,boot_id:boot,observed_at:now.toISOString(),status_epoch:epoch,
   held_count:state.held_count,outbox_pending_count:state.outbox_pending_count,last_receipt_id:state.last_receipt_id,
   activity_label:state.held_count?'HOLD':state.outbox_pending_count?'OUTBOX':null};
 return sealReceipt({schema:'relatte.receipt/v0',crossing_id:`pulse:${boot}:${epoch}:${node}`,world_id:node,
   receiver_particular:`node:${node}`,kind:'PNEUMA_PULSE',semantic_effect:'none',contract_ref:'PNEUMA-001',
   pre_state_ref:null,post_state_ref:null,descendant_refs:[],residual_refs:[],note:'ephemeral observer material; not durable crossing evidence',
   created_at:observation.observed_at,extensions:{pneuma:observation}},keys);
}
export class PulseObserver {
 private last=new Map<NodeId,Pulse>();private missing=new Set<NodeId>();
 private fingerprints:Record<string,string>;
 constructor(fingerprints:Record<string,string>){this.fingerprints=fingerprints;}
 estimate(node:NodeId,now=new Date()):Estimation {
  const last=this.last.get(node);
  if(!last||this.missing.has(node)||now.getTime()-Date.parse(last.observed_at)>PULSE_TTL_MS){this.missing.add(node);return 'UNKNOWN';}
  return last.held_count||last.outbox_pending_count?'PULSING':'QUIET';
 }
 async observe(node:NodeId,signed:ReceiptV0|null,now=new Date()):Promise<{state:Estimation;last_contact:string|null;authority:'observer-local-estimation'}>{
  const result=(state:Estimation)=>({state,last_contact:this.last.get(node)?.observed_at??null,authority:'observer-local-estimation' as const});
  if(!signed){this.missing.add(node);return result('UNKNOWN');}
  const p=signed.extensions?.pneuma as Pulse;
  const fields=['node_id','boot_id','observed_at','status_epoch','held_count','outbox_pending_count','last_receipt_id','activity_label'].sort();
  if(!isNodeId(node)||signed.kind!=='PNEUMA_PULSE'||signed.world_id!==node||signed.receiver_particular!==`node:${node}`||
    signed.semantic_effect!=='none'||!(await verifyReceipt(signed))||publicKeyFingerprint(signed.signing.public_key)!==this.fingerprints[node]||
    !p||Object.keys(p).sort().join('|')!==fields.join('|')||Object.keys(signed.extensions).join('|')!=='pneuma'||signed.contract_ref!=='PNEUMA-001'||
    signed.pre_state_ref!==null||signed.post_state_ref!==null||signed.descendant_refs.length!==0||signed.residual_refs.length!==0||
    !Number.isFinite(Date.parse(p.observed_at))||signed.crossing_id!==`pulse:${p.boot_id}:${p.status_epoch}:${node}`||p.node_id!==node||signed.created_at!==p.observed_at||!Number.isSafeInteger(p.status_epoch)||p.status_epoch<0||
    !/^[a-f0-9-]{36}$/.test(p.boot_id)||!Number.isSafeInteger(p.held_count)||p.held_count<0||
    !Number.isSafeInteger(p.outbox_pending_count)||p.outbox_pending_count<0||
    ![null,'HOLD','OUTBOX'].includes(p.activity_label)||
    (p.last_receipt_id!==null&&!/^relatte-receipt-v0:[a-f0-9]{64}$/.test(p.last_receipt_id))||
    now.getTime()-Date.parse(p.observed_at)<-5000)throw Error('INVALID_OR_UNPINNED_PULSE');
  const last=this.last.get(node);
  if(now.getTime()-Date.parse(p.observed_at)>PULSE_TTL_MS|| (last&&last.boot_id===p.boot_id&&last.status_epoch>=p.status_epoch)){this.missing.add(node);return result('UNKNOWN');}
  const recovering=this.missing.has(node)||(last!==undefined&&last.boot_id!==p.boot_id);
  this.last.set(node,p);this.missing.delete(node);
  return result(recovering?'RECOVERING':this.estimate(node,now));
 }
}
