## Requirements

### Requirement: Six-group sidebar navigation structure
The sidebar navigation SHALL be organised into exactly 6 named domain groups rendered in the following order: PROCESS STUDIO, AGENT STUDIO, KNOWLEDGE, OBSERVABILITY, MARKETPLACE, PLATFORM. Each group SHALL be visually separated by a divider and labelled with its domain name. No blank or empty section SHALL appear above the first group. No divider line SHALL appear above the first group (PROCESS STUDIO).

#### Scenario: Sidebar displays all 6 groups in correct order with no blank section
- **WHEN** an authenticated user opens the Agent Console
- **THEN** the sidebar SHALL render 6 section headers in the order: PROCESS STUDIO, AGENT STUDIO, KNOWLEDGE, OBSERVABILITY, MARKETPLACE, PLATFORM, with no empty padded section above PROCESS STUDIO

#### Scenario: No divider above the first group
- **WHEN** the sidebar renders the PROCESS STUDIO group as the first non-primary group
- **THEN** no `<Divider>` element SHALL appear above it

#### Scenario: Each group displays only permitted items
- **WHEN** a user does not have permission for a menu item within a group
- **THEN** that item SHALL be hidden, but the group header SHALL remain visible if at least one item in the group is visible

### Requirement: PROCESS STUDIO group
The PROCESS STUDIO group SHALL contain four menu items in order: "Chatflows", "Reinvention Processes", "Deployments", and "Process Intelligence". "Process Intelligence" SHALL link to `/coming-soon` with `alwaysShow: true` and use icon `IconBulb`. It SHALL be rendered immediately after "Deployments".

> **Known gap (2026-04-10):** "Chatflows" is specified as the first item in this group but is not yet implemented in `reinventionDashboard.js`. It was intentionally omitted from `reinvention-menu-fixes` scope. A follow-up change is required to add it.

#### Scenario: Process Intelligence is present after Deployments
- **WHEN** the sidebar is rendered for any authenticated user
- **THEN** the PROCESS STUDIO section SHALL contain "Process Intelligence" immediately after "Deployments"

#### Scenario: Process Intelligence navigates to coming-soon
- **WHEN** a user clicks "Process Intelligence"
- **THEN** the browser SHALL navigate to `/coming-soon`

#### Scenario: Process Intelligence uses a bulb icon
- **WHEN** the sidebar renders the PROCESS STUDIO group
- **THEN** the "Process Intelligence" item SHALL display `IconBulb`

### Requirement: AGENT STUDIO group
The AGENT STUDIO group SHALL contain seven menu items in order: "Agent Flows", "Executions", "Assistants", "Tools", "Credentials", "Variables", and "Versions & Promotion". "Versions & Promotion" SHALL link to `/agentops` and use a Git branching icon (`IconGitBranch`). "Executions" SHALL link to `/executions` with permission `executions:view`.

#### Scenario: AGENT STUDIO items are present in correct order
- **WHEN** the sidebar is rendered for a user with appropriate permissions
- **THEN** the AGENT STUDIO section SHALL contain in order: "Agent Flows", "Executions", "Assistants", "Tools", "Credentials", "Variables", "Versions & Promotion"

#### Scenario: Executions respects permission gate
- **WHEN** a user lacks the `executions:view` permission
- **THEN** the "Executions" item SHALL be hidden from AGENT STUDIO

#### Scenario: Versions & Promotion navigates to agentops
- **WHEN** a user clicks "Versions & Promotion"
- **THEN** the browser SHALL navigate to `/agentops`

#### Scenario: Versions & Promotion icon is a git branch
- **WHEN** the sidebar renders the AGENT STUDIO group
- **THEN** the "Versions & Promotion" item SHALL display the `IconGitBranch` icon

### Requirement: KNOWLEDGE group
The KNOWLEDGE group SHALL contain three menu items: "Document Stores", "Knowledge Graph", and "Connectors".

#### Scenario: KNOWLEDGE items are present
- **WHEN** the sidebar is rendered
- **THEN** the KNOWLEDGE section SHALL contain "Document Stores", "Knowledge Graph", and "Connectors"

#### Scenario: Document Stores retains existing permission gate
- **WHEN** a user lacks the `documentStores:view` permission
- **THEN** the "Document Stores" item SHALL be hidden

