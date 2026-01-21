/**
 * Custom RBAC - Organization Management Service
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
import { generateId } from '../../../utils'
import { Organization, OrganizationName } from '../../entities/organization.entity'
import { isInvalidName, isInvalidUUID } from '../../utils/validation.util'

export const enum OrganizationManagementErrorMessage {
    INVALID_ORGANIZATION_ID = 'Invalid Organization Id',
    INVALID_ORGANIZATION_NAME = 'Invalid Organization Name',
    ORGANIZATION_NOT_FOUND = 'Organization Not Found',
    ORGANIZATION_FOUND_MULTIPLE = 'Organization Found Multiple',
    ORGANIZATION_RESERVED_NAME = 'Organization name cannot be Default Organization - this is a reserved name'
}

export class OrganizationManagementService {
    private dataSource: DataSource

    constructor() {
        const appServer = getRunningExpressApp()
        this.dataSource = appServer.AppDataSource
    }

    public validateOrganizationId(id: string | undefined) {
        if (isInvalidUUID(id))
            throw new InternalFlowiseError(StatusCodes.BAD_REQUEST, OrganizationManagementErrorMessage.INVALID_ORGANIZATION_ID)
    }

    public validateOrganizationName(name: string | undefined, isRegister: boolean = false) {
        if (isInvalidName(name))
            throw new InternalFlowiseError(StatusCodes.BAD_REQUEST, OrganizationManagementErrorMessage.INVALID_ORGANIZATION_NAME)
        if (!isRegister && name === OrganizationName.DEFAULT_ORGANIZATION) {
            throw new InternalFlowiseError(StatusCodes.BAD_REQUEST, OrganizationManagementErrorMessage.ORGANIZATION_RESERVED_NAME)
        }
    }

    public async readOrganizationById(id: string | undefined, queryRunner: QueryRunner) {
        this.validateOrganizationId(id)
        return await queryRunner.manager.findOneBy(Organization, { id })
    }

    public async readOrganizationByName(name: string | undefined, queryRunner: QueryRunner) {
        this.validateOrganizationName(name)
        return await queryRunner.manager.findOneBy(Organization, { name })
    }

    public async countOrganizations(queryRunner: QueryRunner) {
        return await queryRunner.manager.count(Organization)
    }

    public async readOrganization(queryRunner: QueryRunner) {
        return await queryRunner.manager.find(Organization)
    }

    public createNewOrganization(data: Partial<Organization>, queryRunner: QueryRunner, isRegister: boolean = false) {
        this.validateOrganizationName(data.name, isRegister)
        data.updatedBy = data.createdBy
        data.id = generateId()

        return queryRunner.manager.create(Organization, data)
    }

    public async saveOrganization(data: Partial<Organization>, queryRunner: QueryRunner) {
        return await queryRunner.manager.save(Organization, data)
    }

    public async createOrganization(data: Partial<Organization>, creatorUserId?: string) {
        const queryRunner = this.dataSource.createQueryRunner()
        await queryRunner.connect()

        let newOrganization = this.createNewOrganization(data, queryRunner)
        try {
            await queryRunner.startTransaction()
            newOrganization = await this.saveOrganization(newOrganization, queryRunner)
            await queryRunner.commitTransaction()
        } catch (error) {
            await queryRunner.rollbackTransaction()
            throw error
        } finally {
            await queryRunner.release()
        }

        return newOrganization
    }

    public async updateOrganization(newOrganizationData: Partial<Organization>) {
        const queryRunner = this.dataSource.createQueryRunner()
        await queryRunner.connect()

        const oldOrganizationData = await this.readOrganizationById(newOrganizationData.id, queryRunner)
        if (!oldOrganizationData)
            throw new InternalFlowiseError(StatusCodes.NOT_FOUND, OrganizationManagementErrorMessage.ORGANIZATION_NOT_FOUND)
        
        if (newOrganizationData.name) {
            this.validateOrganizationName(newOrganizationData.name)
        }
        newOrganizationData.createdBy = oldOrganizationData.createdBy

        let updateOrganization = queryRunner.manager.merge(Organization, oldOrganizationData, newOrganizationData)
        try {
            await queryRunner.startTransaction()
            await this.saveOrganization(updateOrganization, queryRunner)
            await queryRunner.commitTransaction()
        } catch (error) {
            await queryRunner.rollbackTransaction()
            throw error
        } finally {
            await queryRunner.release()
        }

        return updateOrganization
    }
}
