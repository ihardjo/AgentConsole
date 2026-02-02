/**
 * Custom RBAC - Account Management Service
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

import bcrypt from 'bcryptjs'
import { StatusCodes } from 'http-status-codes'
import moment from 'moment'
import { DataSource, QueryRunner } from 'typeorm'
import { InternalFlowiseError } from '../../../errors/internalFlowiseError'
import { IdentityManager } from '../../../IdentityManager'
import { Platform, UserPlan } from '../../../Interface'
import { GeneralErrorMessage } from '../../../utils/constants'
import { getRunningExpressApp } from '../../../utils/getRunningExpressApp'
import { checkUsageLimit } from '../../../utils/quotaUsage'
import { sendPasswordResetEmail, sendVerificationEmailForCloud, sendWorkspaceAdd, sendWorkspaceInvite } from '../../../utils/sendEmail'
import { sanitizeUser } from '../../../utils/sanitize.util'
import { OrganizationUser, OrganizationUserStatus } from '../../entities/organization-user.entity'
import { Organization, OrganizationName } from '../../entities/organization.entity'
import { GeneralRole, Role } from '../../entities/role.entity'
import { User, UserStatus } from '../../entities/user.entity'
import { WorkspaceUser, WorkspaceUserStatus } from '../../entities/workspace-user.entity'
import { Workspace, WorkspaceName } from '../../entities/workspace.entity'
import { comparePassword, generateTempToken } from '../../utils/encryption.util'
import { OrganizationUserManagementService } from '../organization-user-management'
import { OrganizationManagementService } from '../organization-management'
import { RoleManagementService } from '../role-management'
import { UserManagementService, UserManagementErrorMessage } from '../user-management'
import { WorkspaceUserManagementService, WorkspaceUserManagementErrorMessage } from '../workspace-user-management'
import { WorkspaceManagementService, WorkspaceManagementErrorMessage } from '../workspace-management'

// Import error messages from other services
const OrganizationManagementErrorMessage = {
    ORGANIZATION_NOT_FOUND: 'Organization Not Found'
}

// Helper to get the app URL with fallback
const getAppUrl = () => {
    return process.env.APP_URL || `http://localhost:${process.env.PORT || 3000}`
}

const OrganizationUserManagementErrorMessage = {
    ORGANIZATION_USER_NOT_FOUND: 'Organization User Not Found'
}

const RoleManagementErrorMessage = {
    ROLE_NOT_FOUND: 'Role Not Found'
}

type AccountDTO = {
    user: Partial<User>
    organization: Partial<Organization>
    organizationUser: Partial<OrganizationUser>
    workspace: Partial<Workspace>
    workspaceUser: Partial<WorkspaceUser>
    role: Partial<Role>
}

export class AccountService {
    private dataSource: DataSource
    private userService: UserManagementService
    private organizationservice: OrganizationManagementService
    private workspaceService: WorkspaceManagementService
    private roleService: RoleManagementService
    private organizationUserService: OrganizationUserManagementService
    private workspaceUserService: WorkspaceUserManagementService
    private identityManager: IdentityManager

    constructor() {
        const appServer = getRunningExpressApp()
        this.dataSource = appServer.AppDataSource
        this.userService = new UserManagementService()
        this.organizationservice = new OrganizationManagementService()
        this.workspaceService = new WorkspaceManagementService()
        this.roleService = new RoleManagementService()
        this.organizationUserService = new OrganizationUserManagementService()
        this.workspaceUserService = new WorkspaceUserManagementService()
        this.identityManager = appServer.identityManager
    }

    private initializeAccountDTO(data: AccountDTO) {
        data.organization = data.organization || {}
        data.organizationUser = data.organizationUser || {}
        data.workspace = data.workspace || {}
        data.workspaceUser = data.workspaceUser || {}
        data.role = data.role || {}

        return data
    }

    public async resendVerificationEmail({ email }: { email: string }) {
        const queryRunner = this.dataSource.createQueryRunner()
        await queryRunner.connect()
        try {
            await queryRunner.startTransaction()

            const user = await this.userService.readUserByEmail(email, queryRunner)
            if (!user) throw new InternalFlowiseError(StatusCodes.NOT_FOUND, UserManagementErrorMessage.USER_NOT_FOUND)
            if (user && user.status === UserStatus.ACTIVE)
                throw new InternalFlowiseError(StatusCodes.NOT_FOUND, UserManagementErrorMessage.USER_EMAIL_ALREADY_EXISTS)

            if (!user.email) throw new InternalFlowiseError(StatusCodes.BAD_REQUEST, UserManagementErrorMessage.INVALID_USER_EMAIL)

            const updateUserData: Partial<User> = {}
            updateUserData.tempToken = generateTempToken()
            const tokenExpiry = new Date()
            const expiryInHours = process.env.INVITE_TOKEN_EXPIRY_IN_HOURS ? parseInt(process.env.INVITE_TOKEN_EXPIRY_IN_HOURS) : 24
            tokenExpiry.setHours(tokenExpiry.getHours() + expiryInHours)
            updateUserData.tokenExpiry = tokenExpiry

            // Update user with new token and expiry
            const updatedUser = queryRunner.manager.merge(User, user, updateUserData)
            await queryRunner.manager.save(User, updatedUser)

            // resend invite
            const verificationLink = `${getAppUrl()}/verify?token=${updateUserData.tempToken}`
            await sendVerificationEmailForCloud(email, verificationLink)

            await queryRunner.commitTransaction()
        } catch (error) {
            await queryRunner.rollbackTransaction()
            throw error
        } finally {
            await queryRunner.release()
        }
    }

    private async ensureOneOrganizationOnly(queryRunner: QueryRunner) {
        const organizations = await this.organizationservice.readOrganization(queryRunner)
        if (organizations.length > 0) throw new InternalFlowiseError(StatusCodes.BAD_REQUEST, 'You can only have one organization')
    }

    private async createRegisterAccount(data: AccountDTO, queryRunner: QueryRunner) {
        data = this.initializeAccountDTO(data)

        const platform = this.identityManager.getPlatformType()

        switch (platform) {
            case Platform.OPEN_SOURCE: {
                // Check if tempToken is provided (invitation flow)
                if (data.user.tempToken) {
                    const user = await this.userService.readUserByToken(data.user.tempToken, queryRunner)
                    if (!user) throw new InternalFlowiseError(StatusCodes.NOT_FOUND, UserManagementErrorMessage.USER_NOT_FOUND)
                    if (user.email.toLowerCase() !== data.user.email?.toLowerCase())
                        throw new InternalFlowiseError(StatusCodes.BAD_REQUEST, UserManagementErrorMessage.INVALID_USER_EMAIL)
                    const name = data.user.name
                    if (data.user.credential) user.credential = this.userService.encryptUserCredential(data.user.credential)
                    data.user = user
                    const organizationUser = await this.organizationUserService.readOrganizationUserByUserId(user.id, queryRunner)
                    if (!organizationUser)
                        throw new InternalFlowiseError(StatusCodes.NOT_FOUND, OrganizationUserManagementErrorMessage.ORGANIZATION_USER_NOT_FOUND)
                    const assignedOrganization = await this.organizationservice.readOrganizationById(
                        organizationUser[0].organizationId,
                        queryRunner
                    )
                    if (!assignedOrganization)
                        throw new InternalFlowiseError(StatusCodes.NOT_FOUND, OrganizationManagementErrorMessage.ORGANIZATION_NOT_FOUND)
                    data.organization = assignedOrganization
                    const tokenExpiry = new Date(user.tokenExpiry!)
                    const today = new Date()
                    if (today > tokenExpiry) throw new InternalFlowiseError(StatusCodes.BAD_REQUEST, UserManagementErrorMessage.EXPIRED_TEMP_TOKEN)
                    data.user.tempToken = ''
                    data.user.tokenExpiry = null
                    data.user.name = name
                    data.user.status = UserStatus.ACTIVE
                    data.organizationUser.status = OrganizationUserStatus.ACTIVE
                    data.organizationUser.role = await this.roleService.readGeneralRoleByName(GeneralRole.MEMBER, queryRunner)
                    // Skip personal workspace creation for invited users - they will use the workspaces they were invited to
                    data.organizationUser.organizationId = data.organization.id
                    data.organizationUser.userId = data.user.id
                    data.organizationUser.createdBy = data.user.createdBy
                    data.organizationUser = this.organizationUserService.createNewOrganizationUser(data.organizationUser, queryRunner)
                    return data
                } else {
                    // New owner registration
                    await this.ensureOneOrganizationOnly(queryRunner)
                    data.organization.name = OrganizationName.DEFAULT_ORGANIZATION
                    data.organizationUser.role = await this.roleService.readGeneralRoleByName(GeneralRole.OWNER, queryRunner)
                    data.workspace.name = WorkspaceName.DEFAULT_WORKSPACE
                    data.workspaceUser.role = data.organizationUser.role
                    data.user.status = UserStatus.ACTIVE
                    data.user = await this.userService.createNewUser(data.user, queryRunner)
                }
                break
            }
            case Platform.CLOUD: {
                const user = await this.userService.readUserByEmail(data.user.email, queryRunner)
                if (user && (user.status === UserStatus.ACTIVE || user.status === UserStatus.UNVERIFIED))
                    throw new InternalFlowiseError(StatusCodes.NOT_FOUND, UserManagementErrorMessage.USER_EMAIL_ALREADY_EXISTS)

                if (!data.user.email) throw new InternalFlowiseError(StatusCodes.BAD_REQUEST, UserManagementErrorMessage.INVALID_USER_EMAIL)
                const { customerId, subscriptionId } = await this.identityManager.createStripeUserAndSubscribe({
                    email: data.user.email,
                    userPlan: UserPlan.FREE,
                    // @ts-ignore
                    referral: data.user.referral || ''
                })
                data.organization.customerId = customerId
                data.organization.subscriptionId = subscriptionId

                // if credential exists then the user is signing up with email/password
                // if not then the user is signing up with oauth/sso
                if (data.user.credential) {
                    data.user.status = UserStatus.UNVERIFIED
                    data.user.tempToken = generateTempToken()
                    const tokenExpiry = new Date()
                    const expiryInHours = process.env.INVITE_TOKEN_EXPIRY_IN_HOURS ? parseInt(process.env.INVITE_TOKEN_EXPIRY_IN_HOURS) : 24
                    tokenExpiry.setHours(tokenExpiry.getHours() + expiryInHours)
                    data.user.tokenExpiry = tokenExpiry
                } else {
                    data.user.status = UserStatus.ACTIVE
                    data.user.tempToken = ''
                    data.user.tokenExpiry = null
                }
                data.organization.name = OrganizationName.DEFAULT_ORGANIZATION
                data.organizationUser.role = await this.roleService.readGeneralRoleByName(GeneralRole.OWNER, queryRunner)
                data.workspace.name = WorkspaceName.DEFAULT_WORKSPACE
                data.workspaceUser.role = data.organizationUser.role
                if (!user) {
                    data.user = await this.userService.createNewUser(data.user, queryRunner)
                } else {
                    if (data.user.credential) data.user.credential = this.userService.encryptUserCredential(data.user.credential)
                    data.user.updatedBy = user.id
                    data.user = queryRunner.manager.merge(User, user, data.user)
                }
                // send verification email only if user signed up with email/password
                if (data.user.credential) {
                    const verificationLink = `${getAppUrl()}/verify?token=${data.user.tempToken}`
                    await sendVerificationEmailForCloud(data.user.email!, verificationLink)
                }
                break
            }
            default:
                throw new InternalFlowiseError(StatusCodes.BAD_REQUEST, GeneralErrorMessage.UNHANDLED_EDGE_CASE)
        }

        if (!data.organization.id) {
            data.organization.createdBy = data.user.createdBy
            data.organization = this.organizationservice.createNewOrganization(data.organization, queryRunner, true)
        }
        data.organizationUser.organizationId = data.organization.id
        data.organizationUser.userId = data.user.id
        data.organizationUser.createdBy = data.user.createdBy
        data.organizationUser = this.organizationUserService.createNewOrganizationUser(data.organizationUser, queryRunner)
        data.workspace.organizationId = data.organization.id
        data.workspace.createdBy = data.user.createdBy
        data.workspace = this.workspaceService.createNewWorkspace(data.workspace, queryRunner, true)
        data.workspaceUser.workspaceId = data.workspace.id
        data.workspaceUser.userId = data.user.id
        data.workspaceUser.createdBy = data.user.createdBy
        data.workspaceUser.status = WorkspaceUserStatus.ACTIVE
        data.workspaceUser = this.workspaceUserService.createNewWorkspaceUser(data.workspaceUser, queryRunner)

        return data
    }

    private async saveRegisterAccount(data: AccountDTO) {
        const queryRunner = this.dataSource.createQueryRunner()
        await queryRunner.connect()
        const platform = this.identityManager.getPlatformType()
        const ownerRole = await this.roleService.readGeneralRoleByName(GeneralRole.OWNER, queryRunner)

        try {
            data = await this.createRegisterAccount(data, queryRunner)

            await queryRunner.startTransaction()
            data.user = await this.userService.saveUser(data.user, queryRunner)
            data.organization = await this.organizationservice.saveOrganization(data.organization, queryRunner)
            data.organizationUser = await this.organizationUserService.saveOrganizationUser(data.organizationUser, queryRunner)
            // Only save workspace and workspaceUser if they were created (not for invited users)
            if (data.workspace.id) {
                data.workspace = await this.workspaceService.saveWorkspace(data.workspace, queryRunner)
            }
            if (data.workspaceUser.workspaceId) {
                data.workspaceUser = await this.workspaceUserService.saveWorkspaceUser(data.workspaceUser, queryRunner)
            }
            if (
                data.workspace.id &&
                platform === Platform.OPEN_SOURCE &&
                ownerRole.id === data.organizationUser.roleId
            ) {
                await this.workspaceService.setNullWorkspaceId(queryRunner, data.workspace.id)
            }
            await queryRunner.commitTransaction()

            delete (data.user as any).credential
            delete (data.user as any).tempToken
            delete (data.user as any).tokenExpiry

            return data
        } catch (error) {
            if (queryRunner && queryRunner.isTransactionActive) await queryRunner.rollbackTransaction()
            throw error
        } finally {
            if (queryRunner && !queryRunner.isReleased) await queryRunner.release()
        }
    }

    public async register(data: AccountDTO) {
        return await this.saveRegisterAccount(data)
    }

    private async saveInviteAccount(data: AccountDTO, currentUser?: Express.User) {
        data = this.initializeAccountDTO(data)
        const queryRunner = this.dataSource.createQueryRunner()
        await queryRunner.connect()

        try {
            const workspace = await this.workspaceService.readWorkspaceById(data.workspace.id, queryRunner)
            if (!workspace) throw new InternalFlowiseError(StatusCodes.NOT_FOUND, WorkspaceManagementErrorMessage.WORKSPACE_NOT_FOUND)
            
            // Block invitations to personal workspaces (identified by name constant)
            if (workspace.name === WorkspaceName.DEFAULT_PERSONAL_WORKSPACE) {
                throw new InternalFlowiseError(
                    StatusCodes.BAD_REQUEST,
                    'Personal workspaces are for individual use only. To collaborate with others, please create a team workspace from the Workspaces page.'
                )
            }
            
            data.workspace = workspace

            const totalOrgUsers = await this.organizationUserService.readOrgUsersCountByOrgId(data.workspace.organizationId || '')
            const subscriptionId = currentUser?.activeOrganizationSubscriptionId || ''

            const role = await this.roleService.readRoleByRoleIdOrganizationId(data.role.id, data.workspace.organizationId, queryRunner)
            if (!role) throw new InternalFlowiseError(StatusCodes.NOT_FOUND, RoleManagementErrorMessage.ROLE_NOT_FOUND)
            data.role = role
            const user = await this.userService.readUserByEmail(data.user.email, queryRunner)
            if (!user) {
                await checkUsageLimit('users', subscriptionId, getRunningExpressApp().usageCacheManager, totalOrgUsers + 1)

                // generate a temporary token
                data.user.tempToken = generateTempToken()
                const tokenExpiry = new Date()
                // set expiry based on env setting and fallback to 24 hours
                const expiryInHours = process.env.INVITE_TOKEN_EXPIRY_IN_HOURS ? parseInt(process.env.INVITE_TOKEN_EXPIRY_IN_HOURS) : 24
                tokenExpiry.setHours(tokenExpiry.getHours() + expiryInHours)
                data.user.tokenExpiry = tokenExpiry
                data.user.status = UserStatus.INVITED
                
                // Get organization details for invitation email
                const organization = await this.organizationservice.readOrganizationById(data.workspace.organizationId || '', queryRunner)
                const inviterUser = currentUser?.id ? await this.userService.readUserById(currentUser.id, queryRunner) : null
                
                // send invite - Open Source uses token-based registration
                const registerLink = `${getAppUrl()}/register?token=${data.user.tempToken}`
                await sendWorkspaceInvite(
                    data.user.email!,
                    data.workspace.name!,
                    registerLink,
                    this.identityManager.getPlatformType(),
                    'new',
                    inviterUser?.name || currentUser?.name || 'Administrator',
                    organization?.name || data.workspace.name,
                    data.user.tempToken
                )
                data.user = await this.userService.createNewUser(data.user, queryRunner)

                data.organizationUser.organizationId = data.workspace.organizationId
                data.organizationUser.userId = data.user.id
                const roleMember = await this.roleService.readGeneralRoleByName(GeneralRole.MEMBER, queryRunner)
                data.organizationUser.roleId = roleMember.id
                data.organizationUser.createdBy = data.user.createdBy
                data.organizationUser.status = OrganizationUserStatus.INVITED
                data.organizationUser = this.organizationUserService.createNewOrganizationUser(data.organizationUser, queryRunner)

                workspace.updatedBy = data.user.createdBy

                data.workspaceUser.workspaceId = data.workspace.id
                data.workspaceUser.userId = data.user.id
                data.workspaceUser.roleId = data.role.id
                data.workspaceUser.createdBy = data.user.createdBy
                data.workspaceUser.status = WorkspaceUserStatus.INVITED
                data.workspaceUser = this.workspaceUserService.createNewWorkspaceUser(data.workspaceUser, queryRunner)

                await queryRunner.startTransaction()
                data.user = await this.userService.saveUser(data.user, queryRunner)
                await this.workspaceService.saveWorkspace(workspace, queryRunner)
                data.organizationUser = await this.organizationUserService.saveOrganizationUser(data.organizationUser, queryRunner)
                data.workspaceUser = await this.workspaceUserService.saveWorkspaceUser(data.workspaceUser, queryRunner)
                data.role = await this.roleService.saveRole(data.role, queryRunner)
                await queryRunner.commitTransaction()
                delete (data.user as any).credential
                delete (data.user as any).tempToken
                delete (data.user as any).tokenExpiry

                return data
            }
            const { organizationUser } = await this.organizationUserService.readOrganizationUserByOrganizationIdUserId(
                data.workspace.organizationId,
                user.id,
                queryRunner
            )
            if (!organizationUser) {
                await checkUsageLimit('users', subscriptionId, getRunningExpressApp().usageCacheManager, totalOrgUsers + 1)
                data.organizationUser.organizationId = data.workspace.organizationId
                data.organizationUser.userId = user.id
                const roleMember = await this.roleService.readGeneralRoleByName(GeneralRole.MEMBER, queryRunner)
                data.organizationUser.roleId = roleMember.id
                data.organizationUser.createdBy = data.user.createdBy
                data.organizationUser.status = OrganizationUserStatus.INVITED
                data.organizationUser = this.organizationUserService.createNewOrganizationUser(data.organizationUser, queryRunner)
            } else {
                data.organizationUser = organizationUser
            }

            let oldWorkspaceUser
            if (data.organizationUser.status === OrganizationUserStatus.INVITED) {
                const workspaceUser = await this.workspaceUserService.readWorkspaceUserByOrganizationIdUserId(
                    data.workspace.organizationId,
                    user.id,
                    queryRunner
                )
                
                // Get organization and inviter details for invitation email
                const organization = await this.organizationservice.readOrganizationById(data.workspace.organizationId || '', queryRunner)
                const inviterUser = data.user.createdBy ? await this.userService.readUserById(data.user.createdBy, queryRunner) : null
                
                // Generate tempToken for Open Source
                data.user = user
                data.user.tempToken = generateTempToken()
                const tokenExpiry = new Date()
                const expiryInHours = process.env.INVITE_TOKEN_EXPIRY_IN_HOURS ? parseInt(process.env.INVITE_TOKEN_EXPIRY_IN_HOURS) : 24
                tokenExpiry.setHours(tokenExpiry.getHours() + expiryInHours)
                data.user.tokenExpiry = tokenExpiry
                await this.userService.saveUser(data.user, queryRunner)
                const registerLink = `${getAppUrl()}/register?token=${data.user.tempToken}`
                
                if (workspaceUser.length === 1) {
                    oldWorkspaceUser = workspaceUser[0]
                    if (oldWorkspaceUser.workspace?.name === WorkspaceName.DEFAULT_PERSONAL_WORKSPACE) {
                        await sendWorkspaceInvite(
                            data.user.email!,
                            data.workspace.name!,
                            registerLink,
                            this.identityManager.getPlatformType(),
                            'new',
                            inviterUser?.name || 'Administrator',
                            organization?.name || data.workspace.name,
                            data.user.tempToken || undefined
                        )
                    } else {
                        await sendWorkspaceInvite(
                            data.user.email!,
                            data.workspace.name!,
                            registerLink,
                            this.identityManager.getPlatformType(),
                            'update',
                            inviterUser?.name || 'Administrator',
                            organization?.name || data.workspace.name,
                            data.user.tempToken || undefined
                        )
                    }
                } else {
                    await sendWorkspaceInvite(
                        data.user.email!,
                        data.workspace.name!,
                        registerLink,
                        this.identityManager.getPlatformType(),
                        'new',
                        inviterUser?.name || 'Administrator',
                        organization?.name || data.workspace.name,
                        data.user.tempToken || undefined
                    )
                }
            } else {
                data.organizationUser.updatedBy = data.user.createdBy

                // Get inviter details for workspace add email
                const inviterUser = data.user.createdBy ? await this.userService.readUserById(data.user.createdBy, queryRunner) : null

                const dashboardLink = `${getAppUrl()}`
                await sendWorkspaceAdd(data.user.email!, data.workspace.name!, dashboardLink, inviterUser?.name || 'Administrator')
            }

            workspace.updatedBy = data.user.createdBy

            data.workspaceUser.workspaceId = data.workspace.id
            data.workspaceUser.userId = user.id
            data.workspaceUser.roleId = data.role.id
            data.workspaceUser.createdBy = data.user.createdBy
            data.workspaceUser.status = WorkspaceUserStatus.INVITED
            data.workspaceUser = this.workspaceUserService.createNewWorkspaceUser(data.workspaceUser, queryRunner)

            const personalWorkspaceRole = await this.roleService.readGeneralRoleByName(GeneralRole.PERSONAL_WORKSPACE, queryRunner)
            if (oldWorkspaceUser && oldWorkspaceUser.roleId !== personalWorkspaceRole.id) {
                await this.workspaceUserService.deleteWorkspaceUser(oldWorkspaceUser.workspaceId, user.id)
            }

            await queryRunner.startTransaction()
            data.organizationUser = await this.organizationUserService.saveOrganizationUser(data.organizationUser, queryRunner)
            await this.workspaceService.saveWorkspace(workspace, queryRunner)
            data.workspaceUser = await this.workspaceUserService.saveWorkspaceUser(data.workspaceUser, queryRunner)
            data.role = await this.roleService.saveRole(data.role, queryRunner)
            await queryRunner.commitTransaction()

            return data
        } catch (error) {
            if (queryRunner && queryRunner.isTransactionActive) await queryRunner.rollbackTransaction()
            throw error
        } finally {
            if (queryRunner && !queryRunner.isReleased) await queryRunner.release()
        }
    }

    public async invite(data: AccountDTO, user?: Express.User) {
        return await this.saveInviteAccount(data, user)
    }

    public async login(data: AccountDTO) {
        data = this.initializeAccountDTO(data)
        const queryRunner = this.dataSource.createQueryRunner()
        await queryRunner.connect()
        try {
            if (!data.user.credential) {
                throw new InternalFlowiseError(StatusCodes.BAD_REQUEST, UserManagementErrorMessage.INVALID_USER_CREDENTIAL)
            }
            const user = await this.userService.readUserByEmail(data.user.email, queryRunner)
            if (!user) {
                throw new InternalFlowiseError(StatusCodes.NOT_FOUND, UserManagementErrorMessage.USER_NOT_FOUND)
            }
            if (!user.credential) {
                throw new InternalFlowiseError(StatusCodes.BAD_REQUEST, UserManagementErrorMessage.INVALID_USER_CREDENTIAL)
            }
            if (!comparePassword(data.user.credential, user.credential)) {
                throw new InternalFlowiseError(StatusCodes.UNAUTHORIZED, UserManagementErrorMessage.INCORRECT_USER_EMAIL_OR_CREDENTIALS)
            }
            if (user.status === UserStatus.UNVERIFIED) {
                throw new InternalFlowiseError(StatusCodes.UNAUTHORIZED, UserManagementErrorMessage.USER_EMAIL_UNVERIFIED)
            }
            if (user.status === UserStatus.DELETED) {
                throw new InternalFlowiseError(StatusCodes.UNAUTHORIZED, 'This account has been deactivated. Please contact your administrator.')
            }
            const wsUsers = await this.workspaceUserService.readWorkspaceUserByLastLogin(user.id, queryRunner)
            let wsUserOrUsers: WorkspaceUser
            if (Array.isArray(wsUsers)) {
                if (wsUsers.length > 0) {
                    wsUserOrUsers = wsUsers[0]
                } else {
                    throw new InternalFlowiseError(StatusCodes.NOT_FOUND, WorkspaceUserManagementErrorMessage.WORKSPACE_USER_NOT_FOUND)
                }
            } else {
                wsUserOrUsers = wsUsers
            }
            return { user, workspaceDetails: wsUserOrUsers }
        } finally {
            await queryRunner.release()
        }
    }

    public async verify(data: AccountDTO) {
        data = this.initializeAccountDTO(data)
        const queryRunner = this.dataSource.createQueryRunner()
        await queryRunner.connect()
        try {
            await queryRunner.startTransaction()
            if (!data.user.tempToken) throw new InternalFlowiseError(StatusCodes.BAD_REQUEST, UserManagementErrorMessage.INVALID_TEMP_TOKEN)
            const user = await this.userService.readUserByToken(data.user.tempToken, queryRunner)
            if (!user) throw new InternalFlowiseError(StatusCodes.NOT_FOUND, UserManagementErrorMessage.USER_NOT_FOUND)
            data.user = user
            data.user.tempToken = ''
            data.user.tokenExpiry = null
            data.user.status = UserStatus.ACTIVE
            data.user = await this.userService.saveUser(data.user, queryRunner)
            await queryRunner.commitTransaction()
        } catch (error) {
            await queryRunner.rollbackTransaction()
            throw error
        } finally {
            await queryRunner.release()
        }

        return data
    }

    public async forgotPassword(data: AccountDTO) {
        data = this.initializeAccountDTO(data)
        const queryRunner = this.dataSource.createQueryRunner()
        await queryRunner.connect()
        try {
            await queryRunner.startTransaction()
            const user = await this.userService.readUserByEmail(data.user.email, queryRunner)
            if (!user) throw new InternalFlowiseError(StatusCodes.NOT_FOUND, UserManagementErrorMessage.USER_NOT_FOUND)

            data.user = user
            data.user.tempToken = generateTempToken()
            const tokenExpiry = new Date()
            const expiryInMins = process.env.PASSWORD_RESET_TOKEN_EXPIRY_IN_MINUTES
                ? parseInt(process.env.PASSWORD_RESET_TOKEN_EXPIRY_IN_MINUTES)
                : 15
            tokenExpiry.setMinutes(tokenExpiry.getMinutes() + expiryInMins)
            data.user.tokenExpiry = tokenExpiry
            data.user = await this.userService.saveUser(data.user, queryRunner)
            const resetLink = `${getAppUrl()}/reset-password?token=${data.user.tempToken}`
            await sendPasswordResetEmail(data.user.email!, resetLink)
            await queryRunner.commitTransaction()
        } catch (error) {
            await queryRunner.rollbackTransaction()
            throw error
        } finally {
            await queryRunner.release()
        }

        return sanitizeUser(data.user)
    }

    public async resetPassword(data: AccountDTO) {
        data = this.initializeAccountDTO(data)
        const queryRunner = this.dataSource.createQueryRunner()
        await queryRunner.connect()
        try {
            const user = await this.userService.readUserByEmail(data.user.email, queryRunner)
            if (!user) throw new InternalFlowiseError(StatusCodes.NOT_FOUND, UserManagementErrorMessage.USER_NOT_FOUND)
            if (user.tempToken !== data.user.tempToken)
                throw new InternalFlowiseError(StatusCodes.BAD_REQUEST, UserManagementErrorMessage.INVALID_TEMP_TOKEN)

            const tokenExpiry = user.tokenExpiry
            const now = moment()
            const expiryInMins = process.env.PASSWORD_RESET_TOKEN_EXPIRY_IN_MINUTES
                ? parseInt(process.env.PASSWORD_RESET_TOKEN_EXPIRY_IN_MINUTES)
                : 15
            const diff = now.diff(tokenExpiry, 'minutes')
            if (Math.abs(diff) > expiryInMins) throw new InternalFlowiseError(StatusCodes.BAD_REQUEST, UserManagementErrorMessage.EXPIRED_TEMP_TOKEN)

            // all checks are done, now update the user password, don't forget to hash it and do not forget to clear the temp token
            // leave the user status and other details as is
            const salt = bcrypt.genSaltSync(parseInt(process.env.PASSWORD_SALT_HASH_ROUNDS || '5'))
            // @ts-ignore
            const hash = bcrypt.hashSync(data.user.password, salt)
            data.user = user
            data.user.credential = hash
            data.user.tempToken = ''
            data.user.tokenExpiry = undefined
            data.user.status = UserStatus.ACTIVE

            await queryRunner.startTransaction()
            data.user = await this.userService.saveUser(data.user, queryRunner)
            await queryRunner.commitTransaction()
        } catch (error) {
            await queryRunner.rollbackTransaction()
            throw error
        } finally {
            await queryRunner.release()
        }

        return sanitizeUser(data.user)
    }

    public async logout(_user: Express.User) {
        // No-op for Open Source mode - audit logging is an enterprise feature
    }
}
