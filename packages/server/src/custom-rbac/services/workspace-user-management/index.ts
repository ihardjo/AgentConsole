/**
 * Custom RBAC - Workspace User Management Service
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
import { DataSource, QueryRunner } from 'typeorm'
import { InternalFlowiseError } from '../../../errors/internalFlowiseError'
import { getRunningExpressApp } from '../../../utils/getRunningExpressApp'
import { WorkspaceUser, WorkspaceUserStatus } from '../../entities/workspace-user.entity'
import { Workspace } from '../../entities/workspace.entity'
import { User } from '../../entities/user.entity'
import { GeneralRole } from '../../entities/role.entity'
import { isInvalidUUID } from '../../utils/validation.util'

export const enum WorkspaceUserManagementErrorMessage {
    INVALID_WORKSPACE_USER_STATUS = 'Invalid Workspace User Status',
    WORKSPACE_USER_ALREADY_EXISTS = 'Workspace User Already Exists',
    WORKSPACE_USER_NOT_FOUND = 'Workspace User Not Found',
    INVALID_USER_ID = 'Invalid User Id',
    USER_NOT_FOUND = 'User Not Found',
    INVALID_WORKSPACE_ID = 'Invalid Workspace Id',
    WORKSPACE_NOT_FOUND = 'Workspace Not Found'
}

export class WorkspaceUserManagementService {
    private dataSource: DataSource
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private _workspaceService: any = null
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private _roleService: any = null
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private _userService: any = null
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private _organizationService: any = null

    constructor() {
        const appServer = getRunningExpressApp()
        this.dataSource = appServer.AppDataSource
    }

    // Lazy initialization to avoid circular dependency
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private get workspaceService(): any {
        if (!this._workspaceService) {
            const { WorkspaceManagementService } = require('../workspace-management')
            this._workspaceService = new WorkspaceManagementService()
        }
        return this._workspaceService
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private get roleService(): any {
        if (!this._roleService) {
            const { RoleManagementService } = require('../role-management')
            this._roleService = new RoleManagementService()
        }
        return this._roleService
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private get userService(): any {
        if (!this._userService) {
            const { UserManagementService } = require('../user-management')
            this._userService = new UserManagementService()
        }
        return this._userService
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private get organizationService(): any {
        if (!this._organizationService) {
            const { OrganizationManagementService } = require('../organization-management')
            this._organizationService = new OrganizationManagementService()
        }
        return this._organizationService
    }

    private validateUserId(id: string | undefined) {
        if (isInvalidUUID(id)) throw new InternalFlowiseError(StatusCodes.BAD_REQUEST, WorkspaceUserManagementErrorMessage.INVALID_USER_ID)
    }

    private async readUserById(id: string | undefined, queryRunner: QueryRunner) {
        this.validateUserId(id)
        return await queryRunner.manager.findOneBy(User, { id })
    }

    private validateWorkspaceId(id: string | undefined) {
        if (isInvalidUUID(id))
            throw new InternalFlowiseError(StatusCodes.BAD_REQUEST, WorkspaceUserManagementErrorMessage.INVALID_WORKSPACE_ID)
    }

    private async readWorkspaceById(id: string | undefined, queryRunner: QueryRunner) {
        this.validateWorkspaceId(id)
        return await queryRunner.manager.findOneBy(Workspace, { id })
    }

    public validateWorkspaceUserStatus(status: string | undefined) {
        if (status && !Object.values(WorkspaceUserStatus).includes(status as WorkspaceUserStatus))
            throw new InternalFlowiseError(StatusCodes.BAD_REQUEST, WorkspaceUserManagementErrorMessage.INVALID_WORKSPACE_USER_STATUS)
    }

    public async readWorkspaceUserByOrganizationIdUserId(
        organizationId: string | undefined,
        userId: string | undefined,
        queryRunner: QueryRunner
    ) {
        const user = await this.readUserById(userId, queryRunner)
        if (!user) throw new InternalFlowiseError(StatusCodes.NOT_FOUND, WorkspaceUserManagementErrorMessage.USER_NOT_FOUND)

        return await queryRunner.manager
            .createQueryBuilder(WorkspaceUser, 'workspaceUser')
            .innerJoinAndSelect('workspaceUser.workspace', 'workspace')
            .innerJoinAndSelect('workspace.organization', 'organization')
            .innerJoinAndSelect('workspaceUser.role', 'role')
            .where('workspace.organizationId = :organizationId', { organizationId })
            .andWhere('workspaceUser.userId = :userId', { userId })
            .getMany()
    }

    public async readWorkspaceUserByLastLogin(userId: string | undefined, queryRunner: QueryRunner) {
        const user = await this.readUserById(userId, queryRunner)
        if (!user) throw new InternalFlowiseError(StatusCodes.NOT_FOUND, WorkspaceUserManagementErrorMessage.USER_NOT_FOUND)

        const workspaceUser = await queryRunner.manager
            .createQueryBuilder(WorkspaceUser, 'workspaceUser')
            .innerJoinAndSelect('workspaceUser.workspace', 'workspace')
            .innerJoinAndSelect('workspaceUser.role', 'role')
            .where('workspaceUser.userId = :userId', { userId })
            .orderBy('workspaceUser.lastLogin', 'DESC')
            .getMany()

        if (!workspaceUser || workspaceUser.length === 0)
            throw new InternalFlowiseError(StatusCodes.NOT_FOUND, WorkspaceUserManagementErrorMessage.WORKSPACE_USER_NOT_FOUND)

        return workspaceUser
    }

    public async readWorkspaceUserByUserId(userId: string | undefined, queryRunner: QueryRunner) {
        const user = await this.readUserById(userId, queryRunner)
        if (!user) throw new InternalFlowiseError(StatusCodes.NOT_FOUND, WorkspaceUserManagementErrorMessage.USER_NOT_FOUND)

        const workspaceUsers = await queryRunner.manager
            .createQueryBuilder(WorkspaceUser, 'workspaceUser')
            .innerJoinAndSelect('workspaceUser.workspace', 'workspace')
            .innerJoinAndSelect('workspaceUser.role', 'role')
            .where('workspaceUser.userId = :userId', { userId })
            .getMany()

        return workspaceUsers
    }

    public async readWorkspaceUserByRoleId(roleId: string | undefined, queryRunner: QueryRunner) {
        const role = await this.roleService.readRoleById(roleId, queryRunner)
        if (!role) throw new InternalFlowiseError(StatusCodes.NOT_FOUND, 'Role not found')
        const ownerRole = await this.roleService.readGeneralRoleByName(GeneralRole.OWNER, queryRunner)

        const workspaceUsers = await queryRunner.manager
            .createQueryBuilder(WorkspaceUser, 'workspaceUser')
            .innerJoinAndSelect('workspaceUser.workspace', 'workspace')
            .innerJoinAndSelect('workspaceUser.user', 'user')
            .innerJoinAndSelect('workspaceUser.role', 'role')
            .where('workspaceUser.roleId = :roleId', { roleId })
            .getMany()

        return workspaceUsers.map((workspaceUser) => {
            delete (workspaceUser.user as any).credential
            delete (workspaceUser.user as any).tempToken
            delete (workspaceUser.user as any).tokenExpiry
            return {
                ...workspaceUser,
                isOrgOwner: workspaceUser.roleId === ownerRole?.id
            }
        })
    }

    public createNewWorkspaceUser(data: Partial<WorkspaceUser>, queryRunner: QueryRunner) {
        if (data.status) this.validateWorkspaceUserStatus(data.status)
        data.updatedBy = data.createdBy
        return queryRunner.manager.create(WorkspaceUser, data)
    }

    public async saveWorkspaceUser(data: Partial<WorkspaceUser>, queryRunner: QueryRunner) {
        return await queryRunner.manager.save(WorkspaceUser, data)
    }

    public async deleteWorkspaceUser(workspaceId: string | undefined, userId: string | undefined) {
        const queryRunner = this.dataSource.createQueryRunner()
        try {
            await queryRunner.connect()
            await queryRunner.startTransaction()

            const workspaceUser = await queryRunner.manager.findOne(WorkspaceUser, {
                where: {
                    workspaceId: workspaceId,
                    userId: userId
                }
            })

            if (!workspaceUser) {
                throw new InternalFlowiseError(StatusCodes.NOT_FOUND, WorkspaceUserManagementErrorMessage.WORKSPACE_USER_NOT_FOUND)
            }

            await queryRunner.manager.delete(WorkspaceUser, {
                workspaceId: workspaceId,
                userId: userId
            })

            await queryRunner.commitTransaction()
        } catch (error) {
            if (queryRunner.isTransactionActive) await queryRunner.rollbackTransaction()
            throw error
        } finally {
            if (!queryRunner.isReleased) await queryRunner.release()
        }
    }

    public async readWorkspaceUserByWorkspaceId(workspaceId: string | undefined, queryRunner: QueryRunner) {
        const workspace = await this.workspaceService.readWorkspaceById(workspaceId, queryRunner)
        if (!workspace) throw new InternalFlowiseError(StatusCodes.NOT_FOUND, WorkspaceUserManagementErrorMessage.WORKSPACE_NOT_FOUND)
        const ownerRole = await this.roleService.readGeneralRoleByName(GeneralRole.OWNER, queryRunner)

        const workspaceUsers = await queryRunner.manager
            .createQueryBuilder(WorkspaceUser, 'workspaceUser')
            .innerJoinAndSelect('workspaceUser.role', 'role')
            .innerJoinAndSelect('workspaceUser.user', 'user')
            .where('workspaceUser.workspaceId = :workspaceId', { workspaceId })
            .getMany()

        return workspaceUsers.map((workspaceUser) => {
            delete (workspaceUser.user as any).credential
            delete (workspaceUser.user as any).tempToken
            delete (workspaceUser.user as any).tokenExpiry
            return {
                ...workspaceUser,
                isOrgOwner: workspaceUser.roleId === ownerRole?.id
            }
        })
    }

    public async readWorkspaceUserByWorkspaceIdUserId(
        workspaceId: string | undefined,
        userId: string | undefined,
        queryRunner: QueryRunner
    ) {
        const workspace = await this.workspaceService.readWorkspaceById(workspaceId, queryRunner)
        if (!workspace) throw new InternalFlowiseError(StatusCodes.NOT_FOUND, WorkspaceUserManagementErrorMessage.WORKSPACE_NOT_FOUND)
        const user = await this.readUserById(userId, queryRunner)
        if (!user) throw new InternalFlowiseError(StatusCodes.NOT_FOUND, WorkspaceUserManagementErrorMessage.USER_NOT_FOUND)

        const workspaceUser = await queryRunner.manager
            .createQueryBuilder(WorkspaceUser, 'workspaceUser')
            .innerJoinAndSelect('workspaceUser.workspace', 'workspace')
            .innerJoinAndSelect('workspaceUser.role', 'role')
            .where('workspaceUser.workspaceId = :workspaceId', { workspaceId })
            .andWhere('workspaceUser.userId = :userId', { userId })
            .getOne()

        return {
            workspace,
            workspaceUser
        }
    }

    public async updateWorkspaceUser(newWorkspaceUser: Partial<WorkspaceUser>, queryRunner: QueryRunner) {
        const { workspaceUser } = await this.readWorkspaceUserByWorkspaceIdUserId(
            newWorkspaceUser.workspaceId,
            newWorkspaceUser.userId,
            queryRunner
        )
        if (!workspaceUser) throw new InternalFlowiseError(StatusCodes.NOT_FOUND, WorkspaceUserManagementErrorMessage.WORKSPACE_USER_NOT_FOUND)
        if (newWorkspaceUser.roleId && workspaceUser.role) {
            const role = await this.roleService.readRoleById(newWorkspaceUser.roleId, queryRunner)
            if (!role) throw new InternalFlowiseError(StatusCodes.NOT_FOUND, 'Role not found')
            // check if the role is from the same organization
            if (role.organizationId !== workspaceUser.role.organizationId) {
                throw new InternalFlowiseError(StatusCodes.NOT_FOUND, 'Role not found')
            }
            // delete role, the new role will be created again, with the new roleId (newWorkspaceUser.roleId)
            if (workspaceUser.role) delete (workspaceUser as any).role
        }
        const updatedBy = await this.readUserById(newWorkspaceUser.updatedBy, queryRunner)
        if (!updatedBy) throw new InternalFlowiseError(StatusCodes.NOT_FOUND, WorkspaceUserManagementErrorMessage.USER_NOT_FOUND)
        if (newWorkspaceUser.status) this.validateWorkspaceUserStatus(newWorkspaceUser.status)
        newWorkspaceUser.createdBy = workspaceUser.createdBy

        let updatedWorkspaceUser = queryRunner.manager.merge(WorkspaceUser, workspaceUser, newWorkspaceUser)
        updatedWorkspaceUser = await this.saveWorkspaceUser(updatedWorkspaceUser, queryRunner)

        return updatedWorkspaceUser
    }

    public async createWorkspace(data: Partial<Workspace>) {
        const queryRunner = this.dataSource.createQueryRunner()
        await queryRunner.connect()

        const organization = await this.organizationService.readOrganizationById(data.organizationId, queryRunner)
        if (!organization) throw new InternalFlowiseError(StatusCodes.NOT_FOUND, 'Organization Not Found')

        const user = await this.userService.readUserById(data.createdBy, queryRunner)
        if (!user) throw new InternalFlowiseError(StatusCodes.NOT_FOUND, WorkspaceUserManagementErrorMessage.USER_NOT_FOUND)

        const OrganizationUser = (await import('../../entities/organization-user.entity')).OrganizationUser
        let organizationUser = await queryRunner.manager.findOneBy(OrganizationUser, { organizationId: organization.id, userId: user.id })
        if (!organizationUser)
            throw new InternalFlowiseError(StatusCodes.NOT_FOUND, 'Organization User Not Found')
        organizationUser.updatedBy = user.id

        let newWorkspace = this.workspaceService.createNewWorkspace(data, queryRunner)

        const { GeneralRole } = await import('../../entities/role.entity')
        const ownerRole = await this.roleService.readGeneralRoleByName(GeneralRole.OWNER, queryRunner)
        if (!ownerRole) throw new InternalFlowiseError(StatusCodes.NOT_FOUND, 'Owner role not found')

        const role = await this.roleService.readRoleById(organizationUser.roleId, queryRunner)
        if (!role) throw new InternalFlowiseError(StatusCodes.NOT_FOUND, 'Role not found')

        // Add org admin as workspace owner if the user creating the workspace is NOT the org admin
        const orgAdmin = await queryRunner.manager.findOneBy(OrganizationUser, {
            organizationId: organization.id,
            roleId: ownerRole.id
        })
        if (!orgAdmin) throw new InternalFlowiseError(StatusCodes.NOT_FOUND, 'Organization User Not Found')

        let isCreateWorkSpaceUserOrgAdmin = false
        if (orgAdmin.userId === user.id) {
            isCreateWorkSpaceUserOrgAdmin = true
        }

        const { WorkspaceUserStatus } = await import('../../entities/workspace-user.entity')
        let orgAdminUser: Partial<WorkspaceUser> = {
            workspaceId: newWorkspace.id,
            roleId: ownerRole.id,
            userId: orgAdmin.userId,
            createdBy: orgAdmin.userId,
            status: WorkspaceUserStatus.ACTIVE
        }
        if (!isCreateWorkSpaceUserOrgAdmin) orgAdminUser = this.createNewWorkspaceUser(orgAdminUser, queryRunner)

        let newWorkspaceUser: Partial<WorkspaceUser> = {
            workspaceId: newWorkspace.id,
            roleId: role.id,
            userId: user.id,
            createdBy: user.id,
            status: WorkspaceUserStatus.ACTIVE
        }
        // If user creating the workspace is an invited user, not the organization admin, inherit the role from existingWorkspaceId
        if ((data as any).existingWorkspaceId) {
            const existingWorkspaceUser = await queryRunner.manager.findOneBy(WorkspaceUser, {
                workspaceId: (data as any).existingWorkspaceId,
                userId: user.id
            })
            if (existingWorkspaceUser) {
                newWorkspaceUser.roleId = existingWorkspaceUser.roleId
            }
        }

        newWorkspaceUser = this.createNewWorkspaceUser(newWorkspaceUser, queryRunner)

        try {
            await queryRunner.startTransaction()
            newWorkspace = await this.workspaceService.saveWorkspace(newWorkspace, queryRunner)
            if (!isCreateWorkSpaceUserOrgAdmin) await this.saveWorkspaceUser(orgAdminUser, queryRunner)
            await this.saveWorkspaceUser(newWorkspaceUser, queryRunner)
            await queryRunner.manager.save(OrganizationUser, organizationUser)
            await queryRunner.commitTransaction()
        } catch (error) {
            await queryRunner.rollbackTransaction()
            throw error
        } finally {
            await queryRunner.release()
        }

        return newWorkspace
    }
}

