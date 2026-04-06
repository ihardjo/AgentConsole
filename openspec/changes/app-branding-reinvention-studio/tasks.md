# Tasks: App Branding — AI Reinvention Studio

## Group 1 — Runtime App Name (ConfigContext)

### Task 1.1 — Update `appName` default in `ConfigContext.jsx`

**File:** `packages/ui/src/store/context/ConfigContext.jsx`

**Change:**
- Line 14: Replace `useState('Agent Console')` with `useState('AI Reinvention Studio')`

**Verification:** After change, confirm the line reads:
```jsx
const [appName, setAppName] = useState('AI Reinvention Studio')
```

---

## Group 2 — Static HTML Metadata

### Task 2.1 — Update Vite entry point `index.html`

**File:** `packages/ui/index.html`

**Changes:**
- `<title>`: Replace `Agent Console - AI Agents for Enterprise` with `AI Reinvention Studio`
- `og:title` meta: Replace content with `AI Reinvention Studio`
- `twitter:title` meta: Replace content with `AI Reinvention Studio`
- Any remaining `Agent Console` or `Flowise` strings in meta tag content: replace or remove

### Task 2.2 — Update CRA public entry point `public/index.html`

**File:** `packages/ui/public/index.html`

**Changes:**
- `<title>`: Replace `Agent Console - AI Agents for Enterprise` with `AI Reinvention Studio`
- `og:title` meta: Replace with `AI Reinvention Studio`
- `og:site_name` meta: Replace with `AI Reinvention Studio`
- `og:url` meta: Replace `flowiseai.com` URL with `https://agentconsole.accentureid.ai` or remove
- `og:image` meta: Remove entirely (points to `flowiseai.com` asset)
- `twitter:title` meta: Replace with `AI Reinvention Studio`
- `twitter:url` meta: Replace `flowiseai.com` URL with `https://agentconsole.accentureid.ai` or remove
- `twitter:image` meta: Remove entirely (points to `flowiseai.com` asset)
- Any remaining `Flowise` content values: Replace with `AI Reinvention Studio` or remove

---

## Group 3 — PWA Manifest

### Task 3.1 — Update `public/manifest.json`

**File:** `packages/ui/public/manifest.json`

**Changes:**
- `"name"`: Replace `"ACN ID App"` with `"AI Reinvention Studio"`
- `"short_name"`: Replace `"ACN ID App"` with `"ARS"`

---

## Group 4 — Header GitHub Star Widget Removal

### Task 4.1 — Remove GitHub star-count widget from `Header/index.jsx`

**File:** `packages/ui/src/layout/MainLayout/Header/index.jsx`

**Changes:**
- Remove the `<Link>` component that links to `https://github.com/FlowiseAI/Flowise` along with its child star-count display (`<GitHubIcon>`, star count number)
- Remove the `useEffect` that fetches from `https://api.github.com/repos/FlowiseAI/Flowise`
- Remove any state variables (`useState`) that exclusively held the GitHub star count and are now orphaned
- Remove any imports that become unused as a result (e.g. `GitHubIcon` if no longer used anywhere in the file)

**Verification:** The header must render without errors. No GitHub-related content visible.

---

## Group 5 — Embed Chat Defaults

### Task 5.1 — Update default embed metadata in `EmbedChat.jsx`

**File:** `packages/ui/src/views/chatflows/EmbedChat.jsx`

**Changes:**
- Line 124: Replace `'Agent Console Bot'` with `'AI Reinvention Studio Bot'`
- Line 173: Replace `company: 'Agent Console'` with `company: 'AI Reinvention Studio'`
- Line 174: `companyLink: 'https://agentconsole.accentureid.ai'` — no change required (already correct)

**Verification:** Confirm changed lines read:
```jsx
title: 'AI Reinvention Studio Bot',
company: 'AI Reinvention Studio',
```

---

## Group 6 — API Keys Page Description

### Task 6.1 — Update ViewHeader description in `apikey/index.jsx`

**File:** `packages/ui/src/views/apikey/index.jsx`

**Change:**
- Line 401: Replace `description='Flowise API & SDK authentication keys'` with `description='API & SDK authentication keys'`

---

## Group 7 — Evaluator Constant Label

### Task 7.1 — Update evaluator type label in `evaluatorConstant.js`

**File:** `packages/ui/src/views/evaluators/evaluatorConstant.js`

**Change:**
- Line 73: Replace `'Flowise Prediction API call'` with `'AI Reinvention Studio Prediction API call'`

---

## Group 8 — Logo Alt Text

### Task 8.1 — Update Logo component alt text in `Logo.jsx`

