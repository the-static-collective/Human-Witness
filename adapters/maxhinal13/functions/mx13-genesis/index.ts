/** Reconciled v2 entrypoint. Existing genesis wire names use shared tested bootstrap. */
import postgres from 'npm:postgres@3.4.9';
import { readIdentity, runBootstrap } from '../../src/bootstrap.ts';
import { PINNED_PROJECT_REFS } from '../../src/peers.ts';
import { readBoundedJson } from '../../src/http.ts';

const ref = new URL(Deno.env.get('SUPABASE_URL') ?? '').hostname.split('.')[0];
const HOST = ref === PINNED_PROJECT_REFS.WITNESS ? 'WITNESS' : ref === PINNED_PROJECT_REFS['pantry-gate'] ? 'pantry-gate' : null;
if (!HOST) throw Error('UNEXPECTED_PROJECT_REF');
const dbUrl = Deno.env.get('SUPABASE_DB_URL');
if (!dbUrl) throw Error('MISSING_LOCAL_DB_URL');
const sql = postgres(dbUrl, { max: 1, idle_timeout: 5, connect_timeout: 10, prepare: false, ssl: 'require' });

Deno.serve(async request => {
  try {
    if (request.method === 'GET' && new URL(request.url).searchParams.get('identity') === '1')
      return Response.json(await readIdentity(sql, HOST), { headers: { 'Cache-Control': 'no-store' } });
    if (request.method !== 'POST') return Response.json({error: 'METHOD_NOT_ALLOWED'}, {status: 405});
    const body = await readBoundedJson(request, 1024);
    if (body?.schema !== 'maxhinal13.genesis/v0') throw Error('INVALID_REQUEST');
    const action = body.action === 'bootstrap' ? 'identity-bootstrap' : body.action === 'sync-peers' ? 'sync-peers' : null;
    if (!action) throw Error('INVALID_ACTION');
    return Response.json(await runBootstrap(sql, HOST, action, request.headers.get('x-mx13-operator') ?? '', fetch),
      {headers: {'Cache-Control': 'no-store'}});
  } catch (error) {
    const reason = error instanceof Error && /^[A-Z][A-Z0-9_]{2,72}$/.test(error.message) ? error.message : 'INTERNAL_FAILURE';
    return Response.json({ok: false, error: reason}, {status: reason === 'UNAUTHORIZED_OPERATOR' ? 401 : 503,
      headers: {'Cache-Control': 'no-store'}});
  }
});
