/**
 * Custom RBAC - Organization User Management Routes
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
import organizationUserManagementController from '../../controllers/organization-user-management'
import { registerRoute } from '../shared/utils'

const router = express.Router()

// Read organization users - no explicit permission required (filtered by user's access)
registerRoute(router, {
    method: 'get',
    path: '/',
    handler: organizationUserManagementController.readOrganizationUsers,
    permission: null,
    description: 'Read organization users accessible to the current user'
})

// Get organization users count
registerRoute(router, {
    method: 'get',
    path: '/count',
    handler: organizationUserManagementController.getOrgUsersCount,
    permission: null,
    description: 'Get count of organization users'
})

export default router
