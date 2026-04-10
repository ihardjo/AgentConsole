## Context

The Agent Console UI uses a sidebar navigation system built on a data-driven approach: a static `dashboard.js` file exports a nested menu-item tree consumed by `MenuList` → `NavGroup` → `NavItem` React components. `NavGroup` is the key rendering component — it understands a single top-level group with a reserved `primary` child group plus additional named sub-groups, each rendered as a divider-separated section.

The current `dashboard.js` has grown ad-hoc: it mixes multiple concerns (platform management, evaluations, others) with no clear domain model. Operator feedback and the reinvention initiative require a structured, 6-domain navigation that maps clearly to product areas.

Key constraints:
- `NavGroup` renders one group object from `dashboard.js`, expecting a `primary` child for top items and additional children for sub-groups with dividers
- `NavItem` supports `permission`, `display`, `alwaysShow`, `external`, `target`, `dynamicUrl` flags — all must be preserved
- `MenuList` iterates `menuItems.items` and renders each item as a `NavGroup`
- The `menuItems` export in `menu-items/index.js` is the single integration point

## Goals / Non-Goals

**Goals:**
- Restructure the sidebar into 6 clear domain groups: PROCESS STUDIO, AGENT STUDIO, KNOWLEDGE, OBSERVABILITY, MARKETPLACE, PLATFORM
- Create a new dedicated `SidebarMenuConfig` component/config file that owns the new structure, keeping `dashboard.js` as a thin re-export or replacing it entirely
- Preserve all existing permission gating, feature-flag `display` checks, `alwaysShow` behaviour, and `dynamicUrl` handling
- Map all existing menu items to their new groups with no broken routes
- Add placeholder route entries for new items: Reinvention Processes, Deployments, Knowledge Graph, Connectors, Versions & Promotion, Process Performance
- Keep changes isolated to the UI package

**Non-Goals:**
- Implementing backend APIs or route handlers for the new placeholder pages
- Changing the `NavGroup`, `NavItem`, `NavCollapse`, or `MenuList` rendering components
- Adding new permission system logic (reuse existing strings or mark as TBD)
- Redesigning the visual appearance of the sidebar (only structure changes)

## Decisions

### Decision 1: New file vs. modifying `dashboard.js`

**Choice**: Create `packages/ui/src/menu-items/reinventionDashboard.js` as a new file, and update `menu-items/index.js` to export it instead of `dashboard.js`.

**Rationale**: Keeps the old `dashboard.js` intact as a rollback reference during the transition. The swap is a single-line change in `index.js`. Avoids a large destructive edit to the existing file, reducing merge-conflict risk.

**Alternative considered**: In-place rewrite of `dashboard.js`. Simpler file count, but makes rollback harder and diffs noisier.

### Decision 2: Data structure — one root group with 6 sub-groups

**Choice**: The new file exports one root group object (`id: 'dashboard'`) with no `primary` child group. Instead, the 6 domain groups are direct children, each following the `{ id, title, type: 'group', children: [...] }` shape that `NavGroup`'s `renderNonPrimaryGroups()` handles.

**Rationale**: `NavGroup` already renders non-primary sub-groups with dividers and section headers. This maps perfectly to the 6-group requirement without any component changes.

**Alternative considered**: Six separate root items in `menuItems.items`. Requires `MenuList` to loop and `NavGroup` to handle root-level groups without a primary wrapper — more invasive.

> **Note on `primary` group removal**: The current `NavGroup.renderPrimaryItems()` calls `item.children.find(child => child.id === 'primary')` and would throw if `primary` is absent. The new structure still needs a `primary` group (can be empty or hold the first domain's items). To avoid touching `NavGroup`, we will retain a `primary` group as an empty placeholder and place all 6 domain groups as additional children.

### Decision 3: Placeholder routes for new items

**Choice**: New items without existing pages (Reinvention Processes, Deployments, Knowledge Graph, Connectors, Versions & Promotion, Process Performance) will use `/coming-soon` as their URL, with a shared `ComingSoon` placeholder page registered in the router. The `permission` field will be left empty (`alwaysShow: true`) until backend permissions are defined.

**Rationale**: Provides immediately navigable, non-broken links. Avoids hiding menu items behind unresolved permissions.

**Alternative considered**: Omit new items until pages exist. Reduces noise but doesn't deliver the full structural change requested.

## Risks / Trade-offs

- **`renderPrimaryItems()` assumes `primary` exists** → Mitigation: retain an empty `primary` group in the new config, or patch `NavGroup` to guard against missing `primary` (preferred safer fix: guard with `?.` and log warning).
- **Route collisions** → All new placeholder items point to `/coming-soon`; ensure the router has this route registered before deployment.
- **Permission strings for new items TBD** → New items default to `alwaysShow: true` until the backend defines permission keys; this is a temporary permissive state.
- **`dashboard.js` and `reinventionDashboard.js` both exist during transition** → Mitigation: `dashboard.js` is only referenced from `index.js`, so the swap is atomic. Remove `dashboard.js` in a follow-up cleanup commit.
