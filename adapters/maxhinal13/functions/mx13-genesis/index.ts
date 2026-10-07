import postgres from 'npm:postgres@3.4.9'
import { createHash, timingSafeEqual } from 'node:crypto'
import { Buffer } from 'node:buffer'

const REFS = { WITNESS:'edxoiynjspjtxjauxhlz', 'pantry-gate':'kbhqacsdvjsstzyplqij' }
const NODES = [
  ['mx13:01-witness','WITNESS'],['mx13:02-gate','pantry-gate'],
  ['mx13:03-dead-letter','WITNESS'],['mx13:04-compost-monk','pantry-gate'],
  ['mx13:05-mirrorgoat','WITNESS'],['mx13:06-contrary','pantry-gate'],
  ['mx13:07-lantern-eater','WITNESS'],['mx13:08-pirate-clerk','pantry-gate'],
  ['mx13:09-choir-of-one','WITNESS'],['mx13:10-bone-orchard','pantry-gate'],
  ['mx13:11-oracl','WITNESS'],['mx13:12-ferryman','pantry-gate'],
  ['mx13:13-misspeldd-maxhinal','WITNESS'],
]
const ref = new URL(Deno.env.get('SUPABASE_URL')||'').hostname.split('.')[0]
const HOST = Object.keys(REFS).find(h=>REFS[h]===ref)
if (!HOST) throw Error('UNKNOWN_PHYSICAL_HOST')
const db = Deno.env.get('SUPABASE_DB_URL')
if (!db) throw Error('MISSING_LOCAL_DB_URL')
const sql = postgres(db,{max:1,idle_timeout:5,connect_timeout:10,ssl:'require'})

