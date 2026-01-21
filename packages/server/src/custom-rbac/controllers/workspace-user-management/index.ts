/**
 * Custom RBAC - Workspace User Controller
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
import { WorkspaceUser } from '../../entities/workspace-user.entity'
import { WorkspaceUserManagementService } from '../../services/workspace-user-management'

type WorkspaceUserQuery = Partial<WorkspaceUser & { organizationId: string | undefined }>

const createWorkspaceUser = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const workspaceUserService = new WorkspaceUserManagementService()
        const newWorkspaceUser = await workspaceUserService.createWorkspace(req.body)
        return res.status(StatusCodes.CREATED).json(newWorkspaceUser)
    } catch (error) {
        next(error)
    }
}

const readWorkspaceUsers = async (req: Request, res: Response, next: NextFunction) => {
    let queryRunner
    try {
        queryRunner = getRunningExpressApp().AppDataSource.createQueryRunner()
        await queryRunner.connect()
        const query = req.query as WorkspaceUserQuery
        const workspaceUserService = new WorkspaceUserManagementService()

        let workspaceUser: any
        if (query.workspaceId && query.userId) {
            workspaceUser = await workspaceUserService.readWorkspaceUserByWorkspaceIdUserId(
                query.workspaceId,
                query.userId,
                queryRunner
            )
        } else if (query.workspaceId) {
            workspaceUser = await workspaceUserService.readWorkspaceUserByWorkspaceId(query.workspaceId, queryRunner)
        } else if (query.organizationId && query.userId) {
            workspaceUser = await workspaceUserService.readWorkspaceUserByOrganizationIdUserId(
                query.organizationId,
                query.userId,
                queryRunner
            )
        } else if (query.userId) {
            workspaceUser = await workspaceUserService.readWorkspaceUserByUserId(query.userId, queryRunner)
        } else if (query.roleId) {
            workspaceUser = await workspaceUserService.readWorkspaceUserByRoleId(query.roleId, queryRunner)
        } else {
            throw new InternalFlowiseError(StatusCodes.BAD_REQUEST, GeneralErrorMessage.UNHANDLED_EDGE_CASE)
        }

        return res.status(StatusCodes.OK).json(workspaceUser)
    } catch (error) {
        next(error)
    } finally {
        if (queryRunner) await queryRunner.release()
    }
}

const updateWorkspaceUser = async (req: Request, res: Response, next: NextFunction) => {
    let queryRunner
    try {
        queryRunner = getRunningExpressApp().AppDataSource.createQueryRunner()
        await queryRunner.connect()
        const workspaceUserService = new WorkspaceUserManagementService()
        const workspaceUser = await workspaceUserService.updateWorkspaceUser(req.body, queryRunner)
        return res.status(StatusCodes.OK).json(workspaceUser)
    } catch (error) {
        if (queryRunner && queryRunner.isTransactionActive) await queryRunner.rollbackTransaction()
        next(error)
    } finally {
        if (queryRunner && !queryRunner.isReleased) await queryRunner.release()
    }
}

const deleteWorkspaceUser = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const query = req.query as Partial<WorkspaceUser>
        const workspaceUserService = new WorkspaceUserManagementService()
        const result = await workspaceUserService.deleteWorkspaceUser(query.workspaceId, query.userId)
        return res.status(StatusCodes.OK).json(result)
    } catch (error) {
        next(error)
    }
}

export default {
    createWorkspaceUser,
    readWorkspaceUsers,
    updateWorkspaceUser,
    deleteWorkspaceUser
}
