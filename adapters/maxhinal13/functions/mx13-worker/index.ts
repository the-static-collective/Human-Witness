import postgres from 'npm:postgres@3.4.9';
import { PostgresMeshStore } from '../../src/store.ts';
import { runWorkerCommand } from '../../src/commands.ts';
import { authorizeHostOperator } from '../../src/operator.ts';
import { readBoundedJson } from '../../src/http.ts';
import { NODE_DEFINITIONS } from '../../src/nodes.ts';
import { PINNED_PROJECT_REFS } from '../../src/peers.ts';

const ref=new URL(Deno.env.get('SUPABASE_URL')??'').hostname.split('.')[0];
const HOST=ref===PINNED_PROJECT_REFS.WITNESS?'WITNESS':ref===PINNED_PROJECT_REFS['pantry-gate']?'pantry-gate':null;
if(!HOST)throw new Error('UNEXPECTED_PROJECT_REF');
const dbUrl=Deno.env.get('SUPABASE_DB_URL');
if(!dbUrl)throw new Error('MISSING_LOCAL_DB_URL');
const sql=postgres(dbUrl,{max:1,idle_timeout:5,connect_timeout:10,prepare:false,ssl:'require'});
const store=new PostgresMeshStore(sql,HOST,NODE_DEFINITIONS.filter(n=>n.host===HOST).map(n=>n.id));

function code(error:unknown):string{
  const message=error instanceof Error?error.message:'INTERNAL_FAILURE';
  return /^[A-Z][A-Z0-9_]{2,72}$/.test(message)?message:'INTERNAL_FAILURE';
}

Deno.serve(async(request:Request)=>{
  if(request.method!=='POST')return Response.json({error:'METHOD_NOT_ALLOWED'},{status:405});
  try{
    // Verify capability before consuming potentially large payloads.
    await authorizeHostOperator(sql,request.headers.get('x-mx13-operator')??'');
    const command=await readBoundedJson(request,1_800_000);
    const result=await runWorkerCommand(store,HOST,command,fetch);
    return Response.json(result,{headers:{'Cache-Control':'no-store'}});
  }catch(error){
    const reason=code(error);
    return Response.json({ok:false,error:reason},{status:reason==='UNAUTHORIZED_OPERATOR'?401:reason==='INTERNAL_FAILURE'?503:400,
      headers:{'Cache-Control':'no-store'}});
  }
});
