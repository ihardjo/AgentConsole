## 1. Prerequisite: Harden NavGroup for missing primary child

- [x] 1.1 In `packages/ui/src/layout/MainLayout/Sidebar/MenuList/NavGroup/index.jsx`, update `renderPrimaryItems()` to guard against a missing `primary` child — return an empty array instead of calling `.children` on `undefined`

## 2. Create the new menu config file

- [x] 2.1 Create `packages/ui/src/menu-items/reinventionDashboard.js` with the root export object (`id: 'dashboard'`, `type: 'group'`)
- [x] 2.2 Add an empty `primary` group as the first child to satisfy NavGroup's existing rendering logic
- [x] 2.3 Add the **PROCESS STUDIO** sub-group with items: "Reinvention Processes" (`/coming-soon`, `alwaysShow: true`) and "Deployments" (`/coming-soon`, `alwaysShow: true`)
- [x] 2.4 Add the **AGENT STUDIO** sub-group with items: "Agent Flows" (`/agentflows`, permission `agentflows:view`), "Assistants" (`/assistants`, permission `assistants:view`), "Tools" (`/tools`, permission `tools:view`), "Credentials" (`/credentials`, permission `credentials:view`), "Variables" (`/variables`, permission `variables:view`), "Versions & Promotion" (`/coming-soon`, `alwaysShow: true`)
- [x] 2.5 Add the **KNOWLEDGE** sub-group with items: "Document Stores" (`/document-stores`, permission `documentStores:view`), "Knowledge Graph" (`/coming-soon`, `alwaysShow: true`), "Connectors" (`/coming-soon`, `alwaysShow: true`)
- [x] 2.6 Add the **OBSERVABILITY** sub-group with items: "Process Performance" (`/coming-soon`, `alwaysShow: true`), "Agent Performance" (`/agentops`, permission `agentops:view`)
- [x] 2.7 Add the **MARKETPLACE** sub-group with one item: "Marketplace" (`/marketplaces`, permission `templates:marketplace,templates:custom`)
- [x] 2.8 Add the **PLATFORM** sub-group with items: "Users & Roles" (`/role-management` + `/user-management` combined, use `/user-management` as URL, permission `users:manage`), "Workspaces" (`/workspace-management`, permission `workspace:view`), "API Keys" (`/apikey`, permission `apikeys:view`), "Worker Configuration" (`/worker-configuration`, permission `worker:view`), "Platform Settings" (`/platform-configuration`, permission `platformConfiguration:manage`)
- [x] 2.9 Import all required Tabler icons at the top of the file (`IconUsersGroup`, `IconRobot`, `IconTool`, `IconLock`, `IconVariable`, `IconFiles`, `IconBuildingStore`, `IconInfinity`, `IconCloudCog`, `IconSettings`, `IconStack2`, `IconUsers`, `IconKey`, etc.)

## 3. Wire the new config into the application

- [x] 3.1 Update `packages/ui/src/menu-items/index.js` to import from `./reinventionDashboard` instead of `./dashboard`

## 4. Add the Coming Soon placeholder page

- [x] 4.1 Create `packages/ui/src/views/coming-soon/index.jsx` — a simple React component that renders a centred "Coming Soon" heading and a brief message
- [x] 4.2 In `packages/ui/src/routes/MainRoutes.jsx`, add a lazy import for the new `ComingSoon` component
- [x] 4.3 Register the `/coming-soon` route inside `MainRoutes.children`, wrapping it in `RequireAuth` (no permission required — allow any authenticated user)

## 5. Verify icon availability

- [x] 5.1 Confirm all icons used in `reinventionDashboard.js` are exported from `@tabler/icons-react` (check existing `dashboard.js` imports as reference; add any missing ones)

## 6. Manual smoke test

- [ ] 6.1 Start the UI dev server and verify all 6 sidebar groups render in the correct order
- [ ] 6.2 Click each existing-route item (Agent Flows, Assistants, Tools, Credentials, Variables, Document Stores, Marketplace, Agent Performance, Workspaces, API Keys, Worker Configuration, Platform Settings) and confirm navigation works
- [ ] 6.3 Click each new placeholder item (Reinvention Processes, Deployments, Knowledge Graph, Connectors, Versions & Promotion, Process Performance) and confirm they navigate to the Coming Soon page without errors
- [ ] 6.4 Log in as a user without platform permissions and confirm PLATFORM items are hidden appropriately
- [ ] 6.5 Confirm no JavaScript console errors on sidebar render (particularly no `Cannot read properties of undefined` from `NavGroup`)
