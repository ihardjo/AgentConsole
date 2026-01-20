/**
 * Custom RBAC - Role Entity
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
 * NOTE: Entity uses the same table name 'role' to reuse existing database schema.
 */

import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm'
import { Organization } from './organization.entity'

/**
 * General role types - matches existing database values
 */
export enum GeneralRole {
    OWNER = 'owner',
    MEMBER = 'member',
    PERSONAL_WORKSPACE = 'personal workspace'
}

/**
 * Role entity - maps to existing 'role' table
 * Column names match existing schema for compatibility
 */
@Entity('role')
export class Role {
    @PrimaryGeneratedColumn('uuid')
    id: string

    @Column({ nullable: true })
    organizationId?: string | null
    @ManyToOne(() => Organization, { onDelete: 'CASCADE', nullable: true })
    @JoinColumn({ name: 'organizationId' })
    organization?: Organization

    @Column({ type: 'varchar', length: 100 })
    name: string

    @Column({ type: 'text', nullable: true })
    description?: string

    @Column({ type: 'text' })
    permissions: string // JSON string array of permission keys

    @CreateDateColumn()
    createdDate?: Date

    @UpdateDateColumn()
    updatedDate?: Date

    @Column({ nullable: true })
    createdBy?: string

    @Column({ nullable: true })
    updatedBy?: string
}
