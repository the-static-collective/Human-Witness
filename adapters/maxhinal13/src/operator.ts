import { Buffer } from 'node:buffer';
import { createHash, timingSafeEqual } from 'node:crypto';

/** A per-host 32-byte capability; only its digest is retained in PostgreSQL. */
export async function verifyOperatorCapability(presented:string,storedHash:string):Promise<boolean>{
  if(typeof presented!=='string'||typeof storedHash!=='string')return false;
  if(!/^[A-Za-z0-9_-]{43}$/.test(presented)||! /^[a-f0-9]{64}$/.test(storedHash))return false;
  const decoded=Buffer.from(presented,'base64url');
  if(decoded.length!==32||decoded.toString('base64url')!==presented)return false;
  const digest=createHash('sha256').update(presented,'utf8').digest();
  return timingSafeEqual(digest,Buffer.from(storedHash,'hex'));
}

export async function authorizeHostOperator(sql:{unsafe(query:string,params?:unknown[]):Promise<any[]>},provided:string):Promise<void>{
  const rows=await sql.unsafe('select token_hash from mx13_host.operator_capabilities where id=$1 and active=true',['default']);
  if(!(await verifyOperatorCapability(provided,rows[0]?.token_hash)))throw new Error('UNAUTHORIZED_OPERATOR');
}
