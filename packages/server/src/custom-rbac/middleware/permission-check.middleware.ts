/**
 * Custom RBAC - Permission Check Middleware
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

import { NextFunction, Request, Response } from 'express'
import { CustomErrorMessage } from '../interfaces'

/**
 * Middleware to check if the user has a specific permission
 * @param permission - The permission key to check for
 * @returns Express middleware function
 */
export const checkPermission = (permission: string) => {
    return (req: Request, res: Response, next: NextFunction) => {
        const user = req.user

        // If no user is attached to the request, deny access
        if (!user) {
            return res.status(403).json({ message: CustomErrorMessage.FORBIDDEN })
        }

        // API key validated users or organization admins have full access
        if (user.isApiKeyValidated || user.isOrganizationAdmin) {
            return next()
        }

        // Check if user has the required permission
        const permissions = user.permissions
        if (permissions && Array.isArray(permissions) && permissions.includes(permission)) {
            return next()
        }

        // Deny access if permission not found
        return res.status(403).json({ message: CustomErrorMessage.FORBIDDEN })
    }
}

/**
 * Middleware to check if the user has any of the specified permissions
 * @param permissionsString - Comma-separated list of permission keys
 * @returns Express middleware function
 */
export const checkAnyPermission = (permissionsString: string) => {
    return (req: Request, res: Response, next: NextFunction) => {
        const user = req.user

        // If no user is attached to the request, deny access
        if (!user) {
            return res.status(403).json({ message: CustomErrorMessage.FORBIDDEN })
        }

        // API key validated users or organization admins have full access
        if (user.isApiKeyValidated || user.isOrganizationAdmin) {
            return next()
        }

        // Parse the required permissions
        const requiredPermissions = permissionsString.split(',').map((p) => p.trim())
        const userPermissions = user.permissions

        // Check if user has any of the required permissions
        if (userPermissions && Array.isArray(userPermissions)) {
            for (const permission of requiredPermissions) {
                if (userPermissions.includes(permission)) {
                    return next()
                }
            }
        }

        // Deny access if no matching permission found
        return res.status(403).json({ message: CustomErrorMessage.FORBIDDEN })
    }
}

/**
 * Middleware to check if the user has all of the specified permissions
 * @param permissionsString - Comma-separated list of permission keys
 * @returns Express middleware function
 */
export const checkAllPermissions = (permissionsString: string) => {
    return (req: Request, res: Response, next: NextFunction) => {
        const user = req.user

        // If no user is attached to the request, deny access
        if (!user) {
            return res.status(403).json({ message: CustomErrorMessage.FORBIDDEN })
        }

        // API key validated users or organization admins have full access
        if (user.isApiKeyValidated || user.isOrganizationAdmin) {
            return next()
        }

        // Parse the required permissions
        const requiredPermissions = permissionsString.split(',').map((p) => p.trim())
        const userPermissions = user.permissions

        // Check if user has all required permissions
        if (userPermissions && Array.isArray(userPermissions)) {
            const hasAllPermissions = requiredPermissions.every((permission) => userPermissions.includes(permission))
            if (hasAllPermissions) {
                return next()
            }
        }

        // Deny access if not all permissions found
        return res.status(403).json({ message: CustomErrorMessage.FORBIDDEN })
    }
}

/**
 * Middleware to check if the user is an organization admin
 * @returns Express middleware function
 */
export const requireOrganizationAdmin = () => {
    return (req: Request, res: Response, next: NextFunction) => {
        const user = req.user

        if (!user) {
            return res.status(403).json({ message: CustomErrorMessage.FORBIDDEN })
        }

        if (user.isOrganizationAdmin || user.isApiKeyValidated) {
            return next()
        }

        return res.status(403).json({ message: CustomErrorMessage.FORBIDDEN })
    }
}

/**
 * Middleware to ensure the user is authenticated
 * @returns Express middleware function
 */
export const requireAuthentication = () => {
    return (req: Request, res: Response, next: NextFunction) => {
        const user = req.user

        if (!user) {
            return res.status(401).json({ message: CustomErrorMessage.UNAUTHORIZED })
        }

        return next()
    }
}

/**
 * Middleware to check if the user has access to a specific workspace
 * @param workspaceIdParam - The request parameter name containing the workspace ID
 * @returns Express middleware function
 */
export const requireWorkspaceAccess = (workspaceIdParam: string = 'workspaceId') => {
    return (req: Request, res: Response, next: NextFunction) => {
        const user = req.user
        const workspaceId = req.params[workspaceIdParam] || req.query[workspaceIdParam] || req.body?.[workspaceIdParam]

        if (!user) {
            return res.status(401).json({ message: CustomErrorMessage.UNAUTHORIZED })
        }

        // Organization admins have access to all workspaces in their org
        if (user.isOrganizationAdmin || user.isApiKeyValidated) {
            return next()
        }

        // Check if the workspace matches the user's active workspace
        if (user.activeWorkspaceId === workspaceId) {
            return next()
        }

        return res.status(403).json({ message: CustomErrorMessage.FORBIDDEN })
    }
}

/**
 * Middleware to check if the user belongs to a specific organization
 * @param organizationIdParam - The request parameter name containing the organization ID
 * @returns Express middleware function
 */
export const requireOrganizationAccess = (organizationIdParam: string = 'organizationId') => {
    return (req: Request, res: Response, next: NextFunction) => {
        const user = req.user
        const organizationId = req.params[organizationIdParam] || req.query[organizationIdParam] || req.body?.[organizationIdParam]

        if (!user) {
            return res.status(401).json({ message: CustomErrorMessage.UNAUTHORIZED })
        }

        // API key validated users bypass organization checks
        if (user.isApiKeyValidated) {
            return next()
        }

        // Check if the organization matches the user's active organization
        if (user.activeOrganizationId === organizationId) {
            return next()
        }

        return res.status(403).json({ message: CustomErrorMessage.FORBIDDEN })
    }
}
