## Context

The sidebar PLATFORM group currently has two separate menu items — "Users" (route `/user-management`) and "Roles" (route `/role-management`) — backed by two separate view directories: `views/usermanagement/` and `views/rolemanagement/`. Both manage platform-level access control and are always navigated to in close succession by administrators. As part of the reinvention-menu restructure, the PLATFORM group item was already renamed to "Users & Roles" in the menu config but still pointed only to `/user-management`, leaving Roles inaccessible from the new menu structure.

This design describes how to unify the two views behind a single route `/user-role-management` using a MUI `Tabs`/`Tab` component, and how to remove all now-redundant resources.

## Goals / Non-Goals

**Goals:**
- Single route `/user-role-management` serves both Users and Roles content via tabs
- Single `MainCard` containing a unified `ViewHeader` (title "Users & Roles", shared search bar, context-sensitive action button) with `Tabs`/`Tab` row directly below the header, inside the same card
- The active tab's table renders immediately below the tab row — no nested cards, no duplicate headers
- Tab visibility is permission-aware: Users tab shown for `users:manage`, Roles tab shown for `roles:manage`
- Action button in the header is context-sensitive: "Invite User" when Users tab active, "Add Role" when Roles tab active
- Search bar filters data for whichever tab is active; placeholder text switches accordingly
- Table columns, row components, and dialogs for Users and Roles are fully preserved
- PLATFORM sidebar item `user-role-management` points to the new route
- Old routes `/user-management` and `/role-management` removed
- Old view directories deleted after absorption

**Non-Goals:**
- No changes to table columns, row components (`ShowUserRow`, `ShowRoleRow`), or dialog/drawer sub-components (`EditUserDialog`, `CreateEditRoleDialog`, `ViewPermissionsDrawer`)
- No API or data-fetching logic changes
- No changes to `WorkspaceUserManagement` (different route, different purpose)
- No URL search-param-based tab state

## Decisions

### Decision 1: Composition approach — single merged component

**Choice:** The wrapper `views/user-role-management/index.jsx` owns the `MainCard`, the `ViewHeader`, the `Tabs` row, and all tab-panel rendering. The sub-files `users/index.jsx` and `roles/index.jsx` become "headless" table components that accept a `search` prop and render only their table + dialogs.

**Rationale:** A single card with one header gives a clean, unified page — no duplicate titles, no duplicate search bars, no nested cards. Sub-views stay independently maintainable while the wrapper owns the visual chrome.

**Alternative considered:** Keep each sub-view wrapping its own `MainCard`/`ViewHeader` and nest them inside the tabs. Rejected — this produces doubled headers and misaligned search bars; the user experience is fragmented.

### Decision 2: Sub-component prop interface

**Choice:** Sub-views (`users/index.jsx`, `roles/index.jsx`) each accept a `search` string prop used to filter their table rows. The action button ("Invite User" / "Add Role") and its handler are hoisted to the wrapper; the sub-view exposes the handler via a forwarded ref or a callback prop passed down.

**Rationale:** Keeps data-fetching and row-level logic inside the sub-view (unchanged), while the wrapper drives the shared header controls. Minimal interface surface — only `search` needs to flow down; action callbacks flow up via props.

**Alternative considered:** Hoist all state into the wrapper. Rejected — would require duplicating all API call logic and state in the wrapper, defeating the purpose of co-located sub-views.

### Decision 3: Sub-component import strategy

**Choice:** Sub-files live in `views/user-role-management/users/` and `views/user-role-management/roles/`, imported via relative paths in the wrapper.

**Rationale:** Keeps related code co-located under one feature folder. Avoids stale cross-folder `@/views/usermanagement` imports.

### Decision 4: Permission-gated tab visibility

**Choice:** Each `Tab` is conditionally rendered using `useAuth` / `hasPermission`. Default active tab = first permitted tab. If only one permission held, one tab renders with no tab chrome overhead.

**Rationale:** Consistent with `RequireAuth` / `PermissionIconButton` patterns. No inaccessible disabled tabs shown.

### Decision 5: Context-sensitive header controls

**Choice:** The wrapper tracks `activeTab` and derives: (a) the search placeholder ("Search Users" vs "Search Roles"), (b) which action button to render ("Invite User" vs "Add Role"), (c) which `permissionId` to apply to the action button.

**Rationale:** Ensures the header always reflects the active context without requiring sub-views to re-render their own headers.

### Decision 6: Route permission for `/user-role-management`

**Choice:** `RequireAuth` uses `permission={'users:manage,roles:manage'}` — OR semantics; user needs at least one.

**Rationale:** An admin with only `users:manage` should still reach the route and see the Users tab.

### Decision 7: Tab state

**Choice:** Local `useState` — no URL search param.

**Rationale:** Simpler; no bookmarkable-tab requirement at this stage.

## Risks / Trade-offs

- **[Risk] Existing bookmarks/deep-links to `/user-management` or `/role-management` will 404** → Accepted. Both routes are internal-only, surfaced only via the sidebar menu. Route entries are deleted outright — no redirects.
- **[Risk] Both sub-views call their own APIs on mount** → Accepted — each fetch is independent and lightweight.

## Migration Plan

1. *(Done)* Create `views/user-role-management/` with sub-dirs `users/` and `roles/`; copy files; fix internal imports
2. *(Done)* Create `views/user-role-management/index.jsx` wrapper with `Tabs`
3. *(Done)* Update `MainRoutes.jsx`, `reinventionDashboard.js`, delete old directories
4. **Refactor** `views/user-role-management/index.jsx` — add `MainCard`, `ViewHeader`, context-sensitive action button and search; manage `search` state; pass `search` prop to active sub-view
5. **Refactor** `views/user-role-management/users/index.jsx` — remove `MainCard` outer wrapper and `ViewHeader`; accept `search` prop; remove internal `addNew` button from header (keep handler, expose via `onAdd` prop or keep inline)
6. **Refactor** `views/user-role-management/roles/index.jsx` — same as above for Roles
7. Verify zero errors; manual smoke test

**Rollback:** Revert all file changes; the old routes/views are still in git history.

## Open Questions

*(none — all decisions resolved above)*
