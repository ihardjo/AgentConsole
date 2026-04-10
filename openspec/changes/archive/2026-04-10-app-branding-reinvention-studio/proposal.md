# Proposal: App Branding — AI Reinvention Studio

## Overview

Update the application branding from its current mixed state ("Agent Console", "ACN ID App", and residual "Flowise" strings inherited from the upstream open-source fork) to a single, consistent identity: **AI Reinvention Studio**.

---

## Background

This codebase was forked from the open-source [FlowiseAI/Flowise](https://github.com/FlowiseAI/Flowise) project. Several layers of branding exist simultaneously:

1. **Flowise** — upstream brand strings that were never removed from HTML meta tags, asset filenames (SVG references in alt text), external documentation links (`docs.flowiseai.com`), a GitHub star-count widget in the main header, and descriptions in UI components.
2. **Agent Console** — the first internal rebrand applied to the app name, present in `ConfigContext.jsx`, `EmbedChat.jsx`, HTML titles, and the server-side platform configuration default (`config-manager.ts`, `platform-config/index.ts`).
3. **ACN ID App** — a stale internal name present in `public/manifest.json` (`short_name` and `name` fields).

None of these identities matches the target: **AI Reinvention Studio**.

---

## Goals

- Replace all user-facing brand strings with **AI Reinvention Studio**.
- Remove UI elements that reference the upstream open-source project (GitHub star-count widget).
- Remove UI elements that embed the upstream open-source project identity.
- Update HTML metadata (title, OG tags, Twitter tags) and PWA manifest to reflect the new brand.
- Keep internal technical identifiers (e.g. `FLOWISE_CREDENTIAL_ID`, package names such as `flowise-react-json-view`) out of scope — they are functional system constants, not user-facing brand strings.

---

## Non-Goals

- Renaming internal npm package names (`flowise-ui`, `flowise`, `flowise-components`, etc.) — these are workspace-internal identifiers and renaming them requires a separate coordinated effort across the monorepo.
- Replacing the logo SVG image assets (`flowise_white.svg`, `flowise_dark.svg`) — logo asset replacement is an asset-management task and will be tracked separately. The alt text and fallback reference will be updated in this change.
- Replacing `FLOWISE_CREDENTIAL_ID` — this is a functional internal constant used by the credential resolution pipeline, not a brand display string.
- Replacing `flowise-embed` / `flowise-embed-react` npm dependency references — these are third-party package names.

---

## Scope

### Files with required changes

| File | Current Brand | Required Change |
|------|--------------|-----------------|
| `packages/ui/public/index.html` | `Agent Console - AI Agents for Enterprise` (title), Flowise OG/Twitter meta | Update title + meta to `AI Reinvention Studio` |
| `packages/ui/index.html` | `Agent Console - AI Agents for Enterprise` (title, og:title, twitter:title) | Update title + meta |
| `packages/ui/public/manifest.json` | `"name": "ACN ID App"`, `"short_name": "ACN ID App"` | `"AI Reinvention Studio"` / `"ARS"` |
| `packages/ui/src/store/context/ConfigContext.jsx` | `useState('Agent Console')` | `useState('AI Reinvention Studio')` |
| `packages/ui/src/layout/MainLayout/Header/index.jsx` | GitHub star-count widget (links + API fetch for `FlowiseAI/Flowise`) | Remove the entire star-count widget |
| `packages/ui/src/views/chatflows/EmbedChat.jsx` | `'Agent Console Bot'`, `company: 'Agent Console'`, `companyLink` | `'AI Reinvention Studio Bot'`, `'AI Reinvention Studio'` |
| `packages/ui/src/views/apikey/index.jsx` | `description='Flowise API & SDK authentication keys'` | Replace with brand-neutral description |
| `packages/ui/src/views/evaluators/evaluatorConstant.js` | `'Flowise Prediction API call'` | `'AI Reinvention Studio Prediction API call'` |
| `packages/ui/src/ui-component/extended/Logo.jsx` | `alt='Flowise'`, imports referencing `flowise_white.svg` / `flowise_dark.svg` | Update `alt` to `'AI Reinvention Studio'` |
| `packages/server/src/custom-rbac/services/platform-config/config-manager.ts` | `process.env.APPLICATION_NAME \|\| 'Agent Console'` | `process.env.APPLICATION_NAME \|\| 'AI Reinvention Studio'` |
| `packages/server/src/custom-rbac/services/platform-config/index.ts` | `const DEFAULT_APPLICATION_NAME = 'Agent Console'` | `'AI Reinvention Studio'` |

---

## Expected Outcome

After this change, no user-visible text, page title, meta tag, manifest entry, UI description, or server-side default will reference "Flowise", "FlowiseAI", "Agent Console", or "ACN ID App". All such strings will read "AI Reinvention Studio".
