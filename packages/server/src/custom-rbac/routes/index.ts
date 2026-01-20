/**
 * Custom RBAC - Routes Index
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

export { default as organizationManagementRouter } from './organization-management'
export { default as organizationUserManagementRouter } from './organization-user-management'
export { default as roleManagementRouter } from './role-management'
export { default as userManagementRouter } from './user-management'
export { default as workspaceManagementRouter } from './workspace-management'
export { default as workspaceUserManagementRouter } from './workspace-user-management'
export { default as accountManagementRouter } from './account-management'
export { default as platformConfigRouter } from './platform-config'

// Export shared utilities for reuse
export * from './shared/types'
export * from './shared/utils'
