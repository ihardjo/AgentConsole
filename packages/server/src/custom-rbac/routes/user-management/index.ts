/**
 * Custom RBAC - User Management Routes
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
import userManagementController from '../../controllers/user-management'
import { registerCrudRoutes, registerRoute } from '../shared/utils'

const router = express.Router()

// Register CRUD routes for user management
registerCrudRoutes(router, {
    permissionPrefix: 'users',
    handlers: {
        read: userManagementController.readOrganizationUsers,
        create: userManagementController.createOrganizationUser,
        update: userManagementController.updateOrganizationUser,
        delete: userManagementController.deleteOrganizationUser
    }
})

// Additional custom route: No permission check needed - users can view their own workspaces
registerRoute(router, {
    method: 'get',
    path: '/workspaces',
    handler: userManagementController.getWorkspacesByOrganizationIdUserId,
    permission: null,
    description: 'Get workspaces by organization and user ID'
})

// Delete a user from a workspace
registerRoute(router, {
    method: 'delete',
    path: '/workspace',
    handler: userManagementController.deleteWorkspaceUser,
    permission: 'users:manage',
    description: 'Delete a user from a workspace'
})

export default router
