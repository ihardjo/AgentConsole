/**
 * Custom RBAC - Workspace Management Routes
 *
 * Copyright (c) 2024-2026
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import express from 'express'
import workspaceManagementController from '../../controllers/workspace-management'
import { registerCrudRoutes, registerRoute } from '../shared/utils'

const router = express.Router()

// Register standard CRUD routes for workspace management
registerCrudRoutes(router, {
    permissionPrefix: 'workspaces',
    handlers: {
        read: workspaceManagementController.readWorkspace,
        create: workspaceManagementController.createWorkspace,
        update: workspaceManagementController.updateWorkspace,
        delete: workspaceManagementController.deleteWorkspace
    }
})

// Switch workspace - no permission check needed as users can switch to any workspace they're a member of
registerRoute(router, {
    method: 'post',
    path: '/switch/:workspaceId',
    handler: workspaceManagementController.switchWorkspace,
    permission: null,
    description: 'Switch to a different workspace'
})

// Workspace user management routes
registerRoute(router, {
    method: 'get',
    path: '/users/:workspaceId',
    handler: workspaceManagementController.readWorkspaceUsers,
    permission: 'workspaces:manage',
    description: 'Get users in a workspace'
})

registerRoute(router, {
    method: 'put',
    path: '/users',
    handler: workspaceManagementController.updateWorkspaceUserRole,
    permission: 'workspaces:manage',
    description: 'Update workspace user role'
})

export default router
