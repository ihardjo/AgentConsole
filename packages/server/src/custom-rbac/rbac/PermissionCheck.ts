/**
 * Permission Check Middleware
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
 * CLEAN ROOM IMPLEMENTATION: This file uses custom RBAC interfaces instead
 * of enterprise code to avoid license tainting.
 */

import { NextFunction, Request, Response } from 'express'
import { CustomErrorMessage } from '../interfaces'

// Error message for forbidden access - using custom constant instead of enterprise import
const FORBIDDEN_MESSAGE = CustomErrorMessage.FORBIDDEN

// Check if the user has the required permission for a route
export const checkPermission = (permission: string) => {
    return (req: Request, res: Response, next: NextFunction) => {
        const user = req.user
        // if the user is not logged in, return forbidden
        if (user) {
            if (user.isApiKeyValidated || user.isOrganizationAdmin) {
                return next()
            }
            const permissions = user.permissions
            if (permissions && permissions.includes(permission)) {
                return next()
            }
        }
        // else throw 403 forbidden error
        return res.status(403).json({ message: FORBIDDEN_MESSAGE })
    }
}

// checks for any permission, input is the permissions separated by comma
export const checkAnyPermission = (permissionsString: string) => {
    return (req: Request, res: Response, next: NextFunction) => {
        const user = req.user
        // if the user is not logged in, return forbidden
        if (user) {
            if (user.isApiKeyValidated || user.isOrganizationAdmin) {
                return next()
            }
            const permissions = user.permissions
            const permissionIds = permissionsString.split(',')
            if (permissions && permissions.length) {
                // split permissions and check if any of the permissions are present in the user's permissions
                for (let i = 0; i < permissionIds.length; i++) {
                    if (permissions.includes(permissionIds[i])) {
                        return next()
                    }
                }
            }
        }
        // else throw 403 forbidden error
        return res.status(403).json({ message: FORBIDDEN_MESSAGE })
    }
}
