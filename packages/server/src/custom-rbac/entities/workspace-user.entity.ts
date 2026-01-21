/**
 * Custom RBAC - Workspace User Entity
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
 * 
 * NOTE: Entity uses the same table name 'workspace_user' to reuse existing database schema.
 */

import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryColumn, UpdateDateColumn } from 'typeorm'
import { Workspace } from './workspace.entity'
import { User } from './user.entity'
import { Role } from './role.entity'

/**
 * Workspace user status enum - matches existing database values
 */
export enum WorkspaceUserStatus {
    ACTIVE = 'active',
    DISABLE = 'disable',
    INVITED = 'invited'
}

/**
 * WorkspaceUser entity - maps to existing 'workspace_user' table
 * Uses composite primary key (workspaceId, userId)
 * Column names match existing schema for compatibility
 */
@Entity({ name: 'workspace_user' })
export class WorkspaceUser {
    @PrimaryColumn()
    workspaceId: string
    @ManyToOne(() => Workspace, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'workspaceId' })
    workspace?: Workspace

    @PrimaryColumn()
    userId: string
    @ManyToOne(() => User, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'userId' })
    user?: User

    @Column({ type: 'uuid', nullable: false })
    roleId: string
    @ManyToOne(() => Role, { onDelete: 'SET NULL' })
    @JoinColumn({ name: 'roleId' })
    role?: Role

    @Column({ type: 'varchar', length: 20, default: WorkspaceUserStatus.INVITED })
    status?: string

    @CreateDateColumn()
    lastLogin?: string

    @CreateDateColumn()
    createdDate?: Date

    @UpdateDateColumn()
    updatedDate?: Date

    @Column({ nullable: false })
    createdBy?: string

    @Column({ nullable: false })
    updatedBy?: string
}
