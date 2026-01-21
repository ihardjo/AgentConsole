/**
 * Platform Configuration Controller
 * 
 * Express controller for managing platform branding assets and configuration.
 * 
 * Copyright (c) 2024-2026
 * Licensed under the Apache License, Version 2.0
 */

import { Request, Response, NextFunction } from 'express'
import { StatusCodes } from 'http-status-codes'
import * as platformConfigService from '../../services/platform-config'
import { PlatformAssetType } from '../../entities'
import { InternalFlowiseError } from '../../../errors/internalFlowiseError'

/**
 * Extended Multer file type with S3/GCS properties
 */
type MulterFileWithCloud = Express.Multer.File & {
    key?: string
    location?: string
    bucket?: string
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
 * Get current storage type from environment
 */
const getStorageType = (): StorageType => {
    const type = process.env.STORAGE_TYPE || StorageType.LOCAL
    return type as StorageType
}

/**
 * Check if storage type is cloud-based (S3 or GCS)
 */
const isCloudStorage = (): boolean => {
    const type = getStorageType()
    return type === StorageType.S3 || type === StorageType.GCS
}

/**
 * Check if file was uploaded via cloud storage multer middleware
 */
const isCloudUploadedFile = (file: MulterFileWithCloud): boolean => {
    return isCloudStorage() && !!file.key
}

/**
 * Get active platform configuration
 * GET /api/v1/platform-config
 */
export const getActiveConfig = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const config = await platformConfigService.getActiveConfig()
        res.json(config)
    } catch (error) {
        next(error)
    }
}

/**
 * Get application name
 * GET /api/v1/platform-config/app-name
 */
export const getApplicationName = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const applicationName = platformConfigService.getApplicationName()
        res.json({ applicationName })
    } catch (error) {
        next(error)
    }
}

/**
 * Update application name
 * PUT /api/v1/platform-config/app-name
 */
export const updateApplicationName = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { applicationName } = req.body
        
        if (!applicationName || typeof applicationName !== 'string') {
            throw new InternalFlowiseError(
                StatusCodes.BAD_REQUEST,
                'Application name is required and must be a string'
            )
        }
        
        platformConfigService.updateApplicationName(applicationName)
        res.json({ 
            success: true, 
            applicationName: platformConfigService.getApplicationName() 
        })
    } catch (error) {
        next(error)
    }
}

/**
 * Helper function to get file buffer from multer upload
 * Handles both memory storage (buffer available) and disk storage (need to read from path)
 */
const getFileBuffer = async (file: Express.Multer.File): Promise<Buffer> => {
    if (file.buffer) {
        return file.buffer
    }
    
    if (file.path) {
        const fs = await import('fs')
        const buffer = fs.readFileSync(file.path)
        // Clean up the temp file after reading
        fs.unlinkSync(file.path)
        return buffer
    }
    
    throw new InternalFlowiseError(StatusCodes.BAD_REQUEST, 'Unable to process uploaded file')
}

/**
 * Process file upload based on storage type
 * Handles both cloud storage (S3/GCS) and local storage
 */
const processFileUpload = async (
    file: MulterFileWithCloud,
    assetType: PlatformAssetType
): Promise<any> => {
    if (isCloudUploadedFile(file)) {
        // File already uploaded to S3/GCS by multer, just create database entry
        return platformConfigService.createAssetFromCloudUpload(assetType, {
            key: file.key!,
            location: file.location,
            bucket: file.bucket,
            mimetype: file.mimetype,
            originalname: file.originalname,
            size: file.size
        })
    }
    
    // Local storage - get buffer and upload
    const buffer = await getFileBuffer(file)
    return platformConfigService.uploadAsset(assetType, {
        buffer,
        mimetype: file.mimetype,
        originalname: file.originalname,
        size: file.size || buffer.length
    })
}

/**
 * Generic upload handler for platform assets
 */
const handleAssetUpload = (assetType: PlatformAssetType) => {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            if (!req.file) {
                throw new InternalFlowiseError(StatusCodes.BAD_REQUEST, 'No file uploaded')
            }

            const asset = await processFileUpload(req.file as MulterFileWithCloud, assetType)
            res.status(StatusCodes.CREATED).json(asset)
        } catch (error) {
            next(error)
        }
    }
}

/**
 * Upload a logo
 * POST /api/v1/platform-config/logo
 */
export const uploadLogo = handleAssetUpload(PlatformAssetType.LOGO)

