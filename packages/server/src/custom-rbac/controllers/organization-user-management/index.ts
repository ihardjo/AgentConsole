/**
 * Custom RBAC - Organization User Management Controller
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
import { InternalFlowiseError } from '../../../errors/internalFlowiseError'
import { GeneralErrorMessage } from '../../../utils/constants'
import { getRunningExpressApp } from '../../../utils/getRunningExpressApp'
import { OrganizationUser } from '../../entities/organization-user.entity'
import { OrganizationUserManagementService } from '../../services/organization-user-management'

type OrganizationUserQuery = Partial<Pick<OrganizationUser, 'organizationId' | 'userId'>>

const readOrganizationUsers = async (req: Request, res: Response, next: NextFunction) => {
    let queryRunner
    try {
        queryRunner = getRunningExpressApp().AppDataSource.createQueryRunner()
        await queryRunner.connect()
        const query = req.query as OrganizationUserQuery
        const organizationUserManagementService = new OrganizationUserManagementService()

        let organizationUser
        if (query.organizationId && query.userId) {
            organizationUser = await organizationUserManagementService.readOrganizationUserByOrganizationIdUserId(
                query.organizationId,
                query.userId,
                queryRunner
            )
        } else if (query.userId) {
            organizationUser = await organizationUserManagementService.readOrganizationUserByUserId(query.userId, queryRunner)
        } else {
            throw new InternalFlowiseError(StatusCodes.BAD_REQUEST, GeneralErrorMessage.UNHANDLED_EDGE_CASE)
        }

        return res.status(StatusCodes.OK).json(organizationUser)
    } catch (error) {
        next(error)
    } finally {
        if (queryRunner) await queryRunner.release()
    }
}

const getOrgUsersCount = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { organizationId } = req.query as { organizationId: string }
        if (!organizationId) {
            throw new InternalFlowiseError(StatusCodes.BAD_REQUEST, 'Organization ID is required')
        }

        const organizationUserManagementService = new OrganizationUserManagementService()
        const count = await organizationUserManagementService.readOrgUsersCountByOrgId(organizationId)

        return res.status(StatusCodes.OK).json({ count })
    } catch (error) {
        next(error)
    }
}

export default {
    readOrganizationUsers,
    getOrgUsersCount
}
