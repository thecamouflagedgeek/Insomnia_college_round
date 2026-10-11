# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary: an HR reviewer (persona "Sarah Jenkins", role `hr_reviewer`) who opens the dashboard during the working day to triage anonymous misconduct reports, see what needs a decision, and route work. Other staff roles share the same dashboard with role-trimmed views enforced by the backend: assigned investigator (case dossier, inbox, witnesses), committee members (only their assigned cases), and an independent reviewer (adjudicates committee challenges).

## Product Purpose

INCOGNITO lets employees report workplace misconduct anonymously but verifiably, and gives the organisation an accountable process for handling those reports. The dashboard is the staff side: queue, case dossier, committee and challenge handling, voluntary witness quorum, two-way anonymous inbox, pattern cues across cases, case resolution, and an append-only Silent Audit trail.

Success: the reviewer can tell within seconds what is happening, what needs attention, and what to do next, without the interface overstating what the system has proven.

## Positioning

Reporter anonymity is enforced by Semaphore zero-knowledge membership proofs checked on Polygon Amoy, and every case action is written to a hash-chained Silent Audit log anchored on-chain. Reporters can challenge a committee member for conflict of interest; an independent reviewer decides, and an upheld challenge revokes that member's access server-side.

## Operating Context

- Dashboard: React 19 + Vite + Tailwind v4 in `web/`; data via `web/src/services/api.ts` (live `/hr/*` FastAPI routes with `X-Stub-Admin` + `X-Staff-Id`, falling back to an in-browser mock when the backend is unreachable or `VITE_FORCE_MOCK=true`).
- Persona switcher stands in for login during the hackathon demo; role checks are enforced by the backend.
- Companion: the Flutter employee app (reporter side).

## Capabilities and Constraints

- Real today: case list/detail, challenges + decisions, committee pool, witness invitations and summary, inbox messages, audit events with per-event verification status, evidence verification endpoint, related cases, patterns, resolution, Reflect & Reform insights (k ≥ 3 suppression), legal evidence PDF export.
- Not real: no endpoint assigns committee members manually; messages are not end-to-end encrypted (TLS in transit, AES-256-GCM at rest on the server); no ECDSA message signing.
- Pattern intelligence and related cases are review cues, never findings.
- Frontend changes stay inside `web/`; backend and API contracts are fixed.

## Brand Commitments

- Name: INCOGNITO. Lucide icons.
- Visual reference pinned by the user (2026-10-11): a lavender-ground dashboard with white cards, deep purple primary, selective teal, rounded cards, compact top navigation (see the Finova-style Pinterest screenshot).

## Evidence on Hand

Demo staff directory (Sarah, Elena, Marcus, Priya, Aris, David) and seeded demo cases on the offline backend. No real customers, outcomes, or statistics: never invent metrics, resolution trends, or verification results.

## Product Principles

1. Never claim more than the system proves: verification states, encryption, and chain anchoring are shown exactly as the backend reports them.
2. Allegations are not findings: severity, similarity, and repeat counts are cues for human review.
3. Next action first: every screen surfaces what the current role can and should do now.
4. Role honesty: hidden or redacted data is explained, not silently missing.
5. Demo and live are always distinguishable.

## Accessibility & Inclusion

WCAG 2.1 AA contrast, keyboard operation, visible focus, `prefers-reduced-motion` respected.
