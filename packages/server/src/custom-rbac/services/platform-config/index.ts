/**
 * Platform Configuration Service
 * 
 * Service for managing platform branding assets (logo, favicon) and configuration (app name).
 * Uses existing storage utilities for file storage (local/S3/GCS).
 * 
 * Copyright (c) 2024-2026
 * Licensed under the Apache License, Version 2.0
 */

import { Repository } from 'typeorm'
import { PlatformAsset, PlatformAssetType } from '../../entities'
import { getDataSource } from '../../../DataSource'
import {
    addSingleFileToStorage,
    removeSpecificFileFromStorage,
    getFileFromUpload,
    getStorageType,
    getStoragePath
} from 'flowise-components'
import configManager from './config-manager'
import path from 'path'
import fs from 'fs'

// Constants
const PLATFORM_ASSETS_FOLDER = 'platform-assets'
const DEFAULT_APPLICATION_NAME = 'AI Reinvention Studio'

// Allowed MIME types for each asset type
const ALLOWED_MIME_TYPES: Record<PlatformAssetType, string[]> = {
    [PlatformAssetType.LOGO]: ['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp'],
    [PlatformAssetType.FAVICON]: ['image/x-icon', 'image/vnd.microsoft.icon', 'image/png', 'image/svg+xml']
}

/**
 * Storage type enumeration
 */
enum StorageType {
    LOCAL = 'local',
    S3 = 's3',
    GCS = 'gcs'
}

/**
 * Check if current storage is cloud-based
 */
const isCloudStorage = (): boolean => {
    const storageType = getStorageType()
    return storageType === StorageType.S3 || storageType === StorageType.GCS
}

/**
 * Lazy initialization pattern for repository
 */
let platformAssetRepository: Repository<PlatformAsset> | null = null

const getRepository = (): Repository<PlatformAsset> => {
    if (!platformAssetRepository) {
        const dataSource = getDataSource()
        platformAssetRepository = dataSource.getRepository(PlatformAsset)
    }
    return platformAssetRepository!
}

/**
 * Get the active configuration including app name, agent evaluation URL, and active assets
 */
export const getActiveConfig = async (): Promise<{
    applicationName: string
    agentEvaluationUrl: string
    activeLogo: PlatformAsset | null
    activeFavicon: PlatformAsset | null
}> => {
    const repository = getRepository()
    
    const [activeLogo, activeFavicon] = await Promise.all([
        repository.findOne({
            where: { assetType: PlatformAssetType.LOGO, isActive: true }
        }),
        repository.findOne({
            where: { assetType: PlatformAssetType.FAVICON, isActive: true }
        })
    ])
    
    return {
        applicationName: configManager.get<string>('applicationName') || DEFAULT_APPLICATION_NAME,
        agentEvaluationUrl: configManager.get<string>('agentEvaluationUrl') || 'https://example.com/agent-evaluation/',
        activeLogo,
        activeFavicon
    }
}

/**
 * Get application name
 */
export const getApplicationName = (): string => {
    return configManager.get<string>('applicationName') || DEFAULT_APPLICATION_NAME
}

/**
 * Update application name (hot reloadable)
 */
export const updateApplicationName = (name: string): void => {
    if (!name || name.trim().length === 0) {
        throw new Error('Application name cannot be empty')
    }
    configManager.set('applicationName', name.trim())
}

/**
 * Get Agent Evaluation URL
 */
export const getAgentEvaluationUrl = (): string => {
    return configManager.get<string>('agentEvaluationUrl') || 'https://example.com/agent-evaluation/'
}

/**
 * Update Agent Evaluation URL (hot reloadable)
 */
export const updateAgentEvaluationUrl = (url: string): void => {
    if (!url || url.trim().length === 0) {
        throw new Error('Agent Evaluation URL cannot be empty')
    }
    // Ensure URL ends with /
    const trimmedUrl = url.trim()
    const normalizedUrl = trimmedUrl.endsWith('/') ? trimmedUrl : `${trimmedUrl}/`
    configManager.set('agentEvaluationUrl', normalizedUrl)
}

/**
 * Validate file MIME type for asset type
 */
const validateMimeType = (assetType: PlatformAssetType, mimeType: string): void => {
    const allowedTypes = ALLOWED_MIME_TYPES[assetType]
    if (!allowedTypes.includes(mimeType)) {
        throw new Error(`Invalid file type. Allowed types: ${allowedTypes.join(', ')}`)
    }
}

/**
 * Generate unique filename for asset
 */
const generateUniqueFileName = (assetType: PlatformAssetType, originalName: string): string => {
    const timestamp = Date.now()
    const ext = path.extname(originalName)
    const baseName = path.basename(originalName, ext)
    return `${assetType}-${baseName}-${timestamp}${ext}`
}

/**
 * Build storage path for asset
 */
const buildStoragePath = (assetType: PlatformAssetType, fileName: string): string => {
    return `${PLATFORM_ASSETS_FOLDER}/${assetType}/${fileName}`
}

/**
 * Upload a new platform asset (logo or favicon) - Local Storage
 */
