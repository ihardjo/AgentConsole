/**
 * Custom RBAC - Permissions Definition
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

/**
 * Permission definition
 */
export class Permission {
    constructor(
        public readonly key: string,
        public readonly description: string,
        public readonly isAdvanced: boolean = false
    ) {}

    public toJSON() {
        return {
            key: this.key,
            value: this.description,
            isAdvanced: this.isAdvanced
        }
    }
}

/**
 * Permission category containing related permissions
 */
export class PermissionCategory {
    public permissions: Permission[] = []

    constructor(public readonly category: string) {}

    addPermission(permission: Permission): this {
        this.permissions.push(permission)
        return this
    }

    public toJSON() {
        return {
            [this.category]: this.permissions.map((permission) => permission.toJSON())
        }
    }
}

/**
 * Custom Permissions Registry
 * 
 * This class defines all available permissions in the system.
 * Each permission follows the format: resource:action
 */
export class CustomPermissions {
    private categories: PermissionCategory[] = []

    constructor() {
        this.initializePermissions()
    }

    private initializePermissions(): void {
        // ========================================
        // Agentflows Permissions
        // ========================================
        const agentflowsCategory = new PermissionCategory('agentflows')
        agentflowsCategory
            .addPermission(new Permission('agentflows:view', 'View Agentflows'))
            .addPermission(new Permission('agentflows:create', 'Create Agentflows'))
            .addPermission(new Permission('agentflows:update', 'Update Agentflows'))
            .addPermission(new Permission('agentflows:duplicate', 'Duplicate Agentflows'))
            .addPermission(new Permission('agentflows:delete', 'Delete Agentflows'))
            .addPermission(new Permission('agentflows:export', 'Export Agentflows'))
            .addPermission(new Permission('agentflows:import', 'Import Agentflows'))
            .addPermission(new Permission('agentflows:config', 'Edit Configuration'))
            .addPermission(new Permission('agentflows:domains', 'Manage Allowed Domains'))
        this.categories.push(agentflowsCategory)

        // ========================================
        // Chatflows Permissions
        // ========================================
        const chatflowsCategory = new PermissionCategory('chatflows')
        chatflowsCategory
            .addPermission(new Permission('chatflows:view', 'View Chatflows'))
            .addPermission(new Permission('chatflows:create', 'Create Chatflows'))
            .addPermission(new Permission('chatflows:update', 'Update Chatflows'))
            .addPermission(new Permission('chatflows:duplicate', 'Duplicate Chatflows'))
            .addPermission(new Permission('chatflows:delete', 'Delete Chatflows'))
            .addPermission(new Permission('chatflows:export', 'Export Chatflows'))
            .addPermission(new Permission('chatflows:import', 'Import Chatflows'))
            .addPermission(new Permission('chatflows:config', 'Edit Configuration'))
            .addPermission(new Permission('chatflows:domains', 'Manage Allowed Domains'))
        this.categories.push(chatflowsCategory)

        // ========================================
        // Tools Permissions
        // ========================================
        const toolsCategory = new PermissionCategory('tools')
        toolsCategory
            .addPermission(new Permission('tools:view', 'View Tools'))
            .addPermission(new Permission('tools:create', 'Create Tools'))
            .addPermission(new Permission('tools:update', 'Update Tools'))
            .addPermission(new Permission('tools:delete', 'Delete Tools'))
            .addPermission(new Permission('tools:export', 'Export Tools'))
        this.categories.push(toolsCategory)

        // ========================================
        // Assistants Permissions
        // ========================================
        const assistantsCategory = new PermissionCategory('assistants')
        assistantsCategory
            .addPermission(new Permission('assistants:view', 'View Assistants'))
            .addPermission(new Permission('assistants:create', 'Create Assistants'))
            .addPermission(new Permission('assistants:update', 'Update Assistants'))
            .addPermission(new Permission('assistants:delete', 'Delete Assistants'))
        this.categories.push(assistantsCategory)

        // ========================================
        // Credentials Permissions
        // ========================================
        const credentialsCategory = new PermissionCategory('credentials')
        credentialsCategory
            .addPermission(new Permission('credentials:view', 'View Credentials'))
            .addPermission(new Permission('credentials:create', 'Create Credentials'))
            .addPermission(new Permission('credentials:update', 'Update Credentials'))
            .addPermission(new Permission('credentials:delete', 'Delete Credentials'))
            .addPermission(new Permission('credentials:share', 'Share Credentials'))
        this.categories.push(credentialsCategory)

        // ========================================
        // Variables Permissions
        // ========================================
        const variablesCategory = new PermissionCategory('variables')
        variablesCategory
            .addPermission(new Permission('variables:view', 'View Variables'))
            .addPermission(new Permission('variables:create', 'Create Variables'))
            .addPermission(new Permission('variables:update', 'Update Variables'))
            .addPermission(new Permission('variables:delete', 'Delete Variables'))
        this.categories.push(variablesCategory)

        // ========================================
        // API Keys Permissions
        // ========================================
        const apikeysCategory = new PermissionCategory('apikeys')
        apikeysCategory
            .addPermission(new Permission('apikeys:view', 'View API Keys'))
            .addPermission(new Permission('apikeys:create', 'Create API Keys'))
            .addPermission(new Permission('apikeys:update', 'Update API Keys'))
            .addPermission(new Permission('apikeys:delete', 'Delete API Keys'))
            .addPermission(new Permission('apikeys:import', 'Import API Keys'))
        this.categories.push(apikeysCategory)

        // ========================================
        // Document Stores Permissions
        // ========================================
        const documentStoresCategory = new PermissionCategory('documentStores')
        documentStoresCategory
            .addPermission(new Permission('documentStores:view', 'View Document Stores'))
            .addPermission(new Permission('documentStores:create', 'Create Document Stores'))
            .addPermission(new Permission('documentStores:update', 'Update Document Stores'))
            .addPermission(new Permission('documentStores:delete', 'Delete Document Stores'))
            .addPermission(new Permission('documentStores:add-loader', 'Add Document Loaders'))
            .addPermission(new Permission('documentStores:delete-loader', 'Delete Document Loaders'))
            .addPermission(new Permission('documentStores:preview-process', 'Preview & Process Documents'))
            .addPermission(new Permission('documentStores:upsert-config', 'Upsert Configuration'))
        this.categories.push(documentStoresCategory)

        // ========================================
        // Executions Permissions
        // ========================================
        const executionsCategory = new PermissionCategory('executions')
        executionsCategory
            .addPermission(new Permission('executions:view', 'View Executions'))
            .addPermission(new Permission('executions:delete', 'Delete Executions'))
        this.categories.push(executionsCategory)

        // ========================================
        // Templates Permissions
        // ========================================
        const templatesCategory = new PermissionCategory('templates')
        templatesCategory
            .addPermission(new Permission('templates:marketplace', 'View Marketplace Templates'))
            .addPermission(new Permission('templates:custom', 'View Custom Templates'))
            .addPermission(new Permission('templates:custom-delete', 'Delete Custom Templates'))
            .addPermission(new Permission('templates:toolexport', 'Export Tool as Template'))
            .addPermission(new Permission('templates:flowexport', 'Export Flow as Template'))
            .addPermission(new Permission('templates:custom-share', 'Share Custom Templates'))
        this.categories.push(templatesCategory)

        // ========================================
        // Workspace Permissions
        // ========================================
        const workspaceCategory = new PermissionCategory('workspace')
        workspaceCategory
            .addPermission(new Permission('workspace:view', 'View Workspace'))
            .addPermission(new Permission('workspace:create', 'Create Workspace'))
            .addPermission(new Permission('workspace:update', 'Update Workspace'))
            .addPermission(new Permission('workspace:add-user', 'Add Users to Workspace'))
            .addPermission(new Permission('workspace:unlink-user', 'Remove Users from Workspace'))
            .addPermission(new Permission('workspace:delete', 'Delete Workspace'))
            .addPermission(new Permission('workspace:export', 'Export Workspace Data'))
            .addPermission(new Permission('workspace:import', 'Import Workspace Data'))
        this.categories.push(workspaceCategory)

        // ========================================
        // Admin Permissions
        // ========================================
        const adminCategory = new PermissionCategory('admin')
        adminCategory
            .addPermission(new Permission('users:manage', 'Manage Users', true))
            .addPermission(new Permission('roles:manage', 'Manage Roles', true))
            .addPermission(new Permission('sso:manage', 'Manage SSO', true))
            .addPermission(new Permission('platformConfiguration:manage', 'Manage Platform Configuration', true))
        this.categories.push(adminCategory)

        // ========================================
        // Logs Permissions
        // ========================================
        const logsCategory = new PermissionCategory('logs')
        logsCategory.addPermission(new Permission('logs:view', 'View Logs', true))
        this.categories.push(logsCategory)

        // ========================================
        // Login Activity Permissions
        // ========================================
        const loginActivityCategory = new PermissionCategory('loginActivity')
        loginActivityCategory
            .addPermission(new Permission('loginActivity:view', 'View Login Activity', true))
            .addPermission(new Permission('loginActivity:delete', 'Delete Login Activity', true))
        this.categories.push(loginActivityCategory)

        // ========================================
        // Agent Ops Permissions
        // ========================================
        const agentOpsCategory = new PermissionCategory('agentOps')
        agentOpsCategory.addPermission(new Permission('agentops:view', 'View Agent Ops'))
        this.categories.push(agentOpsCategory)

        // ========================================
        // Worker Configuration Permissions
        // ========================================
        const workerCategory = new PermissionCategory('worker')
        workerCategory.addPermission(new Permission('worker:view', 'View Worker Configuration'))
        this.categories.push(workerCategory)
    }

