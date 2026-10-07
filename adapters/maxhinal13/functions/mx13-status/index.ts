import {pulse,POLL_INTERVAL_MS} from '../../src/pneuma.ts';
import postgres from 'npm:postgres@3.4.9';
import { PostgresMeshStore } from '../../src/store.ts';
import { readHostStatus } from '../../src/status.ts';
import { NODE_DEFINITIONS } from '../../src/nodes.ts';
import { PINNED_PROJECT_REFS } from '../../src/peers.ts';

const supabaseUrl=Deno.env.get('SUPABASE_URL') ?? '';
const ref=new URL(supabaseUrl).hostname.split('.')[0];
const HOST=ref===PINNED_PROJECT_REFS.WITNESS?'WITNESS':ref===PINNED_PROJECT_REFS['pantry-gate']?'pantry-gate':null;
if(!HOST)throw new Error('UNEXPECTED_PROJECT_REF');
const dbUrl=Deno.env.get('SUPABASE_DB_URL');
if(!dbUrl)throw new Error('MISSING_LOCAL_DB_URL');
const sql=postgres(dbUrl,{max:1,idle_timeout:5,connect_timeout:10,prepare:false,ssl:'require'});
const store=new PostgresMeshStore(sql,HOST,NODE_DEFINITIONS.filter(n=>n.host===HOST).map(n=>n.id));

const boot=crypto.randomUUID();let epoch=0;let lastPulseAt=0;let cachedPulses:any[]=[];let pulseWork:Promise<any[]>|null=null;
Deno.serve(async(req:Request)=>{
  if(req.method!=='GET')return Response.json({error:'METHOD_NOT_ALLOWED'},{status:405});
  try {
    const status=await readHostStatus(store);
    if(new URL(req.url).searchParams.get('pulse')==='1'){
      if(Date.now()-lastPulseAt>=POLL_INTERVAL_MS){
        if(!pulseWork){const nextEpoch=++epoch;
          pulseWork=(async()=>{const observations:any[]=[];
            for(const node of NODE_DEFINITIONS.filter(n=>n.host===HOST)){
              try{observations.push(await pulse(store,node.id,boot,nextEpoch));}catch{observations.push({node_id:node.id,observation:'UNKNOWN'});}
            }
            return observations;
          })();
        }
        try{cachedPulses=await pulseWork;lastPulseAt=Date.now();}finally{pulseWork=null;}
      }
      return Response.json({...status,pulses:cachedPulses,poll_interval_ms:POLL_INTERVAL_MS},{headers:{'Cache-Control':'no-store'}});
    }
    return Response.json(status,{headers:{'Cache-Control':'no-store'}});}
  catch {return Response.json({error:'STATUS_UNAVAILABLE'},{status:503,headers:{'Cache-Control':'no-store'}});}
});
