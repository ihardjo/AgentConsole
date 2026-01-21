/**
 * Custom RBAC - Workspace Entity
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
 * NOTE: Entity uses the same table name 'workspace' to reuse existing database schema.
 */

import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm'
import { Organization } from './organization.entity'

/**
 * Reserved workspace name constants - matches existing database values
 */
export const WorkspaceName = {
    DEFAULT_WORKSPACE: 'Default Workspace',
    DEFAULT_PERSONAL_WORKSPACE: 'Personal Workspace'
} as const

/**
 * Workspace entity - maps to existing 'workspace' table
 * Column names match existing schema for compatibility
 */
@Entity('workspace')
export class Workspace {
    @PrimaryGeneratedColumn('uuid')
    id: string

    @Column({ type: 'varchar', length: 100, default: WorkspaceName.DEFAULT_PERSONAL_WORKSPACE })
    name: string

    @Column({ type: 'text', nullable: true })
    description?: string

    @Column({ nullable: false })
    organizationId?: string
    @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'organizationId' })
    organization?: Organization

    @CreateDateColumn()
    createdDate?: Date

    @UpdateDateColumn()
    updatedDate?: Date

    @Column({ nullable: false })
    createdBy?: string

    @Column({ nullable: false })
    updatedBy?: string
}
