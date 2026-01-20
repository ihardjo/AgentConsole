/**
 * Custom RBAC - Interfaces
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
// User Related Interfaces
// ========================================

export enum CustomUserStatus {
    ACTIVE = 'active',
    INVITED = 'invited',
    UNVERIFIED = 'unverified',
    DISABLED = 'disabled',
    DELETED = 'deleted'
}

export interface ICustomUser {
    id: string
    name: string
    email: string
    credential?: string | null
    tempToken?: string | null
    tokenExpiry?: Date | null
    status: CustomUserStatus
    createdDate?: Date
    updatedDate?: Date
    createdBy: string
    updatedBy: string
}

// ========================================
// Organization Related Interfaces
// ========================================

export interface ICustomOrganization {
    id: string
    name: string
    description?: string
    customerId?: string
    subscriptionId?: string
    createdDate?: Date
    updatedDate?: Date
    createdBy?: string
    updatedBy?: string
}

export enum CustomOrganizationUserStatus {
    ACTIVE = 'active',
    INVITED = 'invited',
    DISABLED = 'disabled'
}

export interface ICustomOrganizationUser {
    id: string
    organizationId: string
    userId: string
    roleId: string
    status: CustomOrganizationUserStatus
    createdDate?: Date
    updatedDate?: Date
    createdBy: string
    updatedBy: string
}

// ========================================
// Workspace Related Interfaces
// ========================================

export interface ICustomWorkspace {
    id: string
    organizationId: string
    name: string
    description?: string
    createdDate?: Date
    updatedDate?: Date
    createdBy?: string
    updatedBy?: string
}

export enum CustomWorkspaceUserStatus {
    ACTIVE = 'active',
    INVITED = 'invited',
    DISABLED = 'disabled'
}

export interface ICustomWorkspaceUser {
    id: string
    workspaceId: string
    userId: string
    roleId: string
    status: CustomWorkspaceUserStatus
    lastLogin?: string
    createdDate?: Date
    updatedDate?: Date
    createdBy: string
    updatedBy: string
}

// ========================================
// Role Related Interfaces
// ========================================

export enum CustomGeneralRole {
    OWNER = 'owner',
    ADMIN = 'admin',
    MEMBER = 'member',
    VIEWER = 'viewer',
    PERSONAL_WORKSPACE = 'personal workspace'
}

export interface ICustomRole {
    id: string
    organizationId?: string | null
    name: string
    description?: string
    permissions: string // JSON string of permission array
    isSystemRole?: boolean
    createdDate?: Date
    updatedDate?: Date
    createdBy?: string
    updatedBy?: string
}

// ========================================
// Permission Interfaces
// ========================================

export interface IPermission {
    key: string
    value: string
    category: string
}

export interface IPermissionCategory {
    category: string
    permissions: IPermission[]
}

// ========================================
// Authentication/Session Interfaces
// ========================================

export interface ILoggedInUser {
    id: string
    email: string
    name: string
    status: CustomUserStatus
    roleId?: string
    roleName?: string
    activeOrganizationId?: string
    activeOrganization?: string
    activeOrganizationSubscriptionId?: string
    activeOrganizationCustomerId?: string
    activeOrganizationProductId?: string
    isOrganizationAdmin?: boolean
    activeWorkspaceId?: string
    activeWorkspace?: string
    assignedWorkspaces?: IAssignedWorkspace[]
    isApiKeyValidated?: boolean
    permissions?: string[]
    features?: Record<string, string>
    ssoRefreshToken?: string
    ssoToken?: string
    ssoProvider?: string
    loginMode?: string
}

export interface IAssignedWorkspace {
    id: string
    name: string
    role: string
    organizationId: string
}

// ========================================
// API Response Interfaces
// ========================================

export interface IApiResponse<T = any> {
    success: boolean
    data?: T
    message?: string
    error?: string
}

export interface IPaginatedResponse<T> {
    items: T[]
    total: number
    page: number
    pageSize: number
    totalPages: number
}

// ========================================
// Request Context Interfaces
// ========================================

export interface IRequestContext {
    user?: ILoggedInUser
    organizationId?: string
    workspaceId?: string
    permissions?: string[]
}

// ========================================
// Workspace Shared Item Interfaces
// ========================================

export enum CustomSharedItemType {
    CREDENTIAL = 'credential',
    TOOL = 'tool',
    TEMPLATE = 'template'
}

export interface ICustomWorkspaceShared {
    id: string
    workspaceId: string
    sharedItemId: string
    itemType: CustomSharedItemType
    createdDate?: Date
    updatedDate?: Date
}

// ========================================
// Audit/Activity Interfaces
// ========================================

export enum CustomLoginActivityCode {
    SUCCESS = 0,
    INVALID_CREDENTIALS = 1,
    ACCOUNT_DISABLED = 2,
    ACCOUNT_LOCKED = 3,
    SESSION_EXPIRED = 4,
    LOGOUT = 5
}

export interface ICustomLoginActivity {
    id: string
    username: string
    activityCode: CustomLoginActivityCode
    message: string
    loginMode: string
    attemptedDateTime: Date
    ipAddress?: string
    userAgent?: string
}

// ========================================
// Error Message Enum
// ========================================

export enum CustomErrorMessage {
    INVALID_MISSING_TOKEN = 'Invalid or Missing token',
    TOKEN_EXPIRED = 'Token Expired',
    REFRESH_TOKEN_EXPIRED = 'Refresh Token Expired',
    FORBIDDEN = 'Forbidden',
    UNAUTHORIZED = 'Unauthorized access',
    UNKNOWN_USER = 'Unknown Username or Password',
    INCORRECT_PASSWORD = 'Incorrect Password',
    INACTIVE_USER = 'Inactive User',
    INVITED_USER = 'User Invited, but has not registered',
    INVALID_WORKSPACE = 'No Workspace Assigned',
    UNKNOWN_ERROR = 'Unknown Error',
    INVALID_TOKEN = 'Invalid or expired token',
    USER_NOT_FOUND = 'User not found',
    ORGANIZATION_NOT_FOUND = 'Organization not found',
    WORKSPACE_NOT_FOUND = 'Workspace not found',
    ROLE_NOT_FOUND = 'Role not found',
    INVALID_CREDENTIALS = 'Invalid email or password',
    EMAIL_ALREADY_EXISTS = 'Email already exists',
    INVALID_INPUT = 'Invalid input provided',
    INTERNAL_ERROR = 'An internal error occurred'
}

