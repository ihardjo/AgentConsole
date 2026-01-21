/**
 * Custom RBAC - User Entity
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
 * NOTE: Entity uses the same table name 'user' to reuse existing database schema.
 */

import { Column, CreateDateColumn, Entity, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm'

// Forward reference type for LoginMethod to avoid circular dependency
type LoginMethodType = import('./login-method.entity').LoginMethod

/**
 * User status enum - matches existing database values
 */
export enum UserStatus {
    ACTIVE = 'active',
    INVITED = 'invited',
    UNVERIFIED = 'unverified',
    DELETED = 'deleted'
}

/**
 * User entity - maps to existing 'user' table
 * Column names match existing schema for compatibility
 */
@Entity('user')
export class User {
    @PrimaryGeneratedColumn('uuid')
    id: string

    @Column({ type: 'varchar', length: 100 })
    name: string

    @Column({ type: 'varchar', length: 255, unique: true })
    email: string

    @Column({ type: 'text', nullable: true })
    credential?: string | null

    @Column({ type: 'text', nullable: true, unique: true })
    tempToken?: string | null

    @CreateDateColumn({ nullable: true })
    tokenExpiry?: Date | null

    @Column({ type: 'varchar', length: 20, default: UserStatus.UNVERIFIED })
    status: string

    @CreateDateColumn()
    createdDate?: Date

    @UpdateDateColumn()
    updatedDate?: Date

    @Column({ nullable: false })
    createdBy: string

    @Column({ nullable: false })
    updatedBy: string

    // Relations for LoginMethod created/updated by this user
    @OneToMany('LoginMethod', 'createdByUser')
    createdByLoginMethod?: LoginMethodType[]

    @OneToMany('LoginMethod', 'updatedByUser')
    updatedByLoginMethod?: LoginMethodType[]
}
