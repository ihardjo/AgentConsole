/**
 * Platform Asset Entity
 * 
 * Stores metadata for platform branding assets (logos, favicons).
 * Actual files are stored using the existing storage utils (local/S3/GCS).
 * 
 * Copyright (c) 2024-2026
 * Licensed under the Apache License, Version 2.0
 */

import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm'

export enum PlatformAssetType {
    LOGO = 'logo',
    FAVICON = 'favicon'
}

@Entity('platform_asset')
export class PlatformAsset {
    @PrimaryGeneratedColumn('uuid')
    id: string

    @Column({ type: 'varchar', length: 20 })
    @Index()
    assetType: PlatformAssetType

    @Column({ type: 'varchar', length: 500 })
    storagePath: string

    @Column({ type: 'varchar', length: 255 })
    fileName: string

    @Column({ type: 'varchar', length: 100 })
    mimeType: string

    @Column({ type: 'int' })
    fileSize: number

    @Column({ type: 'boolean', default: false })
    @Index()
    isActive: boolean

    @CreateDateColumn()
    createdDate: Date

    @UpdateDateColumn()
    updatedDate: Date
}
