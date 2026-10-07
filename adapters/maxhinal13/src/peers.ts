import { NODE_DEFINITIONS } from './nodes.ts';
import { publicKeyFingerprint } from './relatte_v0.ts';
import type { PublicNodeIdentity } from './identity.ts';
import type { PeerRecord } from './store.ts';

export const PINNED_PROJECT_REFS = {
  WITNESS: 'edxoiynjspjtxjauxhlz',
  'pantry-gate': 'kbhqacsdvjsstzyplqij',
} as const;
export type HostId=keyof typeof PINNED_PROJECT_REFS;
export interface IdentityBundleV0 {
  schema: 'maxhinal13.identity/v0';
  host_id: HostId;
  nodes: PublicNodeIdentity[];
}

export async function validateIdentityBundle(input:unknown,host:HostId):Promise<PublicNodeIdentity[]> {
  if(!input||typeof input!=='object')throw new Error('INVALID_IDENTITY_BUNDLE');
  const data=input as IdentityBundleV0;
  if(data.schema!=='maxhinal13.identity/v0')throw new Error('INVALID_IDENTITY_BUNDLE');
  if(data.host_id!==host)throw new Error('IDENTITY_HOST_MISMATCH');
  if(!Array.isArray(data.nodes))throw new Error('IDENTITY_BUNDLE_INCOMPLETE');
  const expected=NODE_DEFINITIONS.filter(n=>n.host===host).map(n=>n.id);
  if(data.nodes.length!==expected.length || new Set(data.nodes.map(n=>n.node_id)).size!==expected.length ||
    expected.some(id=>!data.nodes.some(n=>n.node_id===id)))throw new Error('IDENTITY_BUNDLE_INCOMPLETE');
  const seen=new Set<string>();
  for(const row of data.nodes){
    if(row.host_id!==host || row.key_version!==1)throw new Error('IDENTITY_HOST_MISMATCH');
    const key=row.public_jwk;
    if(!key||typeof key!=='object')throw new Error('INVALID_IDENTITY_PUBLIC_KEY');
    if('d' in key)throw new Error('PRIVATE_KEY_MATERIAL');
    const publicKey={kty:key.kty,crv:key.crv,x:key.x,y:key.y};
    if(publicKey.kty!=='EC'||publicKey.crv!=='P-256'|| typeof publicKey.x!=='string'|| typeof publicKey.y!=='string')
      throw new Error('INVALID_IDENTITY_PUBLIC_KEY');
    try { await crypto.subtle.importKey('jwk',publicKey,{name:'ECDSA',namedCurve:'P-256'},false,['verify']); }
    catch { throw Error('INVALID_IDENTITY_PUBLIC_KEY'); }
    const actual=publicKeyFingerprint(publicKey);
    if(actual!==row.fingerprint)throw new Error('IDENTITY_FINGERPRINT_MISMATCH');
    if(seen.has(row.fingerprint))throw new Error('DUPLICATE_NODE_FINGERPRINT');
    seen.add(row.fingerprint);
  }
  return data.nodes;
}

export function preparePeerSync(witness:PublicNodeIdentity[],pantry:PublicNodeIdentity[],existing:Map<string,string>):PeerRecord[]{
  const rows=[...witness,...pantry];
  if(rows.length!==13||new Set(rows.map(r=>r.node_id)).size!==13 || new Set(rows.map(r=>r.fingerprint)).size!==13)
    throw new Error('IDENTITY_BUNDLE_INCOMPLETE');
  return rows.map(row=>{
    const prior=existing.get(row.node_id);
    if(prior && prior!==row.fingerprint)throw new Error('PEER_KEY_ROTATION_REQUIRES_CEREMONY');
    const projectRef=PINNED_PROJECT_REFS[row.host_id];
    if(!projectRef)throw new Error('IDENTITY_HOST_MISMATCH');
    return {nodeId:row.node_id as PeerRecord['nodeId'],hostId:row.host_id,publicJwk:row.public_jwk,
      fingerprint:row.fingerprint,ingressUrl:`https://${projectRef}.supabase.co/functions/v1/mx13-ingress`,active:true};
  });
}
