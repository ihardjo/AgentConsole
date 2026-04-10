## Context

The `reinvention-menu` change introduced a new 6-group sidebar structure via `reinventionDashboard.js`. Seven issues were found after initial implementation and addressed in this change:

1. **Empty section at the top**: `NavGroup` renders a `<List>` for the empty `primary` group, producing a blank padded area before PROCESS STUDIO.
2. **Missing Executions item**: The "Executions" page (`/executions`) exists and has a permission gate (`executions:view`) but was omitted from AGENT STUDIO.
3. **Wrong route on Versions & Promotion**: The `/agentops` route was placed under "Agent Performance" in OBSERVABILITY, but belongs under "Versions & Promotion" in AGENT STUDIO. "Agent Performance" becomes a placeholder.
4. **Redundant top divider on PROCESS STUDIO**: `NavGroup` renders a `<Divider>` before every non-primary group, including the first one, producing an unnecessary top line above PROCESS STUDIO.
5. **Hamburger icon on wrong side of logo**: The sidebar toggle (`IconMenu2`) renders to the right of the application logo; it should be on the left for standard navigation conventions.
6. **Indistinguishable OBSERVABILITY icons**: "Process Performance" and "Agent Performance" both used `IconChartBar`, making them visually identical.
7. **Missing Process Intelligence placeholder**: PROCESS STUDIO is missing a "Process Intelligence" entry after "Deployments" — it should exist as a coming-soon placeholder alongside the other forthcoming PROCESS STUDIO items.

## Goals / Non-Goals

**Goals:**
- Eliminate the blank `<List>` rendered for the empty `primary` group in `NavGroup`
- Remove the top divider line above the first non-primary group (PROCESS STUDIO)
- Add "Executions" to AGENT STUDIO after "Agent Flows"
- Reassign `/agentops` to "Versions & Promotion" with `IconGitBranch` icon
- Set "Agent Performance" to `/coming-soon` with `alwaysShow: true`
- Move the header hamburger toggle to the left of the application logo
- Assign distinct, semantically meaningful icons to "Process Performance" (`IconActivity`) and "Agent Performance" (`IconBrain`)
- Clean up `IconInfinity`; add `IconGitBranch`, `IconListCheck`, `IconActivity`, `IconBrain`, `IconBulb`
- Add "Process Intelligence" item to PROCESS STUDIO after "Deployments", routing to `/coming-soon` with `alwaysShow: true` and icon `IconBulb`

**Non-Goals:**
- Structural changes to any other component or route
- Any backend or API changes

## Decisions

### Decision 1: Suppress empty `primary` `<List>` in `NavGroup`

**Choice**: Wrap the primary `<List>` render in a conditional — only render when `renderPrimaryItems().length > 0`.

**Rationale**: The empty `primary` group is a structural necessity to avoid a runtime crash. But rendering an empty `<List>` produces visible padding. Hiding it when empty is the minimal, correct fix.

**Alternative considered**: Remove the `primary` group entirely and rely solely on the null-guard. Cleaner, but risks regressions on other menu configs that still use `primary`.

### Decision 2: Suppress top divider on first non-primary group

**Choice**: In `renderNonPrimaryGroups().map`, track the array `index` and only render `<Divider>` when `index > 0`.

**Rationale**: A divider above the very first group has nothing above it to divide from — it's purely noise. All subsequent groups still receive their dividers. Zero impact on other configs.

### Decision 3: Icon for Versions & Promotion

**Choice**: `IconGitBranch`.

**Rationale**: Universally understood as "branching / versioning" in developer tooling. More recognisable than `IconVersions`.

### Decision 4: Hamburger icon placement

**Choice**: Move the `ButtonBase` (hamburger) before the `LogoSection` inside the left header `Box`.

**Rationale**: Standard navigation pattern — the menu toggle precedes the brand logo. This is a pure DOM order swap with no layout impact (both are `inline-flex` within a flex container).

### Decision 5: OBSERVABILITY icons

**Choice**: `IconActivity` for Process Performance, `IconBrain` for Agent Performance.

**Rationale**: `IconActivity` (heartbeat/pulse line) visually represents process flow and throughput monitoring. `IconBrain` communicates AI/agent cognitive performance, clearly differentiating it from generic process metrics.

### Decision 6: Process Intelligence icon and placement

**Choice**: `IconBulb` placed immediately after "Deployments" in PROCESS STUDIO.

**Rationale**: `IconBulb` conveys insight and intelligence without conflicting with any existing icon in the sidebar. Positioning it after "Deployments" keeps the forthcoming PROCESS STUDIO items grouped at the bottom of the section, consistent with the placeholder pattern already used for "Reinvention Processes" and "Deployments".

## Risks / Trade-offs

- **`NavGroup` conditional render** → Only affects the primary section and the first-group divider. Low risk; non-primary groups are unaffected.
- **Header DOM reorder** → Pure visual swap; no functional change to toggle behaviour.
- **`IconInfinity` removal** → Only used for Agent Performance in `reinventionDashboard.js`. Safe to remove.
- **`IconBulb` addition** → New import; no conflict with existing icons.
