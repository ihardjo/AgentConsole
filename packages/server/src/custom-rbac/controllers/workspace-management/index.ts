/**
 * Custom RBAC - Workspace Management Controller
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
import { Workspace } from '../../entities/workspace.entity'
import { WorkspaceManagementService } from '../../services/workspace-management'
import { WorkspaceUserManagementService } from '../../services/workspace-user-management'
import { RoleManagementService } from '../../services/role-management'
import { GeneralRole } from '../../entities/role.entity'
import { InternalFlowiseError } from '../../../errors/internalFlowiseError'

const createWorkspace = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const workspaceUserManagementService = new WorkspaceUserManagementService()
        const newWorkspace = await workspaceUserManagementService.createWorkspace(req.body)
        return res.status(StatusCodes.CREATED).json(newWorkspace)
    } catch (error) {
        next(error)
    }
}

const readWorkspace = async (req: Request, res: Response, next: NextFunction) => {
    let queryRunner
    try {
        queryRunner = getRunningExpressApp().AppDataSource.createQueryRunner()
        await queryRunner.connect()
        const query = req.query as Partial<Workspace>
        const workspaceManagementService = new WorkspaceManagementService()

        let workspace: Workspace | Workspace[] | null | (Workspace & { userCount: number })[]
        if (query.id) {
            workspace = await workspaceManagementService.readWorkspaceById(query.id, queryRunner)
        } else if (query.organizationId) {
            workspace = await workspaceManagementService.readWorkspaceByOrganizationId(query.organizationId, queryRunner)
        } else {
            workspace = await workspaceManagementService.readWorkspaceByGeneral(queryRunner)
        }

        return res.status(StatusCodes.OK).json(workspace)
    } catch (error) {
        next(error)
    } finally {
        if (queryRunner) await queryRunner.release()
    }
}

const updateWorkspace = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const workspaceManagementService = new WorkspaceManagementService()
        const workspace = await workspaceManagementService.updateWorkspace(req.body)
        return res.status(StatusCodes.OK).json(workspace)
    } catch (error) {
        next(error)
    }
}

const deleteWorkspace = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const query = req.query as Partial<Workspace> & { organizationId?: string }
        if (!query.id) {
            throw new InternalFlowiseError(StatusCodes.BAD_REQUEST, 'Workspace ID is required')
        }
        if (!query.organizationId) {
            throw new InternalFlowiseError(StatusCodes.BAD_REQUEST, 'Organization ID is required')
        }
        const workspaceManagementService = new WorkspaceManagementService()
        const workspace = await workspaceManagementService.deleteWorkspace(query.organizationId, query.id)
        return res.status(StatusCodes.OK).json(workspace)
    } catch (error) {
        next(error)
    }
}

const readWorkspaceUsers = async (req: Request, res: Response, next: NextFunction) => {
    let queryRunner
    try {
        queryRunner = getRunningExpressApp().AppDataSource.createQueryRunner()
        await queryRunner.connect()
        const { workspaceId } = req.params
        const workspaceUserManagementService = new WorkspaceUserManagementService()
        const workspaceUsers = await workspaceUserManagementService.readWorkspaceUserByWorkspaceId(workspaceId, queryRunner)
        return res.status(StatusCodes.OK).json(workspaceUsers)
    } catch (error) {
        next(error)
    } finally {
        if (queryRunner) await queryRunner.release()
    }
}

const updateWorkspaceUserRole = async (req: Request, res: Response, next: NextFunction) => {
    let queryRunner
    try {
        queryRunner = getRunningExpressApp().AppDataSource.createQueryRunner()
        await queryRunner.connect()
        const workspaceUserManagementService = new WorkspaceUserManagementService()
        const workspaceUser = await workspaceUserManagementService.updateWorkspaceUser(req.body, queryRunner)
        return res.status(StatusCodes.OK).json(workspaceUser)
    } catch (error) {
        if (queryRunner && queryRunner.isTransactionActive) await queryRunner.rollbackTransaction()
        next(error)
    } finally {
        if (queryRunner && !queryRunner.isReleased) await queryRunner.release()
    }
}

const switchWorkspace = async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
        return next(new InternalFlowiseError(StatusCodes.UNAUTHORIZED, 'Unauthorized: User not found'))
    }
    let queryRunner
    try {
        queryRunner = getRunningExpressApp().AppDataSource.createQueryRunner()
        await queryRunner.connect()
        const { workspaceId } = req.params
        
        const workspaceManagementService = new WorkspaceManagementService()
        const workspaceUserManagementService = new WorkspaceUserManagementService()
        const roleService = new RoleManagementService()

        await queryRunner.startTransaction()

        const workspace = await workspaceManagementService.readWorkspaceById(workspaceId, queryRunner)
        if (!workspace) throw new InternalFlowiseError(StatusCodes.NOT_FOUND, 'Workspace not found')

        const { workspaceUser } = await workspaceUserManagementService.readWorkspaceUserByWorkspaceIdUserId(
            workspaceId,
            req.user.id,
            queryRunner
        )
        if (!workspaceUser) throw new InternalFlowiseError(StatusCodes.NOT_FOUND, 'Workspace user not found')

        // Get the role and permissions for the new workspace
        const role = await roleService.readRoleById(workspaceUser.roleId, queryRunner)
        if (!role) throw new InternalFlowiseError(StatusCodes.NOT_FOUND, 'Role not found')
        
        // Get owner role to check if user is org admin
        const ownerRole = await roleService.readGeneralRoleByName(GeneralRole.OWNER, queryRunner)

        // Update last login and status
        workspaceUser.lastLogin = new Date().toISOString()
        workspaceUser.status = 'active'
        workspaceUser.updatedBy = req.user.id
        await workspaceUserManagementService.saveWorkspaceUser(workspaceUser, queryRunner)

        await queryRunner.commitTransaction()

        // Parse permissions from the role
        let permissions: string[] = []
        try {
            permissions = JSON.parse(role.permissions || '[]')
        } catch (e) {
            permissions = []
        }

        // Build the response with updated user context including NEW permissions
        const loggedInUser = {
            ...req.user,
            activeOrganizationId: workspace.organizationId || req.user.activeOrganizationId,
            activeWorkspaceId: workspace.id,
            activeWorkspace: workspace.name,
            roleId: workspaceUser.roleId,
            isOrganizationAdmin: workspaceUser.roleId === ownerRole?.id,
            permissions: permissions
        }

        // Update session
        req.user = loggedInUser
        // @ts-ignore
        if (req.session && req.session.passport) {
            // @ts-ignore
            req.session.passport.user = loggedInUser
        }

        return res.status(StatusCodes.OK).json(loggedInUser)
    } catch (error) {
        if (queryRunner && queryRunner.isTransactionActive) await queryRunner.rollbackTransaction()
        next(error)
    } finally {
        if (queryRunner && !queryRunner.isReleased) await queryRunner.release()
    }
}

export default {
    createWorkspace,
    readWorkspace,
    updateWorkspace,
    deleteWorkspace,
    readWorkspaceUsers,
    updateWorkspaceUserRole,
    switchWorkspace
}
