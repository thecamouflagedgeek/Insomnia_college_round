---
name: INCOGNITO
description: Staff case-work desk for anonymous, verifiable misconduct reports.
colors:
  canvas-lavender: "#efecf9"
  surface: "#ffffff"
  sunken: "#f6f4fc"
  line: "#e4e0f1"
  line-strong: "#cfc8e6"
  ink: "#191629"
  ink-soft: "#3b3752"
  muted: "#66617f"
  night: "#191629"
  night-2: "#252139"
  brand-50: "#f3f0fd"
  brand-100: "#e6e0fb"
  brand-200: "#cfc4f6"
  brand-300: "#ad9bef"
  brand-500: "#6747d9"
  brand-600: "#4f33b8"
  brand-700: "#40289a"
  brand-800: "#321f78"
  teal-50: "#e6f6f3"
  teal-100: "#c6ece5"
  teal-500: "#13a594"
  teal-600: "#0e9384"
  teal-700: "#0b7569"
  attn-50: "#fdf0ea"
  attn-100: "#fbdccd"
  attn-500: "#e2622b"
  attn-600: "#c44f1d"
  attn-700: "#9c3d14"
  danger-50: "#fdecee"
  danger-100: "#f9d2d7"
  danger-500: "#d9364f"
  danger-600: "#bb2440"
  danger-700: "#961b33"
typography:
  display:
    fontFamily: "Figtree, ui-sans-serif, system-ui, sans-serif"
    fontSize: "2rem"
    fontWeight: 700
    lineHeight: 1.1
    letterSpacing: "-0.025em"
  headline:
    fontFamily: "Figtree, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.75rem"
    fontWeight: 700
    lineHeight: 1.15
    letterSpacing: "-0.025em"
  title:
    fontFamily: "Figtree, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 600
    lineHeight: 1.5
  body:
    fontFamily: "Figtree, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 400
    lineHeight: 1.5
    fontFeature: "'ss01'"
  label:
    fontFamily: "Figtree, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 600
    lineHeight: 1.33
  chip:
    fontFamily: "Figtree, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.6875rem"
    fontWeight: 600
    lineHeight: 1.2
  mono:
    fontFamily: "JetBrains Mono, ui-monospace, SFMono-Regular, Menlo, monospace"
    fontSize: "0.75rem"
    fontWeight: 600
    letterSpacing: "-0.01em"
rounded:
  lg: "8px"
  xl: "12px"
  2xl: "16px"
  card: "20px"
  full: "9999px"
spacing:
  gutter: "20px"
  card-pad-mobile: "20px"
  card-pad: "24px"
  page-x-mobile: "16px"
  page-x: "24px"
components:
  button-primary:
    backgroundColor: "{colors.brand-600}"
    textColor: "{colors.surface}"
    typography: "{typography.label}"
    rounded: "{rounded.full}"
    padding: "0 16px"
    height: "40px"
  button-primary-hover:
    backgroundColor: "{colors.brand-700}"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.full}"
    padding: "0 16px"
    height: "40px"
  button-secondary-hover:
    backgroundColor: "{colors.brand-50}"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.brand-700}"
    rounded: "{rounded.full}"
    padding: "0 16px"
    height: "40px"
  button-ghost-hover:
    backgroundColor: "{colors.brand-50}"
  button-teal:
    backgroundColor: "{colors.teal-600}"
    textColor: "{colors.surface}"
    rounded: "{rounded.full}"
    height: "40px"
  button-danger:
    backgroundColor: "{colors.danger-600}"
    textColor: "{colors.surface}"
    rounded: "{rounded.full}"
    height: "40px"
  button-sm:
    padding: "0 12px"
    height: "32px"
  icon-button:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink-soft}"
    rounded: "{rounded.full}"
    size: "40px"
  card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.card}"
    padding: "24px"
  field:
    backgroundColor: "{colors.sunken}"
    textColor: "{colors.ink}"
    rounded: "{rounded.xl}"
    padding: "8px 14px"
    height: "40px"
  field-focus:
    backgroundColor: "{colors.surface}"
  chip:
    typography: "{typography.chip}"
    rounded: "{rounded.full}"
    padding: "4px 10px"
  hero-band:
    backgroundColor: "{colors.brand-600}"
    textColor: "{colors.surface}"
    rounded: "{rounded.card}"
    padding: "28px"
  action-panel:
    backgroundColor: "{colors.night}"
    textColor: "{colors.surface}"
    rounded: "{rounded.card}"
    padding: "24px"
  nav-pill-active:
    backgroundColor: "{colors.brand-600}"
    textColor: "{colors.surface}"
    rounded: "{rounded.full}"
    padding: "8px 16px"
