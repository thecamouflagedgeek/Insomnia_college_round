# React + TypeScript + Vite

## INCOGNITO dashboard updates

The dashboard automatically checks the backend every three seconds while visible.
It also refreshes after successful staff actions and when returning to the tab.
This covers the case queue, case details and audit/evidence state, messages,
committee challenges and pool, witness invitations/responses, patterns, and feedback.
Background refreshes preserve filters and unsent messages, avoid overlapping
requests within a view, and ignore responses from an old case/role. Denied case
reads stop retrying automatically to avoid repeated access-denial audit events.

Inbox messages place the anonymous reporter on the left and all investigation-team
replies on the right. Failed sends preserve the draft. The interface does not
claim end-to-end PGP encryption, which the current messaging transport does not implement.

For the presentation, demonstrate Witness Quorum with an invitation code that a
witness enters in the employee app; push notifications are not connected. Pattern
Intelligence displays backend correlations/repeat references when available and
shows an explicit error when the backend is unavailable, without sample clusters. An
empty result is expected until suitable reports exist. These are review cues,
not findings of misconduct.

Validation: `npm run build`, `npm run lint`, and `npm run test:browser`.
The browser test requires the running Vite server and the dependencies installed
under `tools/webprover/`. It intercepts HR requests with fictional fixtures and
does not send messages to the real backend. Override `DASHBOARD_URL` and
`CHROME_PATH` if necessary. Existing lint warnings remain in unrelated code.

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend enabling type-aware lint rules by installing `oxlint-tsgolint` and editing `.oxlintrc.json`:

```json
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "plugins": ["react", "typescript", "oxc"],
  "options": {
    "typeAware": true
  },
  "rules": {
    "react/rules-of-hooks": "error",
    "react/only-export-components": ["warn", { "allowConstantExport": true }]
  }
}
```

See the [Oxlint rules documentation](https://oxc.rs/docs/guide/usage/linter/rules) for the full list of rules and categories