function fp(jwk) {
  const key = {crv:jwk.crv,kty:jwk.kty,x:jwk.x,y:jwk.y}
  return 'sha256:'+createHash('sha256').update(JSON.stringify(key)).digest('hex')
}
function publicOnly(jwk) { return {kty:'EC',crv:'P-256',x:jwk.x,y:jwk.y} }
function checkBundle(bundle,expectedHost) {
  const expected=NODES.filter(n=>n[1]===expectedHost).map(n=>n[0])
  if(bundle?.schema!=='maxhinal13.identity/v0'||bundle.host_id!==expectedHost||!Array.isArray(bundle.nodes)||
    bundle.nodes.length!==expected.length)throw Error('INVALID_PEER_BUNDLE')
  const seen=new Set(), signers=new Set()
  for(const n of bundle.nodes){
    if(!expected.includes(n.node_id)||seen.has(n.node_id)||n.host_id!==expectedHost||n.key_version!==1||
      n.public_jwk?.kty!=='EC'||n.public_jwk?.crv!=='P-256'||'d' in n.public_jwk||
      !/^[A-Za-z0-9_-]{43}$/.test(n.public_jwk.x)||!/^[A-Za-z0-9_-]{43}$/.test(n.public_jwk.y)||
      fp(n.public_jwk)!==n.fingerprint||signers.has(n.fingerprint))throw Error('INVALID_PEER_IDENTITY')
    seen.add(n.node_id);signers.add(n.fingerprint)
  }
  if(seen.size!==expected.length)throw Error('PEER_BUNDLE_INCOMPLETE')
  return bundle.nodes
}
async function readIdentity(){
  const rows=await sql.unsafe('select node_id,key_version,public_jwk,fingerprint from mx13_host.node_keys where active=true order by node_id')
  const nodes=NODES.filter(n=>n[1]===HOST).map(n=>{
    const r=rows.find(x=>x.node_id===n[0])
    if(!r)throw Error('GENESIS_NOT_READY')
    return {node_id:r.node_id,host_id:HOST,key_version:r.key_version,public_jwk:r.public_jwk,fingerprint:r.fingerprint}
  })
  const bundle={schema:'maxhinal13.identity/v0',host_id:HOST,nodes}
  checkBundle(bundle,HOST)
  return bundle
}
async function authorize(raw){
  if(!/^[A-Za-z0-9_-]{32,128}$/.test(raw))throw Error('UNAUTHORIZED_OPERATOR')
  const r=await sql.unsafe("select token_hash from mx13_host.operator_capabilities where id='default' and active=true")
  if(!r[0]?.token_hash)throw Error('UNAUTHORIZED_OPERATOR')
  const expected=Buffer.from(r[0].token_hash,'hex')
  const supplied=createHash('sha256').update(raw).digest()
  if(expected.length!==32||!timingSafeEqual(expected,supplied))throw Error('UNAUTHORIZED_OPERATOR')
}
async function genesis(){
  return sql.begin(async tx=>{
    await tx.unsafe("select pg_advisory_xact_lock(hashtext('maxhinal13-identity-genesis'))")
    const rows=await tx.unsafe('select node_id from mx13_host.node_keys')
    const existing=new Set(rows.map(r=>r.node_id))
    for(const n of NODES.filter(n=>n[1]===HOST)){
      if(existing.has(n[0]))continue
      const pair=await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify'])
      const rawPublic=await crypto.subtle.exportKey('jwk',pair.publicKey)
      const rawPrivate=await crypto.subtle.exportKey('jwk',pair.privateKey)
      const pub=publicOnly(rawPublic)
      await tx.unsafe('insert into mx13_host.node_keys(node_id,key_version,public_jwk,private_jwk,fingerprint) values($1,1,$2::jsonb,$3::jsonb,$4) on conflict(node_id) do nothing',
      [n[0],JSON.stringify(pub),JSON.stringify(rawPrivate),fp(pub)])
    }
    return {ok:true,host_id:HOST,created_or_existing:NODES.filter(n=>n[1]===HOST).length}
  })
}
async function syncPeers(){
  const local=checkBundle(await readIdentity(),HOST)
  const remoteHost=HOST==='WITNESS'?'pantry-gate':'WITNESS'
  const url='https://'+REFS[remoteHost]+'.supabase.co/functions/v1/mx13-genesis?identity=1'
  const response=await fetch(url,{method:'GET',signal:AbortSignal.timeout(8000)})
  if(!response.ok)throw Error('REMOTE_IDENTITY_UNAVAILABLE')
  const remote=checkBundle(await response.json(),remoteHost)
  const peers=[...local,...remote]
  if(new Set(peers.map(p=>p.fingerprint)).size!==13)throw Error('IDENTITY_COLLISION')
  return sql.begin(async tx=>{
    await tx.unsafe("select pg_advisory_xact_lock(hashtext('maxhinal13-peer-sync'))")
    const current=await tx.unsafe('select node_id,fingerprint from mx13_host.peers')
    const known=new Map(current.map(p=>[p.node_id,p.fingerprint]))
    for(const p of peers){
      if(known.has(p.node_id)&&known.get(p.node_id)!==p.fingerprint)throw Error('KEY_ROTATION_REQUIRES_CEREMONY')
      const endpoint='https://'+REFS[p.host_id]+'.supabase.co/functions/v1/mx13-ingress'
      await tx.unsafe('insert into mx13_host.peers(node_id,host_id,public_jwk,fingerprint,ingress_url) values($1,$2,$3::jsonb,$4,$5) on conflict(node_id) do nothing',
      [p.node_id,p.host_id,JSON.stringify(p.public_jwk),p.fingerprint,endpoint])
    }
    const done=await tx.unsafe('select node_id,fingerprint from mx13_host.peers')
    const actual=new Map(done.map(p=>[p.node_id,p.fingerprint]))
    for(const p of peers)if(actual.get(p.node_id)!==p.fingerprint)throw Error('KEY_ROTATION_REQUIRES_CEREMONY')
    return {ok:true,host_id:HOST,peer_count:peers.length}
  })
}
Deno.serve(async req=>{
  try{
    if(req.method==='GET'&&new URL(req.url).searchParams.get('identity')==='1')
      return Response.json(await readIdentity(),{headers:{'Cache-Control':'no-store'}})
    if(req.method!=='POST')return Response.json({error:'METHOD_NOT_ALLOWED'},{status:405})
    if(Number(req.headers.get('Content-Length')||0)>1024)throw Error('BODY_TOO_LARGE')
    const raw=await req.text()
    if(raw.length>1024)throw Error('BODY_TOO_LARGE')
    const body=JSON.parse(raw)
    if(body?.schema!=='maxhinal13.genesis/v0')throw Error('INVALID_REQUEST')
    await authorize(req.headers.get('x-mx13-operator')||'')
    const result=body.action==='bootstrap'?await genesis():body.action==='sync-peers'?await syncPeers():null
    if(!result)throw Error('INVALID_ACTION')
    return Response.json(result,{headers:{'Cache-Control':'no-store'}})
  }catch(e){
    const error=e instanceof Error?e.message:'INTERNAL_FAILURE'
    const allowed=/^(UNAUTHORIZED_OPERATOR|INVALID_ACTION|INVALID_REQUEST|BODY_TOO_LARGE|GENESIS_NOT_READY|REMOTE_IDENTITY_UNAVAILABLE|INVALID_PEER_BUNDLE|INVALID_PEER_IDENTITY|PEER_BUNDLE_INCOMPLETE|IDENTITY_COLLISION|KEY_ROTATION_REQUIRES_CEREMONY)$/.test(error)
    if(!allowed)console.error('MX13_GENESIS_FAILURE',error)
    return Response.json({ok:false,error:allowed?error:'INTERNAL_FAILURE'},{status:error==='UNAUTHORIZED_OPERATOR'?401:503,headers:{'Cache-Control':'no-store'}})
  }
})