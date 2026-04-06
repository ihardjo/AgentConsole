## Why

The PLATFORM group in the sidebar currently lists "Users" and "Roles" as two separate menu items (backed by separate routes `/user-management` and `/role-management`), which artificially splits a single administrative concern — managing platform access — into two disconnected screens. Consolidating them into a single "Users & Roles" entry with tabs removes the redundant navigation overhead and gives administrators a unified view of access control.

## What Changes

- **New unified view** `views/user-role-management/index.jsx` — single `MainCard` with a shared `ViewHeader` (title "Users & Roles", search bar, context-sensitive action button) followed by a `Tabs`/`Tab` row below the header. Table content for each tab is rendered directly beneath.
- **New route** `/user-role-management` replaces the two separate routes `/user-management` and `/role-management`.
- **PLATFORM menu item** `user-management` updated: `id` → `user-role-management`, `url` → `/user-role-management`, permission expanded to cover both `users:manage` and `roles:manage`.
- **BREAKING**: Routes `/user-management` and `/role-management` fully removed — no redirects. Any internal navigation or references to these paths must be updated to `/user-role-management`.
- **Cleanup**: Lazy imports `RoleManagement` and `UserManagement` removed from `MainRoutes.jsx`; route definitions for `/user-management` and `/role-management` deleted entirely; old view directories `views/usermanagement/` and `views/rolemanagement/` deleted after content is embedded via the new parent component.
- **Sub-view refactor**: `users/index.jsx` and `roles/index.jsx` each lose their own `MainCard` and `ViewHeader` wrappers; they accept props for `search` filter state and expose only their table content (columns, rows, dialogs — unchanged).

## Capabilities

### New Capabilities

- `user-role-management`: Unified single-card view with shared header (title, search, action button) and permission-gated tabs ("Users", "Roles") below it, with tab-level permission awareness and consistent table content per tab.

### Modified Capabilities

*(none — no existing spec-level behavior changes; this is a UI composition and routing change only)*

## Impact

- **`packages/ui/src/views/user-role-management/index.jsx`** — new file created; owns `MainCard`, `ViewHeader`, `Tabs`, and tab-panel rendering
- **`packages/ui/src/views/user-role-management/users/index.jsx`** — refactored: `MainCard` and `ViewHeader` removed; receives `search` prop; exposes table + dialogs only
- **`packages/ui/src/views/user-role-management/roles/index.jsx`** — refactored: `MainCard` and `ViewHeader` removed; receives `search` prop; exposes table + dialogs only
- **`packages/ui/src/routes/MainRoutes.jsx`** — add new route `/user-role-management`; delete route entries for `/user-management` and `/role-management` entirely; remove `RoleManagement` and `UserManagement` lazy imports; add `UserRoleManagement` lazy import
- **`packages/ui/src/menu-items/reinventionDashboard.js`** — update PLATFORM group item `user-management` → `user-role-management` with new `url` and combined permission
- **`packages/ui/src/views/usermanagement/`** — deleted (content absorbed into new view)
- **`packages/ui/src/views/rolemanagement/`** — deleted (content absorbed into new view)
- No API or backend changes required
