## ADDED Requirements

### Requirement: Six-group sidebar navigation structure
The sidebar navigation SHALL be reorganised into exactly 6 named domain groups rendered in the following order: PROCESS STUDIO, AGENT STUDIO, KNOWLEDGE, OBSERVABILITY, MARKETPLACE, PLATFORM. Each group SHALL be visually separated by a divider and labelled with its domain name.

#### Scenario: Sidebar displays all 6 groups in correct order
- **WHEN** an authenticated user opens the Agent Console
- **THEN** the sidebar SHALL render 6 section headers in the order: PROCESS STUDIO, AGENT STUDIO, KNOWLEDGE, OBSERVABILITY, MARKETPLACE, PLATFORM

#### Scenario: Each group displays only permitted items
- **WHEN** a user does not have permission for a menu item within a group
- **THEN** that item SHALL be hidden, but the group header SHALL remain visible if at least one item in the group is visible

### Requirement: PROCESS STUDIO group
The PROCESS STUDIO group SHALL contain two menu items: "Reinvention Processes" and "Deployments".

#### Scenario: PROCESS STUDIO items are present
- **WHEN** the sidebar is rendered for a user with access
- **THEN** the PROCESS STUDIO section SHALL contain exactly the items "Reinvention Processes" and "Deployments"

#### Scenario: New items navigate without errors
- **WHEN** a user clicks "Reinvention Processes" or "Deployments"
- **THEN** the application SHALL navigate to a valid route without a 404 error

### Requirement: AGENT STUDIO group
The AGENT STUDIO group SHALL contain six menu items: "Agent Flows", "Assistants", "Tools", "Credentials", "Variables", and "Versions & Promotion".

#### Scenario: AGENT STUDIO items are present
- **WHEN** the sidebar is rendered for a user with appropriate permissions
- **THEN** the AGENT STUDIO section SHALL contain the items "Agent Flows", "Assistants", "Tools", "Credentials", "Variables", and "Versions & Promotion"

#### Scenario: AGENT STUDIO respects existing permissions
- **WHEN** a user lacks the `agentflows:view` permission
- **THEN** the "Agent Flows" item SHALL be hidden from AGENT STUDIO

### Requirement: KNOWLEDGE group
The KNOWLEDGE group SHALL contain three menu items: "Document Stores", "Knowledge Graph", and "Connectors".

#### Scenario: KNOWLEDGE items are present
- **WHEN** the sidebar is rendered
- **THEN** the KNOWLEDGE section SHALL contain "Document Stores", "Knowledge Graph", and "Connectors"

#### Scenario: Document Stores retains existing permission gate
- **WHEN** a user lacks the `documentStores:view` permission
- **THEN** the "Document Stores" item SHALL be hidden

### Requirement: OBSERVABILITY group
The OBSERVABILITY group SHALL contain two menu items: "Process Performance" and "Agent Performance".

#### Scenario: OBSERVABILITY items are present
- **WHEN** the sidebar is rendered
- **THEN** the OBSERVABILITY section SHALL contain "Process Performance" and "Agent Performance"

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
The `NavGroup` component SHALL handle the absence of a `primary` child group without throwing a JavaScript error, rendering an empty primary section instead.

#### Scenario: No primary child — no crash
- **WHEN** a menu group object is passed to `NavGroup` that has no child with `id: 'primary'`
- **THEN** the component SHALL render the non-primary sub-groups without throwing an uncaught error
