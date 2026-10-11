-- ==============================================================================
-- INCOGNITO MIGRATION 0050: Supabase Persistence Layer (Proposed)
--
-- Objective:
--   Establish the canonical database schema for reports, private evidence,
--   committee challenges, witness invitations, investigation messaging,
--   audit events, and incident correlations.
--
-- Safeguards & Notice:
--   DO NOT apply directly to production without team review and approval.
--   Use with a dedicated development/staging Supabase project.
--   All sensitive text fields (title, narrative, contacts, message bodies)
--   are encrypted client-/backend-side with AES-256-GCM before database insertion.
-- ==============================================================================

-- 1. REPORTS TABLE
-- Canonical persistent source of truth for all complaints and incident reports.
create table if not exists reports (
    id uuid primary key default gen_random_uuid(),
    case_id text not null unique,                      -- Human-readable case identifier e.g. "CASE-2026-001" or "INC-..."
    token_hash text not null,                          -- SHA-256 digest of the anonymous reporter's single-use case token
    category text not null,                            -- Primary category
    categories jsonb not null default '[]'::jsonb,     -- Multi-category tags or suggestions
    encrypted_title text not null,                     -- AES-256-GCM ciphertext
    encrypted_narrative text not null,                 -- AES-256-GCM ciphertext
    title_aad text not null default '',                -- Associated Authenticated Data for title
    narrative_aad text not null default '',            -- Associated Authenticated Data for narrative
    incident_date date,                                -- Optional date of incident
    client_nonce text,                                 -- Client replay-prevention nonce
    subject_ref text,                                  -- Opaque directory reference for reported subject (for repeat allegations)
    status text not null default 'submitted',          -- 'submitted', 'committee_assigned', 'under_challenge', 'investigating', 'resolved', 'closed'
    severity jsonb,                                    -- Triage severity assessment { "level": "high", "signals": [...] }
    integrity_flags jsonb not null default '[]'::jsonb,-- Lexical & integrity cue flags
    nullifier text,                                    -- ZK Semaphore nullifier hash
    proof_tx text,                                     -- Polygon on-chain seal transaction hash
    investigator_id text,                              -- Assigned staff ID e.g. "usr_sarah"
    committee jsonb not null default '[]'::jsonb,      -- Array of seated committee members [{ "member_id": "...", "name": "...", "role": "..." }]
    revoked_ids jsonb not null default '[]'::jsonb,    -- Array of member IDs removed by upheld challenges
    resolution jsonb,                                  -- Outcome record { "outcome": "...", "summary": "...", "actions": [...] }
    reflection jsonb,                                  -- Reporter post-resolution feedback { "fairness": 5, "felt_safe": true, "would_report_again": true, "at": "..." }
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists idx_reports_case_id on reports(case_id);
create index if not exists idx_reports_status on reports(status);
create index if not exists idx_reports_token_hash on reports(token_hash);
create index if not exists idx_reports_subject_ref on reports(subject_ref) where subject_ref is not null;
create index if not exists idx_reports_created_at on reports(created_at desc);

-- 2. EVIDENCE ITEMS TABLE
-- Metadata, hashes, and private Supabase Storage paths for sealed case attachments.
create table if not exists evidence_items (
    id text primary key,                               -- Evidence ID e.g. "EVD-001"
    case_id text not null references reports(case_id) on delete cascade,
    name text not null,                                -- Original sanitized filename
    mime text not null,                                -- MIME type (validated against allowlist)
    size bigint not null,                              -- File size in bytes (max 20MB)
    sha256 text not null,                              -- SHA-256 content hash
    storage_path text,                                 -- Path in private Supabase Storage bucket e.g. "cases/CASE-2026-001/EVD-001"
    bucket text not null default 'incognito-evidence', -- Supabase Storage bucket name (private)
    verification_status text not null default 'verified',
    created_at timestamptz not null default now()
);

create index if not exists idx_evidence_case_id on evidence_items(case_id);
create index if not exists idx_evidence_sha256 on evidence_items(sha256);

-- 3. COMMITTEE CHALLENGES TABLE
-- Impartiality challenges filed by anonymous reporters against seated committee members.
create table if not exists committee_challenges (
    id text primary key,                               -- Challenge ID e.g. "CHL-001"
    case_id text not null references reports(case_id) on delete cascade,
    member_id text not null,                           -- Challenged committee member staff ID
    reason text not null,                              -- "Professional relationship", "Personal relationship", "Prior involvement", "Other"
    explanation text not null,                         -- Confidential explanation submitted by reporter
    status text not null default 'pending_review',     -- 'pending_review', 'upheld', 'rejected'
    proof_tx text,                                     -- ZK challenge proof transaction hash
    nullifier text,                                    -- ZK challenge nullifier
    decided_at timestamptz,                            -- Timestamp when independent reviewer adjudicated
    reviewer_id text,                                  -- Staff ID of adjudicating independent reviewer
    rationale text,                                    -- Decision rationale
    created_at timestamptz not null default now()
);

create index if not exists idx_challenges_case_id on committee_challenges(case_id);
create index if not exists idx_challenges_member_id on committee_challenges(member_id);
create index if not exists idx_challenges_status on committee_challenges(status);

-- 4. WITNESS INVITATIONS TABLE
-- Confidential witness quorum invitations and opt-in responses.
create table if not exists witness_invitations (
    id text primary key,                               -- Invitation ID e.g. "WIT-001"
    case_id text not null references reports(case_id) on delete cascade,
    code text not null unique,                         -- Secure one-time code or token digest
    role_alias text not null,                          -- Anonymized alias e.g. "Witness A"
    encrypted_contact text,                            -- Encrypted contact details (AES-256-GCM)
    contact_aad text,
    status text not null default 'pending',            -- 'pending', 'accepted', 'declined'
    expires_at timestamptz,
    statement_provided boolean not null default false,
    created_at timestamptz not null default now(),
    responded_at timestamptz
);

create index if not exists idx_witness_case_id on witness_invitations(case_id);
create index if not exists idx_witness_code on witness_invitations(code);

-- 5. INVESTIGATION MESSAGES TABLE
-- Encrypted bilateral communication thread between anonymous reporter and investigation team.
create table if not exists investigation_messages (
    id text primary key,                               -- Message ID e.g. "MSG-001"
    case_id text not null references reports(case_id) on delete cascade,
    sender text not null,                              -- 'you' (reporter) or 'investigator'
    encrypted_body text not null,                      -- AES-256-GCM encrypted message body
    body_aad text not null default '',
    created_at timestamptz not null default now()
);

create index if not exists idx_messages_case_id on investigation_messages(case_id);
create index if not exists idx_messages_created_at on investigation_messages(created_at asc);

-- 6. INCIDENT CORRELATIONS TABLE
-- Advisory correlation scores derived between cases (Repeat Allegation & Pattern Intelligence).
create table if not exists incident_correlations (
    id bigserial primary key,
    case_id_a text not null references reports(case_id) on delete cascade,
    case_id_b text not null references reports(case_id) on delete cascade,
    score double precision not null,                   -- 0.0 to 1.0 similarity score
    method text not null,                              -- "subject_match", "token_jaccard", "embedding"
    signals jsonb not null default '[]'::jsonb,
    created_at timestamptz not null default now(),
    unique(case_id_a, case_id_b, method)
);

create index if not exists idx_correlations_case_a on incident_correlations(case_id_a);
create index if not exists idx_correlations_case_b on incident_correlations(case_id_b);

-- 7. ROW LEVEL SECURITY (RLS) POLICIES
-- In INCOGNITO, backend services use the service role key to perform authorized operations
-- after server-side cryptographic and role validation.
-- Direct anon access to sensitive tables is blocked by default.
alter table reports enable row level security;
alter table evidence_items enable row level security;
alter table committee_challenges enable row level security;
alter table witness_invitations enable row level security;
alter table investigation_messages enable row level security;
alter table incident_correlations enable row level security;

-- Fail-closed default: deny all direct anon/public access
-- (Service role key bypasses RLS on the server boundary).
drop policy if exists no_direct_anon_reports on reports;
create policy no_direct_anon_reports on reports for all to anon using (false);

drop policy if exists no_direct_anon_evidence on evidence_items;
create policy no_direct_anon_evidence on evidence_items for all to anon using (false);

drop policy if exists no_direct_anon_challenges on committee_challenges;
create policy no_direct_anon_challenges on committee_challenges for all to anon using (false);

drop policy if exists no_direct_anon_witness on witness_invitations;
create policy no_direct_anon_witness on witness_invitations for all to anon using (false);

drop policy if exists no_direct_anon_messages on investigation_messages;
create policy no_direct_anon_messages on investigation_messages for all to anon using (false);

drop policy if exists no_direct_anon_correlations on incident_correlations;
create policy no_direct_anon_correlations on incident_correlations for all to anon using (false);

-- 8. STORAGE BUCKET CONFIGURATION (Supabase Storage)
-- Create the private evidence bucket if not exists (public = false)
insert into storage.buckets (id, name, public)
values ('incognito-evidence', 'incognito-evidence', false)
on conflict (id) do update set public = false;

-- Deny public reading of private evidence objects
drop policy if exists deny_public_evidence_read on storage.objects;
create policy deny_public_evidence_read on storage.objects
    for select to anon using (bucket_id != 'incognito-evidence');

-- ==============================================================================
-- 9. SAFE ADDITIVE SCHEMA RECONCILIATION
-- Ensures existing projects provisioned with baseline schema column names
-- seamlessly support all application repository read/write paths.
-- ==============================================================================

-- reports table additive reconciliation
alter table reports add column if not exists public_reference text;
alter table reports add column if not exists summary_ciphertext text;
alter table reports add column if not exists description_ciphertext text;
alter table reports add column if not exists outcome jsonb;
alter table reports add column if not exists feedback jsonb;
alter table reports add column if not exists accused_person text;
alter table reports add column if not exists committee_assignments jsonb default '[]'::jsonb;

-- evidence_items table additive reconciliation
alter table evidence_items add column if not exists report_reference text;
alter table evidence_items add column if not exists storage_object_path text;
alter table evidence_items add column if not exists sha256_hash text;
alter table evidence_items add column if not exists mime_type text;
alter table evidence_items add column if not exists file_size bigint;

-- committee_challenges table additive reconciliation
alter table committee_challenges add column if not exists report_reference text;
alter table committee_challenges add column if not exists committee_member_reference text;
alter table committee_challenges add column if not exists encrypted_rationale text;
alter table committee_challenges add column if not exists encrypted_decision_note text;

-- witness_invitations table additive reconciliation
alter table witness_invitations add column if not exists report_reference text;
alter table witness_invitations add column if not exists token_hash text;

-- investigation_messages table additive reconciliation
alter table investigation_messages add column if not exists report_reference text;
alter table investigation_messages add column if not exists sender_role text;
alter table investigation_messages add column if not exists encrypted_message_body text;

-- audit_events table additive reconciliation
alter table audit_events add column if not exists report_reference text;
alter table audit_events add column if not exists actor_role text;
alter table audit_events add column if not exists metadata jsonb;
alter table audit_events add column if not exists previous_hash text;
alter table audit_events add column if not exists event_hash text;
alter table audit_events add column if not exists tx_hash text;

-- incident_correlations table additive reconciliation
alter table incident_correlations add column if not exists report_references jsonb;
alter table incident_correlations add column if not exists similarity_score double precision;
alter table incident_correlations add column if not exists encrypted_rationale text;
alter table incident_correlations add column if not exists review_status text default 'pending';

-- ==============================================================================
-- 10. DEVELOPER READ-ONLY SCHEMA INSPECTION QUERY
-- Run this read-only query in Supabase SQL Editor to verify remote table columns.
-- ==============================================================================
/*
SELECT
    table_name,
    column_name,
    data_type,
    is_nullable
FROM
    information_schema.columns
WHERE
    table_schema = 'public'
    AND table_name IN (
        'reports',
        'evidence_items',
        'committee_challenges',
        'witness_invitations',
        'investigation_messages',
        'audit_events',
        'incident_correlations'
    )
ORDER BY
    table_name, ordinal_position;
*/
