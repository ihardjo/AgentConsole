/**
 * Custom RBAC - Organization User Management Service
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
import { OrganizationUser, OrganizationUserStatus } from '../../entities/organization-user.entity'
import { Organization } from '../../entities/organization.entity'
import { GeneralRole } from '../../entities/role.entity'
import { User } from '../../entities/user.entity'
import { isInvalidUUID } from '../../utils/validation.util'

export const enum OrganizationUserManagementErrorMessage {
    INVALID_ORGANIZATION_USER_STATUS = 'Invalid Organization User Status',
    ORGANIZATION_USER_ALREADY_EXISTS = 'Organization User Already Exists',
    ORGANIZATION_USER_NOT_FOUND = 'Organization User Not Found',
    INVALID_USER_ID = 'Invalid User Id',
    USER_NOT_FOUND = 'User Not Found',
    INVALID_ORGANIZATION_ID = 'Invalid Organization Id',
    ORGANIZATION_NOT_FOUND = 'Organization Not Found'
}

export class OrganizationUserManagementService {
    private dataSource: DataSource
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private _roleManagementService: any = null
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private _userManagementService: any = null

    constructor() {
        const appServer = getRunningExpressApp()
        this.dataSource = appServer.AppDataSource
    }

    // Lazy initialization to avoid circular dependency
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private get roleManagementService(): any {
        if (!this._roleManagementService) {
            const { RoleManagementService } = require('../role-management')
            this._roleManagementService = new RoleManagementService()
        }
        return this._roleManagementService
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private get userManagementService(): any {
        if (!this._userManagementService) {
            const { UserManagementService } = require('../user-management')
            this._userManagementService = new UserManagementService()
        }
        return this._userManagementService
    }

    private validateUserId(id: string | undefined) {
        if (isInvalidUUID(id)) throw new InternalFlowiseError(StatusCodes.BAD_REQUEST, OrganizationUserManagementErrorMessage.INVALID_USER_ID)
    }

    private async readUserById(id: string | undefined, queryRunner: QueryRunner) {
        this.validateUserId(id)
        return await queryRunner.manager.findOneBy(User, { id })
    }

    private validateOrganizationId(id: string | undefined) {
        if (isInvalidUUID(id))
            throw new InternalFlowiseError(StatusCodes.BAD_REQUEST, OrganizationUserManagementErrorMessage.INVALID_ORGANIZATION_ID)
    }

    private async readOrganizationById(id: string | undefined, queryRunner: QueryRunner) {
        this.validateOrganizationId(id)
        return await queryRunner.manager.findOneBy(Organization, { id })
    }

    public validateOrganizationUserStatus(status: string | undefined) {
        if (status && !Object.values(OrganizationUserStatus).includes(status as OrganizationUserStatus))
            throw new InternalFlowiseError(StatusCodes.BAD_REQUEST, OrganizationUserManagementErrorMessage.INVALID_ORGANIZATION_USER_STATUS)
    }

    public async readOrganizationUserByOrganizationIdUserId(
        organizationId: string | undefined,
        userId: string | undefined,
        queryRunner: QueryRunner
    ) {
        const organization = await this.readOrganizationById(organizationId, queryRunner)
        if (!organization) throw new InternalFlowiseError(StatusCodes.NOT_FOUND, OrganizationUserManagementErrorMessage.ORGANIZATION_NOT_FOUND)
        const user = await this.readUserById(userId, queryRunner)
        if (!user) throw new InternalFlowiseError(StatusCodes.NOT_FOUND, OrganizationUserManagementErrorMessage.USER_NOT_FOUND)
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

    public async readOrganizationUserByUserId(userId: string | undefined, queryRunner: QueryRunner) {
        const user = await this.readUserById(userId, queryRunner)
        if (!user) throw new InternalFlowiseError(StatusCodes.NOT_FOUND, OrganizationUserManagementErrorMessage.USER_NOT_FOUND)

        const organizationUsers = await queryRunner.manager
            .createQueryBuilder(OrganizationUser, 'organizationUser')
            .innerJoinAndSelect('organizationUser.organization', 'organization')
            .innerJoinAndSelect('organizationUser.role', 'role')
            .where('organizationUser.userId = :userId', { userId })
            .getMany()

        return organizationUsers
    }

    public async readOrgUsersCountByOrgId(organizationId: string): Promise<number> {
        try {
            const appServer = getRunningExpressApp()
            const dbResponse = await appServer.AppDataSource.getRepository(OrganizationUser).countBy({
                organizationId
            })
            return dbResponse
        } catch (error) {
            throw new InternalFlowiseError(StatusCodes.BAD_REQUEST, OrganizationUserManagementErrorMessage.ORGANIZATION_USER_NOT_FOUND)
        }
    }

    public async readOrganizationUserByWorkspaceIdUserId(
        workspaceId: string | undefined,
        userId: string | undefined,
        queryRunner: QueryRunner
    ) {
        const user = await this.readUserById(userId, queryRunner)
        if (!user) throw new InternalFlowiseError(StatusCodes.NOT_FOUND, OrganizationUserManagementErrorMessage.USER_NOT_FOUND)

        const organizationUser = await queryRunner.manager
            .createQueryBuilder(OrganizationUser, 'organizationUser')
            .innerJoinAndSelect('organizationUser.organization', 'organization')
            .innerJoinAndSelect('organizationUser.role', 'role')
            .innerJoin('organization.workspaces', 'workspace')
            .where('workspace.id = :workspaceId', { workspaceId })
            .andWhere('organizationUser.userId = :userId', { userId })
            .getOne()

        return {
            organizationUser
        }
    }

    public async updateOrganizationUser(newOrganizationUser: Partial<OrganizationUser>, queryRunner: QueryRunner) {
        const { organizationUser } = await this.readOrganizationUserByOrganizationIdUserId(
            newOrganizationUser.organizationId,
            newOrganizationUser.userId,
            queryRunner
        )
        if (!organizationUser) 
            throw new InternalFlowiseError(StatusCodes.NOT_FOUND, OrganizationUserManagementErrorMessage.ORGANIZATION_USER_NOT_FOUND)
        
        if (newOrganizationUser.status) this.validateOrganizationUserStatus(newOrganizationUser.status)
        newOrganizationUser.createdBy = organizationUser.createdBy

        let updatedOrganizationUser = queryRunner.manager.merge(OrganizationUser, organizationUser, newOrganizationUser)
        updatedOrganizationUser = await this.saveOrganizationUser(updatedOrganizationUser, queryRunner)

        return updatedOrganizationUser
    }

    public createNewOrganizationUser(data: Partial<OrganizationUser>, queryRunner: QueryRunner) {
        if (data.status) this.validateOrganizationUserStatus(data.status)
        data.updatedBy = data.createdBy
        return queryRunner.manager.create(OrganizationUser, data)
    }

    public async saveOrganizationUser(data: Partial<OrganizationUser>, queryRunner: QueryRunner) {
        return await queryRunner.manager.save(OrganizationUser, data)
    }
}
