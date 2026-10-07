import test from 'node:test';
import assert from 'node:assert/strict';

async function loadIdentity(){try{return await import('../src/identity.ts')}catch(e){assert.fail(`identity module unavailable: ${e}`)}}

class FakeSql {
  rows=new Map<string,any>();
  async begin<T>(fn:(tx:FakeSql)=>Promise<T>):Promise<T>{return fn(this)}
  async unsafe(query:string,params:any[]=[]){
    if(query.includes('pg_advisory_xact_lock'))return [];
    if(query.includes('select node_id,key_version,public_jwk,fingerprint'))return [...this.rows.values()];
    if(query.includes('insert into mx13_host.node_keys')){
      const [node_id,key_version,public_jwk,private_jwk,fingerprint]=params;
      if(!this.rows.has(node_id))this.rows.set(node_id,{node_id,key_version,public_jwk:JSON.parse(public_jwk),private_jwk:JSON.parse(private_jwk),fingerprint});
      return [];
    }
    throw new Error(`unexpected SQL: ${query.slice(0,80)}`);
  }
}

test('identity bootstrap creates seven unique WITNESS keys without returning private material',async()=>{
  const {ensureLocalIdentities}=await loadIdentity();const sql=new FakeSql();
  const pub=await ensureLocalIdentities(sql,'WITNESS');
  assert.equal(pub.length,7);
  assert.equal(new Set(pub.map((x:any)=>x.fingerprint)).size,7);
  assert.equal(pub.every((x:any)=>!('private_jwk' in x)&&!('d' in x.public_jwk)),true);
  assert.equal([...sql.rows.values()].every((x:any)=>typeof x.private_jwk.d==='string'),true);
});

test('identity bootstrap is idempotent on second call',async()=>{
  const {ensureLocalIdentities}=await loadIdentity();const sql=new FakeSql();
  const first=await ensureLocalIdentities(sql,'pantry-gate');
  const second=await ensureLocalIdentities(sql,'pantry-gate');
  assert.equal(first.length,6);
  assert.deepEqual(second.map((x:any)=>x.fingerprint),first.map((x:any)=>x.fingerprint));
  assert.equal(sql.rows.size,6);
});
