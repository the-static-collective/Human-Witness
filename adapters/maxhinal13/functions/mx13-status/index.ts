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

Deno.serve(async(req:Request)=>{
  if(req.method!=='GET')return Response.json({error:'METHOD_NOT_ALLOWED'},{status:405});
  try {return Response.json(await readHostStatus(store),{headers:{'Cache-Control':'no-store'}});}
  catch {return Response.json({error:'STATUS_UNAVAILABLE'},{status:503,headers:{'Cache-Control':'no-store'}});}
});
