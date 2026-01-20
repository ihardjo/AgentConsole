/**
 * Custom RBAC - Workspace User Routes
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
import workspaceUserManagementController from '../../controllers/workspace-user-management'
import { registerRoute } from '../shared/utils'

const router = express.Router()

// Read workspace users - no permission needed, users can view their own workspace info
registerRoute(router, {
    method: 'get',
    path: '/',
    handler: workspaceUserManagementController.readWorkspaceUsers,
    permission: null,
    description: 'Read workspace users'
})

// Create workspace user
registerRoute(router, {
    method: 'post',
    path: '/',
    handler: workspaceUserManagementController.createWorkspaceUser,
    permission: 'workspaces:manage',
    description: 'Create workspace user'
})

// Update workspace user
registerRoute(router, {
    method: 'put',
    path: '/',
    handler: workspaceUserManagementController.updateWorkspaceUser,
    permission: 'workspaces:manage',
    description: 'Update workspace user'
})

// Delete workspace user
registerRoute(router, {
    method: 'delete',
    path: '/',
    handler: workspaceUserManagementController.deleteWorkspaceUser,
    permission: 'workspaces:manage',
    description: 'Delete workspace user'
})

export default router
