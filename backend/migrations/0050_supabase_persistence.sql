-- ==============================================================================
-- INCOGNITO 0050: Supabase persistence — schema verification (read-only)
--
-- The canonical tables already exist in the project and were verified in the SQL editor. This file does NOT
-- create, alter, drop or re-policy anything. It only checks that the columns the backend writes
-- (backend/app/core/supabase_repo.py, backend/app/core/supabase_audit.py) are present, and that the evidence
-- bucket exists and is private, and raises an error naming whatever is missing.
--
-- Replaces an earlier draft that redefined the tables with different names (case_id, encrypted_title, sha256,
-- storage_path, sender, ...), added duplicate alias columns, and dropped/recreated RLS and Storage policies. None
-- of that matches the verified schema, and policy changes are out of scope for application migrations.
--
-- Canonical columns used by the backend:
--   reports                 id, public_reference, category, summary_ciphertext, description_ciphertext,
--                           severity (low|medium|high|critical),
--                           status (submitted|triage|under_review|awaiting_info|resolved|closed), updated_at
--   evidence_items          id, report_id, storage_object_path, sha256_hex, mime_type, size_bytes, created_at
--   committee_challenges    id, report_id, committee_member_ref, reason_ciphertext,
--                           status (pending|accepted|rejected|reassigned), decision_note_ciphertext, decided_at
--   witness_invitations     id, report_id, invitation_token_hash, witness_contact_ciphertext,
--                           status (invited|accepted|declined|expired), invited_at, responded_at
--   investigation_messages  id, report_id, sender_role (reporter|investigator|system), body_ciphertext, created_at
--   audit_events            report_id, event_type, actor_role, metadata, previous_hash, event_hash,
--                           blockchain_tx_hash
--   incident_correlations   id, report_id_a, report_id_b, similarity_score, rationale_ciphertext,
--                           review_status (pending|reviewed|dismissed); UNIQUE(report_id_a, report_id_b)
-- Storage: private bucket 'incognito-evidence', 10 MB per object, image/jpeg, image/png, application/pdf,
-- text/plain. Objects are AES-256-GCM encrypted by the backend before upload.
--
-- Workflow state with no canonical column is proposed separately in 0051_report_workflow.sql.
-- ==============================================================================

do $$
declare
    required constant text[][] := array[
        ['reports', 'id'], ['reports', 'public_reference'], ['reports', 'category'],
        ['reports', 'summary_ciphertext'], ['reports', 'description_ciphertext'], ['reports', 'severity'],
        ['reports', 'status'], ['reports', 'created_at'], ['reports', 'updated_at'],
        ['evidence_items', 'id'], ['evidence_items', 'report_id'], ['evidence_items', 'storage_object_path'],
        ['evidence_items', 'sha256_hex'], ['evidence_items', 'mime_type'], ['evidence_items', 'size_bytes'],
        ['evidence_items', 'created_at'],
        ['committee_challenges', 'id'], ['committee_challenges', 'report_id'],
        ['committee_challenges', 'committee_member_ref'], ['committee_challenges', 'reason_ciphertext'],
        ['committee_challenges', 'status'], ['committee_challenges', 'decision_note_ciphertext'],
        ['committee_challenges', 'decided_at'],
        ['witness_invitations', 'id'], ['witness_invitations', 'report_id'],
        ['witness_invitations', 'invitation_token_hash'], ['witness_invitations', 'witness_contact_ciphertext'],
        ['witness_invitations', 'status'], ['witness_invitations', 'invited_at'],
        ['witness_invitations', 'responded_at'],
        ['investigation_messages', 'id'], ['investigation_messages', 'report_id'],
        ['investigation_messages', 'sender_role'], ['investigation_messages', 'body_ciphertext'],
        ['investigation_messages', 'created_at'],
        ['audit_events', 'report_id'], ['audit_events', 'event_type'], ['audit_events', 'actor_role'],
        ['audit_events', 'metadata'], ['audit_events', 'previous_hash'], ['audit_events', 'event_hash'],
        ['audit_events', 'blockchain_tx_hash'],
        ['incident_correlations', 'id'], ['incident_correlations', 'report_id_a'],
        ['incident_correlations', 'report_id_b'], ['incident_correlations', 'similarity_score'],
        ['incident_correlations', 'rationale_ciphertext'], ['incident_correlations', 'review_status']
    ];
    missing text := '';
    i int;
begin
    for i in 1 .. array_length(required, 1) loop
        if not exists (
            select 1 from information_schema.columns
            where table_schema = 'public' and table_name = required[i][1] and column_name = required[i][2]
        ) then
            missing := missing || format(' %s.%s', required[i][1], required[i][2]);
        end if;
    end loop;
    if missing <> '' then
        raise exception 'INCOGNITO schema check failed; missing columns:%', missing;
    end if;

    if not exists (select 1 from storage.buckets where id = 'incognito-evidence' and public = false) then
        raise exception 'INCOGNITO schema check failed: private bucket incognito-evidence not found';
    end if;
end
$$;
