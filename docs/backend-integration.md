# Backend integration and privacy notes

## Current state

The repo initially contained no `database/`, `shared/`, `docs/` or blockchain source. The backend therefore does not assume database columns or issue Supabase writes. `Database.require_schema()` fails closed until a teammate verifies the existing schema and explicitly implements the adapter. The known table names and private bucket settings are context only, not a schema contract.

The health endpoint, input schemas, advisory engines, cryptographic helpers, and development-only blockchain/email adapters are local and testable. Report submission currently validates input but returns HTTP 503 because storage cannot yet be done safely. Most investigator workflows return 501/503 for the same reason. No endpoint is evidence of a production integration.

## Safe schema inspection

Use the Supabase Dashboard SQL Editor with a read-only query, or Supabase CLI linked to the existing project after team approval/authentication. Do not paste the service key into chat, shell history, logs, or source. Save reviewed, non-secret output locally in `database/schema.sql`; inspect RLS policies and grants separately before enabling an adapter. For a catalog snapshot, run this read-only query:

```sql
select table_name, column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema = 'public'
  and table_name in ('reports','evidence_items','committee_challenges','witness_invitations','investigation_messages','audit_events','incident_correlations')
order by table_name, ordinal_position;
```

Also inspect `pg_enum`, `pg_policies`, foreign keys, indexes, and table grants. Never run migrations or policy changes from this backend setup. Only enable writes after columns, encrypted field representation, identity linkage, RLS, and audit behavior have been reviewed against a dedicated test project.

## Authentication boundary

Private routes verify Supabase Auth JWTs requiring expiry, issuer, authenticated audience, and subject. By default they use the project's JWKS discovery endpoint for ES256/RS256 signing keys; the JWKS client caches keys. `SUPABASE_JWT_SECRET` explicitly switches to legacy HS256 verification. Supabase recommends verified claims/JWKS for asymmetric keys and warns legacy shared-secret verification needs separate consideration. Roles are read from verified claims, never request payloads. The exact role claim format and investigator-to-report assignment source still need teammate confirmation. Do not deploy as production until the configured auth mode is confirmed against the project.

Service key calls bypass RLS. Even after schema adapter implementation, every private read/write must authorize the verified identity and report assignment before using the service client.

## Privacy limits

Anonymous reporting does not mean perfect anonymity: timing, network, device, attachment metadata, and administrator access may correlate a report to a person. The application avoids body/header/IP logging and does not log request paths in error handling. Run Uvicorn with `--no-access-log`; reverse proxy, hosting, and Supabase logs must also be separately configured and reviewed. Do not accept live complaints/evidence until persistence encryption, authorization, and private object access have been implemented and tested.

AES-GCM helper accepts an externally managed 32-byte key; keys must be generated and stored outside the database and source. A future deployment must use a managed secret/KMS, key identifier/versioning, and rotation plan. The in-memory audit chain is test-only, not durable, ordered across workers, or tamper-proof. Durable append-only storage and concurrency-safe chain ordering need a database design with the schema owner.

## Blockchain boundary

`BlockchainAdapter` is development-only. It always returns `pending` without evidence and cannot claim proof verification or anchoring. The blockchain teammate must provide the interface, status semantics, idempotency behavior, and verified contract details. Backend rules may validate content/metadata, but proof/nullifier creation and cryptographic verification remain with the blockchain component. On-chain data must be limited to approved commitments.

## AI/ML limitations

Baselines run locally on synthetic examples and are triage aids only. Severity always requests human review; critical lexical signals are escalation cues, not findings. Correlation defaults to token Jaccard. Optional sentence-transformers mode only loads a pre-cached model with local-only behavior and silently falls back to the lexical baseline if unavailable. No report is merged, rejected, or deprioritized by an engine. Do not pass real allegations to external AI services.

## Routes

See [`../shared/m3-api-v1.yaml`](../shared/m3-api-v1.yaml) (this `/api/v1` app; the employee app and dashboard use [`../shared/api-contract.yaml`](../shared/api-contract.yaml)) and the live `/docs`. Routes tagged as integration-dependent return explicit 503/501 responses. The report POST only becomes available after safe persistence is implemented. Notifications report that delivery is not configured. Private routes require a verified Bearer JWT.
