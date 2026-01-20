/**
 * Custom RBAC - User Management Controller
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
import { UserManagementService } from '../../services/user-management'
import { WorkspaceUserManagementService } from '../../services/workspace-user-management'

type OrganizationUserQuery = Partial<Pick<OrganizationUser, 'organizationId' | 'userId' | 'roleId'>>

const createOrganizationUser = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userManagementService = new UserManagementService()
        const newOrganizationUser = await userManagementService.createOrganizationUser(req.body)
        return res.status(StatusCodes.CREATED).json(newOrganizationUser)
    } catch (error) {
        next(error)
    }
}

const readOrganizationUsers = async (req: Request, res: Response, next: NextFunction) => {
    let queryRunner
    try {
        queryRunner = getRunningExpressApp().AppDataSource.createQueryRunner()
        await queryRunner.connect()
        const query = req.query as OrganizationUserQuery
        const userManagementService = new UserManagementService()

        let organizationUser
        if (query.organizationId && query.userId) {
            organizationUser = await userManagementService.readOrganizationUserByOrganizationIdUserId(
                query.organizationId,
                query.userId,
                queryRunner
            )
        } else if (query.organizationId && query.roleId) {
            organizationUser = await userManagementService.readOrganizationUserByOrganizationIdRoleId(
                query.organizationId,
                query.roleId,
                queryRunner
            )
        } else if (query.organizationId) {
            organizationUser = await userManagementService.readOrganizationUserByOrganizationId(query.organizationId, queryRunner)
        } else if (query.userId) {
            organizationUser = await userManagementService.readOrganizationUserByUserId(query.userId, queryRunner)
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

const updateOrganizationUser = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userManagementService = new UserManagementService()
        const organizationUser = await userManagementService.updateOrganizationUser(req.body)
        return res.status(StatusCodes.OK).json(organizationUser)
    } catch (error) {
        next(error)
    }
}

const deleteOrganizationUser = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const query = req.query as Partial<OrganizationUser>
        if (!query.organizationId) {
            throw new InternalFlowiseError(StatusCodes.BAD_REQUEST, 'Organization ID is required')
        }
        if (!query.userId) {
            throw new InternalFlowiseError(StatusCodes.BAD_REQUEST, 'User ID is required')
        }
        const userManagementService = new UserManagementService()
        const result = await userManagementService.deleteOrganizationUser(query.organizationId, query.userId)
        return res.status(StatusCodes.OK).json(result)
    } catch (error) {
        next(error)
    }
}

const getWorkspacesByOrganizationIdUserId = async (req: Request, res: Response, next: NextFunction) => {
    let queryRunner
    try {
        queryRunner = getRunningExpressApp().AppDataSource.createQueryRunner()
        await queryRunner.connect()
        
        const { organizationId, userId } = req.query as { organizationId: string; userId: string }
        
        if (!organizationId) {
            throw new InternalFlowiseError(StatusCodes.BAD_REQUEST, 'Organization ID is required')
        }
        if (!userId) {
            throw new InternalFlowiseError(StatusCodes.BAD_REQUEST, 'User ID is required')
        }
        
        const workspaceUserManagementService = new WorkspaceUserManagementService()
        const workspaceUsers = await workspaceUserManagementService.readWorkspaceUserByOrganizationIdUserId(
            organizationId,
            userId,
            queryRunner
        )
        
        return res.status(StatusCodes.OK).json(workspaceUsers)
    } catch (error) {
        next(error)
    } finally {
        if (queryRunner) await queryRunner.release()
    }
}

const deleteWorkspaceUser = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { workspaceId, userId } = req.query as { workspaceId: string; userId: string }
        
        if (!workspaceId) {
            throw new InternalFlowiseError(StatusCodes.BAD_REQUEST, 'Workspace ID is required')
        }
        if (!userId) {
            throw new InternalFlowiseError(StatusCodes.BAD_REQUEST, 'User ID is required')
        }
        
        const workspaceUserManagementService = new WorkspaceUserManagementService()
        await workspaceUserManagementService.deleteWorkspaceUser(workspaceId, userId)
        
        return res.status(StatusCodes.OK).json({ message: 'Workspace user deleted successfully' })
    } catch (error) {
        next(error)
    }
}

export default {
    createOrganizationUser,
    readOrganizationUsers,
    updateOrganizationUser,
    deleteOrganizationUser,
    getWorkspacesByOrganizationIdUserId,
    deleteWorkspaceUser
}
