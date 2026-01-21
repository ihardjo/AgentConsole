/**
 * Custom RBAC - Route Types
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

import { RequestHandler, Router } from 'express'

/**
 * HTTP Methods supported by the router
 */
export type HttpMethod = 'get' | 'post' | 'put' | 'delete' | 'patch'

/**
 * Permission configuration for a route
 * Can be:
 * - A single permission string
 * - An array of permissions (any of them grants access)
 * - null/undefined for public routes
 */
export type PermissionConfig = string | string[] | null | undefined

/**
 * Route configuration object
 */
export interface RouteConfig {
    /** HTTP method for the route */
    method: HttpMethod
    /** Path pattern for the route */
    path: string
    /** Controller/handler function */
    handler: RequestHandler
    /** Permission(s) required to access this route */
    permission?: PermissionConfig
    /** Description/comment for the route (optional, for documentation) */
    description?: string
}

/**
 * CRUD operation types
 */
export type CrudOperation = 'create' | 'read' | 'update' | 'delete'

/**
 * CRUD route configuration
 */
export interface CrudRouteConfig {
    /** Base permission prefix (e.g., 'users' for 'users:manage') */
    permissionPrefix: string
    /** Controller methods for CRUD operations */
    handlers: {
        create?: RequestHandler
        read?: RequestHandler
        update?: RequestHandler
        delete?: RequestHandler
    }
    /** Custom paths for operations (defaults to REST conventions) */
    paths?: {
        create?: string
        read?: string
        update?: string
        delete?: string
    }
    /** Override default permissions for specific operations */
    permissions?: {
        create?: PermissionConfig
        read?: PermissionConfig
        update?: PermissionConfig
        delete?: PermissionConfig
    }
}
