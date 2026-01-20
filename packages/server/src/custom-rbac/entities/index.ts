/**
 * Custom RBAC - Entities Index
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
 * 
 * NOTE: These entities map to existing database tables to maintain compatibility.
 */

// Export entities
export { User, UserStatus } from './user.entity'
export { Organization, OrganizationName } from './organization.entity'
export { OrganizationUser, OrganizationUserStatus } from './organization-user.entity'
export { Workspace, WorkspaceName } from './workspace.entity'
export { WorkspaceUser, WorkspaceUserStatus } from './workspace-user.entity'
export { Role, GeneralRole } from './role.entity'
export { LoginMethod, LoginMethodStatus } from './login-method.entity'
export { PlatformAsset, PlatformAssetType } from './platform-asset.entity'

// All entities for TypeORM registration
// These can be added to DataSource entities array
import { User } from './user.entity'
import { Organization } from './organization.entity'
import { OrganizationUser } from './organization-user.entity'
import { Workspace } from './workspace.entity'
import { WorkspaceUser } from './workspace-user.entity'
import { Role } from './role.entity'
import { LoginMethod } from './login-method.entity'
import { PlatformAsset } from './platform-asset.entity'

export const CustomRBACEntities = [
    User,
    Organization,
    OrganizationUser,
    Workspace,
    WorkspaceUser,
    Role,
    LoginMethod,
    PlatformAsset
]
