## Context

The previous branding change (`app-branding-reinvention-studio`) successfully consolidated all product surfaces to `AI Reinvention Studio`. The product name has since been updated to **AI Reinvention Engine**. This is a pure string replacement — the SVG assets are already named correctly (`ai_reinvention_engine.svg`), and no structural, API, or schema changes are required. The change touches 9 files across 2 packages.

**Current state of each file:**

| File | Current value | Required value |
|------|--------------|---------------|
| `packages/ui/src/store/context/ConfigContext.jsx:14` | `'AI Reinvention Studio'` | `'AI Reinvention Engine'` |
| `packages/ui/src/ui-component/extended/Logo.jsx` | `alt='AI Reinvention Studio'` | `alt='AI Reinvention Engine'` |
| `packages/ui/src/views/chatflows/EmbedChat.jsx:124` | `title: 'AI Reinvention Studio Bot'` | `title: 'AI Reinvention Engine Bot'` |
| `packages/ui/src/views/chatflows/EmbedChat.jsx:173` | `company: 'AI Reinvention Studio'` | `company: 'AI Reinvention Engine'` |
| `packages/ui/src/views/evaluators/evaluatorConstant.js:73` | `'...AI Reinvention Studio Prediction API call...'` | `'...AI Reinvention Engine Prediction API call...'` |
| `packages/ui/index.html` | `AI Reinvention Studio` (×4) | `AI Reinvention Engine` |
| `packages/ui/public/index.html` | `AI Reinvention Studio` (×5) | `AI Reinvention Engine` |
| `packages/ui/public/manifest.json` | `"name": "AI Reinvention Studio"` | `"name": "AI Reinvention Engine"` |
| `packages/server/.../config-manager.ts:97` | `'AI Reinvention Studio'` | `'AI Reinvention Engine'` |
| `packages/server/.../platform-config/index.ts:27` | `'AI Reinvention Studio'` | `'AI Reinvention Engine'` |

## Goals / Non-Goals

**Goals:**
- Replace every hard-coded `AI Reinvention Studio` string with `AI Reinvention Engine` in source code, HTML metadata, and the PWA manifest.
- Ensure a fresh install defaults to the new name at the server level.
- Ensure the logo `alt` text, embed widget copy, and evaluator description are aligned.

**Non-Goals:**
- Renaming SVG asset files (already named `ai_reinvention_engine.*`).
- Changing any API endpoint paths, payload schemas, or database keys.
- Updating historical openspec change artifacts (`app-branding-reinvention-studio/` documents) — those are immutable history.
- Updating the admin-configurable application name already stored in `platform-config.json` on running instances (admins may override via the Platform Configuration UI).

## Decisions

### Decision: Mechanical string replacement only

**Choice:** Treat this as a global find-and-replace of `AI Reinvention Studio` → `AI Reinvention Engine` with no structural changes.

**Rationale:** The name is a leaf-level display string in every context. No logic, routing, or data model depends on its value. A structural refactor would add unnecessary risk and complexity.

**Alternative considered:** Introduce a shared constant (e.g., `APP_BRAND_NAME`) imported by all files. Rejected because the server and UI are separate packages with no shared module layer, and the server already uses a configurable runtime value — a compile-time constant would be redundant.

### Decision: Do not reset persisted config on running instances

**Choice:** Only update the hard-coded defaults in `config-manager.ts` and `platform-config/index.ts`. Do not add a migration to overwrite the stored `platform-config.json` on existing deployments.

**Rationale:** Admins may have intentionally configured a custom application name. A silent migration that overwrites their value would be destructive. The new default applies only to fresh installs.

## Risks / Trade-offs

- **[Risk] Running instances show old name** → The persisted `platform-config.json` on existing deployments still contains `AI Reinvention Studio`. Admins must manually update the name via the Platform Configuration UI, or delete `platform-config.json` to reset to the new default. Document this in release notes.
- **[Risk] Future renames require the same sweep** → No single source-of-truth constant exists across the monorepo. Mitigation: this change is narrow and the pattern is well-understood; the risk is acceptable.

## Migration Plan

1. Apply all string replacements (see `tasks.md`).
2. Build and smoke-test the UI (`pnpm build`, verify browser tab title and logo alt text).
3. Restart the server on a clean install to confirm the default application name is `AI Reinvention Engine`.
4. For existing deployments: notify admins to update the application name via Platform Configuration, or delete `platform-config.json` and restart.

**Rollback:** Revert the commit. No database or file-system migrations were performed.

## Open Questions

None — the rename mapping is fully specified and there are no ambiguous occurrences.
