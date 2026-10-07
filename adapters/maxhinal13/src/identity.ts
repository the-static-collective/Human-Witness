import { generateP256KeyPair, publicKeyFingerprint } from './relatte_v0.ts';
import { NODE_DEFINITIONS } from './nodes.ts';
import type { SqlClientLike } from './store.ts';

export interface PublicNodeIdentity {
  node_id: string;
  host_id: 'WITNESS' | 'pantry-gate';
  key_version: number;
  public_jwk: JsonWebKey;
  fingerprint: string;
}

/**
 * One-way in-host key genesis. The two hosted Supabases generate their own
 * private node keys; no private key is supplied by an outside request.
 * Public read-back is intentional; private JWKs never leave this SQL client.
 */
export async function ensureLocalIdentities(sql:SqlClientLike, host:'WITNESS'|'pantry-gate'):Promise<PublicNodeIdentity[]> {
  const local=NODE_DEFINITIONS.filter(n=>n.host===host);
  const work=async(tx:SqlClientLike)=>{
    await tx.unsafe('select pg_advisory_xact_lock(hashtext($1))',[`maxhinal13-identity-${host}`]);
    const existing=await tx.unsafe('select node_id,key_version,public_jwk,fingerprint from mx13_host.node_keys order by node_id');
    const byId=new Map(existing.map((x:any)=>[x.node_id,x]));
    for(const n of local){
      if(byId.has(n.id))continue;
      const keys=await generateP256KeyPair();
      const privateJwk=await crypto.subtle.exportKey('jwk',keys.privateKey);
      const fp=publicKeyFingerprint(keys.publicKeyJwk);
      await tx.unsafe('insert into mx13_host.node_keys(node_id,key_version,public_jwk,private_jwk,fingerprint) values($1,$2,$3::jsonb,$4::jsonb,$5) on conflict(node_id) do nothing',[
        n.id,1,JSON.stringify(keys.publicKeyJwk),JSON.stringify(privateJwk),fp,
      ]);
      byId.set(n.id,{node_id:n.id,key_version:1,public_jwk:keys.publicKeyJwk,fingerprint:fp});
    }
    const output=local.map(n=>{
      const r:any=byId.get(n.id);
      if(!r)throw new Error('IDENTITY_BOOTSTRAP_INCOMPLETE');
      return {node_id:n.id,host_id:host,key_version:Number(r.key_version),public_jwk:r.public_jwk,fingerprint:r.fingerprint};
    });
    if(new Set(output.map(n=>n.fingerprint)).size!==output.length)throw new Error('DUPLICATE_NODE_FINGERPRINT');
    return output;
  };
  return sql.begin?sql.begin(work):work(sql);
}
