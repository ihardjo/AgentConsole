## 1. Client — ConfigContext default

- [x] 1.1 In `packages/ui/src/store/context/ConfigContext.jsx` line 14, replace `useState('AI Reinvention Studio')` with `useState('AI Reinvention Engine')`

## 2. Client — Logo alt text

- [x] 2.1 In `packages/ui/src/ui-component/extended/Logo.jsx`, replace `alt='AI Reinvention Studio'` with `alt='AI Reinvention Engine'`

## 3. Client — EmbedChat widget copy

- [x] 3.1 In `packages/ui/src/views/chatflows/EmbedChat.jsx` line 124, replace `title: 'AI Reinvention Studio Bot'` with `title: 'AI Reinvention Engine Bot'`
- [x] 3.2 In `packages/ui/src/views/chatflows/EmbedChat.jsx` line 173, replace `company: 'AI Reinvention Studio'` with `company: 'AI Reinvention Engine'`

## 4. Client — Evaluator constant description

- [x] 4.1 In `packages/ui/src/views/evaluators/evaluatorConstant.js` line 73, replace `AI Reinvention Studio Prediction API call` with `AI Reinvention Engine Prediction API call`

## 5. Client — HTML metadata (index.html)

- [x] 5.1 In `packages/ui/index.html`, replace all 4 occurrences of `AI Reinvention Studio` with `AI Reinvention Engine` (`<title>`, `name` meta, `og:title`, `twitter:title`)

## 6. Client — HTML metadata (public/index.html)

- [x] 6.1 In `packages/ui/public/index.html`, replace all 5 occurrences of `AI Reinvention Studio` with `AI Reinvention Engine` (`<title>`, `name` meta, `og:site_name`, `og:title`, `twitter:title`)

## 7. Client — PWA manifest

- [x] 7.1 In `packages/ui/public/manifest.json`, replace `"name": "AI Reinvention Studio"` with `"name": "AI Reinvention Engine"`
- [x] 7.2 In `packages/ui/public/manifest.json`, replace `"short_name": "AI Reinvention Studio"` with `"short_name": "AI Reinvention Engine"` (if present)

## 8. Server — Config defaults

- [x] 8.1 In `packages/server/src/custom-rbac/services/platform-config/config-manager.ts` line 97, replace `'AI Reinvention Studio'` with `'AI Reinvention Engine'` in the `setDefaults` method
- [x] 8.2 In `packages/server/src/custom-rbac/services/platform-config/index.ts` line 27, replace `const DEFAULT_APPLICATION_NAME = 'AI Reinvention Studio'` with `const DEFAULT_APPLICATION_NAME = 'AI Reinvention Engine'`

## 9. Verification

- [x] 9.1 Run `pnpm build` and confirm exit code 0 with no errors
- [x] 9.2 Confirm browser tab title reads `AI Reinvention Engine` in the built output
- [x] 9.3 Confirm `grep -r "AI Reinvention Studio" packages/` returns zero matches (excluding openspec history)