---

# Design System: INCOGNITO

## Overview

**Creative North Star: "The Case-Work Desk"**

A working desk for people who handle anonymous misconduct reports, not a vanity dashboard. The ground is a soft lavender that lets white cards float just above it; deep violet carries the one voice of action (primary buttons, the active navigation pill, the overview hero band), and a near-black ink panel holds the list of things to do now. Every number on screen is counted from real cases, challenges, witness summaries or audit events, so the system has no decorative KPI tiles, sparklines or trend charts to style.

Density is moderate and table-led: 13px body text, 12px labels, tabular numerals, rows that breathe at 10 to 12px vertical padding. Status and severity are carried by small rounded chips in tinted fills, each colour family bound to a meaning. Motion is short and expo-eased (200 to 300ms): cards rise on enter, the active nav pill slides between tabs, progress bars grow from the left. Everything collapses to zero under `prefers-reduced-motion`.

**Key Characteristics:**
- Lavender canvas, white 20px-radius cards with soft violet-tinted shadows.
- One violet accent for action and "where you are"; teal only for verified/positive; orange only for needs-attention; red only for critical/destructive.
- Pill geometry for anything you press or scan (buttons, chips, nav); generous rounded rectangles for anything that contains.
- Figtree for all UI, JetBrains Mono only for case IDs and hashes.
- Signature: the sliding violet pill in the top tab group, echoed by the four-segment case-stage track in the dossier.

## Colors

A cool lavender-and-violet field with three semantic accents, each kept to one meaning.

### Primary
- **Deep Case Violet** (brand-600): primary buttons, the active nav pill, the overview hero band, the current stage segment, the wordmark tile. Hover deepens to brand-700; brand-700 also colours ghost-button text and case-ID links. brand-50 / brand-100 are the tinted fills for info notices, section icon wells, "committee assigned" and "investigating" chips. brand-500 is the focus-ring colour; brand-200 the text-selection and hovered-card border; brand-300 marks completed stages.

### Secondary
- **Verified Teal** (teal-600): verified audit events, the live-backend chip, resolved status, success notices, the "resolved" data series, and the teal confirm button. Fills use teal-50 / teal-100 with teal-700 text.

### Tertiary
- **Attention Orange** (attn-500): needs-attention signals only: pending-challenge badges and the bell dot, "under challenge" status, high severity, the demo-data chip, warning notices, a challenged stage segment. Text on tinted fills uses attn-700. The code's `warn-*` tokens are aliases of the same orange values; there is no amber in this world.
- **Critical Red** (danger-600): critical severity and destructive actions only (danger button, danger notice). Fills danger-50 with danger-700 text.

### Neutral
- **Lavender Canvas** (canvas-lavender): page ground, also the translucent sticky top bar (85% with backdrop blur).
- **Card White** (surface): cards, the nav tab group, stat chips inside the hero, popovers.
- **Sunken Lilac** (sunken): input fills, progress-bar tracks, neutral chips, inline "Next:" callouts, skeleton base.
- **Hairline** (line) and **Firm Hairline** (line-strong): table dividers and card edges; secondary-button and hovered-field borders, scrollbar thumb.
- **Desk Ink** (ink): headings and primary text. **Soft Ink** (ink-soft): nav labels, secondary text, form labels. **Muted Plum-Grey** (muted): descriptions, table headers, timestamps.
- **Night Panel** (night, night-2): the "Next actions" panel and the API security sheet; white text at 100/70/45% opacity for title/meta/IDs.

### Named Rules
**The One Meaning Per Hue Rule.** Violet means action or location, teal means verified or positive, orange means needs attention, red means critical or destructive. Never borrow a hue for decoration or for a second meaning.

