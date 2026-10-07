import { mkdir, writeFile } from 'node:fs/promises';
import { randomBytes, createHash } from 'node:crypto';
import { generateP256KeyPair, publicKeyFingerprint } from '../src/relatte_v0.ts';
import { NODE_DEFINITIONS } from '../src/nodes.ts';

const outDir=new URL('../.local/',import.meta.url);
await mkdir(outDir,{recursive:true});
const nodes=[];
for(const node of NODE_DEFINITIONS){
  const keys=await generateP256KeyPair();
  const privateJwk=await crypto.subtle.exportKey('jwk',keys.privateKey);
  nodes.push({node_id:node.id,host_id:node.host,key_version:1,public_jwk:keys.publicKeyJwk,private_jwk:privateJwk,fingerprint:publicKeyFingerprint(keys.publicKeyJwk)});
}
const capabilities:any={};
for(const host of ['WITNESS','pantry-gate']){
  const raw=randomBytes(32).toString('base64url');
  capabilities[host]={raw,sha256:createHash('sha256').update(raw,'utf8').digest('hex')};
}
const unique=new Set(nodes.map(n=>n.fingerprint));
if(unique.size!==13) throw new Error('DUPLICATE_NODE_FINGERPRINT');
const result={schema:'maxhinal13.bootstrap-local/v0',generated_at:new Date().toISOString(),nodes,operator_capabilities:capabilities};
await writeFile(new URL('identities.json',outDir),JSON.stringify(result,null,2)+'\n',{mode:0o600});
console.log(JSON.stringify({node_count:nodes.length,fingerprints:nodes.map(n=>({node_id:n.node_id,fingerprint:n.fingerprint})),operator_capability_hashes:Object.fromEntries(Object.entries(capabilities).map(([k,v]:any)=>[k,v.sha256]))},null,2));
