/**
 * Custom RBAC - Workspace Management Service
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
import { DataSource, In, QueryRunner } from 'typeorm'
import { InternalFlowiseError } from '../../../errors/internalFlowiseError'
import { generateId } from '../../../utils'
import { GeneralSuccessMessage } from '../../../utils/constants'
import { getRunningExpressApp } from '../../../utils/getRunningExpressApp'
import { Workspace, WorkspaceName } from '../../entities/workspace.entity'
import { WorkspaceUser } from '../../entities/workspace-user.entity'
import { GeneralRole } from '../../entities/role.entity'
import { User } from '../../entities/user.entity'
import { Organization } from '../../entities/organization.entity'
import { isInvalidName, isInvalidUUID } from '../../utils/validation.util'
import { QueueManager } from '../../../queue/QueueManager'
import { MODE } from '../../../Interface'
import logger from '../../../utils/logger'

// Import non-enterprise database entities for workspace deletion
import { ChatFlow } from '../../../database/entities/ChatFlow'
import { ChatMessage } from '../../../database/entities/ChatMessage'
import { ChatMessageFeedback } from '../../../database/entities/ChatMessageFeedback'
import { Assistant } from '../../../database/entities/Assistant'
import { Tool } from '../../../database/entities/Tool'
import { Credential } from '../../../database/entities/Credential'
import { Variable } from '../../../database/entities/Variable'
import { ApiKey } from '../../../database/entities/ApiKey'
import { DocumentStore } from '../../../database/entities/DocumentStore'
import { DocumentStoreFileChunk } from '../../../database/entities/DocumentStoreFileChunk'
import { Dataset } from '../../../database/entities/Dataset'
import { DatasetRow } from '../../../database/entities/DatasetRow'
import { CustomTemplate } from '../../../database/entities/CustomTemplate'
import { Execution } from '../../../database/entities/Execution'
import { Evaluation } from '../../../database/entities/Evaluation'
import { EvaluationRun } from '../../../database/entities/EvaluationRun'
import { Evaluator } from '../../../database/entities/Evaluator'
import { UpsertHistory } from '../../../database/entities/UpsertHistory'

export const enum WorkspaceManagementErrorMessage {
    INVALID_WORKSPACE_ID = 'Invalid Workspace Id',
    INVALID_WORKSPACE_NAME = 'Invalid Workspace Name',
    WORKSPACE_NOT_FOUND = 'Workspace Not Found',
    WORKSPACE_RESERVED_NAME = 'Workspace name cannot be Default Workspace or Personal Workspace - this is a reserved name',
    INVALID_USER_ID = 'Invalid User Id',
    USER_NOT_FOUND = 'User Not Found',
    INVALID_ORGANIZATION_ID = 'Invalid Organization Id',
    ORGANIZATION_NOT_FOUND = 'Organization Not Found'
}

export class WorkspaceManagementService {
    private dataSource: DataSource
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private _roleManagementService: any = null

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

    // Internal method to read user by ID
    private validateUserId(id: string | undefined) {
        if (isInvalidUUID(id))
            throw new InternalFlowiseError(StatusCodes.BAD_REQUEST, WorkspaceManagementErrorMessage.INVALID_USER_ID)
    }

    private async readUserById(id: string | undefined, queryRunner: QueryRunner) {
        this.validateUserId(id)
        return await queryRunner.manager.findOneBy(User, { id })
    }

    // Internal method to read organization by ID
    private validateOrganizationId(id: string | undefined) {
        if (isInvalidUUID(id))
            throw new InternalFlowiseError(StatusCodes.BAD_REQUEST, WorkspaceManagementErrorMessage.INVALID_ORGANIZATION_ID)
    }

    private async readOrganizationById(id: string | undefined, queryRunner: QueryRunner) {
        this.validateOrganizationId(id)
        return await queryRunner.manager.findOneBy(Organization, { id })
    }

    public validateWorkspaceId(id: string | undefined) {
        if (isInvalidUUID(id))
            throw new InternalFlowiseError(StatusCodes.BAD_REQUEST, WorkspaceManagementErrorMessage.INVALID_WORKSPACE_ID)
    }

    public async readWorkspaceById(id: string | undefined, queryRunner: QueryRunner) {
        this.validateWorkspaceId(id)
        return await queryRunner.manager.findOneBy(Workspace, { id })
    }

    public validateWorkspaceName(name: string | undefined, isRegister: boolean = false) {
        if (isInvalidName(name))
            throw new InternalFlowiseError(StatusCodes.BAD_REQUEST, WorkspaceManagementErrorMessage.INVALID_WORKSPACE_NAME)
        if (!isRegister && (name === WorkspaceName.DEFAULT_PERSONAL_WORKSPACE || name === WorkspaceName.DEFAULT_WORKSPACE)) {
            throw new InternalFlowiseError(StatusCodes.BAD_REQUEST, WorkspaceManagementErrorMessage.WORKSPACE_RESERVED_NAME)
        }
    }

    public async readWorkspaceByOrganizationId(organizationId: string | undefined, queryRunner: QueryRunner) {
        await this.readOrganizationById(organizationId, queryRunner)
        const workspaces = await queryRunner.manager.findBy(Workspace, { organizationId })

        const rolePersonalWorkspace = await this.roleManagementService.readGeneralRoleByName(GeneralRole.PERSONAL_WORKSPACE, queryRunner)
        if (!rolePersonalWorkspace) throw new InternalFlowiseError(StatusCodes.NOT_FOUND, 'Role Not Found')

        const filteredWorkspaces = await Promise.all(
            workspaces.map(async (workspace) => {
                const workspaceUsers = await queryRunner.manager.findBy(WorkspaceUser, { workspaceId: workspace.id })

                // Skip if any user in the workspace has PERSONAL_WORKSPACE role
                const hasPersonalWorkspaceUser = workspaceUsers.some((user) => user.roleId === rolePersonalWorkspace.id)
                if (hasPersonalWorkspaceUser) {
                    return null
                }

                return {
                    ...workspace,
                    userCount: workspaceUsers.length
                } as Workspace & { userCount: number }
            })
        )

        // Filter out null values (personal workspaces)
        return filteredWorkspaces.filter((workspace): workspace is Workspace & { userCount: number } => workspace !== null)
    }

    public async readWorkspaceByGeneral(queryRunner: QueryRunner) {
        const generalWorkspaces = await queryRunner.manager.find(Workspace)
        if (generalWorkspaces.length <= 0)
            throw new InternalFlowiseError(StatusCodes.NOT_FOUND, WorkspaceManagementErrorMessage.WORKSPACE_NOT_FOUND)
        return generalWorkspaces
    }

    public createNewWorkspace(data: Partial<Workspace>, queryRunner: QueryRunner, isRegister: boolean = false) {
        this.validateWorkspaceName(data.name, isRegister)
        data.updatedBy = data.createdBy
        data.id = generateId()

        return queryRunner.manager.create(Workspace, data)
    }

    public async saveWorkspace(data: Partial<Workspace>, queryRunner: QueryRunner) {
        return await queryRunner.manager.save(Workspace, data)
    }

    public async createWorkspace(data: Partial<Workspace>) {
        const queryRunner = this.dataSource.createQueryRunner()
        await queryRunner.connect()

        const organization = await this.readOrganizationById(data.organizationId, queryRunner)
        if (!organization) throw new InternalFlowiseError(StatusCodes.NOT_FOUND, WorkspaceManagementErrorMessage.ORGANIZATION_NOT_FOUND)
        const user = await this.readUserById(data.createdBy, queryRunner)
        if (!user) throw new InternalFlowiseError(StatusCodes.NOT_FOUND, WorkspaceManagementErrorMessage.USER_NOT_FOUND)

        let newWorkspace = this.createNewWorkspace(data, queryRunner)
        try {
            await queryRunner.startTransaction()
            newWorkspace = await this.saveWorkspace(newWorkspace, queryRunner)
            await queryRunner.commitTransaction()
        } catch (error) {
            await queryRunner.rollbackTransaction()
            throw error
        } finally {
            await queryRunner.release()
        }

        return newWorkspace
    }

    public async updateWorkspace(newWorkspaceData: Partial<Workspace>) {
        const queryRunner = this.dataSource.createQueryRunner()
        await queryRunner.connect()

        const oldWorkspaceData = await this.readWorkspaceById(newWorkspaceData.id, queryRunner)
        if (!oldWorkspaceData)
            throw new InternalFlowiseError(StatusCodes.NOT_FOUND, WorkspaceManagementErrorMessage.WORKSPACE_NOT_FOUND)
        const user = await this.readUserById(newWorkspaceData.updatedBy, queryRunner)
        if (!user) throw new InternalFlowiseError(StatusCodes.NOT_FOUND, WorkspaceManagementErrorMessage.USER_NOT_FOUND)
        if (newWorkspaceData.name) {
            this.validateWorkspaceName(newWorkspaceData.name)
        }
        newWorkspaceData.organizationId = oldWorkspaceData.organizationId
        newWorkspaceData.createdBy = oldWorkspaceData.createdBy

        let updateWorkspace = queryRunner.manager.merge(Workspace, oldWorkspaceData, newWorkspaceData)
        try {
            await queryRunner.startTransaction()
            updateWorkspace = await this.saveWorkspace(updateWorkspace, queryRunner)
            await queryRunner.commitTransaction()
        } catch (error) {
            await queryRunner.rollbackTransaction()
            throw error
        } finally {
            await queryRunner.release()
        }

        return updateWorkspace
    }

    public async deleteWorkspace(organizationId: string | undefined, id: string | undefined) {
        const queryRunner = this.dataSource.createQueryRunner()
        await queryRunner.connect()

        this.validateWorkspaceId(id)
        const organization = await this.readOrganizationById(organizationId, queryRunner)
        if (!organization) throw new InternalFlowiseError(StatusCodes.NOT_FOUND, WorkspaceManagementErrorMessage.ORGANIZATION_NOT_FOUND)

        const workspace = await this.readWorkspaceById(id, queryRunner)
        if (!workspace) throw new InternalFlowiseError(StatusCodes.NOT_FOUND, WorkspaceManagementErrorMessage.WORKSPACE_NOT_FOUND)

        if (workspace.organizationId !== organizationId) {
            throw new InternalFlowiseError(StatusCodes.FORBIDDEN, 'Workspace does not belong to this organization')
        }

        try {
            await queryRunner.startTransaction()
            
            // First get all related entities that need to be deleted
            const chatflows = await queryRunner.manager.findBy(ChatFlow, { workspaceId: id })
            const documentStores = await queryRunner.manager.findBy(DocumentStore, { workspaceId: id })
            const evaluations = await queryRunner.manager.findBy(Evaluation, { workspaceId: id })
            const datasets = await queryRunner.manager.findBy(Dataset, { workspaceId: id })

            // Extract IDs for bulk deletion
            const chatflowIds = chatflows.map((cf) => cf.id)
            const documentStoreIds = documentStores.map((ds) => ds.id)
            const evaluationIds = evaluations.map((e) => e.id)
            const datasetIds = datasets.map((d) => d.id)

            // Start deleting in the correct order to maintain referential integrity
            await queryRunner.manager.delete(WorkspaceUser, { workspaceId: id })
            await queryRunner.manager.delete(ApiKey, { workspaceId: id })
            await queryRunner.manager.delete(Assistant, { workspaceId: id })
            await queryRunner.manager.delete(Execution, { workspaceId: id })

            // Delete chatflow related entities
            if (chatflowIds.length > 0) {
                await queryRunner.manager.delete(ChatFlow, { workspaceId: id })
                await queryRunner.manager.delete(ChatMessageFeedback, { chatflowid: In(chatflowIds) })
                await queryRunner.manager.delete(ChatMessage, { chatflowid: In(chatflowIds) })
                await queryRunner.manager.delete(UpsertHistory, { chatflowid: In(chatflowIds) })
            }

            await queryRunner.manager.delete(Credential, { workspaceId: id })
            await queryRunner.manager.delete(CustomTemplate, { workspaceId: id })

            // Delete dataset related entities
            if (datasetIds.length > 0) {
                await queryRunner.manager.delete(Dataset, { workspaceId: id })
                await queryRunner.manager.delete(DatasetRow, { datasetId: In(datasetIds) })
            }

            // Delete document store related entities
            if (documentStoreIds.length > 0) {
                await queryRunner.manager.delete(DocumentStore, { workspaceId: id })
                await queryRunner.manager.delete(DocumentStoreFileChunk, { storeId: In(documentStoreIds) })
            }

            // Delete evaluation related entities
            if (evaluationIds.length > 0) {
                await queryRunner.manager.delete(Evaluation, { workspaceId: id })
                await queryRunner.manager.delete(EvaluationRun, { evaluationId: In(evaluationIds) })
            }

            await queryRunner.manager.delete(Evaluator, { workspaceId: id })
            await queryRunner.manager.delete(Tool, { workspaceId: id })
            await queryRunner.manager.delete(Variable, { workspaceId: id })

            // Finally delete the workspace itself
            await queryRunner.manager.delete(Workspace, { id })
            
            await queryRunner.commitTransaction()
        } catch (error) {
            await queryRunner.rollbackTransaction()
            throw error
        } finally {
            await queryRunner.release()
        }

        // Fire-and-forget queue teardown after the DB transaction is committed.
        // Only active in MODE=queue-dedicated-workspace.
        if (process.env.MODE === MODE.QUEUE_DEDICATED_WORKSPACE && id) {
            QueueManager.getInstance()
                .teardownWorkspaceQueue(id)
                .catch((err) => logger.warn(`[WorkspaceManagement] Failed to tear down queues for workspace ${id}: ${err}`))
        }

        return { message: GeneralSuccessMessage.DELETED }
    }

    /**
     * Delete workspace by ID using an existing queryRunner (for transactional operations).
     * This method is used when deleting a workspace as part of a larger transaction (e.g., deleting user from organization).
     *
     * **Queue teardown note:** This method runs inside the caller's outer transaction and does NOT trigger
     * queue teardown itself. When `MODE=queue-dedicated-workspace`, the caller is responsible for invoking
     * `QueueManager.getInstance().teardownWorkspaceQueue(workspaceId)` after their outer transaction commits.
     */
    public async deleteWorkspaceById(queryRunner: QueryRunner, workspaceId: string) {
        const workspace = await this.readWorkspaceById(workspaceId, queryRunner)
        if (!workspace) {
            return // Workspace already deleted or doesn't exist
        }

        // First get all related entities that need to be deleted
        const chatflows = await queryRunner.manager.findBy(ChatFlow, { workspaceId })
        const documentStores = await queryRunner.manager.findBy(DocumentStore, { workspaceId })
        const evaluations = await queryRunner.manager.findBy(Evaluation, { workspaceId })
        const datasets = await queryRunner.manager.findBy(Dataset, { workspaceId })

        // Extract IDs for bulk deletion
        const chatflowIds = chatflows.map((cf) => cf.id)
        const documentStoreIds = documentStores.map((ds) => ds.id)
        const evaluationIds = evaluations.map((e) => e.id)
        const datasetIds = datasets.map((d) => d.id)

        // Start deleting in the correct order to maintain referential integrity
        await queryRunner.manager.delete(WorkspaceUser, { workspaceId })
        await queryRunner.manager.delete(ApiKey, { workspaceId })
        await queryRunner.manager.delete(Assistant, { workspaceId })
        await queryRunner.manager.delete(Execution, { workspaceId })

        // Delete chatflow related entities
        if (chatflowIds.length > 0) {
            await queryRunner.manager.delete(ChatFlow, { workspaceId })
            await queryRunner.manager.delete(ChatMessageFeedback, { chatflowid: In(chatflowIds) })
            await queryRunner.manager.delete(ChatMessage, { chatflowid: In(chatflowIds) })
            await queryRunner.manager.delete(UpsertHistory, { chatflowid: In(chatflowIds) })
        }

        await queryRunner.manager.delete(Credential, { workspaceId })
        await queryRunner.manager.delete(CustomTemplate, { workspaceId })

        // Delete dataset related entities
        if (datasetIds.length > 0) {
            await queryRunner.manager.delete(Dataset, { workspaceId })
            await queryRunner.manager.delete(DatasetRow, { datasetId: In(datasetIds) })
        }

        // Delete document store related entities
        if (documentStoreIds.length > 0) {
            await queryRunner.manager.delete(DocumentStore, { workspaceId })
            await queryRunner.manager.delete(DocumentStoreFileChunk, { storeId: In(documentStoreIds) })
        }

        // Delete evaluation related entities
        if (evaluationIds.length > 0) {
            await queryRunner.manager.delete(Evaluation, { workspaceId })
            await queryRunner.manager.delete(EvaluationRun, { evaluationId: In(evaluationIds) })
        }

        await queryRunner.manager.delete(Evaluator, { workspaceId })
        await queryRunner.manager.delete(Tool, { workspaceId })
        await queryRunner.manager.delete(Variable, { workspaceId })

        // Finally delete the workspace itself
        await queryRunner.manager.delete(Workspace, { id: workspaceId })
    }

    // Set null workspaceId for chatflows when creating default workspace
    public async setNullWorkspaceId(queryRunner: QueryRunner, workspaceId: string) {
        await queryRunner.manager.update(ChatFlow, { workspaceId: null }, { workspaceId })
    }

    /**
     * Get shared items for a workspace (credentials, templates, etc.)
     * @param wsId - Workspace ID
     * @param itemType - Type of item ('credential', 'custom_template', etc.)
     * @returns Array of shared items
     */
    public async getSharedItemsForWorkspace(wsId: string, itemType: string) {
        const { WorkspaceShared } = await import('../../../enterprise/database/entities/EnterpriseEntities')
        const { Credential } = await import('../../../database/entities/Credential')
        const { CustomTemplate } = await import('../../../database/entities/CustomTemplate')
        const { In } = await import('typeorm')

        const sharedItems = await this.dataSource.getRepository(WorkspaceShared).find({
            where: {
                workspaceId: wsId,
                itemType: itemType
            }
        })
        
        if (sharedItems.length === 0) {
            return []
        }

        const itemIds = sharedItems.map((item) => item.sharedItemId)
        
        if (itemType === 'credential') {
            return await this.dataSource.getRepository(Credential).find({
                select: ['id', 'name', 'credentialName'],
                where: { id: In(itemIds) }
            })
        } else if (itemType === 'custom_template') {
            return await this.dataSource.getRepository(CustomTemplate).find({
                where: { id: In(itemIds) }
            })
        }
        
        return []
    }
}
