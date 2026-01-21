/**
 * Custom RBAC - Organization Entity
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
 * NOTE: Entity uses the same table name 'organization' to reuse existing database schema.
 */

import { Column, CreateDateColumn, Entity, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm'
import { Workspace } from './workspace.entity'

/**
 * Reserved organization name constant
 */
export const OrganizationName = {
    DEFAULT_ORGANIZATION: 'Default Organization'
} as const

/**
 * Organization entity - maps to existing 'organization' table
 * Column names match existing schema for compatibility
 */
@Entity('organization')
export class Organization {
    @PrimaryGeneratedColumn('uuid')
    id: string

    @Column({ type: 'varchar', length: 100, default: OrganizationName.DEFAULT_ORGANIZATION })
    name: string

    @Column({ type: 'varchar', length: 100, nullable: true })
    customerId?: string

    @Column({ type: 'varchar', length: 100, nullable: true })
    subscriptionId?: string

    @CreateDateColumn()
    createdDate?: Date

    @UpdateDateColumn()
    updatedDate?: Date

    @Column({ nullable: false })
    createdBy?: string

    @Column({ nullable: false })
    updatedBy?: string

    @OneToMany(() => Workspace, (workspace) => workspace.organization)
    workspaces?: Workspace[]
}
