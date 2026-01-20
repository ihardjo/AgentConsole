/**
 * Custom RBAC - Route Utilities
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

import { Router } from 'express'
import { checkPermission, checkAnyPermission } from '../../middleware'
import { RouteConfig, CrudRouteConfig, PermissionConfig } from './types'

/**
 * Creates a permission middleware based on the permission configuration
 * @param permission - Permission string, array, or null
 * @returns Permission middleware or undefined for public routes
 */
const createPermissionMiddleware = (permission: PermissionConfig) => {
    if (!permission) {
        return undefined
    }

    if (Array.isArray(permission)) {
        return checkAnyPermission(permission.join(','))
    }

    return checkPermission(permission)
}

/**
 * Registers a single route with optional permission checking
 * @param router - Express router instance
 * @param config - Route configuration
 */
export const registerRoute = (router: Router, config: RouteConfig): void => {
    const { method, path, handler, permission } = config
    const middleware = createPermissionMiddleware(permission)

    if (middleware) {
        router[method](path, middleware, handler)
    } else {
        router[method](path, handler)
    }
}

/**
 * Registers multiple routes at once
 * @param router - Express router instance
 * @param routes - Array of route configurations
 */
export const registerRoutes = (router: Router, routes: RouteConfig[]): void => {
    routes.forEach((route) => registerRoute(router, route))
}

/**
 * Creates CRUD routes following REST conventions
 * @param router - Express router instance
 * @param config - CRUD route configuration
 */
export const registerCrudRoutes = (router: Router, config: CrudRouteConfig): void => {
    const { permissionPrefix, handlers, paths = {}, permissions = {} } = config

    // Default paths and permissions
    const defaultPaths = {
        create: '/',
        read: '/',
        update: '/',
        delete: '/'
    }

    const defaultPermissions = {
        create: `${permissionPrefix}:manage`,
        read: `${permissionPrefix}:manage`,
        update: `${permissionPrefix}:manage`,
        delete: `${permissionPrefix}:manage`
    }

    // Register CREATE route (POST)
    if (handlers.create) {
        registerRoute(router, {
            method: 'post',
            path: paths.create || defaultPaths.create,
            handler: handlers.create,
            permission: permissions.create !== undefined ? permissions.create : defaultPermissions.create
        })
    }

    // Register READ route (GET)
    if (handlers.read) {
        registerRoute(router, {
            method: 'get',
            path: paths.read || defaultPaths.read,
            handler: handlers.read,
            permission: permissions.read !== undefined ? permissions.read : defaultPermissions.read
        })
    }

    // Register UPDATE route (PUT)
    if (handlers.update) {
        registerRoute(router, {
            method: 'put',
            path: paths.update || defaultPaths.update,
            handler: handlers.update,
            permission: permissions.update !== undefined ? permissions.update : defaultPermissions.update
        })
    }

    // Register DELETE route (DELETE)
    if (handlers.delete) {
        registerRoute(router, {
            method: 'delete',
            path: paths.delete || defaultPaths.delete,
            handler: handlers.delete,
            permission: permissions.delete !== undefined ? permissions.delete : defaultPermissions.delete
        })
    }
}

/**
 * Creates a router with pre-configured routes
 * @param routes - Array of route configurations
 * @returns Express router with registered routes
 */
export const createRouterWithRoutes = (routes: RouteConfig[]): Router => {
    const router = Router()
    registerRoutes(router, routes)
    return router
}

/**
 * Creates a CRUD router with standard REST endpoints
 * @param config - CRUD route configuration
 * @returns Express router with CRUD routes
 */
export const createCrudRouter = (config: CrudRouteConfig): Router => {
    const router = Router()
    registerCrudRoutes(router, config)
    return router
}
