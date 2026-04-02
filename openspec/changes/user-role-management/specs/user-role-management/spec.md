## ADDED Requirements

### Requirement: Unified Users & Roles view at single route
The system SHALL provide a single page at `/user-role-management` that combines Users management and Roles management under a tabbed interface. The page SHALL be accessible to any user holding at least one of the permissions `users:manage` or `roles:manage`.

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

### Requirement: Tab switching renders correct content
The system SHALL render the UserManagement content when the "Users" tab is active, and RoleManagement content when the "Roles" tab is active.

#### Scenario: Switching to Roles tab
- **WHEN** the user clicks the "Roles" tab
- **THEN** the system SHALL display the Roles management content and hide the Users management content

#### Scenario: Switching to Users tab
- **WHEN** the user clicks the "Users" tab
- **THEN** the system SHALL display the Users management content and hide the Roles management content

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