**The Earned Teal Rule.** Teal appears only where the backend has actually reported a verified, live or resolved state. Never use it to make an unverified state look reassuring.

## Typography

**Display Font:** Figtree (with ui-sans-serif, system-ui)
**Body Font:** Figtree, stylistic set `ss01` on
**Label/Mono Font:** JetBrains Mono (with ui-monospace, Menlo)

**Character:** A friendly, round geometric sans doing all the work at a small, steady scale; the mono face appears only where a string must be read character by character.

### Hierarchy
- **Display** (700, 2rem, tight tracking): the Overview page title inside the hero band (1.75rem on small screens).
- **Headline** (700, 1.75rem, tight tracking): page titles via the page header (1.5rem on small screens); hero stat values and the large count in case progress, both tabular.
- **Title** (600, 1rem): card/section titles, the Next-actions heading.
- **Body** (400, 0.8125rem, 1.5): table cells, list rows, notices, descriptions under section titles. Page descriptions use 0.875rem, max ~42rem wide.
- **Label** (600, 0.75rem): form labels, table headers (muted, sentence case), stat labels, meta lines.
- **Chip** (600, 0.6875rem): status, severity and source chips.
- **Mono** (600, 0.75rem, -0.01em): case IDs and hashes only.

### Named Rules
**The Mono Is Evidence Rule.** JetBrains Mono is reserved for case IDs, hashes and other machine identifiers. Never set prose, numbers or headings in mono.

**The Sentence Case Rule.** Labels, table headers and chips are sentence case at normal tracking. The only tracked, capitalised text in the build is the INCOGNITO wordmark.

**The Tabular Count Rule.** Every counted number (tables, stats, badges, timestamps) uses tabular numerals.

## Layout

A centred container (max 1440px; 16px side padding, 24px from 640px) under a sticky 72px top bar. Pages compose on a 12-column grid with a 20px gutter: the overview pairs an 8-column violet hero band with a 4-column night action panel, then 8/4 rows (priority queue with case progress, recent activity with reflect-and-reform). Grids collapse to a single column below `xl` (1280px) for the hero row and below `lg` (1024px) for content rows. Cards pad 20px, 24px from 640px; the hero band pads 20px / 28px. Vertical rhythm between page sections is 20px. Below `xl` the tab group is replaced by a menu button that opens a popover list, and the page title appears beside the wordmark.

## Elevation & Depth

Layered, soft and ambient. Cards sit on the canvas with a two-part violet-tinted shadow plus a 70%-opacity hairline border; interactive cards lift on hover; popovers and sheets use the deepest, ink-tinted shadow. Shadows are diffuse, never hard-offset.

### Shadow Vocabulary
- **Card** (`box-shadow: 0 1px 2px rgb(40 26 92 / 0.04), 0 6px 18px -8px rgb(40 26 92 / 0.12)`): every resting card and the nav tab group.
- **Raised** (`box-shadow: 0 2px 4px rgb(40 26 92 / 0.06), 0 16px 32px -12px rgb(40 26 92 / 0.22)`): hovered card links, the hero band, the night panel.
- **Pop** (`box-shadow: 0 4px 10px rgb(25 22 41 / 0.08), 0 24px 48px -16px rgb(25 22 41 / 0.32)`): menus, the mobile nav popover, modal sheets.
- **Violet glow** (`box-shadow: 0 4px 12px -4px rgb(79 51 184 / 0.6)`): under the active nav pill and the wordmark tile only.

### Named Rules
**The Soft Lift Rule.** Depth is ambient and violet-tinted. A card lifts 1px with the raised shadow and a brand-200 border on hover; nothing else moves.

## Shapes

Two families. Containers are generous rounded rectangles: cards, the hero band, the night panel and sheets at 20px; notices, stat chips and popovers at 16px; inputs, list rows, icon wells and the wordmark tile at 12px; small icon squares at 8px. Anything pressed or scanned is a full pill: buttons, icon buttons, chips, the nav group and its sliding pill, progress tracks, count badges. Status dots are 6px circles; legend keys 10px soft squares.

## Components

