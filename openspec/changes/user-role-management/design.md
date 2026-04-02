## Context

The sidebar PLATFORM group currently has two separate menu items — "Users" (route `/user-management`) and "Roles" (route `/role-management`) — backed by two separate view directories: `views/usermanagement/` and `views/rolemanagement/`. Both manage platform-level access control and are always navigated to in close succession by administrators. As part of the reinvention-menu restructure, the PLATFORM group item was already renamed to "Users & Roles" in the menu config but still pointed only to `/user-management`, leaving Roles inaccessible from the new menu structure.

This design describes how to unify the two views behind a single route `/user-role-management` using a MUI `Tabs`/`Tab` component, and how to remove all now-redundant resources.

## Goals / Non-Goals

**Goals:**
- Single route `/user-role-management` serves both Users and Roles content via tabs
- Tab visibility is permission-aware: Users tab shown for `users:manage`, Roles tab shown for `roles:manage`
- PLATFORM sidebar item `user-role-management` points to the new route
- Old routes `/user-management` and `/role-management` removed
- Old view directories deleted after absorption

**Non-Goals:**
- No changes to existing UserManagement or RoleManagement data-fetching logic
- No API changes
- No changes to dialog/drawer sub-components (`EditUserDialog`, `CreateEditRoleDialog`, `ViewPermissionsDrawer`) — they are relocated in-directory only
- No changes to `WorkspaceUserManagement` (different route, different purpose)

## Decisions

### Decision 1: Composition approach — wrapper component vs. inlining

**Choice:** Create a new top-level wrapper `views/user-role-management/index.jsx` that imports and renders `UserManagement` and `RoleManagement` as sub-components inside MUI `Tabs`.

**Rationale:** Keeps both sub-views as independently testable exports; the wrapper only adds tab state management. Avoids duplicating hundreds of lines.

**Alternative considered:** Merge everything into one monolithic file. Rejected — too much churn, hard to review, hard to maintain independently.

### Decision 2: Sub-component import strategy

**Choice:** Move `views/usermanagement/` and `views/rolemanagement/` contents into `views/user-role-management/` as sibling sub-directories (`users/` and `roles/`), then import from relative paths in the wrapper.

**Rationale:** Keeps related code co-located under one feature folder. Avoids cross-folder `@/views/usermanagement` imports that would persist after deletion.

**Alternative considered:** Keep old directories, import from `@/views/usermanagement` in the wrapper. Rejected — the goal includes cleanup; leaving old directories creates dead code.

### Decision 3: Permission-gated tab visibility

**Choice:** Each tab is conditionally rendered using `useAuth` / `hasPermission`. The active tab defaults to the first visible tab. If a user has only one permission, they see only one tab (no tabs UI overhead needed — just the content).

**Rationale:** Matches the existing pattern used in `RequireAuth` and `PermissionIconButton`. Avoids showing users a disabled/forbidden tab.

**Alternative considered:** Show all tabs but disable unauthorized ones. Rejected — showing inaccessible UI is poor UX and inconsistent with the rest of the permission model.

### Decision 4: Route permission for `/user-role-management`

**Choice:** The `RequireAuth` wrapper on `/user-role-management` uses `permission={'users:manage,roles:manage'}` with OR semantics (user needs at least one), consistent with how compound permission strings work in existing `PermissionIconButton` usage.

**Rationale:** An admin with only `users:manage` should still reach the route and see the Users tab. Blocking the route entirely unless both permissions are held would be overly restrictive.

### Decision 5: Tab state via URL search param vs. component state

**Choice:** Use local React `useState` for active tab index. No URL search param.

**Rationale:** Simpler, no router dependencies. Neither Users nor Roles has a deep-link use case that requires bookmarkable tabs.

**Alternative considered:** `?tab=roles` search param. Rejected — adds complexity with no clear user benefit at this stage.

## Risks / Trade-offs

- **[Risk] Existing bookmarks/deep-links to `/user-management` or `/role-management` will 404** → Accepted. Both routes are internal-only, surfaced only via the sidebar menu (which is updated to `/user-role-management`). No external consumers depend on these paths. Route entries are deleted outright — no redirects.
- **[Risk] Both sub-components call their own data-fetching APIs on mount; both will fire when the page loads** → Mitigation: Acceptable — each fetch is independent and lightweight. Could be deferred to tab activation in a future optimisation.
- **[Risk] Sub-component `ViewHeader` titles ("User Management", "Role Management") will show inside tabs, creating redundant labelling** → Mitigation: The wrapper can pass a `hideTitle` prop or the sub-components' `ViewHeader` titles are suppressed; decide during implementation (task-level detail).

## Migration Plan

1. Create `views/user-role-management/` directory with sub-dirs `users/` and `roles/`
2. Copy `views/usermanagement/*` → `views/user-role-management/users/`; copy `views/rolemanagement/*` → `views/user-role-management/roles/`
3. Update internal imports in copied files (relative paths change)
4. Create `views/user-role-management/index.jsx` wrapper with `Tabs`
5. Update `MainRoutes.jsx`: add `/user-role-management` route, delete the `/user-management` and `/role-management` route entries entirely, remove old lazy imports, add `UserRoleManagement` lazy import
6. Update `reinventionDashboard.js` PLATFORM item: `id`, `url`, `permission`
7. Delete original `views/usermanagement/` and `views/rolemanagement/` directories
8. Verify no remaining imports reference the old paths

**Rollback:** Revert all file changes; the old routes/views are still in git history.

## Open Questions

*(none — all decisions resolved above)*
