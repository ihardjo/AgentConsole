## Why

After the initial reinvention-menu implementation, three visual and structural issues were identified: (1) an empty list section renders above the PROCESS STUDIO group due to the empty `primary` group child, (2) the "Executions" menu item is missing from AGENT STUDIO, and (3) the `/agentops` route is incorrectly assigned to "Agent Performance" in OBSERVABILITY rather than "Versions & Promotion" in AGENT STUDIO where it logically belongs. Three further visual polish items were also addressed: (4) a redundant top-line divider appears above PROCESS STUDIO as the first group, (5) the sidebar hamburger toggle icon renders to the right of the application logo instead of the left, and (6) "Process Performance" and "Agent Performance" share the same icon, making them visually indistinguishable. A seventh item adds a new placeholder entry to PROCESS STUDIO: "Process Intelligence" under "Deployments", routing to `/coming-soon`.

## What Changes

- **Remove** the visible empty section at the top of the sidebar caused by the empty `primary` group being rendered by `NavGroup` — fix by ensuring the `primary` group is completely eliminated from the structure and `NavGroup` is updated to not render an empty `<List>` for it
- **Remove** the top divider line above the first sidebar group (PROCESS STUDIO) — `NavGroup` now only renders a `<Divider>` for groups after the first one (`index > 0`)
- **Add** "Executions" menu item in the AGENT STUDIO group, immediately after "Agent Flows", linking to `/executions` with permission `executions:view`
- **Move** the `/agentops` route from the "Agent Performance" item in OBSERVABILITY to the "Versions & Promotion" item in AGENT STUDIO; update "Versions & Promotion" icon to `IconGitBranch`
- **Update** "Agent Performance" in OBSERVABILITY to use `/coming-soon` with `alwaysShow: true`
- **Move** the hamburger menu toggle (`IconMenu2`) to the left of the application logo in the header
- **Differentiate** OBSERVABILITY icons: "Process Performance" → `IconActivity` (workflow pulse), "Agent Performance" → `IconBrain` (AI intelligence)
- **Remove** `IconInfinity` import (replaced by `IconBrain`); add `IconGitBranch`, `IconListCheck`, `IconActivity`, `IconBrain` imports
- **Add** "Process Intelligence" menu item in the PROCESS STUDIO group, immediately after "Deployments", linking to `/coming-soon` with `alwaysShow: true` and icon `IconBulb`

## Capabilities

### New Capabilities

- (none)

### Modified Capabilities

- `reinvention-menu`: Fixing empty primary section and first-group divider rendering, adding Executions to AGENT STUDIO, reassigning agentops route to Versions & Promotion with `IconGitBranch`, differentiating OBSERVABILITY icons, moving the header hamburger to the left of the logo, and adding Process Intelligence placeholder to PROCESS STUDIO

## Impact

- **UI**: `packages/ui/src/menu-items/reinventionDashboard.js` — item additions, route reassignment, icon updates (`IconActivity`, `IconBrain`, `IconGitBranch`, `IconListCheck`, `IconBulb`)
- **UI**: `packages/ui/src/layout/MainLayout/Sidebar/MenuList/NavGroup/index.jsx` — suppress empty primary `<List>`; suppress top divider on first non-primary group
- **UI**: `packages/ui/src/layout/MainLayout/Header/index.jsx` — hamburger icon moved left of logo
- No route changes, no new views, no API changes
