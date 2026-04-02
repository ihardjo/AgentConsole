## 1. Create New View Directory Structure

- [x] 1.1 Create directory `packages/ui/src/views/user-role-management/users/`
- [x] 1.2 Copy `packages/ui/src/views/usermanagement/index.jsx` to `packages/ui/src/views/user-role-management/users/index.jsx`
- [x] 1.3 Copy `packages/ui/src/views/usermanagement/EditUserDialog.jsx` to `packages/ui/src/views/user-role-management/users/EditUserDialog.jsx`
- [x] 1.4 Create directory `packages/ui/src/views/user-role-management/roles/`
- [x] 1.5 Copy `packages/ui/src/views/rolemanagement/index.jsx` to `packages/ui/src/views/user-role-management/roles/index.jsx`
- [x] 1.6 Copy `packages/ui/src/views/rolemanagement/CreateEditRoleDialog.jsx` to `packages/ui/src/views/user-role-management/roles/CreateEditRoleDialog.jsx`
- [x] 1.7 Copy `packages/ui/src/views/rolemanagement/CreateEditRoleDialog.css` to `packages/ui/src/views/user-role-management/roles/CreateEditRoleDialog.css`

## 2. Fix Internal Imports in Copied Files

- [x] 2.1 In `users/index.jsx`: update import of `EditUserDialog` from `@/views/usermanagement/EditUserDialog` → `./EditUserDialog`
- [x] 2.2 In `roles/index.jsx`: update import of `CreateEditRoleDialog` from `@/views/rolemanagement/CreateEditRoleDialog` → `./CreateEditRoleDialog`
- [x] 2.3 In `roles/CreateEditRoleDialog.jsx`: update CSS import from `./CreateEditRoleDialog.css` (verify path is still correct relative to new location)

## 3. Create Wrapper Component

- [x] 3.1 Create `packages/ui/src/views/user-role-management/index.jsx` with MUI `Tabs`/`Tab` component wrapping `UserManagement` and `RoleManagement` sub-components
- [x] 3.2 Implement `useState` for active tab index (default `0`)
- [x] 3.3 Add `useAuth` + `hasPermission` calls to gate "Users" tab on `users:manage` and "Roles" tab on `roles:manage`
- [x] 3.4 Default active tab to first permitted tab (Users if permitted, otherwise Roles)
- [x] 3.5 Conditionally render tab panel content: `UserManagement` when Users tab active, `RoleManagement` when Roles tab active

## 4. Update Routing

- [x] 4.1 In `packages/ui/src/routes/MainRoutes.jsx`: add lazy import `const UserRoleManagement = Loadable(lazy(() => import('@/views/user-role-management')))`
- [x] 4.2 Add route `{ path: '/user-role-management', element: <RequireAuth permission={'users:manage,roles:manage'}><UserRoleManagement /></RequireAuth> }`
- [x] 4.3 Delete the `{ path: '/user-management', element: ... }` route entry entirely from `MainRoutes.jsx`
- [x] 4.4 Delete the `{ path: '/role-management', element: ... }` route entry entirely from `MainRoutes.jsx`
- [x] 4.5 Remove lazy imports `const RoleManagement = ...` and `const UserManagement = ...` from `MainRoutes.jsx`

## 5. Update Sidebar Menu Config

- [x] 5.1 In `packages/ui/src/menu-items/reinventionDashboard.js`: update PLATFORM group item — change `id` from `user-management` to `user-role-management`
- [x] 5.2 Update `url` from `/user-management` to `/user-role-management`
- [x] 5.3 Update `permission` from `'users:manage'` to `'users:manage,roles:manage'`

## 6. Delete Old View Directories

- [x] 6.1 Delete `packages/ui/src/views/usermanagement/` directory (all files)
- [x] 6.2 Delete `packages/ui/src/views/rolemanagement/` directory (all files)

## 7. Verify & Validate

- [x] 7.1 Run `get_errors` on all modified files and confirm zero TypeScript/lint errors
- [ ] 7.2 Manually verify: navigate to `/user-role-management` — both tabs render correctly
- [ ] 7.3 Manually verify: `/user-management` and `/role-management` are no longer matched routes
- [ ] 7.4 Manually verify: PLATFORM sidebar "Users & Roles" item navigates to `/user-role-management`
- [ ] 7.5 Manually verify: user with only `users:manage` sees only "Users" tab; user with only `roles:manage` sees only "Roles" tab
