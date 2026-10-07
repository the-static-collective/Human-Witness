-- Read-only MAXHINAL-13 verification query.
select nspname as schema_name
from pg_namespace
where nspname = 'mx13_host' or nspname ~ '^mx13_n(0[1-9]|1[0-3])$'
order by nspname;

select node_id, key_version, fingerprint, active, (private_jwk ? 'd') as has_private_d, (public_jwk ? 'd') as public_has_private_d
from mx13_host.node_keys
order by node_id;

select node_id, host_id, fingerprint, ingress_url, active, (public_jwk ? 'd') as public_has_private_d
from mx13_host.peers
order by node_id;

select table_schema, table_name, grantee, privilege_type
from information_schema.role_table_grants
where table_schema = 'mx13_host' or table_schema ~ '^mx13_n(0[1-9]|1[0-3])$'
  and grantee in ('anon','authenticated','PUBLIC')
order by table_schema, table_name, grantee, privilege_type;
