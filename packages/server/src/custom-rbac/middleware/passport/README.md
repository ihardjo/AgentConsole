# Custom RBAC Passport Middleware

## Overview

This folder contains the passport authentication middleware implementation for the custom-rbac system. This implementation replaces the enterprise folder's passport middleware to use custom-rbac entities and services exclusively.

## Purpose

The passport middleware was migrated to custom-rbac to:
1. Avoid dependencies on enterprise folder entities
2. Use custom-rbac services for organization, user, and workspace management
3. Maintain all authentication features from the enterprise implementation
4. Ensure proper entity registration with TypeORM

## Files

### `index.ts`
Main passport middleware implementation that:
- Initializes JWT cookie middleware
- Configures passport strategies (local and JWT)
- Implements authentication endpoints:
  - `/api/v1/auth/resolve` - Checks authentication state and redirects
  - `/api/v1/auth/login` - User login
  - `/api/v1/auth/refreshToken` - Token refresh
- Uses custom-rbac services:
  - `OrganizationManagementService`
  - `OrganizationUserManagementService`
  - `WorkspaceUserManagementService`
  - `RoleManagementService`
  - `AccountService`

### `AuthStrategy.ts`
JWT authentication strategy implementation:
- Cookie-based token extraction
- Token decryption and validation
- User verification

### `SessionPersistance.ts`
Session storage configuration:
- Redis session store for queue mode
- Database session stores (PostgreSQL, MySQL, SQLite) for standard mode
- Configurable based on environment variables

### `tempTokenUtils.ts`
Token utility functions:
- Token encryption/decryption
- Safe user object generation
- Token expiry validation
- User UUID extraction

## Integration

The passport middleware is imported in the main server file (`src/index.ts`):

```typescript
import { initializeJwtCookieMiddleware, verifyToken } from './custom-rbac/middleware/passport'
```

This replaces the previous import from the enterprise folder.

## Services Used

The passport middleware integrates with the following custom-rbac services:

1. **OrganizationManagementService**
   - `countOrganizations()` - Count registered organizations
   - `readOrganizationById()` - Get organization details

2. **OrganizationUserManagementService**
   - `readOrganizationUserByWorkspaceIdUserId()` - Get organization user by workspace and user ID
   - `updateOrganizationUser()` - Update organization user status

3. **WorkspaceUserManagementService**
   - `updateWorkspaceUser()` - Update workspace user login status
   - `readWorkspaceUserByUserId()` - Get all workspace users for a user

4. **RoleManagementService**
   - `readGeneralRoleByName()` - Get role by name (e.g., OWNER)
   - `readRoleById()` - Get role details

5. **AccountService**
   - `login()` - Authenticate user credentials

## Features Carried Over

All features from the enterprise passport implementation are maintained:

✅ JWT authentication with cookies
✅ Session management (Redis/Database)
✅ Token refresh mechanism
✅ SSO support
✅ License validation for Enterprise platform
✅ Organization setup redirect
✅ Workspace user management
✅ Role-based permissions
✅ Feature flags from subscription plans

## Security

- Secure cookie settings based on environment
- HTTPS support
- Token encryption
- Session expiry configuration
- CSRF protection via sameSite cookie attribute

## Environment Variables

Key environment variables used:
- `JWT_AUTH_TOKEN_SECRET` - JWT authentication token secret
- `JWT_REFRESH_TOKEN_SECRET` - JWT refresh token secret
- `JWT_TOKEN_EXPIRY_IN_MINUTES` - Auth token expiry (default: 60)
- `JWT_REFRESH_TOKEN_EXPIRY_IN_MINUTES` - Refresh token expiry (default: 129600 = 90 days)
- `EXPRESS_SESSION_SECRET` - Session secret (default: 'flowise')
- `SECURE_COOKIES` - Force secure cookies (true/false)
- `EXPIRE_AUTH_TOKENS_ON_RESTART` - Expire tokens on server restart (true/false)

## Error Handling

The middleware properly handles:
- Invalid credentials
- Expired tokens
- Missing organization
- Missing workspace assignment
- Inactive users
- License validation failures

## Copyright

Copyright (c) 2024-2026
Licensed under the Apache License, Version 2.0

This is a clean room implementation developed independently without reference to any FlowiseAI Enterprise code.
