-- ==============================================================================
-- INCOGNITO 0051 (PROPOSAL — review before applying; not applied anywhere)
-- One additive table for workflow state the canonical schema has no column for.
--
-- Why it is needed. Without it these cannot survive a restart, and the backend refuses to save a report
-- (save_report fails with persistence_failed) rather than pretend it did:
--   - token_hash: SHA-256 of the reporter's case token. The only credential for an anonymous case; without it
--     the reporter loses access to their own case after a restart.
--   - lifecycle_stage: the finer workflow stage (committee_assigned, under_challenge, investigating, ...).
--     reports.status keeps the constrained value (triage, under_review, ...) mapped from it.
--   - state_ciphertext: AES-256-GCM encrypted JSON with
--       raw_payload (the exact submitted payload: its hash is sealed in the Silent Audit, so it must round-trip
--         byte for byte), committee member ids, investigator id, members removed by upheld challenges,
--         nullifier and proof transaction, severity signals, integrity flags, subject reference, duplicate
--         fingerprint, resolution (outcome, summary, reform actions), reporter feedback (Reflect & Reform),
--         evidence file names.
--
-- Why one table, not new columns or several tables. This is the smallest change that stores everything the
-- running features need, and it keeps the canonical tables exactly as verified. The cost: committee seats,
-- outcomes and feedback are not queryable in SQL. If reporting needs that later, split out committee_assignments
-- (report_id, member_ref, seated_at, removed_at) and report_outcomes in a follow-up migration.
--
-- Security. RLS on, no policies, nothing granted to anon or authenticated: only the backend's server key can
-- reach it, and the backend authorizes every request before touching it. Deleting a report with workflow state
-- is restricted rather than cascaded.
-- ==============================================================================

create table if not exists public.report_workflow (
    report_id        uuid primary key references public.reports(id) on delete restrict,
    lifecycle_stage  text not null check (lifecycle_stage in (
                         'submitted', 'committee_assigned', 'under_challenge', 'investigating',
                         'witness_quorum_active', 'resolved', 'closed')),
    token_hash       text not null check (token_hash ~ '^[0-9a-f]{64}$'),
    state_ciphertext text not null,
    updated_at       timestamptz not null default now()
);

alter table public.report_workflow enable row level security;
revoke all on table public.report_workflow from anon, authenticated;
