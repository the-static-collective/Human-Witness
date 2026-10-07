-- MAXHINAL-13 private mesh substrate. Additive only.
create schema if not exists mx13_host;
revoke all on schema mx13_host from public, anon, authenticated;

create table if not exists mx13_host.node_keys (
  node_id text primary key,
  key_version integer not null default 1 check (key_version > 0),
  public_jwk jsonb not null,
  private_jwk jsonb not null,
  fingerprint text not null unique check (fingerprint ~ '^sha256:[0-9a-f]{64}$'),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  check ((private_jwk ? 'd') and not (public_jwk ? 'd'))
);

create table if not exists mx13_host.peers (
  node_id text primary key,
  host_id text not null check (host_id in ('WITNESS','pantry-gate')),
  public_jwk jsonb not null,
  fingerprint text not null unique check (fingerprint ~ '^sha256:[0-9a-f]{64}$'),
  ingress_url text not null check (ingress_url like 'https://%.supabase.co/functions/v1/mx13-ingress'),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  check (not (public_jwk ? 'd'))
);

create table if not exists mx13_host.operator_capabilities (
  id text primary key,
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

revoke all on all tables in schema mx13_host from public, anon, authenticated;
alter default privileges in schema mx13_host revoke all on tables from public, anon, authenticated;
alter default privileges in schema mx13_host revoke all on sequences from public, anon, authenticated;

create schema if not exists mx13_n01;
revoke all on schema mx13_n01 from public, anon, authenticated;

create table if not exists mx13_n01.payloads (
  address text primary key check (address ~ '^sha256:[0-9a-f]{64}$'),
  bytes bytea not null,
  byte_length integer not null check (byte_length between 0 and 1048576),
  observed_name text not null,
  detected_media_type text not null,
  received_at timestamptz not null default now(),
  check (octet_length(bytes) = byte_length)
);
create table if not exists mx13_n01.receipts (
  receipt_id text primary key check (receipt_id ~ '^relatte-receipt-v0:[0-9a-f]{64}$'),
  kind text not null,
  body jsonb not null,
  created_at timestamptz not null default now()
);
create table if not exists mx13_n01.inbox (
  crossing_id text primary key check (crossing_id ~ '^relatte-crossing-v0:[0-9a-f]{64}$'),
  source_node_id text not null,
  state text not null check (state in ('HOLD','RESOLVED')),
  hold_receipt_id text not null,
  disposition_receipt_id text,
  envelope jsonb not null,
  payload_address text not null references mx13_n01.payloads(address),
  received_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((state='HOLD' and disposition_receipt_id is null) or (state='RESOLVED' and disposition_receipt_id is not null))
);
create table if not exists mx13_n01.outbox (
  crossing_id text primary key check (crossing_id ~ '^relatte-crossing-v0:[0-9a-f]{64}$'),
  destination_node_id text not null,
  envelope jsonb not null,
  payload_address text not null references mx13_n01.payloads(address),
  state text not null default 'PENDING' check (state in ('PENDING','COMPLETE')),
  attempts integer not null default 0 check (attempts >= 0),
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists mx13_n01.constitution_events (
  event_id text primary key,
  crossing_id text not null,
  class text not null,
  body jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists mx13_n01_constitution_events_crossing_idx on mx13_n01.constitution_events(crossing_id,created_at);
create table if not exists mx13_n01.ancestry (
  child_ref text not null,
  parent_ref text not null,
  relation text not null,
  created_at timestamptz not null default now(),
  primary key(child_ref,parent_ref,relation)
);
revoke all on all tables in schema mx13_n01 from public, anon, authenticated;
alter default privileges in schema mx13_n01 revoke all on tables from public, anon, authenticated;
alter default privileges in schema mx13_n01 revoke all on sequences from public, anon, authenticated;

create schema if not exists mx13_n03;
revoke all on schema mx13_n03 from public, anon, authenticated;

create table if not exists mx13_n03.payloads (
  address text primary key check (address ~ '^sha256:[0-9a-f]{64}$'),
  bytes bytea not null,
  byte_length integer not null check (byte_length between 0 and 1048576),
  observed_name text not null,
  detected_media_type text not null,
  received_at timestamptz not null default now(),
  check (octet_length(bytes) = byte_length)
);
create table if not exists mx13_n03.receipts (
  receipt_id text primary key check (receipt_id ~ '^relatte-receipt-v0:[0-9a-f]{64}$'),
  kind text not null,
  body jsonb not null,
  created_at timestamptz not null default now()
);
create table if not exists mx13_n03.inbox (
  crossing_id text primary key check (crossing_id ~ '^relatte-crossing-v0:[0-9a-f]{64}$'),
  source_node_id text not null,
  state text not null check (state in ('HOLD','RESOLVED')),
  hold_receipt_id text not null,
  disposition_receipt_id text,
  envelope jsonb not null,
  payload_address text not null references mx13_n03.payloads(address),
  received_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((state='HOLD' and disposition_receipt_id is null) or (state='RESOLVED' and disposition_receipt_id is not null))
);
create table if not exists mx13_n03.outbox (
  crossing_id text primary key check (crossing_id ~ '^relatte-crossing-v0:[0-9a-f]{64}$'),
  destination_node_id text not null,
  envelope jsonb not null,
  payload_address text not null references mx13_n03.payloads(address),
  state text not null default 'PENDING' check (state in ('PENDING','COMPLETE')),
  attempts integer not null default 0 check (attempts >= 0),
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists mx13_n03.constitution_events (
  event_id text primary key,
  crossing_id text not null,
  class text not null,
  body jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists mx13_n03_constitution_events_crossing_idx on mx13_n03.constitution_events(crossing_id,created_at);
create table if not exists mx13_n03.ancestry (
  child_ref text not null,
  parent_ref text not null,
  relation text not null,
  created_at timestamptz not null default now(),
  primary key(child_ref,parent_ref,relation)
);
revoke all on all tables in schema mx13_n03 from public, anon, authenticated;
alter default privileges in schema mx13_n03 revoke all on tables from public, anon, authenticated;
alter default privileges in schema mx13_n03 revoke all on sequences from public, anon, authenticated;

create schema if not exists mx13_n05;
revoke all on schema mx13_n05 from public, anon, authenticated;

create table if not exists mx13_n05.payloads (
  address text primary key check (address ~ '^sha256:[0-9a-f]{64}$'),
  bytes bytea not null,
  byte_length integer not null check (byte_length between 0 and 1048576),
  observed_name text not null,
  detected_media_type text not null,
  received_at timestamptz not null default now(),
  check (octet_length(bytes) = byte_length)
);
create table if not exists mx13_n05.receipts (
  receipt_id text primary key check (receipt_id ~ '^relatte-receipt-v0:[0-9a-f]{64}$'),
  kind text not null,
  body jsonb not null,
  created_at timestamptz not null default now()
);
create table if not exists mx13_n05.inbox (
  crossing_id text primary key check (crossing_id ~ '^relatte-crossing-v0:[0-9a-f]{64}$'),
  source_node_id text not null,
  state text not null check (state in ('HOLD','RESOLVED')),
  hold_receipt_id text not null,
  disposition_receipt_id text,
  envelope jsonb not null,
  payload_address text not null references mx13_n05.payloads(address),
  received_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((state='HOLD' and disposition_receipt_id is null) or (state='RESOLVED' and disposition_receipt_id is not null))
);
create table if not exists mx13_n05.outbox (
  crossing_id text primary key check (crossing_id ~ '^relatte-crossing-v0:[0-9a-f]{64}$'),
  destination_node_id text not null,
  envelope jsonb not null,
  payload_address text not null references mx13_n05.payloads(address),
  state text not null default 'PENDING' check (state in ('PENDING','COMPLETE')),
  attempts integer not null default 0 check (attempts >= 0),
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists mx13_n05.constitution_events (
  event_id text primary key,
  crossing_id text not null,
  class text not null,
  body jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists mx13_n05_constitution_events_crossing_idx on mx13_n05.constitution_events(crossing_id,created_at);
create table if not exists mx13_n05.ancestry (
  child_ref text not null,
  parent_ref text not null,
  relation text not null,
  created_at timestamptz not null default now(),
  primary key(child_ref,parent_ref,relation)
);
revoke all on all tables in schema mx13_n05 from public, anon, authenticated;
alter default privileges in schema mx13_n05 revoke all on tables from public, anon, authenticated;
alter default privileges in schema mx13_n05 revoke all on sequences from public, anon, authenticated;

create schema if not exists mx13_n07;
revoke all on schema mx13_n07 from public, anon, authenticated;

create table if not exists mx13_n07.payloads (
  address text primary key check (address ~ '^sha256:[0-9a-f]{64}$'),
  bytes bytea not null,
  byte_length integer not null check (byte_length between 0 and 1048576),
  observed_name text not null,
  detected_media_type text not null,
  received_at timestamptz not null default now(),
  check (octet_length(bytes) = byte_length)
);
create table if not exists mx13_n07.receipts (
  receipt_id text primary key check (receipt_id ~ '^relatte-receipt-v0:[0-9a-f]{64}$'),
  kind text not null,
  body jsonb not null,
  created_at timestamptz not null default now()
);
create table if not exists mx13_n07.inbox (
  crossing_id text primary key check (crossing_id ~ '^relatte-crossing-v0:[0-9a-f]{64}$'),
  source_node_id text not null,
  state text not null check (state in ('HOLD','RESOLVED')),
  hold_receipt_id text not null,
  disposition_receipt_id text,
  envelope jsonb not null,
  payload_address text not null references mx13_n07.payloads(address),
  received_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((state='HOLD' and disposition_receipt_id is null) or (state='RESOLVED' and disposition_receipt_id is not null))
);
create table if not exists mx13_n07.outbox (
  crossing_id text primary key check (crossing_id ~ '^relatte-crossing-v0:[0-9a-f]{64}$'),
  destination_node_id text not null,
  envelope jsonb not null,
  payload_address text not null references mx13_n07.payloads(address),
  state text not null default 'PENDING' check (state in ('PENDING','COMPLETE')),
  attempts integer not null default 0 check (attempts >= 0),
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists mx13_n07.constitution_events (
  event_id text primary key,
  crossing_id text not null,
  class text not null,
  body jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists mx13_n07_constitution_events_crossing_idx on mx13_n07.constitution_events(crossing_id,created_at);
create table if not exists mx13_n07.ancestry (
  child_ref text not null,
  parent_ref text not null,
  relation text not null,
  created_at timestamptz not null default now(),
  primary key(child_ref,parent_ref,relation)
);
revoke all on all tables in schema mx13_n07 from public, anon, authenticated;
alter default privileges in schema mx13_n07 revoke all on tables from public, anon, authenticated;
alter default privileges in schema mx13_n07 revoke all on sequences from public, anon, authenticated;

create schema if not exists mx13_n09;
revoke all on schema mx13_n09 from public, anon, authenticated;

create table if not exists mx13_n09.payloads (
  address text primary key check (address ~ '^sha256:[0-9a-f]{64}$'),
  bytes bytea not null,
  byte_length integer not null check (byte_length between 0 and 1048576),
  observed_name text not null,
  detected_media_type text not null,
  received_at timestamptz not null default now(),
  check (octet_length(bytes) = byte_length)
);
create table if not exists mx13_n09.receipts (
  receipt_id text primary key check (receipt_id ~ '^relatte-receipt-v0:[0-9a-f]{64}$'),
  kind text not null,
  body jsonb not null,
  created_at timestamptz not null default now()
);
create table if not exists mx13_n09.inbox (
  crossing_id text primary key check (crossing_id ~ '^relatte-crossing-v0:[0-9a-f]{64}$'),
  source_node_id text not null,
  state text not null check (state in ('HOLD','RESOLVED')),
  hold_receipt_id text not null,
  disposition_receipt_id text,
  envelope jsonb not null,
  payload_address text not null references mx13_n09.payloads(address),
  received_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((state='HOLD' and disposition_receipt_id is null) or (state='RESOLVED' and disposition_receipt_id is not null))
);
create table if not exists mx13_n09.outbox (
  crossing_id text primary key check (crossing_id ~ '^relatte-crossing-v0:[0-9a-f]{64}$'),
  destination_node_id text not null,
  envelope jsonb not null,
  payload_address text not null references mx13_n09.payloads(address),
  state text not null default 'PENDING' check (state in ('PENDING','COMPLETE')),
  attempts integer not null default 0 check (attempts >= 0),
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists mx13_n09.constitution_events (
  event_id text primary key,
  crossing_id text not null,
  class text not null,
  body jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists mx13_n09_constitution_events_crossing_idx on mx13_n09.constitution_events(crossing_id,created_at);
create table if not exists mx13_n09.ancestry (
  child_ref text not null,
  parent_ref text not null,
  relation text not null,
  created_at timestamptz not null default now(),
  primary key(child_ref,parent_ref,relation)
);
revoke all on all tables in schema mx13_n09 from public, anon, authenticated;
alter default privileges in schema mx13_n09 revoke all on tables from public, anon, authenticated;
alter default privileges in schema mx13_n09 revoke all on sequences from public, anon, authenticated;

create schema if not exists mx13_n11;
revoke all on schema mx13_n11 from public, anon, authenticated;

create table if not exists mx13_n11.payloads (
  address text primary key check (address ~ '^sha256:[0-9a-f]{64}$'),
  bytes bytea not null,
  byte_length integer not null check (byte_length between 0 and 1048576),
  observed_name text not null,
  detected_media_type text not null,
  received_at timestamptz not null default now(),
  check (octet_length(bytes) = byte_length)
);
create table if not exists mx13_n11.receipts (
  receipt_id text primary key check (receipt_id ~ '^relatte-receipt-v0:[0-9a-f]{64}$'),
  kind text not null,
  body jsonb not null,
  created_at timestamptz not null default now()
);
create table if not exists mx13_n11.inbox (
  crossing_id text primary key check (crossing_id ~ '^relatte-crossing-v0:[0-9a-f]{64}$'),
  source_node_id text not null,
  state text not null check (state in ('HOLD','RESOLVED')),
  hold_receipt_id text not null,
  disposition_receipt_id text,
  envelope jsonb not null,
  payload_address text not null references mx13_n11.payloads(address),
  received_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((state='HOLD' and disposition_receipt_id is null) or (state='RESOLVED' and disposition_receipt_id is not null))
);
create table if not exists mx13_n11.outbox (
  crossing_id text primary key check (crossing_id ~ '^relatte-crossing-v0:[0-9a-f]{64}$'),
  destination_node_id text not null,
  envelope jsonb not null,
  payload_address text not null references mx13_n11.payloads(address),
  state text not null default 'PENDING' check (state in ('PENDING','COMPLETE')),
  attempts integer not null default 0 check (attempts >= 0),
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists mx13_n11.constitution_events (
  event_id text primary key,
  crossing_id text not null,
  class text not null,
  body jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists mx13_n11_constitution_events_crossing_idx on mx13_n11.constitution_events(crossing_id,created_at);
create table if not exists mx13_n11.ancestry (
  child_ref text not null,
  parent_ref text not null,
  relation text not null,
  created_at timestamptz not null default now(),
  primary key(child_ref,parent_ref,relation)
);
revoke all on all tables in schema mx13_n11 from public, anon, authenticated;
alter default privileges in schema mx13_n11 revoke all on tables from public, anon, authenticated;
alter default privileges in schema mx13_n11 revoke all on sequences from public, anon, authenticated;

create schema if not exists mx13_n13;
revoke all on schema mx13_n13 from public, anon, authenticated;

create table if not exists mx13_n13.payloads (
  address text primary key check (address ~ '^sha256:[0-9a-f]{64}$'),
  bytes bytea not null,
  byte_length integer not null check (byte_length between 0 and 1048576),
  observed_name text not null,
  detected_media_type text not null,
  received_at timestamptz not null default now(),
  check (octet_length(bytes) = byte_length)
);
create table if not exists mx13_n13.receipts (
  receipt_id text primary key check (receipt_id ~ '^relatte-receipt-v0:[0-9a-f]{64}$'),
  kind text not null,
  body jsonb not null,
  created_at timestamptz not null default now()
);
create table if not exists mx13_n13.inbox (
  crossing_id text primary key check (crossing_id ~ '^relatte-crossing-v0:[0-9a-f]{64}$'),
  source_node_id text not null,
  state text not null check (state in ('HOLD','RESOLVED')),
  hold_receipt_id text not null,
  disposition_receipt_id text,
  envelope jsonb not null,
  payload_address text not null references mx13_n13.payloads(address),
  received_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((state='HOLD' and disposition_receipt_id is null) or (state='RESOLVED' and disposition_receipt_id is not null))
);
create table if not exists mx13_n13.outbox (
  crossing_id text primary key check (crossing_id ~ '^relatte-crossing-v0:[0-9a-f]{64}$'),
  destination_node_id text not null,
  envelope jsonb not null,
  payload_address text not null references mx13_n13.payloads(address),
  state text not null default 'PENDING' check (state in ('PENDING','COMPLETE')),
  attempts integer not null default 0 check (attempts >= 0),
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists mx13_n13.constitution_events (
  event_id text primary key,
  crossing_id text not null,
  class text not null,
  body jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists mx13_n13_constitution_events_crossing_idx on mx13_n13.constitution_events(crossing_id,created_at);
create table if not exists mx13_n13.ancestry (
  child_ref text not null,
  parent_ref text not null,
  relation text not null,
  created_at timestamptz not null default now(),
  primary key(child_ref,parent_ref,relation)
);
revoke all on all tables in schema mx13_n13 from public, anon, authenticated;
alter default privileges in schema mx13_n13 revoke all on tables from public, anon, authenticated;
alter default privileges in schema mx13_n13 revoke all on sequences from public, anon, authenticated;