### Buttons
Confident, compact pills.
- **Shape:** full pill (9999px), 40px tall, 32px for the small size.
- **Primary:** Deep Case Violet with white 13px semibold text, 16px side padding, a faint violet drop shadow; hover deepens to brand-700.
- **Hover / Focus:** 150ms colour transitions; press scales to 0.98; focus shows a 2px brand-500 outline offset 2px; disabled at 50% opacity.
- **Secondary:** white with a firm-hairline border and ink text; hover tints brand-50 with a brand-300 border.
- **Ghost:** transparent with brand-700 text, brand-50 on hover; used for "All complaints" style links inside cards.
- **Teal / Danger:** solid teal-600 or danger-600 for confirming a verified outcome or a destructive act.
- **Icon button:** 40px white circle, hairline border, ink-soft icon; hover tints brand-50 with a brand-700 icon.

### Chips
- **Style:** pill, 11px semibold, 4px by 10px, tinted fill with the 700 shade of the same family as text; optional 6px leading dot in the 500 shade.
- **State:** status chips map case status to a family (submitted neutral with a hairline ring, committee assigned brand-50, investigating brand-100, under challenge attn-50, witness quorum teal-50, resolved teal-100, archived sunken/muted). Severity: critical red, high orange, medium violet, low neutral. Source: live teal, demo orange.

### Cards / Containers
- **Corner Style:** 20px.
- **Background:** Card White; the hero band is Deep Case Violet with white stat chips (16px radius); the action panel is Night.
- **Shadow Strategy:** card at rest, raised on hover or for the two hero-row panels (see Elevation & Depth).
- **Border:** 1px hairline at 70% opacity.
- **Internal Padding:** 20px, 24px from 640px. Section header: optional 36px brand-50 icon well, 16px semibold title, 13px muted description, actions right.

### Inputs / Fields
- **Style:** Sunken Lilac fill, 1px hairline border, 12px radius, 40px min height, 13px text; selects carry a muted chevron.
- **Focus:** fill turns white, border brand-500, 3px violet halo at 15% opacity.
- **Error / Disabled:** disabled at 60% opacity; errors are surfaced through the danger notice rather than a field state.

### Navigation
- **Style:** a white pill tab group centred in the sticky top bar, 13px semibold ink-soft labels; the active tab sits on a violet pill that slides (300ms expo) to track the current page. Hover tints labels brand-700. A count badge (orange, white when on the active pill) marks pending committee challenges.
- **Mobile:** below 1280px a menu icon button opens a 16px-radius popover list with icons; the active row is a solid violet rounded row.

### Notices
Inline guidance and results in a 16px-radius box with a tinted fill, matching 100-shade border and a leading Lucide icon: info violet, success teal, warning orange, danger red, neutral and locked lilac. Never used to fake an outcome.

### Case-Stage Track (signature)
Four equal segments of 6px pill bars on a sunken track: completed stages brand-300 with a check, the current stage solid violet, a challenged current stage orange with a warning icon. Bars grow from the left with an 80ms stagger. It is the dossier's echo of the sliding nav pill.

## Do's and Don'ts

### Do:
- **Do** place every surface on the lavender canvas as a white 20px card with the card shadow and hairline border.
- **Do** keep violet for action and location: primary buttons, the active nav pill, the overview hero band, the current stage.
- **Do** bind every chip to the One Meaning Per Hue Rule: tinted 50/100 fill, 700-shade text.
- **Do** set case IDs and hashes in JetBrains Mono 12px semibold, in brand-700 when they are links.
- **Do** use tabular numerals for every count, date and timestamp.
- **Do** use Lucide icons at 16px in buttons and 18px in nav and icon wells.
- **Do** expo-ease motion (cubic-bezier(0.16, 1, 0.3, 1)) at 200 to 300ms and honour reduced motion.

### Don't:
- **Don't** add decorative KPI tiles, sparklines, trend charts or calendars; every number must be counted from real cases, challenges, witness summaries or audit events.
- **Don't** use teal for anything the backend has not reported as verified, live or resolved.
- **Don't** introduce an amber or yellow; attention is orange.
- **Don't** use hard offset shadows or square corners on cards and buttons.
- **Don't** add uppercase tracked labels or kicker lines above headings; labels stay sentence case.
- **Don't** set prose or headings in the mono face.
