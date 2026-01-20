/**
 * Custom RBAC - Account Management Routes
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
import accountController from '../../controllers/account-management'
import { registerRoute } from '../shared/utils'

const router = express.Router()

// Authentication routes (public - no permission required)
const authRoutes = [
    { method: 'post' as const, path: '/register', handler: accountController.register, description: 'User registration' },
    { method: 'post' as const, path: '/login', handler: accountController.login, description: 'User login' },
    { method: 'post' as const, path: '/logout', handler: accountController.logout, description: 'User logout' },
    { method: 'post' as const, path: '/verify', handler: accountController.verify, description: 'Verify email' },
    {
        method: 'post' as const,
        path: '/resend-verification',
        handler: accountController.resendVerificationEmail,
        description: 'Resend verification email'
    },
    { method: 'post' as const, path: '/forgot-password', handler: accountController.forgotPassword, description: 'Forgot password' },
    { method: 'post' as const, path: '/reset-password', handler: accountController.resetPassword, description: 'Reset password' }
]

authRoutes.forEach((route) => {
    registerRoute(router, {
        ...route,
        permission: null
    })
})

// User invitation - requires workspace:add-user OR users:manage permission
registerRoute(router, {
    method: 'post',
    path: '/invite',
    handler: accountController.invite,
    permission: ['workspace:add-user', 'users:manage'],
    description: 'Invite user to workspace'
})

// Billing routes
registerRoute(router, {
    method: 'post',
    path: '/billing',
    handler: accountController.createStripeCustomerPortalSession,
    permission: null,
    description: 'Create Stripe customer portal session'
})

// Basic authentication routes
registerRoute(router, {
    method: 'get',
    path: '/basic-auth',
    handler: accountController.getBasicAuth,
    permission: null,
    description: 'Get basic auth configuration'
})

registerRoute(router, {
    method: 'post',
    path: '/basic-auth',
    handler: accountController.checkBasicAuth,
    permission: null,
    description: 'Check basic auth credentials'
})

export default router
