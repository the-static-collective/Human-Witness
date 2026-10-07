import { readFile, writeFile } from 'node:fs/promises';
const base=new URL('../.local/',import.meta.url);
const data=JSON.parse(await readFile(new URL('identities.json',base),'utf8'));
if(new Set(data.nodes.map((n:any)=>n.fingerprint)).size!==13)throw new Error('DUPLICATE_NODE_FINGERPRINT');
const witnessRef=process.env.MX13_WITNESS_REF ?? 'edxoiynjspjtxjauxhlz';
const pantryRef=process.env.MX13_PANTRY_REF ?? 'kbhqacsdvjsstzyplqij';
const urls:any={WITNESS:`https://${witnessRef}.supabase.co/functions/v1/mx13-ingress`,'pantry-gate':`https://${pantryRef}.supabase.co/functions/v1/mx13-ingress`};
function lit(s:string){return `'${s.replaceAll("'","''")}'`;}
for(const host of ['WITNESS','pantry-gate']){
  const lines=['begin;'];
  for(const n of data.nodes.filter((x:any)=>x.host_id===host)) lines.push(`insert into mx13_host.node_keys(node_id,key_version,public_jwk,private_jwk,fingerprint) values(${lit(n.node_id)},${n.key_version},${lit(JSON.stringify(n.public_jwk))}::jsonb,${lit(JSON.stringify(n.private_jwk))}::jsonb,${lit(n.fingerprint)}) on conflict(node_id) do nothing;`);
  for(const n of data.nodes) lines.push(`insert into mx13_host.peers(node_id,host_id,public_jwk,fingerprint,ingress_url) values(${lit(n.node_id)},${lit(n.host_id)},${lit(JSON.stringify(n.public_jwk))}::jsonb,${lit(n.fingerprint)},${lit(urls[n.host_id])}) on conflict(node_id) do update set host_id=excluded.host_id,public_jwk=excluded.public_jwk,fingerprint=excluded.fingerprint,ingress_url=excluded.ingress_url,active=true;`);
  const cap=data.operator_capabilities[host];
  lines.push(`insert into mx13_host.operator_capabilities(id,token_hash) values('default',${lit(cap.sha256)}) on conflict(id) do update set token_hash=excluded.token_hash,active=true;`);
  lines.push('commit;');
  const filename=host==='WITNESS'?'witness-bootstrap.sql':'pantry-gate-bootstrap.sql';
  await writeFile(new URL(filename,base),lines.join('\n')+'\n',{mode:0o600});
}
console.log(JSON.stringify({ok:true,files:['witness-bootstrap.sql','pantry-gate-bootstrap.sql'],raw_operator_capabilities_embedded:false}));
