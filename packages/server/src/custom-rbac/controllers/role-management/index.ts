/**
 * Custom RBAC - Role Management Controller
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
import { Role } from '../../entities/role.entity'
import { RoleManagementService } from '../../services/role-management'
import { InternalFlowiseError } from '../../../errors/internalFlowiseError'

const createRole = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const roleManagementService = new RoleManagementService()
        const newRole = await roleManagementService.createRole(req.body)
        return res.status(StatusCodes.CREATED).json(newRole)
    } catch (error) {
        next(error)
    }
}

const readRole = async (req: Request, res: Response, next: NextFunction) => {
    let queryRunner
    try {
        queryRunner = getRunningExpressApp().AppDataSource.createQueryRunner()
        await queryRunner.connect()
        const query = req.query as Partial<Role>
        const roleManagementService = new RoleManagementService()

        let role: Role | Role[] | null | (Role & { userCount: number })[]
        if (query.id) {
            role = await roleManagementService.readRoleById(query.id, queryRunner)
        } else if (query.organizationId) {
            role = await roleManagementService.readRoleByOrganizationId(query.organizationId, queryRunner)
        } else {
            role = await roleManagementService.readRoleByGeneral(queryRunner)
        }

        return res.status(StatusCodes.OK).json(role)
    } catch (error) {
        next(error)
    } finally {
        if (queryRunner) await queryRunner.release()
    }
}

const updateRole = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const roleManagementService = new RoleManagementService()
        const role = await roleManagementService.updateRole(req.body)
        return res.status(StatusCodes.OK).json(role)
    } catch (error) {
        next(error)
    }
}

const deleteRole = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const query = req.query as Partial<Role>
        if (!query.id) {
            throw new InternalFlowiseError(StatusCodes.BAD_REQUEST, 'Role ID is required')
        }
        if (!query.organizationId) {
            throw new InternalFlowiseError(StatusCodes.BAD_REQUEST, 'Organization ID is required')
        }
        const roleManagementService = new RoleManagementService()
        const role = await roleManagementService.deleteRole(query.organizationId, query.id)
        return res.status(StatusCodes.OK).json(role)
    } catch (error) {
        next(error)
    }
}

export default {
    createRole,
    readRole,
    updateRole,
    deleteRole
}
