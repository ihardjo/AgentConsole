# Design: App Branding — AI Reinvention Studio

## Architecture Overview

Branding strings in this application are distributed across **four layers**:

1. **Static HTML / PWA manifest** — `public/index.html`, `index.html`, `public/manifest.json`
2. **React context (runtime)** — `ConfigContext.jsx` holds `appName` as state and distributes it via React context to all consumers
3. **Hardcoded UI strings** — individual component files where brand text was written inline rather than sourced from context
4. **Server-side defaults** — the platform configuration service (`config-manager.ts`, `platform-config/index.ts`) stores the default application name returned by the `/api/v1/platform-configuration/app-name` endpoint, which seeds the UI on first load

This change addresses all four layers.

---

## Design Decisions

### 1. `ConfigContext.jsx` — Single source of truth for `appName`

The `appName` state in `ConfigContext.jsx` is the runtime source of truth for the application name. Its default value is `'Agent Console'`. Any component that consumes the `ConfigContext` will automatically reflect the new name once this default is updated to `'AI Reinvention Studio'`.

**Decision:** Update the `useState` default to `'AI Reinvention Studio'`. No structural changes to the context are needed.

---

### 2. Static HTML metadata — Update in both entry points

The monorepo has two HTML entry files:
- `packages/ui/public/index.html` — used by the CRA/legacy build
- `packages/ui/index.html` — used by the Vite build

Both need their `<title>`, `og:title`, `og:site_name`, `twitter:title`, and all `flowiseai.com` meta URLs updated.

**Decision:** Replace all `Agent Console - AI Agents for Enterprise` title strings with `AI Reinvention Studio`. Replace `flowiseai.com` OG/Twitter URLs with the production domain (`https://agentconsole.accentureid.ai`) or remove the tags entirely if they add no value. Since no canonical public social media preview is configured for this product, remove `og:image` and `twitter:image` meta tags that reference `flowiseai.com` assets.

---

### 3. `public/manifest.json` — PWA identity

The manifest currently has `"name": "ACN ID App"` and `"short_name": "ACN ID App"` — a stale internal codename that predates both "Agent Console" and "AI Reinvention Studio".

**Decision:**
- `"name"`: `"AI Reinvention Studio"`
- `"short_name"`: `"ARS"` (fits PWA icon label constraints)

---

### 4. Header GitHub star-count widget — Remove entirely

`packages/ui/src/layout/MainLayout/Header/index.jsx` contains:
- A `<Link>` pointing to `https://github.com/FlowiseAI/Flowise`
- A `useEffect` that calls `https://api.github.com/repos/FlowiseAI/Flowise` to fetch the star count

This widget was inherited from the upstream Flowise UI and serves no purpose in AI Reinvention Studio. There is no equivalent internal or public repo to point it at.

**Decision:** Remove the entire star-count widget — both the JSX `<Link>` + star count display and the corresponding `useEffect` fetch logic. Any state variables and imports made orphaned by this removal should also be deleted.

---

### 5. `EmbedChat.jsx` — Default embed metadata

The embedded chat component ships with default metadata used when an agent config does not override them:
- `title: 'Agent Console Bot'` — the floating chat bubble title
- `company: 'Agent Console'` — the company attribution in the embed widget
- `companyLink: 'https://agentconsole.accentureid.ai'` — the company link

**Decision:** Update the defaults to:
- `title: 'AI Reinvention Studio Bot'`
- `company: 'AI Reinvention Studio'`
- `companyLink: 'https://agentconsole.accentureid.ai'` — keep unchanged, it's already the correct production URL

---

### 6. `apikey/index.jsx` — ViewHeader description

The API Keys page header contains `description='Flowise API & SDK authentication keys'`. This is a description text displayed in the page header, not a technical identifier.

**Decision:** Replace with `description='API & SDK authentication keys'` — remove the "Flowise" brand prefix, keep the rest of the text as-is. No need to add "AI Reinvention Studio" since the description is generic and readable without a brand prefix.

---

### 7. `evaluatorConstant.js` — Evaluator type label

