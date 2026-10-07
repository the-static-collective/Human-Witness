-- Additive MAXHINAL-only indexes; no application tables or grants change.
alter table mx13_host.operator_capabilities add column if not exists expires_at timestamptz;
do $mx13$
declare mesh_schema text;
begin
  for mesh_schema in select nspname from pg_namespace where nspname ~ '^mx13_n(0[1-9]|1[0-3])$' loop
    execute format('create index if not exists inbox_payload_address_idx on %I.inbox(payload_address)',mesh_schema);
    execute format('create index if not exists outbox_payload_address_idx on %I.outbox(payload_address)',mesh_schema);
    execute format('create index if not exists outbox_pending_created_idx on %I.outbox(created_at) where state=%L',mesh_schema,'PENDING');
  end loop;
end $mx13$;