**File:** `packages/ui/src/ui-component/extended/Logo.jsx`

**Change:**
- Line 69: Replace `alt='Flowise'` with `alt='AI Reinvention Studio'`

**Note:** Import variable names (`logo`, `logoDark`) and the SVG file paths (`flowise_white.svg`, `flowise_dark.svg`) are intentionally left unchanged — asset replacement is tracked separately.

---

## Group 9 — Server-Side Platform Configuration Defaults

### Task 9.1 — Update default application name in `config-manager.ts`

**File:** `packages/server/src/custom-rbac/services/platform-config/config-manager.ts`

**Change:**
- In the `setDefaults()` method, replace:
  ```ts
  this.config.set('applicationName', process.env.APPLICATION_NAME || 'Agent Console')
  ```
  with:
  ```ts
  this.config.set('applicationName', process.env.APPLICATION_NAME || 'AI Reinvention Studio')
  ```

**Context:** This value is written to `platform-config.json` on first boot, before any admin has configured the app name via the Platform Configuration UI. Updating it ensures a fresh install defaults to `AI Reinvention Studio`.

### Task 9.2 — Update `DEFAULT_APPLICATION_NAME` constant in `platform-config/index.ts`

**File:** `packages/server/src/custom-rbac/services/platform-config/index.ts`

**Change:**
- Line 27: Replace:
  ```ts
  const DEFAULT_APPLICATION_NAME = 'Agent Console'
  ```
  with:
  ```ts
  const DEFAULT_APPLICATION_NAME = 'AI Reinvention Studio'
  ```

**Context:** This constant is the in-memory fallback returned by `getApplicationName()` and `getActiveConfig()` when no value exists in the config store. It also pre-fills the Application Name field in the Platform Configuration UI on a fresh install.

---

## Group 12 — Platform Configuration Enhancements

### Task 12.1 — Add cache headers to `serveAssetFile` in `controllers/platform-config/index.ts`

**File:** `packages/server/src/custom-rbac/controllers/platform-config/index.ts`

**Change:**  
In the `serveAssetFile` function, add the same cache-prevention headers already present on `serveActiveLogo` and `serveActiveFavicon`:

```ts
res.setHeader('Content-Type', file.mimeType)
res.setHeader('Content-Disposition', `inline; filename="${file.fileName}"`)
// Disable caching to ensure asset previews update immediately after upload
res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate')
res.setHeader('Pragma', 'no-cache')
res.setHeader('Expires', '0')
res.send(file.buffer)
```

**Context:** Without these headers the browser may cache asset preview thumbnails in the `AssetCard` component, showing stale images after a re-upload. `serveActiveLogo` and `serveActiveFavicon` already carry these headers correctly.

---

### Task 12.2 — Fix Blob URL memory leak in `usePlatformConfig.js`

**File:** `packages/ui/src/hooks/usePlatformConfig.js`

**Change:**  
Replace the Blob-based favicon injection with the URL-based approach used by `ConfigContext.jsx`. Remove the `fetch()` + `.blob()` + `URL.createObjectURL()` chain and replace with a direct URL string assignment:

```js
// Replace the favicon section:
const faviconResponse = await fetch(`${window.location.origin}/api/v1/platform-configuration/favicon?t=${Date.now()}`)
if (faviconResponse.ok) {
    const faviconUrl = `${window.location.origin}/api/v1/platform-configuration/favicon?t=${Date.now()}`

    let faviconLink = document.querySelector("link[rel*='icon']")
    if (!faviconLink) {
        faviconLink = document.createElement('link')
        faviconLink.rel = 'icon'
        document.head.appendChild(faviconLink)
    }
    faviconLink.href = faviconUrl

    const appleTouchIcon = document.querySelector("link[rel='apple-touch-icon']")
    if (appleTouchIcon) {
        appleTouchIcon.href = faviconUrl
    }
}
```

**Context:** `URL.createObjectURL(blob)` was creating a new Blob URL on every `loadPlatformConfig()` call with no corresponding `URL.revokeObjectURL()` cleanup, leaking memory. The public favicon endpoint does not require authentication, so a plain URL reference is both correct and simpler.

---

### Task 12.3 — Fix event handler naming in `usePlatformConfig.js`

**File:** `packages/ui/src/hooks/usePlatformConfig.js`

**Change:**  
Add an explicit `handleAppNameUpdate` function and wire `platformAppNameUpdated` to it instead of `handleLogoUpdate`:

