/**
 * Custom RBAC - Organization Management Controller
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

import { NextFunction, Request, Response } from 'express'
import { StatusCodes } from 'http-status-codes'
import { getRunningExpressApp } from '../../../utils/getRunningExpressApp'
import { Organization } from '../../entities/organization.entity'
import { OrganizationManagementService } from '../../services/organization-management'

type OrganizationQuery = Partial<Pick<Organization, 'id'>>

const readOrganizations = async (req: Request, res: Response, next: NextFunction) => {
    let queryRunner
    try {
        queryRunner = getRunningExpressApp().AppDataSource.createQueryRunner()
        await queryRunner.connect()
        const query = req.query as OrganizationQuery
        const organizationManagementService = new OrganizationManagementService()

        let organization
        if (query.id) {
            organization = await organizationManagementService.readOrganizationById(query.id, queryRunner)
        } else {
            organization = await organizationManagementService.readOrganization(queryRunner)
        }

        return res.status(StatusCodes.OK).json(organization)
    } catch (error) {
        next(error)
    } finally {
        if (queryRunner) await queryRunner.release()
    }
}

export default {
    readOrganizations
}
