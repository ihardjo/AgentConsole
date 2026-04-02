## Why

The PLATFORM group in the sidebar currently lists "Users" and "Roles" as two separate menu items (backed by separate routes `/user-management` and `/role-management`), which artificially splits a single administrative concern — managing platform access — into two disconnected screens. Consolidating them into a single "Users & Roles" entry with tabs removes the redundant navigation overhead and gives administrators a unified view of access control.

## What Changes

- **New tabbed view** `views/user-role-management/index.jsx` combining `UserManagement` and `RoleManagement` content under a single `Tabs`/`Tab` interface (tabs: "Users" and "Roles").
- **New route** `/user-role-management` replaces the two separate routes `/user-management` and `/role-management`.
- **PLATFORM menu item** `user-management` updated: `id` → `user-role-management`, `url` → `/user-role-management`, permission expanded to cover both `users:manage` and `roles:manage`.
- **BREAKING**: Routes `/user-management` and `/role-management` fully removed — no redirects. Any internal navigation or references to these paths must be updated to `/user-role-management`.
- **Cleanup**: Lazy imports `RoleManagement` and `UserManagement` removed from `MainRoutes.jsx`; route definitions for `/user-management` and `/role-management` deleted entirely; old view directories `views/usermanagement/` and `views/rolemanagement/` deleted after content is embedded via the new parent component.

## Capabilities

### New Capabilities

- `user-role-management`: Tabbed unified view for managing platform Users and Roles in a single route, with tab-level permission awareness (Users tab visible with `users:manage`; Roles tab visible with `roles:manage`).

### Modified Capabilities

*(none — no existing spec-level behavior changes; this is a UI composition and routing change only)*

## Impact

- **`packages/ui/src/views/user-role-management/index.jsx`** — new file created
- **`packages/ui/src/routes/MainRoutes.jsx`** — add new route `/user-role-management`; delete route entries for `/user-management` and `/role-management` entirely; remove `RoleManagement` and `UserManagement` lazy imports; add `UserRoleManagement` lazy import
- **`packages/ui/src/menu-items/reinventionDashboard.js`** — update PLATFORM group item `user-management` → `user-role-management` with new `url` and combined permission
- **`packages/ui/src/views/usermanagement/`** — deleted (content absorbed into new view)
- **`packages/ui/src/views/rolemanagement/`** — deleted (content absorbed into new view)
- No API or backend changes required