```js
const handleLogoUpdate = () => {
    loadPlatformConfig()
}

const handleFaviconUpdate = () => {
    loadPlatformConfig()
}

const handleAppNameUpdate = () => {
    loadPlatformConfig()
}

window.addEventListener('platformLogoUpdated', handleLogoUpdate)
window.addEventListener('platformFaviconUpdated', handleFaviconUpdate)
window.addEventListener('platformAppNameUpdated', handleAppNameUpdate)

return () => {
    window.removeEventListener('platformLogoUpdated', handleLogoUpdate)
    window.removeEventListener('platformFaviconUpdated', handleFaviconUpdate)
    window.removeEventListener('platformAppNameUpdated', handleAppNameUpdate)
}
```

**Context:** Previously `platformAppNameUpdated` was wired to `handleLogoUpdate` — a misleading naming that masks future divergence. Functional behaviour is unchanged; only semantics and maintainability are improved.

---

### Task 12.4 — Remove duplicate `updateFavicon` from `platformconfiguration/index.jsx`

**File:** `packages/ui/src/views/platformconfiguration/index.jsx`

**Changes:**
1. Remove the module-level `updateFavicon()` helper function (the standalone function defined outside the React component).
2. In the `PlatformConfiguration` component, add `updateFavicon` to the `useConfig()` destructure alongside the existing `updateDocumentTitle`:
   ```js
   const { updateDocumentTitle, updateFavicon } = useConfig()
   ```
3. Update the favicon activate call site to use `updateFavicon(true)` — matching the `ConfigContext` signature that accepts `hasActiveFavicon: boolean`.

**Note:** The module-level `resetFavicon()` function is a separate helper that handles the deactivate flow (resetting to `/favicon.ico`). It remains unchanged as it is called in the deactivate path and is semantically distinct from `updateFavicon`.

**Context:** The removed module-level function was a parallel reimplementation of the same logic already present in `ConfigContext.jsx`. Consolidating onto the context version ensures there is one code path for favicon DOM updates and that future changes to the strategy only need to be made in one place.

---

## Group 10 — Validation

### Task 10.1 — Check for errors in all modified files

Run `get_errors` on:
- `packages/ui/src/store/context/ConfigContext.jsx`
- `packages/ui/src/layout/MainLayout/Header/index.jsx`
- `packages/ui/src/views/chatflows/EmbedChat.jsx`
- `packages/ui/src/views/apikey/index.jsx`
- `packages/ui/src/views/evaluators/evaluatorConstant.js`
- `packages/ui/src/ui-component/extended/Logo.jsx`
- `packages/server/src/custom-rbac/services/platform-config/config-manager.ts`
- `packages/server/src/custom-rbac/services/platform-config/index.ts`
- `packages/server/src/custom-rbac/controllers/platform-config/index.ts`
- `packages/ui/src/hooks/usePlatformConfig.js`
- `packages/ui/src/views/platformconfiguration/index.jsx`

Resolve any lint or compile errors before marking complete.

### Task 10.2 — Grep sweep to confirm no residual brand strings

Run grep across `packages/ui/src/**`, `packages/ui/public/**`, `packages/ui/index.html`, and `packages/server/src/**` for the following strings (all must return zero user-facing matches):

- `Agent Console` (in JSX/TS/JS source values — not in path strings or comments)
- `ACN ID App`
- `Flowise - Build`
- `flowiseai.com` (in user-visible meta tag content — not in import paths or internal module names)
- `FlowiseAI/Flowise` (in UI/href contexts — not in import paths)

---

## Group 11 — Manual Verification

### Task 11.1 — Visual verification of the application header

Start the development server and confirm:
- The browser tab title reads `AI Reinvention Studio`
- The main layout header does not contain any GitHub star-count widget or FlowiseAI link
- The logo `alt` text is correct when inspected in DevTools

### Task 11.2 — Visual verification of embed chat defaults

Open the Embed Chat configuration for any chatflow and confirm:
- Default title shows `AI Reinvention Studio Bot`
- Default company shows `AI Reinvention Studio`

### Task 11.3 — Visual verification of API Keys page

Navigate to the API Keys page and confirm the page header description reads `API & SDK authentication keys` (no "Flowise" prefix).

### Task 11.4 — Visual verification of evaluator type label

Open the Evaluations section, create or inspect an evaluator, and confirm the evaluator type label reads `AI Reinvention Studio Prediction API call`.

### Task 11.5 — Visual verification of PWA manifest

Open the browser DevTools → Application → Manifest and confirm:
- `Name` reads `AI Reinvention Studio`
- `Short name` reads `ARS`

### Task 11.6 — Visual verification of Platform Configuration default

On a fresh environment (or after clearing `platform-config.json`), navigate to **Settings → Platform Configuration → Application Name** and confirm the pre-filled default value reads `AI Reinvention Studio`.