Contains the string `'Flowise Prediction API call'` as a user-visible label for a specific evaluator type.

**Decision:** Replace with `'AI Reinvention Studio Prediction API call'` to match the new brand.

---

### 8. `Logo.jsx` — Alt text only

The `Logo` component imports logo images from `@/assets/images/flowise_white.svg` and `@/assets/images/flowise_dark.svg`. Logo image asset replacement is out of scope for this change (tracked separately). However, the rendered `<img alt='Flowise'>` attribute is user-visible in accessibility contexts and should be updated.

**Decision:** Update `alt='Flowise'` to `alt='AI Reinvention Studio'`. Import variable names (`logo`, `logoDark`) and the `src` paths to the SVG files remain unchanged — they are internal references to asset files.

---

### 9. Server-side platform configuration defaults

The platform configuration service defines `'Agent Console'` as the default application name in two places:

- **`config-manager.ts`** — `setDefaults()` method: `this.config.set('applicationName', process.env.APPLICATION_NAME || 'Agent Console')`. This is the value written to `platform-config.json` on first boot (before any admin has saved a custom name).
- **`platform-config/index.ts`** — `const DEFAULT_APPLICATION_NAME = 'Agent Console'`. This constant is the fallback used by `getApplicationName()` and `getActiveConfig()` when the config store has no value.

The Platform Configuration UI (`/platform-configuration`) reads `applicationName` from the API and pre-fills the "Application Name" text field with this value. A fresh install will therefore show `'Agent Console'` in that field until an admin manually overrides it.

**Decision:** Update both constants to `'AI Reinvention Studio'`. The `config-manager.ts` change affects the persisted file written on first boot; the `platform-config/index.ts` change affects the in-memory fallback for all reads.

---

### 10. Platform Configuration: Asset Preview Cache Strategy

The platform configuration controller (`controllers/platform-config/index.ts`) exposes three file-serving endpoints:

| Endpoint | Controller Function | Cache Headers |
|----------|--------------------|----|
| `GET /logo` | `serveActiveLogo` | `no-cache, no-store, must-revalidate` ✓ |
| `GET /favicon` | `serveActiveFavicon` | `no-cache, no-store, must-revalidate` ✓ |
| `GET /assets/:id/file` | `serveAssetFile` | **None** ← gap |

The `serveAssetFile` endpoint is used by the `AssetCard` component to render preview thumbnails in the Logo and Favicon asset management tabs. Because there are no cache headers, a browser may serve a stale binary from its cache after an asset is replaced or re-uploaded with the same ID. The active logo and favicon endpoints are already correctly protected — the gap is only on the preview endpoint.

**Decision:** Add the same `Cache-Control: no-cache, no-store, must-revalidate` + `Pragma: no-cache` + `Expires: 0` headers to `serveAssetFile`, matching the pattern already established on `serveActiveLogo` and `serveActiveFavicon`.

---

### 11. `usePlatformConfig.js`: Blob URL Leak and Event Handler Correctness

**Blob URL memory leak**

`usePlatformConfig.js` fetches the active favicon on every `loadPlatformConfig()` call and creates a `Blob` URL via `URL.createObjectURL(blob)`. This URL is assigned to the `<link rel="icon">` tag in the document head. The problem is that each invocation of `loadPlatformConfig()` creates a new Blob URL without revoking the previous one, and the `useEffect` cleanup function does not call `URL.revokeObjectURL()`. Every favicon-triggered re-fetch leaks a Blob URL into the browser's memory until the page is unloaded.

`ConfigContext.jsx` already implements the correct approach: it constructs a plain URL string directly (`/api/v1/platform-configuration/favicon?t=${Date.now()}`) and assigns it to the `<link>` tag — no Blob creation, no memory leak, and the `?t=` timestamp parameter handles cache-busting. The public favicon endpoint does not require authentication, making a direct URL reference safe.

