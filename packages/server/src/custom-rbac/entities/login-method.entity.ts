/**
 * Custom RBAC - LoginMethod Entity
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
 * NOTE: Uses the same table name as enterprise entity for compatibility.
 */

import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm'
import { User } from './user.entity'
import { Organization } from './organization.entity'

/**
 * Login method status enumeration
 */
export enum LoginMethodStatus {
    ENABLE = 'enable',
    DISABLE = 'disable'
}

/**
 * LoginMethod entity - Stores organization login method configurations (SSO, OAuth, etc.)
 * Uses the same 'login_method' table as the enterprise entity.
 */
@Entity({ name: 'login_method' })
export class LoginMethod {
    @PrimaryGeneratedColumn('uuid')
    id: string

    @Column({ nullable: true })
    organizationId?: string
    @ManyToOne(() => Organization, (organization) => organization.id)
    @JoinColumn({ name: 'organizationId' })
    organization?: Organization

    @Column({ type: 'varchar', length: 100 })
    name: string

    @Column({ type: 'text' })
    config: string

    @Column({ type: 'varchar', length: 20, default: LoginMethodStatus.ENABLE })
    status?: string

    @CreateDateColumn()
    createdDate?: Date

    @UpdateDateColumn()
    updatedDate?: Date

    @Column({ nullable: true })
    createdBy?: string
    @ManyToOne(() => User, (user) => user.createdByLoginMethod)
    @JoinColumn({ name: 'createdBy' })
    createdByUser?: User

    @Column({ nullable: true })
    updatedBy?: string
    @ManyToOne(() => User, (user) => user.updatedByLoginMethod)
    @JoinColumn({ name: 'updatedBy' })
    updatedByUser?: User
}
