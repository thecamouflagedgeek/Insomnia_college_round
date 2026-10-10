-- INCOGNITO chain tables (owner: Member 4). No foreign keys to employees, by design.
create table if not exists zk_members (
  member_index        integer primary key,
  identity_commitment numeric(78,0) not null unique,
  merkle_root         numeric(78,0) not null,
  tx_hash             text not null,
  created_at          timestamptz not null default now()
);

create table if not exists zk_nullifiers (
  nullifier  numeric(78,0) primary key,
  scope      numeric(78,0) not null,
  message    numeric(78,0) not null,
  kind       text not null,
  tx_hash    text not null,
  created_at timestamptz not null default now()
);

create table if not exists audit_events (
  id          bigserial primary key,
  case_id     text not null,
  seq         integer not null,
  event_type  text not null,
  payload     jsonb not null,
  salt        text not null,
  commitment  text not null,
  prev_hash   text not null,
  entry_hash  text not null,
  created_at  timestamptz not null default now(),
  unique (case_id, seq)
);

create table if not exists audit_anchors (
  case_id      text not null,
  seq          integer not null,
  head         text not null,
  tx_hash      text not null,
  block_number bigint not null,
  anchored_at  timestamptz not null default now(),
  primary key (case_id, seq)
);

-- Append-only. The tamper demo disables this on purpose (rogue DB admin); detection never relies on it.
create or replace function audit_append_only() returns trigger language plpgsql as $$
begin
  raise exception '% is append-only', tg_table_name;
end $$;

drop trigger if exists audit_events_append_only on audit_events;
create trigger audit_events_append_only before update or delete on audit_events
  for each row execute function audit_append_only();

drop trigger if exists audit_anchors_append_only on audit_anchors;
create trigger audit_anchors_append_only before update or delete on audit_anchors
  for each row execute function audit_append_only();
