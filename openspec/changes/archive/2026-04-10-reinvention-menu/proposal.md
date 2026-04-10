## Why

The current sidebar navigation in the Agent Console has grown organically and no longer reflects a clear, user-centric mental model — mixing platform concerns, agent authoring, and operational tools in a flat, ungrouped way. A structured, domain-driven navigation redesign will improve discoverability, reduce cognitive load for operators, and align the UI with the platform's evolving capability surface.

## What Changes

- **Remove** the existing flat/semi-grouped `dashboard.js` menu structure
- **Introduce** a new `SidebarMenu` React component that encapsulates the new 6-group navigation structure
- **Replace** the inline menu-item definitions in `dashboard.js` with a reference to the new component
- **Add** six new top-level navigation groups:
  - **PROCESS STUDIO**: Reinvention Processes, Deployments
  - **AGENT STUDIO**: Agent Flows, Assistants, Tools, Credentials, Variables, Versions & Promotion
  - **KNOWLEDGE**: Document Stores, Knowledge Graph, Connectors
  - **OBSERVABILITY**: Process Performance, Agent Performance
  - **MARKETPLACE**: Marketplace
  - **PLATFORM**: Users & Roles, Workspaces, API Keys, Worker Configuration, Platform Settings
- **Preserve** existing permission gating and `display` feature-flag patterns per menu item
- Map new items to existing routes where available; introduce placeholder routes for new items (Knowledge Graph, Connectors, Reinvention Processes, Deployments, Versions & Promotion, Process Performance)

## Capabilities

### New Capabilities

- `reinvention-menu`: A new sidebar navigation structure with 6 domain-grouped sections, implemented as a dedicated React component replacing the legacy inline menu definition in `dashboard.js`

### Modified Capabilities

- (none — no existing spec-level behavior changes; this is a UI structural change only)

## Impact

- **UI**: `packages/ui/src/menu-items/dashboard.js` replaced or refactored; new component file(s) added under `packages/ui/src/`
- **Routing**: New placeholder routes may need to be registered in the React Router config for new menu items (Knowledge Graph, Connectors, Reinvention Processes, Deployments, Versions & Promotion, Process Performance)
- **Permissions**: Existing permission strings reused; new items may require new permission keys coordinated with the backend
- **No API changes** required for the navigation restructure itself
- **No breaking changes** to existing routes — all current URLs remain valid
