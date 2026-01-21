/**
 * Custom RBAC - User Management Service
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

import { StatusCodes } from 'http-status-codes'
import { DataSource, ILike, QueryRunner } from 'typeorm'
import { InternalFlowiseError } from '../../../errors/internalFlowiseError'
import { GeneralSuccessMessage, GeneralErrorMessage } from '../../../utils/constants'
import { getRunningExpressApp } from '../../../utils/getRunningExpressApp'
import { generateId } from '../../../utils'
import { Telemetry, TelemetryEventType } from '../../../utils/telemetry'
import { User, UserStatus } from '../../entities/user.entity'
import { Organization } from '../../entities/organization.entity'
import { OrganizationUser, OrganizationUserStatus } from '../../entities/organization-user.entity'
import { WorkspaceUser } from '../../entities/workspace-user.entity'
import { Workspace } from '../../entities/workspace.entity'
import { GeneralRole } from '../../entities/role.entity'
import { isInvalidUUID, isInvalidEmail, isInvalidName, isInvalidPassword } from '../../utils/validation.util'
import { hashPassword } from '../../utils/encryption.util'

export const enum UserManagementErrorMessage {
    EXPIRED_TEMP_TOKEN = 'Expired Temporary Token',
    INVALID_TEMP_TOKEN = 'Invalid Temporary Token',
    INVALID_USER_ID = 'Invalid User Id',
    INVALID_USER_EMAIL = 'Invalid User Email',
    INVALID_USER_CREDENTIAL = 'Invalid User Credential',
    INVALID_USER_NAME = 'Invalid User Name',
    INVALID_USER_TYPE = 'Invalid User Type',
    INVALID_USER_STATUS = 'Invalid User Status',
    USER_EMAIL_ALREADY_EXISTS = 'User Email Already Exists',
    USER_EMAIL_UNVERIFIED = 'User Email Unverified',
    USER_NOT_FOUND = 'User Not Found',
    USER_FOUND_MULTIPLE = 'User Found Multiple',
    INCORRECT_USER_EMAIL_OR_CREDENTIALS = 'Incorrect Email or Password',
    INVALID_ORGANIZATION_USER_STATUS = 'Invalid Organization User Status',
    ORGANIZATION_USER_ALREADY_EXISTS = 'Organization User Already Exists',
    ORGANIZATION_USER_NOT_FOUND = 'Organization User Not Found',
    INVALID_ORGANIZATION_ID = 'Invalid Organization Id',
    ORGANIZATION_NOT_FOUND = 'Organization Not Found'
}

export class UserManagementService {
    private dataSource: DataSource
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private _roleManagementService: any = null
    private telemetry: Telemetry

    constructor() {
        const appServer = getRunningExpressApp()
        this.dataSource = appServer.AppDataSource
        this.telemetry = appServer.telemetry
    }

    // Lazy initialization to avoid circular dependency
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private get roleManagementService(): any {
        if (!this._roleManagementService) {
            // Dynamic import to avoid circular dependency
            const { RoleManagementService } = require('../role-management')
            this._roleManagementService = new RoleManagementService()
        }
        return this._roleManagementService!
    }

    // User validation and CRUD methods
    public validateUserId(id: string | undefined) {
        if (isInvalidUUID(id)) throw new InternalFlowiseError(StatusCodes.BAD_REQUEST, UserManagementErrorMessage.INVALID_USER_ID)
    }

    public async readUserById(id: string | undefined, queryRunner: QueryRunner) {
        this.validateUserId(id)
        return await queryRunner.manager.findOneBy(User, { id })
    }

    public validateUserName(name: string | undefined) {
        if (isInvalidName(name)) throw new InternalFlowiseError(StatusCodes.BAD_REQUEST, UserManagementErrorMessage.INVALID_USER_NAME)
    }

    public validateUserEmail(email: string | undefined) {
        if (isInvalidEmail(email)) throw new InternalFlowiseError(StatusCodes.BAD_REQUEST, UserManagementErrorMessage.INVALID_USER_EMAIL)
    }

    public async readUserByEmail(email: string | undefined, queryRunner: QueryRunner) {
        if (!email) throw new InternalFlowiseError(StatusCodes.BAD_REQUEST, UserManagementErrorMessage.INVALID_USER_EMAIL)
        this.validateUserEmail(email)
        return await queryRunner.manager.findOneBy(User, { email: ILike(email) })
    }

    public async readUserByToken(token: string | undefined, queryRunner: QueryRunner) {
        return await queryRunner.manager.findOneBy(User, { tempToken: token })
    }

    public validateUserStatus(status: string | undefined) {
        if (status && !Object.values(UserStatus).includes(status as UserStatus))
            throw new InternalFlowiseError(StatusCodes.BAD_REQUEST, UserManagementErrorMessage.INVALID_USER_STATUS)
    }

    public async readUser(queryRunner: QueryRunner) {
        return await queryRunner.manager.find(User)
    }

    public encryptUserCredential(credential: string | undefined) {
        if (!credential || isInvalidPassword(credential))
            throw new InternalFlowiseError(StatusCodes.BAD_REQUEST, GeneralErrorMessage.INVALID_PASSWORD)
        return hashPassword(credential)
    }

    public async createNewUser(data: Partial<User>, queryRunner: QueryRunner) {
        const user = await this.readUserByEmail(data.email, queryRunner)
        if (user) throw new InternalFlowiseError(StatusCodes.BAD_REQUEST, UserManagementErrorMessage.USER_EMAIL_ALREADY_EXISTS)
        if (data.credential) data.credential = this.encryptUserCredential(data.credential)
        if (!data.name) data.name = data.email
        this.validateUserName(data.name)
        if (data.status) this.validateUserStatus(data.status)

        data.id = generateId()
        if (data.createdBy) {
            const createdBy = await this.readUserById(data.createdBy, queryRunner)
            if (!createdBy) throw new InternalFlowiseError(StatusCodes.NOT_FOUND, UserManagementErrorMessage.USER_NOT_FOUND)
            data.createdBy = createdBy.id
            data.updatedBy = data.createdBy
        } else {
            data.createdBy = data.id
            data.updatedBy = data.id
        }

        const userObj = queryRunner.manager.create(User, data)

        this.telemetry.sendTelemetry(
            TelemetryEventType.USER_CREATED,
            {
                userId: userObj.id,
                createdBy: userObj.createdBy
            },
            userObj.id
        )

        return userObj
    }

    public async saveUser(data: Partial<User>, queryRunner: QueryRunner) {
        return await queryRunner.manager.save(User, data)
    }

    // Internal method to read organization by ID
    private validateOrganizationId(id: string | undefined) {
        if (isInvalidUUID(id))
            throw new InternalFlowiseError(StatusCodes.BAD_REQUEST, UserManagementErrorMessage.INVALID_ORGANIZATION_ID)
    }

    public async readOrganizationById(id: string | undefined, queryRunner: QueryRunner) {
        this.validateOrganizationId(id)
        return await queryRunner.manager.findOneBy(Organization, { id })
    }

    public validateOrganizationUserStatus(status: string | undefined) {
        if (status && !Object.values(OrganizationUserStatus).includes(status as OrganizationUserStatus))
            throw new InternalFlowiseError(StatusCodes.BAD_REQUEST, UserManagementErrorMessage.INVALID_ORGANIZATION_USER_STATUS)
    }

    public async readOrganizationUserByOrganizationIdUserId(
        organizationId: string | undefined,
        userId: string | undefined,
        queryRunner: QueryRunner
    ) {
        const organization = await this.readOrganizationById(organizationId, queryRunner)
        if (!organization) throw new InternalFlowiseError(StatusCodes.NOT_FOUND, UserManagementErrorMessage.ORGANIZATION_NOT_FOUND)
        const user = await this.readUserById(userId, queryRunner)
        if (!user) throw new InternalFlowiseError(StatusCodes.NOT_FOUND, UserManagementErrorMessage.USER_NOT_FOUND)
        const ownerRole = await this.roleManagementService.readGeneralRoleByName(GeneralRole.OWNER, queryRunner)

        const organizationUser = await queryRunner.manager
            .createQueryBuilder(OrganizationUser, 'organizationUser')
            .innerJoinAndSelect('organizationUser.role', 'role')
            .where('organizationUser.organizationId = :organizationId', { organizationId })
            .andWhere('organizationUser.userId = :userId', { userId })
            .getOne()

        return {
            organization,
            organizationUser: organizationUser
                ? {
                      ...organizationUser,
                      isOrgOwner: organizationUser.roleId === ownerRole?.id
                  }
                : null
        }
    }

    public async readOrganizationUserByOrganizationId(organizationId: string | undefined, queryRunner: QueryRunner) {
        const organization = await this.readOrganizationById(organizationId, queryRunner)
        if (!organization) throw new InternalFlowiseError(StatusCodes.NOT_FOUND, UserManagementErrorMessage.ORGANIZATION_NOT_FOUND)
        const ownerRole = await this.roleManagementService.readGeneralRoleByName(GeneralRole.OWNER, queryRunner)

        const organizationUsers = await queryRunner.manager
            .createQueryBuilder(OrganizationUser, 'organizationUser')
            .innerJoinAndSelect('organizationUser.user', 'user')
            .innerJoinAndSelect('organizationUser.role', 'role')
            .where('organizationUser.organizationId = :organizationId', { organizationId })
            .getMany()

        // Get workspace user last login for all users
        const workspaceUsers = await queryRunner.manager
            .createQueryBuilder(WorkspaceUser, 'workspaceUser')
            .where('workspaceUser.userId IN (:...userIds)', {
                userIds: organizationUsers.length > 0 ? organizationUsers.map((user) => user.userId) : ['']
            })
            .orderBy('workspaceUser.lastLogin', 'ASC')
            .getMany()

        const lastLoginMap = new Map(workspaceUsers.map((wu) => [wu.userId, wu.lastLogin]))

        return await Promise.all(
            organizationUsers.map(async (organizationUser) => {
                const workspaceUser = await queryRunner.manager.findBy(WorkspaceUser, {
                    userId: organizationUser.userId,
                    workspace: { organizationId: organizationId }
                })
                delete (organizationUser.user as any).credential
                delete (organizationUser.user as any).tempToken
                delete (organizationUser.user as any).tokenExpiry
                return {
                    ...organizationUser,
                    isOrgOwner: organizationUser.roleId === ownerRole?.id,
                    lastLogin: lastLoginMap.get(organizationUser.userId) || null,
                    roleCount: workspaceUser.length
                }
            })
        )
    }

    public async readOrganizationUserByOrganizationIdRoleId(
        organizationId: string | undefined,
        roleId: string | undefined,
        queryRunner: QueryRunner
    ) {
        const organization = await this.readOrganizationById(organizationId, queryRunner)
        if (!organization) throw new InternalFlowiseError(StatusCodes.NOT_FOUND, UserManagementErrorMessage.ORGANIZATION_NOT_FOUND)
        const role = await this.roleManagementService.readRoleById(roleId, queryRunner)
        if (!role) throw new InternalFlowiseError(StatusCodes.NOT_FOUND, 'Role Not Found')
        const ownerRole = await this.roleManagementService.readGeneralRoleByName(GeneralRole.OWNER, queryRunner)

        const orgUsers = await queryRunner.manager
            .createQueryBuilder(OrganizationUser, 'organizationUser')
            .innerJoinAndSelect('organizationUser.role', 'role')
            .innerJoinAndSelect('organizationUser.user', 'user')
            .where('organizationUser.organizationId = :organizationId', { organizationId })
            .andWhere('organizationUser.roleId = :roleId', { roleId })
            .getMany()

        return orgUsers.map((organizationUser) => {
            delete (organizationUser.user as any).credential
            delete (organizationUser.user as any).tempToken
            delete (organizationUser.user as any).tokenExpiry
            return {
                ...organizationUser,
                isOrgOwner: organizationUser.roleId === ownerRole?.id
            }
        })
    }

    public async readOrganizationUserByUserId(userId: string | undefined, queryRunner: QueryRunner) {
        const user = await this.readUserById(userId, queryRunner)
        if (!user) throw new InternalFlowiseError(StatusCodes.NOT_FOUND, UserManagementErrorMessage.USER_NOT_FOUND)

        const organizationUsers = await queryRunner.manager
            .createQueryBuilder(OrganizationUser, 'organizationUser')
            .innerJoinAndSelect('organizationUser.organization', 'organization')
            .innerJoinAndSelect('organizationUser.role', 'role')
            .where('organizationUser.userId = :userId', { userId })
            .getMany()

        return organizationUsers
    }

    public async readOrgUsersCountByOrgId(organizationId: string | undefined) {
        const queryRunner = this.dataSource.createQueryRunner()
        try {
            await queryRunner.connect()
            const organization = await this.readOrganizationById(organizationId, queryRunner)
            if (!organization) throw new InternalFlowiseError(StatusCodes.NOT_FOUND, UserManagementErrorMessage.ORGANIZATION_NOT_FOUND)

            return await queryRunner.manager.count(OrganizationUser, {
                where: {
                    organizationId: organizationId
                }
            })
        } finally {
            await queryRunner.release()
        }
    }

    public async createOrganizationUser(data: Partial<OrganizationUser>) {
        const queryRunner = this.dataSource.createQueryRunner()
        await queryRunner.connect()

        try {
            await queryRunner.startTransaction()

            const organization = await this.readOrganizationById(data.organizationId, queryRunner)
            if (!organization) throw new InternalFlowiseError(StatusCodes.NOT_FOUND, UserManagementErrorMessage.ORGANIZATION_NOT_FOUND)

            const user = await this.readUserById(data.userId, queryRunner)
            if (!user) throw new InternalFlowiseError(StatusCodes.NOT_FOUND, UserManagementErrorMessage.USER_NOT_FOUND)

            const role = await this.roleManagementService.readRoleById(data.roleId, queryRunner)
            if (!role) throw new InternalFlowiseError(StatusCodes.NOT_FOUND, 'Role Not Found')

            const existingOrgUser = await queryRunner.manager.findOne(OrganizationUser, {
                where: {
                    organizationId: data.organizationId,
                    userId: data.userId
                }
            })

            if (existingOrgUser) {
                throw new InternalFlowiseError(StatusCodes.CONFLICT, UserManagementErrorMessage.ORGANIZATION_USER_ALREADY_EXISTS)
            }

            this.validateOrganizationUserStatus(data.status)

            const newOrganizationUser = queryRunner.manager.create(OrganizationUser, data)
            const savedOrganizationUser = await queryRunner.manager.save(OrganizationUser, newOrganizationUser)

            await queryRunner.commitTransaction()

            return savedOrganizationUser
        } catch (error) {
            await queryRunner.rollbackTransaction()
            throw error
        } finally {
            await queryRunner.release()
        }
    }

    public async updateOrganizationUser(data: Partial<OrganizationUser>) {
        const queryRunner = this.dataSource.createQueryRunner()
        await queryRunner.connect()

        try {
            await queryRunner.startTransaction()

            const existingOrgUser = await queryRunner.manager.findOne(OrganizationUser, {
                where: {
                    organizationId: data.organizationId,
                    userId: data.userId
                }
            })

            if (!existingOrgUser) {
                throw new InternalFlowiseError(StatusCodes.NOT_FOUND, UserManagementErrorMessage.ORGANIZATION_USER_NOT_FOUND)
            }

            if (data.roleId) {
                const role = await this.roleManagementService.readRoleById(data.roleId, queryRunner)
                if (!role) throw new InternalFlowiseError(StatusCodes.NOT_FOUND, 'Role Not Found')
            }

            if (data.status) {
                this.validateOrganizationUserStatus(data.status)
            }

            const updatedOrgUser = queryRunner.manager.merge(OrganizationUser, existingOrgUser, data)
            const savedOrgUser = await queryRunner.manager.save(OrganizationUser, updatedOrgUser)

            await queryRunner.commitTransaction()

            return savedOrgUser
        } catch (error) {
            await queryRunner.rollbackTransaction()
            throw error
        } finally {
            await queryRunner.release()
        }
    }

    public async deleteOrganizationUser(organizationId: string | undefined, userId: string | undefined) {
        const queryRunner = this.dataSource.createQueryRunner()
        try {
            await queryRunner.connect()
            await queryRunner.startTransaction()

            // Validate organization exists
            const organization = await this.readOrganizationById(organizationId, queryRunner)
            if (!organization) {
                throw new InternalFlowiseError(StatusCodes.NOT_FOUND, UserManagementErrorMessage.ORGANIZATION_NOT_FOUND)
            }

            // Validate organization user exists
            const existingOrgUser = await queryRunner.manager.findOne(OrganizationUser, {
                where: {
                    organizationId: organizationId,
                    userId: userId
                },
                relations: ['role']
            })

            if (!existingOrgUser) {
                throw new InternalFlowiseError(StatusCodes.NOT_FOUND, UserManagementErrorMessage.ORGANIZATION_USER_NOT_FOUND)
            }

            // Check if user is organization owner
            const role = await this.roleManagementService.readRoleById(existingOrgUser.roleId, queryRunner)
            if (!role) {
                throw new InternalFlowiseError(StatusCodes.NOT_FOUND, 'Role Not Found')
            }
            if (role.name === GeneralRole.OWNER) {
                throw new InternalFlowiseError(StatusCodes.BAD_REQUEST, GeneralErrorMessage.NOT_ALLOWED_TO_DELETE_OWNER)
            }

            // Get the user to deactivate
            const user = await this.readUserById(userId, queryRunner)
            if (!user) {
                throw new InternalFlowiseError(StatusCodes.NOT_FOUND, UserManagementErrorMessage.USER_NOT_FOUND)
            }

            // Get personal workspace role to exclude from deletion
            const rolePersonalWorkspace = await this.roleManagementService.readGeneralRoleByName(GeneralRole.PERSONAL_WORKSPACE, queryRunner)
            
            // Find user's personal workspace in this organization
            const personalWorkspaceUser = await queryRunner.manager.findOne(WorkspaceUser, {
                where: {
                    userId: userId,
                    roleId: rolePersonalWorkspace?.id || ''
                },
                relations: ['workspace']
            })

            // Get all workspaces in this organization
            const organizationWorkspaces = await queryRunner.manager.findBy(Workspace, { organizationId })
            
            // Build array of workspace users to delete (excluding personal workspace - will be deleted entirely)
            const workspaceUserToDelete = organizationWorkspaces
                .filter((ws) => personalWorkspaceUser?.workspaceId !== ws.id) // Exclude personal workspace from this list
                .map((organizationWorkspace) => ({
                    workspaceId: organizationWorkspace.id,
                    userId: userId
                }))

            // Remove user from team workspaces (not personal workspace)
            if (workspaceUserToDelete.length > 0) {
                await queryRunner.manager.delete(WorkspaceUser, workspaceUserToDelete)
            }

            // Delete the personal workspace entirely (including all its data)
            if (personalWorkspaceUser?.workspaceId) {
                // Use workspace management service to properly delete the workspace and all related data
                const { WorkspaceManagementService } = require('../workspace-management')
                const workspaceManagementService = new WorkspaceManagementService()
                await workspaceManagementService.deleteWorkspaceById(queryRunner, personalWorkspaceUser.workspaceId)
            }

            // Remove the organization user relationship
            await queryRunner.manager.delete(OrganizationUser, {
                organizationId: organizationId,
                userId: userId
            })

            // Mark user as deleted (deactivate) instead of physically removing
            // This preserves data integrity and audit trails
            user.status = UserStatus.DELETED
            user.updatedBy = userId || user.id // Track who initiated the deletion
            await queryRunner.manager.save(User, user)

            await queryRunner.commitTransaction()

            return { message: 'User has been deactivated successfully' }
        } catch (error) {
            if (queryRunner.isTransactionActive) await queryRunner.rollbackTransaction()
            throw error
        } finally {
            if (!queryRunner.isReleased) await queryRunner.release()
        }
    }
}