export const uploadAsset = async (
    assetType: PlatformAssetType,
    file: {
        buffer: Buffer
        mimetype: string
        originalname: string
        size: number
    }
): Promise<PlatformAsset> => {
    const repository = getRepository()
    
    // Validate mime type
    validateMimeType(assetType, file.mimetype)
    
    // Generate unique filename
    const uniqueFileName = generateUniqueFileName(assetType, file.originalname)
    
    // Upload to storage
    await addSingleFileToStorage(
        file.mimetype,
        file.buffer,
        uniqueFileName,
        PLATFORM_ASSETS_FOLDER,
        assetType
    )
    
    // Create database record
    const asset = repository.create({
        assetType,
        storagePath: buildStoragePath(assetType, uniqueFileName),
        fileName: file.originalname,
        mimeType: file.mimetype,
        fileSize: file.size,
        isActive: false
    })
    
    return repository.save(asset)
}

/**
 * Create asset record from cloud storage upload (S3/GCS)
 * This is used when multer-s3 or multer-gcs has already uploaded the file
 */
export const createAssetFromCloudUpload = async (
    assetType: PlatformAssetType,
    fileInfo: {
        key: string
        location?: string
        bucket?: string
        mimetype: string
        originalname: string
        size: number
    }
): Promise<PlatformAsset> => {
    const repository = getRepository()
    
    // Validate mime type
    validateMimeType(assetType, fileInfo.mimetype)
    
    // For S3/GCS, the key is the full path in the bucket
    const storagePath = fileInfo.key
    
    // Create database record
    const asset = repository.create({
        assetType,
        storagePath,
        fileName: fileInfo.originalname,
        mimeType: fileInfo.mimetype,
        fileSize: fileInfo.size,
        isActive: false
    })
    
    return repository.save(asset)
}

/**
 * Set an asset as active (deactivates others of same type)
 */
export const setActiveAsset = async (assetId: string): Promise<PlatformAsset> => {
    const repository = getRepository()
    
    const asset = await repository.findOne({ where: { id: assetId } })
    if (!asset) {
        throw new Error('Asset not found')
    }
    
    // Deactivate all assets of the same type
    await repository.update(
        { assetType: asset.assetType },
        { isActive: false }
    )
    
    // Activate the selected asset
    asset.isActive = true
    return repository.save(asset)
}

/**
 * Deactivate an asset (remove from active use)
 */
export const deactivateAsset = async (assetId: string): Promise<PlatformAsset> => {
    const repository = getRepository()
    
    const asset = await repository.findOne({ where: { id: assetId } })
    if (!asset) {
        throw new Error('Asset not found')
    }
    
    asset.isActive = false
    return repository.save(asset)
}

/**
 * Delete an asset
 */
export const deleteAsset = async (assetId: string): Promise<void> => {
    const repository = getRepository()
    
    const asset = await repository.findOne({ where: { id: assetId } })
    if (!asset) {
        throw new Error('Asset not found')
    }
    
    // Don't allow deletion of active assets
    if (asset.isActive) {
        throw new Error('Cannot delete active asset. Please deactivate it first.')
    }
    
    // Remove from storage
    // For S3/GCS, the storagePath might be just the key (UUID)
    // For local, it's a full path like platform-assets/logo/filename.png
    const storageType = getStorageType()
    if (storageType === 's3' || storageType === 'gcs') {
        // For cloud storage, the storagePath is the key/path in the bucket
        await removeSpecificFileFromStorage(asset.storagePath)
    } else {
        // For local storage, split the path
        const pathParts = asset.storagePath.split('/')
        await removeSpecificFileFromStorage(...pathParts)
    }
    
    // Delete database record
    await repository.delete(assetId)
}

/**
 * List all assets, optionally filtered by type
 */
export const listAssets = async (assetType?: PlatformAssetType): Promise<PlatformAsset[]> => {
    const repository = getRepository()
    
    const where = assetType ? { assetType } : {}
    return repository.find({
        where,
        order: { createdDate: 'DESC' }
    })
}

/**
 * Get a single asset by ID
 */
export const getAssetById = async (assetId: string): Promise<PlatformAsset | null> => {
    const repository = getRepository()
    return repository.findOne({ where: { id: assetId } })
}

/**
 * Get asset file content for serving
 */
export const getAssetFile = async (assetId: string): Promise<{
    buffer: Buffer
    mimeType: string
    fileName: string
} | null> => {
    const repository = getRepository()
    
    const asset = await repository.findOne({ where: { id: assetId } })
    if (!asset) {
        return null
    }
    
    const storageType = getStorageType()
    let buffer: Buffer
    
    if (storageType === 'local') {
        const filePath = path.join(getStoragePath(), asset.storagePath)
        if (!fs.existsSync(filePath)) {
            return null
        }
        buffer = fs.readFileSync(filePath)
    } else {
        // For S3/GCS
        buffer = await getFileFromUpload(asset.storagePath)
    }
    
    return {
        buffer,
        mimeType: asset.mimeType,
        fileName: asset.fileName
    }
}

/**
 * Get active asset file for serving (by type)
 */
export const getActiveAssetFile = async (assetType: PlatformAssetType): Promise<{
    buffer: Buffer
    mimeType: string
    fileName: string
} | null> => {
    const repository = getRepository()
    
    const asset = await repository.findOne({
        where: { assetType, isActive: true }
    })
    
    if (!asset) {
        return null
    }
    
    return getAssetFile(asset.id)
}

/**
 * Reset configuration to defaults
 */
export const resetConfig = (): void => {
    configManager.reset()
}
