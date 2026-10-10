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