    /**
     * Get all permissions as a JSON object organized by category
     */
    public toJSON(): { [key: string]: { key: string; value: string; isAdvanced: boolean }[] } {
        return this.categories.reduce((acc, category) => {
            return {
                ...acc,
                ...category.toJSON()
            }
        }, {})
    }

    /**
     * Get all permission keys as a flat array
     */
    public getAllPermissionKeys(): string[] {
        return this.categories.flatMap((category) => category.permissions.map((p) => p.key))
    }

    /**
     * Get permissions for a specific category
     */
    public getPermissionsByCategory(categoryName: string): Permission[] | undefined {
        const category = this.categories.find((c) => c.category === categoryName)
        return category?.permissions
    }

    /**
     * Check if a permission key is valid
     */
    public isValidPermission(permissionKey: string): boolean {
        return this.getAllPermissionKeys().includes(permissionKey)
    }

    /**
     * Get all categories
     */
    public getCategories(): PermissionCategory[] {
        return this.categories
    }
}

// Singleton instance
let permissionsInstance: CustomPermissions | null = null

/**
 * Get the permissions registry singleton
 */
export function getPermissions(): CustomPermissions {
    if (!permissionsInstance) {
        permissionsInstance = new CustomPermissions()
    }
    return permissionsInstance
}

