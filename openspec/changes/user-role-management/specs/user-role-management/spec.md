## ADDED Requirements

### Requirement: Unified Users & Roles view at single route
The system SHALL provide a single page at `/user-role-management` consisting of one card with a shared page header (title "Users & Roles", search bar, action button) followed by a tab row ("Users", "Roles"), with the active tab's table content rendered directly below. The page SHALL be accessible to any user holding at least one of the permissions `users:manage` or `roles:manage`.

#### Scenario: User with users:manage navigates to /user-role-management
- **WHEN** a user with `users:manage` permission navigates to `/user-role-management`
- **THEN** the system SHALL render the page with a "Users" tab visible and active

#### Scenario: User with roles:manage navigates to /user-role-management
- **WHEN** a user with `roles:manage` permission navigates to `/user-role-management`
- **THEN** the system SHALL render the page with a "Roles" tab visible and active

#### Scenario: User with both permissions navigates to /user-role-management
- **WHEN** a user with both `users:manage` and `roles:manage` permissions navigates to `/user-role-management`
- **THEN** the system SHALL render the page with both "Users" and "Roles" tabs visible, with "Users" as the default active tab

#### Scenario: User without either permission navigates to /user-role-management
- **WHEN** a user without `users:manage` or `roles:manage` navigates to `/user-role-management`
- **THEN** the system SHALL deny access, consistent with `RequireAuth` behaviour for unauthorised routes

### Requirement: Tab-level permission gating
The system SHALL show only tabs for which the current user has the corresponding permission. Tabs for which the user lacks permission SHALL NOT be rendered.

#### Scenario: Users tab hidden when users:manage absent
- **WHEN** a user with `roles:manage` but without `users:manage` views the page
- **THEN** the "Users" tab SHALL NOT be visible

#### Scenario: Roles tab hidden when roles:manage absent
- **WHEN** a user with `users:manage` but without `roles:manage` views the page
- **THEN** the "Roles" tab SHALL NOT be visible

### Requirement: Shared header with context-sensitive controls
The page header SHALL display the title "Users & Roles" at all times. The search bar placeholder and action button SHALL reflect the active tab: "Search Users" / "Invite User" button when Users tab is active; "Search Roles" / "Add Role" button when Roles tab is active. The action buttons SHALL respect their existing permission gates (`workspace:add-user,users:manage` and `roles:manage` respectively).

#### Scenario: Users tab active — header controls
- **WHEN** the "Users" tab is active
- **THEN** the search bar placeholder SHALL read "Search Users" and the action button SHALL read "Invite User"

#### Scenario: Roles tab active — header controls
- **WHEN** the "Roles" tab is active
- **THEN** the search bar placeholder SHALL read "Search Roles" and the action button SHALL read "Add Role"

### Requirement: Tabs positioned below header inside single card
The `Tabs` row SHALL appear directly below the `ViewHeader` within the same `MainCard`. There SHALL be no nested `MainCard` or secondary header inside each tab panel.

#### Scenario: Single card layout
- **WHEN** a user navigates to `/user-role-management`
- **THEN** the page SHALL render exactly one card boundary, with header and tabs both inside it

### Requirement: Table content and behaviour preserved
The Users table (columns: icon, Email/Name, Assigned Roles, Status, Last Login, actions) and Roles table (columns: Name, Description, Permissions, Assigned Users, actions) SHALL be fully preserved — same columns, same row components, same dialogs and drawers.

#### Scenario: Users table columns unchanged
- **WHEN** the "Users" tab is active
- **THEN** the table SHALL display the same columns as the previous standalone User Management view

#### Scenario: Roles table columns unchanged
- **WHEN** the "Roles" tab is active
- **THEN** the table SHALL display the same columns as the previous standalone Role Management view

### Requirement: Sidebar menu item points to unified route
The PLATFORM group in the sidebar SHALL contain a single "Users & Roles" item with URL `/user-role-management`. The separate "Users" and "Roles" menu items SHALL NOT exist.

#### Scenario: Users & Roles menu item navigates to unified route
- **WHEN** the user clicks "Users & Roles" in the PLATFORM group
- **THEN** the browser SHALL navigate to `/user-role-management`

### Requirement: Legacy routes removed
The routes `/user-management` and `/role-management` SHALL be fully removed from the application router. No redirect or fallback SHALL be registered for these paths. Any access to the old paths SHALL result in the application's standard unmatched-route behaviour.

#### Scenario: /user-management no longer exists
- **WHEN** a user navigates to `/user-management`
- **THEN** the application SHALL NOT match a route for that path (no redirect, no content rendered for `/user-management`)

#### Scenario: /role-management no longer exists
- **WHEN** a user navigates to `/role-management`
- **THEN** the application SHALL NOT match a route for that path (no redirect, no content rendered for `/role-management`)