/**
 * Upload a favicon
 * POST /api/v1/platform-config/favicon
 */
export const uploadFavicon = handleAssetUpload(PlatformAssetType.FAVICON)

/**
 * List all assets
 * GET /api/v1/platform-config/assets
 * Query params: type (optional) - 'logo' | 'favicon'
 */
export const listAssets = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { type } = req.query
        
        let assetType: PlatformAssetType | undefined
        if (type) {
            if (type === 'logo') {
                assetType = PlatformAssetType.LOGO
            } else if (type === 'favicon') {
                assetType = PlatformAssetType.FAVICON
            } else {
                throw new InternalFlowiseError(
                    StatusCodes.BAD_REQUEST,
                    'Invalid asset type. Must be "logo" or "favicon"'
                )
            }
        }
        
        const assets = await platformConfigService.listAssets(assetType)
        res.json(assets)
    } catch (error) {
        next(error)
    }
}

/**
 * Get asset by ID
 * GET /api/v1/platform-config/assets/:id
 */
export const getAsset = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { id } = req.params
        const asset = await platformConfigService.getAssetById(id)
        
        if (!asset) {
            throw new InternalFlowiseError(StatusCodes.NOT_FOUND, 'Asset not found')
        }
        
        res.json(asset)
    } catch (error) {
        next(error)
    }
}

/**
 * Set asset as active
 * PUT /api/v1/platform-config/assets/:id/activate
 */
export const activateAsset = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { id } = req.params
        const asset = await platformConfigService.setActiveAsset(id)
        res.json(asset)
    } catch (error) {
        next(error)
    }
}

/**
 * Deactivate an asset
 * PUT /api/v1/platform-config/assets/:id/deactivate
 */
export const deactivateAsset = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { id } = req.params
        const asset = await platformConfigService.deactivateAsset(id)
        res.json(asset)
    } catch (error) {
        next(error)
    }
}

/**
 * Delete an asset
 * DELETE /api/v1/platform-config/assets/:id
 */
export const deleteAsset = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { id } = req.params
        await platformConfigService.deleteAsset(id)
        res.status(StatusCodes.NO_CONTENT).send()
    } catch (error) {
        next(error)
    }
}

/**
 * Serve asset file
 * GET /api/v1/platform-config/assets/:id/file
 */
export const serveAssetFile = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { id } = req.params
        const file = await platformConfigService.getAssetFile(id)
        
        if (!file) {
            throw new InternalFlowiseError(StatusCodes.NOT_FOUND, 'Asset file not found')
        }
        
        res.setHeader('Content-Type', file.mimeType)
        res.setHeader('Content-Disposition', `inline; filename="${file.fileName}"`)
        res.send(file.buffer)
    } catch (error) {
        next(error)
    }
}

/**
 * Serve active logo
 * GET /api/v1/platform-config/logo
 */
export const serveActiveLogo = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const file = await platformConfigService.getActiveAssetFile(PlatformAssetType.LOGO)
        
        if (!file) {
            // Return 204 No Content if no active logo
            res.status(StatusCodes.NO_CONTENT).send()
            return
        }
        
        res.setHeader('Content-Type', file.mimeType)
        // Disable caching to ensure logo updates are picked up immediately
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate')
        res.setHeader('Pragma', 'no-cache')
        res.setHeader('Expires', '0')
        res.send(file.buffer)
    } catch (error) {
        next(error)
    }
}

/**
 * Serve active favicon
 * GET /api/v1/platform-config/favicon
 */
export const serveActiveFavicon = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const file = await platformConfigService.getActiveAssetFile(PlatformAssetType.FAVICON)
        
        if (!file) {
            // Return 204 No Content if no active favicon
            res.status(StatusCodes.NO_CONTENT).send()
            return
        }
        
        res.setHeader('Content-Type', file.mimeType)
        // Disable caching to ensure favicon updates are picked up immediately
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate')
        res.setHeader('Pragma', 'no-cache')
        res.setHeader('Expires', '0')
        res.send(file.buffer)
    } catch (error) {
        next(error)
    }
}

/**
 * Reset configuration to defaults
 * POST /api/v1/platform-config/reset
 */
export const resetConfig = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        platformConfigService.resetConfig()
        const config = await platformConfigService.getActiveConfig()
        res.json({ success: true, config })
    } catch (error) {
        next(error)
    }
}