/**
 * Default permission sets for common roles
 */
export const DefaultRolePermissions = {
    OWNER: () => getPermissions().getAllPermissionKeys(),
    ADMIN: () =>
        getPermissions()
            .getAllPermissionKeys()
            .filter((p) => !p.startsWith('sso:')),
    MEMBER: [
        'agentflows:view',
        'agentflows:create',
        'agentflows:update',
        'chatflows:view',
        'chatflows:create',
        'chatflows:update',
        'tools:view',
        'tools:create',
        'tools:update',
        'assistants:view',
        'assistants:create',
        'assistants:update',
        'credentials:view',
        'credentials:create',
        'credentials:update',
        'variables:view',
        'apikeys:view',
        'documentStores:view',
        'documentStores:create',
        'documentStores:update',
        'executions:view',
        'templates:marketplace',
        'templates:custom',
        'workspace:view',
        'agentops:view',
        'worker:view'
    ],
    VIEWER: [
        'agentflows:view',
        'chatflows:view',
        'tools:view',
        'assistants:view',
        'credentials:view',
        'variables:view',
        'apikeys:view',
        'documentStores:view',
        'executions:view',
        'templates:marketplace',
        'templates:custom',
        'workspace:view',
        'agentops:view',
        'worker:view'
    ]
} as const