**Decision:** Replace the Blob-based favicon injection in `usePlatformConfig.js` with the URL-based approach that matches `ConfigContext.jsx`. Remove all `fetch()` + `.blob()` + `URL.createObjectURL()` logic. Use `window.location.origin + '/api/v1/platform-configuration/favicon?t=' + Date.now()` as the favicon `href` when the server responds `200`.

**Event handler naming inconsistency**

The `useEffect` in `usePlatformConfig.js` registers three event listeners:
```js
window.addEventListener('platformLogoUpdated', handleLogoUpdate)
window.addEventListener('platformFaviconUpdated', handleFaviconUpdate)
window.addEventListener('platformAppNameUpdated', handleLogoUpdate)  // ← wrong name
```

Both `handleLogoUpdate` and `handleFaviconUpdate` are defined and both call `loadPlatformConfig()`, making the functional behaviour identical. However, `platformAppNameUpdated` is wired to `handleLogoUpdate` (misleading) instead of a semantically correct `handleAppNameUpdate`. If these handlers ever diverge in behaviour, the silent misassignment would produce a hard-to-trace bug.

**Decision:** Introduce an explicit `handleAppNameUpdate` function for `platformAppNameUpdated`. All three handlers may still delegate to `loadPlatformConfig()` — the goal is semantic correctness and maintainability, not a functional change.

---

### 12. `platformconfiguration/index.jsx`: Remove Duplicate `updateFavicon` Implementation

`packages/ui/src/views/platformconfiguration/index.jsx` defines a module-level `updateFavicon()` helper function at file scope (outside the React component). This function is a parallel copy of the `updateFavicon` function already defined and exported via `ConfigContext.jsx`.

Both implementations:
- Set `faviconLink.href = '/api/v1/platform-configuration/favicon?t=' + Date.now()`
- Find or create a `<link rel="icon">` element
- Update the `apple-touch-icon` link

The difference is that `ConfigContext.jsx`'s version accepts a `hasActiveFavicon` boolean (returning to `/favicon.ico` when `false`), whereas the module-level copy always assumes an active favicon is present.

The `PlatformConfiguration` component already consumes `useConfig()` and already imports `updateDocumentTitle` from it. The `updateFavicon` from `ConfigContext` is also available via `useConfig()` and handles both the activate and deactivate states correctly via the `hasActiveFavicon` parameter.

**Decision:**
1. Remove the module-level `updateFavicon()` function from `platformconfiguration/index.jsx`.
2. Add `updateFavicon` to the `useConfig()` destructure in the `PlatformConfiguration` component.
3. Update the call site (favicon activate handler) to use `updateFavicon(true)` — matching the `ConfigContext` API.
4. The existing module-level `resetFavicon()` function is kept unchanged: it handles the deactivate state by pointing back to `/favicon.ico` and is the local explicit form. Alternatively, it can be replaced by `updateFavicon(false)` — but since `resetFavicon` is clear and already correct, it can remain as a named alias for clarity.

---

## Out-of-Scope Decisions

| Item | Reason |
|------|--------|
| `FLOWISE_CREDENTIAL_ID` constant | Internal functional key used by credential resolution logic, not a display string |
| `flowise-react-json-view` imports | Third-party npm package name; renaming would require forking/replacing the package |
| `flowise-embed` / `flowise-embed-react` dependencies | External npm packages used for the embed widget |
| `flowise-ui`, `flowise`, `flowise-components` package names | Internal monorepo package names; renaming requires coordinated refactor across all dependent references |
| Logo SVG assets (`flowise_white.svg`, `flowise_dark.svg`) | Asset replacement tracked separately |
| External `docs.flowiseai.com` links in `HowToUseVariablesDialog.jsx`, `DeleteDocStoreDialog.jsx`, `VectorStoreDialog.jsx` | Links are functional and point to valid upstream documentation; leave unchanged |
| `packages/server/package.json` — `"description": "Flowiseai Server"`, author email | Internal package metadata, not user-facing; out of scope |
| `packages/ui/package.json` — `"homepage": "https://flowiseai.com"` | Internal package metadata, not user-facing; out of scope |
| `InternalFlowiseError` class and related server error classes | Technical class name in server code, not user-facing |