### Requirement: OBSERVABILITY group
The OBSERVABILITY group SHALL contain two menu items: "Process Performance" and "Agent Performance". Both SHALL link to `/coming-soon` with `alwaysShow: true`. "Process Performance" SHALL use `IconActivity`. "Agent Performance" SHALL use `IconBrain`. The two items SHALL have visually distinct icons that are semantically related to their respective feature areas.

#### Scenario: OBSERVABILITY items navigate to coming-soon
- **WHEN** a user clicks "Process Performance" or "Agent Performance"
- **THEN** the browser SHALL navigate to `/coming-soon`

#### Scenario: Process Performance uses a process/workflow icon
- **WHEN** the sidebar renders the OBSERVABILITY group
- **THEN** the "Process Performance" item SHALL display `IconActivity`

#### Scenario: Agent Performance uses an AI/intelligence icon
- **WHEN** the sidebar renders the OBSERVABILITY group
- **THEN** the "Agent Performance" item SHALL display `IconBrain`

### Requirement: MARKETPLACE group
The MARKETPLACE group SHALL contain one menu item: "Marketplace", linking to the existing marketplaces route.

#### Scenario: Marketplace item is present and functional
- **WHEN** the sidebar is rendered for a user with `templates:marketplace` or `templates:custom` permission
- **THEN** the MARKETPLACE section SHALL display the "Marketplace" item

#### Scenario: Marketplace hidden without permission
- **WHEN** a user lacks both `templates:marketplace` and `templates:custom` permissions
- **THEN** the "Marketplace" item SHALL be hidden

### Requirement: PLATFORM group
The PLATFORM group SHALL contain five menu items: "Users & Roles", "Workspaces", "API Keys", "Worker Configuration", and "Platform Settings".

#### Scenario: PLATFORM items are present
- **WHEN** a user with platform management permissions opens the sidebar
- **THEN** the PLATFORM section SHALL contain "Users & Roles", "Workspaces", "API Keys", "Worker Configuration", and "Platform Settings"

#### Scenario: PLATFORM items respect permissions
- **WHEN** a user lacks `users:manage` and `roles:manage`
- **THEN** the "Users & Roles" item SHALL be hidden

### Requirement: New menu config isolated in dedicated file
The new 6-group navigation structure SHALL be defined in a dedicated file (`reinventionDashboard.js`) separate from the legacy `dashboard.js`, and SHALL be wired into the application via `menu-items/index.js`.

#### Scenario: Config file swap is a single-line change
- **WHEN** the implementation is complete
- **THEN** switching between the old and new menu config SHALL require changing only the import in `menu-items/index.js`

### Requirement: Placeholder route for new items
Menu items that do not yet have dedicated pages (Reinvention Processes, Deployments, Knowledge Graph, Connectors, Versions & Promotion, Process Performance) SHALL navigate to a shared `/coming-soon` placeholder route that renders a "Coming Soon" message.

#### Scenario: New items navigate to coming-soon page
- **WHEN** a user clicks any new menu item without a dedicated page
- **THEN** the browser SHALL navigate to `/coming-soon` and display a "Coming Soon" placeholder

#### Scenario: Coming-soon page is registered in the router
- **WHEN** the router configuration is evaluated
- **THEN** a route for `/coming-soon` SHALL exist and render without errors

### Requirement: NavGroup renders gracefully without primary child
The `NavGroup` component SHALL handle the absence of a `primary` child group without throwing a JavaScript error, rendering an empty primary section instead. Additionally, if the primary group exists but has no children, the `NavGroup` component SHALL NOT render an empty `<List>` element for it, producing no visible blank section. The first non-primary group SHALL NOT be preceded by a `<Divider>`.

#### Scenario: No primary child — no crash
- **WHEN** a menu group object is passed to `NavGroup` that has no child with `id: 'primary'`
- **THEN** the component SHALL render the non-primary sub-groups without throwing an uncaught error

#### Scenario: Empty primary group produces no visible blank section
- **WHEN** a menu group has a `primary` child with zero items
- **THEN** the `NavGroup` component SHALL NOT render any visible list element or padding for that empty primary group

#### Scenario: First non-primary group has no leading divider
- **WHEN** `NavGroup` renders non-primary sub-groups
- **THEN** the first sub-group in the list SHALL NOT have a `<Divider>` rendered above it

### Requirement: Header hamburger icon position
The sidebar toggle button (`IconMenu2`) in the application header SHALL be rendered to the left of the application logo.

#### Scenario: Hamburger renders left of logo
- **WHEN** an authenticated user views the application header
- **THEN** the hamburger/menu toggle icon SHALL appear to the left of the application logo
