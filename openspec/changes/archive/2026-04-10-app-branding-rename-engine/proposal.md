## Why

The application brand name has been updated from "AI Reinvention Studio" to "AI Reinvention Engine" to reflect the product's evolution and positioning. All user-facing strings, configuration defaults, metadata, and assets must be aligned to this new identity so the product presents a single, consistent name across every surface.

## What Changes

- Replace all occurrences of the string `AI Reinvention Studio` with `AI Reinvention Engine` across UI source, server source, HTML metadata, and PWA manifest.
- Update the `alt` attribute on the logo `<img>` from `'AI Reinvention Studio'` to `'AI Reinvention Engine'`.
- Update the server-side default application name constants (`config-manager.ts`, `platform-config/index.ts`) to `'AI Reinvention Engine'`.
- Update the client-side `ConfigContext.jsx` default state to `'AI Reinvention Engine'`.
- Update `EmbedChat.jsx` embed widget strings (`title`, `company`) to reference `AI Reinvention Engine`.
- Update the evaluator constant description string in `evaluatorConstant.js`.
- Update `<title>` and all Open Graph / Twitter meta tags in `packages/ui/index.html` and `packages/ui/public/index.html`.
- Update `packages/ui/public/manifest.json` PWA `name` and `short_name` fields.
- Update the Logo `<img>` `alt` attribute in `Logo.jsx`.

## Capabilities

### New Capabilities

None — this is a pure rename with no new capabilities introduced.

### Modified Capabilities

- `app-branding`: The application display name changes from `AI Reinvention Studio` to `AI Reinvention Engine` across all surfaces.

## Impact

- **UI**: `ConfigContext.jsx`, `Logo.jsx`, `EmbedChat.jsx`, `evaluatorConstant.js`, `index.html` (both), `public/manifest.json`
- **Server**: `packages/server/src/custom-rbac/services/platform-config/config-manager.ts`, `packages/server/src/custom-rbac/services/platform-config/index.ts`
- **Openspec docs**: `app-branding-reinvention-studio` change artifacts reference the old name (read-only history, no code impact)
- **No API contract changes** — the application name is a configurable string value; endpoints and payload schemas are unaffected
- **No asset file renames** — SVG files are already named `ai_reinvention_engine.svg`; only the `alt` text changes
