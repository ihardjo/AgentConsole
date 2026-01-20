# Custom RBAC Migration Guide

## Overview

This guide helps you migrate your code from enterprise imports to the custom-rbac module, ensuring compliance with the FlowiseAI Commercial License.

## Why Migrate?

The enterprise folder (`/packages/server/src/enterprise/`) contains code covered by the FlowiseAI Commercial License. Using this code in your custom implementations creates a "tainting" risk - your code could be considered a derivative work of the commercial code.

The `custom-rbac` module provides equivalent functionality that is:
- Licensed under Apache 2.0
- Developed using a clean-room approach
- Free from any enterprise code dependencies

## Migration Steps

### Step 1: Update Import Statements

Replace enterprise imports with custom-rbac equivalents:

#### Entities

```typescript
// BEFORE (enterprise - DO NOT USE)
import { User } from '../../enterprise/database/entities/user.entity'
import { Organization } from '../../enterprise/database/entities/organization.entity'
import { Workspace } from '../../enterprise/database/entities/workspace.entity'
import { Role } from '../../enterprise/database/entities/role.entity'
import { OrganizationUser } from '../../enterprise/database/entities/organization-user.entity'
import { WorkspaceUser } from '../../enterprise/database/entities/workspace-user.entity'

// AFTER (custom-rbac - USE THIS)
import { 
    CustomUser, 
    CustomOrganization, 
    CustomWorkspace, 
    CustomRole,
    CustomOrganizationUser,
    CustomWorkspaceUser 
} from '../../custom-rbac/entities'
```

#### Interfaces and Types

```typescript
// BEFORE (enterprise - DO NOT USE)
import { UserStatus } from '../../enterprise/database/entities/user.entity'
import { GeneralRole } from '../../enterprise/database/entities/role.entity'
import { ErrorMessage } from '../../enterprise/Interface.Enterprise'

// AFTER (custom-rbac - USE THIS)
import { 
    CustomUserStatus, 
    CustomGeneralRole, 
    CustomErrorMessage 
} from '../../custom-rbac/interfaces'
```

#### Utilities

```typescript
// BEFORE (enterprise - DO NOT USE)
import { isInvalidUUID, isInvalidEmail, isInvalidName } from '../../enterprise/utils/validation.util'
import { getHash, compareHash } from '../../enterprise/utils/encryption.util'

// AFTER (custom-rbac - USE THIS)
import { 
    isInvalidUUID, 
    isInvalidEmail, 
    isInvalidName,
    hashPassword,
    comparePassword 
} from '../../custom-rbac/utils'
```

#### Permission Checking

```typescript
// BEFORE (may use enterprise interfaces)
import { checkPermission, checkAnyPermission } from '../../rbac/PermissionCheck'

// AFTER (use custom-rbac middleware)
import { 
    checkPermission, 
    checkAnyPermission,
    checkAllPermissions,
    requireOrganizationAdmin,
    requireAuthentication,
    requireWorkspaceAccess,
    requireOrganizationAccess 
} from '../../custom-rbac/middleware'
```

### Step 2: Update Entity References

If you're using TypeORM with enterprise entities, you'll need to:

1. Register custom entities with your DataSource
2. Update repository references

```typescript
// In your DataSource configuration
import { CustomRBACEntities } from './custom-rbac/entities'

const AppDataSource = new DataSource({
    // ... other config
    entities: [
        ...existingEntities,
        ...CustomRBACEntities
    ]
})
```

### Step 3: Update Service Layer

Services should use the custom-rbac utilities instead of enterprise utilities:

```typescript
// BEFORE
import { getHash } from '../../enterprise/utils/encryption.util'

public encryptUserCredential(credential: string) {
    return getHash(credential)
}

// AFTER
import { hashPassword } from '../../custom-rbac/utils'

public encryptUserCredential(credential: string) {
    return hashPassword(credential)
}
```

### Step 4: Update Error Messages

Replace enterprise error messages with custom constants:

```typescript
// BEFORE
import { ErrorMessage } from '../../enterprise/Interface.Enterprise'
return res.status(403).json({ message: ErrorMessage.FORBIDDEN })

// AFTER
import { CustomErrorMessage } from '../../custom-rbac/interfaces'
return res.status(403).json({ message: CustomErrorMessage.FORBIDDEN })
```

## Entity Mapping Reference

| Enterprise Entity | Custom Entity |
|-------------------|---------------|
| `User` | `CustomUser` |
| `Organization` | `CustomOrganization` |
| `OrganizationUser` | `CustomOrganizationUser` |
| `Workspace` | `CustomWorkspace` |
| `WorkspaceUser` | `CustomWorkspaceUser` |
| `Role` | `CustomRole` |

## Enum Mapping Reference

| Enterprise Enum | Custom Enum |
|-----------------|-------------|
| `UserStatus` | `CustomUserStatus` |
| `GeneralRole` | `CustomGeneralRole` |
| `OrganizationUserStatus` | `CustomOrganizationUserStatus` |
| `WorkspaceUserStatus` | `CustomWorkspaceUserStatus` |

## Constants Mapping Reference

| Enterprise Constant | Custom Constant |
|--------------------|-----------------|
| `OrganizationName.DEFAULT_ORGANIZATION` | `RESERVED_ORGANIZATION_NAME` |
| `WorkspaceName.DEFAULT_WORKSPACE` | `RESERVED_WORKSPACE_NAMES[0]` |
| `WorkspaceName.DEFAULT_PERSONAL_WORKSPACE` | `RESERVED_WORKSPACE_NAMES[1]` |

## Best Practices

1. **Avoid Mixed Imports**: Don't import from both enterprise and custom-rbac in the same file
2. **Use Type Aliases**: If needed, create type aliases to ease migration
3. **Test Thoroughly**: Ensure all functionality works after migration
4. **Document Changes**: Comment any non-obvious changes for future maintainers

## Verification Checklist

Run these checks to ensure you've removed enterprise dependencies:

```bash
# Search for remaining enterprise imports in your custom code
grep -r "from.*enterprise" packages/server/src/controllers/
grep -r "from.*enterprise" packages/server/src/services/
grep -r "from.*enterprise" packages/server/src/rbac/
```

The goal is zero matches in your custom RBAC-related code.

## Support

If you encounter issues during migration, ensure you're:
1. Using the latest version of the custom-rbac module
2. Not mixing enterprise and custom-rbac code
3. Properly registering custom entities with TypeORM

---
Copyright (c) 2024-2026 - Custom Implementation
Licensed under the Apache License, Version 2.0
