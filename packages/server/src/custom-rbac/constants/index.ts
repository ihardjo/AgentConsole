/**
 * Custom RBAC - Constants and Error Messages
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
 *
 * CLEAN ROOM IMPLEMENTATION: This file was developed independently without
 * reference to any FlowiseAI Enterprise code.
 */

// ========================================
// Reserved Names
// ========================================

export const RESERVED_ORGANIZATION_NAME = 'Default Organization'
export const RESERVED_WORKSPACE_NAMES = ['Default Workspace', 'Personal Workspace']

// ========================================
// Error Messages - User Management
// ========================================

export const UserErrorMessage = {
    INVALID_USER_ID: 'Invalid User ID',
    INVALID_USER_EMAIL: 'Invalid User Email',
    INVALID_USER_NAME: 'Invalid User Name',
    INVALID_USER_STATUS: 'Invalid User Status',
    INVALID_USER_CREDENTIAL: 'Invalid User Credential',
    USER_NOT_FOUND: 'User Not Found',
    USER_EMAIL_ALREADY_EXISTS: 'Email Already Exists',
    USER_EMAIL_UNVERIFIED: 'User Email Unverified',
    INCORRECT_CREDENTIALS: 'Incorrect Email or Password',
    EXPIRED_TEMP_TOKEN: 'Expired Temporary Token',
    INVALID_TEMP_TOKEN: 'Invalid Temporary Token'
} as const

// ========================================
// Error Messages - Organization Management
// ========================================

export const OrganizationErrorMessage = {
    INVALID_ORGANIZATION_ID: 'Invalid Organization ID',
    INVALID_ORGANIZATION_NAME: 'Invalid Organization Name',
    ORGANIZATION_NOT_FOUND: 'Organization Not Found',
    ORGANIZATION_RESERVED_NAME: 'Organization name is reserved'
} as const

// ========================================
// Error Messages - Organization User Management
// ========================================

export const OrganizationUserErrorMessage = {
    INVALID_ORGANIZATION_USER_STATUS: 'Invalid Organization User Status',
    ORGANIZATION_USER_NOT_FOUND: 'Organization User Not Found',
    ORGANIZATION_USER_ALREADY_EXISTS: 'Organization User Already Exists'
} as const

// ========================================
// Error Messages - Workspace Management
// ========================================

export const WorkspaceErrorMessage = {
    INVALID_WORKSPACE_ID: 'Invalid Workspace ID',
    INVALID_WORKSPACE_NAME: 'Invalid Workspace Name',
    WORKSPACE_NOT_FOUND: 'Workspace Not Found',
    WORKSPACE_RESERVED_NAME: 'Workspace name is reserved'
} as const

// ========================================
// Error Messages - Workspace User Management
// ========================================

export const WorkspaceUserErrorMessage = {
    INVALID_WORKSPACE_USER_STATUS: 'Invalid Workspace User Status',
    WORKSPACE_USER_NOT_FOUND: 'Workspace User Not Found',
    WORKSPACE_USER_ALREADY_EXISTS: 'Workspace User Already Exists'
} as const

// ========================================
// Error Messages - Role Management
// ========================================

export const RoleErrorMessage = {
    INVALID_ROLE_ID: 'Invalid Role ID',
    INVALID_ROLE_NAME: 'Invalid Role Name',
    INVALID_ROLE_PERMISSIONS: 'Invalid Role Permissions',
    ROLE_NOT_FOUND: 'Role Not Found'
} as const

// ========================================
// Error Messages - General
// ========================================

export const GeneralErrorMessage = {
    UNAUTHORIZED: 'Unauthorized',
    FORBIDDEN: 'Forbidden',
    INVALID_PASSWORD: 'Password must be at least 8 characters with at least one letter and one number',
    UNHANDLED_EDGE_CASE: 'An unexpected error occurred',
    INTERNAL_SERVER_ERROR: 'Internal Server Error'
} as const

// ========================================
// Success Messages
// ========================================

export const SuccessMessage = {
    CREATED: 'Successfully created',
    UPDATED: 'Successfully updated',
    DELETED: 'Successfully deleted',
    LOGGED_IN: 'Successfully logged in',
    LOGGED_OUT: 'Successfully logged out',
    PASSWORD_RESET: 'Password has been reset',
    VERIFICATION_SENT: 'Verification email sent'
} as const

// ========================================
// Token Expiry Settings
// ========================================

export const TokenSettings = {
    DEFAULT_INVITE_EXPIRY_HOURS: 24,
    DEFAULT_PASSWORD_RESET_EXPIRY_HOURS: 1,
    DEFAULT_SESSION_EXPIRY_HOURS: 24
} as const

// ========================================
// Pagination Defaults
// ========================================

export const PaginationDefaults = {
    DEFAULT_PAGE: 1,
    DEFAULT_PAGE_SIZE: 20,
    MAX_PAGE_SIZE: 100
} as const
