## 1. Fix empty primary section in NavGroup

- [x] 1.1 In `packages/ui/src/layout/MainLayout/Sidebar/MenuList/NavGroup/index.jsx`, wrap the primary `<List>` render in a conditional — only render it when `renderPrimaryItems()` returns a non-empty array (i.e. `renderPrimaryItems().length > 0`)

## 2. Update reinventionDashboard.js — icon imports

- [x] 2.1 Add `IconGitBranch` to the import list from `@tabler/icons-react` in `reinventionDashboard.js`
- [x] 2.2 Add `IconGitBranch` to the `icons` constant object
- [x] 2.3 Remove `IconInfinity` from the import list (no longer used after Agent Performance moves to coming-soon)
- [x] 2.4 Remove `IconInfinity` from the `icons` constant object

## 3. Update reinventionDashboard.js — AGENT STUDIO group

- [x] 3.1 Add the "Executions" menu item (`id: 'executions'`, `url: '/executions'`, icon: `icons.IconListCheck`, permission: `executions:view`) immediately after the "Agent Flows" item
- [x] 3.2 Change the "Versions & Promotion" item: set `url` to `/agentops`, set `permission` to `agentops:view`, remove `alwaysShow: true`, update `icon` to `icons.IconGitBranch`

## 4. Update reinventionDashboard.js — OBSERVABILITY group

- [x] 4.1 Change the "Agent Performance" item: set `url` to `/coming-soon`, remove `permission: 'agentops:view'`, add `alwaysShow: true`, update icon to `icons.IconBrain`
- [x] 4.2 Change the "Process Performance" item: update icon to `icons.IconActivity`
- [x] 4.3 Add `IconActivity` and `IconBrain` to the import list and `icons` constant in `reinventionDashboard.js`

## 5. Add missing icon import for Executions

- [x] 5.1 Verify `IconListCheck` is already imported in `reinventionDashboard.js`; if not, add it to the imports and `icons` constant

## 6. Remove top divider from first sidebar group

- [x] 6.1 In `NavGroup/index.jsx`, update `renderNonPrimaryGroups().map` to track `index` and only render `<Divider>` when `index > 0`

## 7. Move header hamburger to left of logo

- [x] 7.1 In `packages/ui/src/layout/MainLayout/Header/index.jsx`, reorder the left `Box` children so the `ButtonBase` (hamburger toggle) renders before the `LogoSection`

## 8. Verify

- [x] 8.1 Check for lint/type errors across all modified files
- [ ] 8.2 Confirm the sidebar renders with no blank section and no divider above PROCESS STUDIO
- [ ] 8.3 Confirm "Executions" appears in AGENT STUDIO after "Agent Flows"
- [ ] 8.4 Confirm "Versions & Promotion" navigates to `/agentops` and displays `IconGitBranch`
- [ ] 8.5 Confirm "Agent Performance" navigates to `/coming-soon` and displays `IconBrain`
- [ ] 8.6 Confirm "Process Performance" displays `IconActivity`
- [ ] 8.7 Confirm the hamburger toggle appears to the left of the application logo in the header
