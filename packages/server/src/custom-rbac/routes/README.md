# Custom RBAC Routes Architecture

This directory contains the route definitions for the custom RBAC (Role-Based Access Control) system, following clean code architecture and best practices.

## Architecture Overview

The routes are organized using a **utility-based approach** that eliminates code duplication and provides consistent patterns across all route modules.

### Key Components

1. **`types.ts`** - TypeScript type definitions for route configurations
2. **`utils.ts`** - Utility functions for route registration
3. **Individual route files** - Specific route implementations for each module

## Core Utilities

### `registerRoute(router, config)`
Registers a single route with optional permission checking.

```typescript
registerRoute(router, {
    method: 'get',
    path: '/users',
    handler: userController.getUsers,
    permission: 'users:view',
    description: 'Get all users'
})
```

### `registerRoutes(router, routes)`
Registers multiple routes at once from an array configuration.

```typescript
const routes = [
    { method: 'get', path: '/', handler: controller.list, permission: null },
    { method: 'post', path: '/', handler: controller.create, permission: 'resource:create' }
]
registerRoutes(router, routes)
```

### `registerCrudRoutes(router, config)`
Creates standard CRUD routes following REST conventions with automatic permission handling.

```typescript
registerCrudRoutes(router, {
    permissionPrefix: 'users',
    handlers: {
        read: userController.readUsers,
        create: userController.createUser,
        update: userController.updateUser,
        delete: userController.deleteUser
    }
})
```

## Benefits

### 1. **DRY (Don't Repeat Yourself)**
- No repetitive `router.get()`, `router.post()` calls
- Permission checking logic centralized
- Consistent route structure across modules

### 2. **Type Safety**
- TypeScript interfaces ensure correct configuration
- Compile-time error checking
- Better IDE autocomplete and refactoring

### 3. **Maintainability**
- Changes to route logic happen in one place
- Easy to add new features (logging, validation, etc.)
- Clear separation of concerns

### 4. **Readability**
- Declarative route definitions
- Self-documenting code with descriptions
- Clear permission requirements

### 5. **Consistency**
- All routes follow the same patterns
- Standard CRUD operations use identical structure
- Predictable behavior across modules

## Route Modules

### Account Management (`account-management.ts`)
Authentication and account operations:
- Registration, login, logout
- Email verification
- Password reset
- User invitation (requires permissions)
- Billing integration

### User Management (`user-management.ts`)
User CRUD operations with organization context:
- List, create, update, delete users
- Get user workspaces
- Permission: `users:manage`

### Organization Management (`organization-management.ts`)
Organization access and listing:
- Read organizations (filtered by user access)
- No explicit permissions (implicit via membership)

### Organization User Management (`organization-user-management.ts`)
Organization user relationships:
- List organization users
- Get user counts
- Permission-based filtering

### Workspace Management (`workspace-management.ts`)
Workspace CRUD and user management:
- Full CRUD operations on workspaces
- Workspace switching
- Workspace user management
- Permission: `workspaces:manage`

### Role Management (`role-management.ts`)
Role-based access control:
- Full CRUD operations on roles
- Permission: `roles:manage`

### Platform Configuration (`platform-config.ts`)
System branding and configuration:
- Public routes for logo/favicon serving
- Asset management
- Application name configuration
- Multiple permission levels: view, manage, upload, delete

## Permission Handling

### Single Permission
```typescript
permission: 'users:manage'
```

### Multiple Permissions (ANY of them grants access)
```typescript
permission: ['workspace:add-user', 'users:manage']
```

### Public Routes (no permission required)
```typescript
permission: null
```

## Adding New Routes

### Simple Route
```typescript
import { registerRoute } from './utils'

registerRoute(router, {
    method: 'get',
    path: '/my-endpoint',
    handler: myController.myHandler,
    permission: 'resource:action',
    description: 'What this route does'
})
```

### CRUD Routes
```typescript
import { registerCrudRoutes } from './utils'

registerCrudRoutes(router, {
    permissionPrefix: 'myResource',
    handlers: {
        read: controller.read,
        create: controller.create,
        update: controller.update,
        delete: controller.delete
    }
})
```

### Custom CRUD Paths
```typescript
registerCrudRoutes(router, {
    permissionPrefix: 'myResource',
    handlers: { /* ... */ },
    paths: {
        read: '/list',
        create: '/new',
        update: '/:id',
        delete: '/:id'
    }
})
```

### Override Specific Permissions
```typescript
registerCrudRoutes(router, {
    permissionPrefix: 'myResource',
    handlers: { /* ... */ },
    permissions: {
        read: null,  // Public
        create: 'myResource:create',
        update: 'myResource:update',
        delete: ['myResource:delete', 'admin:all']  // Multiple
    }
})
```

## Migration Guide

### Before (Old Pattern)
```typescript
router.get('/', checkPermission('users:manage'), controller.read)
router.post('/', checkPermission('users:manage'), controller.create)
router.put('/', checkPermission('users:manage'), controller.update)
router.delete('/', checkPermission('users:manage'), controller.delete)
```

### After (New Pattern)
```typescript
registerCrudRoutes(router, {
    permissionPrefix: 'users',
    handlers: {
        read: controller.read,
        create: controller.create,
        update: controller.update,
        delete: controller.delete
    }
})
```

**Lines of code reduced:** 4 lines → 8 lines, but with better structure, documentation, and type safety.

## Best Practices

1. **Use descriptive descriptions** - Add `description` field to document route purpose
2. **Group related routes** - Use arrays or CRUD helpers for related endpoints
3. **Consistent permissions** - Follow `resource:action` naming convention
4. **Type safety** - Let TypeScript catch configuration errors
5. **Public routes** - Always explicitly set `permission: null` for clarity

## Future Enhancements

Potential improvements to the route architecture:

- Rate limiting configuration per route
- Request validation middleware integration
- Automatic API documentation generation
- Route-level caching configuration
- Request/response logging
- Metrics and monitoring hooks

---

**Copyright (c) 2024-2026**
Licensed under the Apache License, Version 2.0
