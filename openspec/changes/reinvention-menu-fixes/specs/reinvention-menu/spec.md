## MODIFIED Requirements

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
