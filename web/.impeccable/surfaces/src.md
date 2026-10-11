---
version: 1
slug: "src"
primary_target: "src"
related_targets: []
---

# Surface: HR investigation dashboard (web/src)

Mode: Operate. Audience: HR reviewer triaging daily (primary); investigator, committee, independent reviewer with role-trimmed views.
Task: see what is happening, what needs attention, act. Seven pages: Overview, Complaints Queue, Case Dossier, Committee Management, Witness Quorum, Investigation Inbox, Pattern Intelligence.
Constraints: preserve every API call, mock/live behaviour and role restriction; no invented metrics or verification claims; changes only in web/.
Build path: code-led (no image generation available).

## Direction contract

THESIS: A case-work desk, not a vanity dashboard. Refuses the category default of decorative KPI tiles, fake trend charts and calendars; every number on screen is counted from real cases, challenges, witness summaries or audit events.

OWN-WORLD: Lavender ground (#EFECF9), white 20px-radius cards with soft offset shadows, deep violet (#4F33B8) for primary actions, active navigation and the hero band; teal (#0E9384) only for verified/positive states and one data series; orange (#E2622B) for "needs attention"; near-black ink panel (#191629) for the action list. Figtree for UI, JetBrains Mono for case IDs and hashes only.

STORY: The reviewer lands, reads the violet hero band (counts of open cases, urgent, challenges, witness responses pending), scans the dark "Next actions" list derived from live state, opens a case from the priority queue, and acts in the dossier.

FIRST VIEWPORT: Top bar: wordmark left, white pill tab group centre with sliding violet active pill, data-source chip + attention bell + persona avatar right. Below, 12-col grid: violet hero band (8 cols) with page title, date, greeting and four white stat chips; dark Next-actions panel (4 cols) right. Second row: priority queue table (8) and queue-by-status bars (4).

FORM: Pinned by the brief (user-supplied Finova reference); no concept-seed roll. Signature move: the sliding violet pill that tracks the active page in the top tab group, echoed by the case-stage track in the dossier.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
