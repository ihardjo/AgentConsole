/**
 * Custom RBAC - Role Management Routes
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
import roleManagementController from '../../controllers/role-management'
import { registerCrudRoutes } from '../shared/utils'

const router = express.Router()

// Register standard CRUD routes for role management
registerCrudRoutes(router, {
    permissionPrefix: 'roles',
    handlers: {
        read: roleManagementController.readRole,
        create: roleManagementController.createRole,
        update: roleManagementController.updateRole,
        delete: roleManagementController.deleteRole
    }
})

export default router
