/**
 * Platform Configuration Routes
 * 
 * Express routes for platform branding configuration management.
 * Includes file upload support via multer.
 * 
 * Copyright (c) 2024-2026
 * Licensed under the Apache License, Version 2.0
 */

import express from 'express'
import * as platformConfigController from '../../controllers/platform-config'
import { getMulterStorage } from '../../../utils'
import { registerRoute } from '../shared/utils'
import { checkPermission } from '../../middleware'

const router = express.Router()

// File upload middleware - single file for assets
const upload = getMulterStorage()

/**
 * Public routes (no permission required) - for serving assets to the app
 * These are accessed by the frontend to display branding
 */
const publicRoutes = [
    { method: 'get' as const, path: '/', handler: platformConfigController.getActiveConfig, description: 'Get active configuration' },
    { method: 'get' as const, path: '/logo', handler: platformConfigController.serveActiveLogo, description: 'Serve active logo' },
    {
        method: 'get' as const,
        path: '/favicon',
        handler: platformConfigController.serveActiveFavicon,
        description: 'Serve active favicon'
    },
    {
        method: 'get' as const,
        path: '/app-name',
        handler: platformConfigController.getApplicationName,
        description: 'Get application name'
    },
    {
        method: 'get' as const,
        path: '/agent-performance-url',
        handler: platformConfigController.getAgentPerformanceUrl,
        description: 'Get Agent Performance URL'
    }
]

publicRoutes.forEach((route) => {
    registerRoute(router, { ...route, permission: null })
})

/**
 * Protected routes - require manage permission
 */
const protectedRoutes = [
    { method: 'get' as const, path: '/assets', handler: platformConfigController.listAssets, description: 'List all assets' },
    { method: 'get' as const, path: '/assets/:id', handler: platformConfigController.getAsset, description: 'Get asset by ID' },
    {
        method: 'get' as const,
        path: '/assets/:id/file',
        handler: platformConfigController.serveAssetFile,
        description: 'Serve asset file'
    }
]

protectedRoutes.forEach((route) => {
    registerRoute(router, { ...route, permission: 'platformConfiguration:manage' })
})

/**
 * Protected routes - require manage permission
 */
registerRoute(router, {
    method: 'put',
    path: '/app-name',
    handler: platformConfigController.updateApplicationName,
    permission: 'platformConfiguration:manage',
    description: 'Update application name'
})

registerRoute(router, {
    method: 'put',
    path: '/agent-performance-url',
    handler: platformConfigController.updateAgentPerformanceUrl,
    permission: 'platformConfiguration:manage',
    description: 'Update Agent Performance URL'
})

registerRoute(router, {
    method: 'post',
    path: '/reset',
    handler: platformConfigController.resetConfig,
    permission: 'platformConfiguration:manage',
    description: 'Reset configuration to defaults'
})

registerRoute(router, {
    method: 'put',
    path: '/assets/:id/activate',
    handler: platformConfigController.activateAsset,
    permission: 'platformConfiguration:manage',
    description: 'Activate an asset'
})

registerRoute(router, {
    method: 'put',
    path: '/assets/:id/deactivate',
    handler: platformConfigController.deactivateAsset,
    permission: 'platformConfiguration:manage',
    description: 'Deactivate an asset'
})

/**
 * Protected routes - require manage permission with file handling
 * Note: File upload routes use direct router registration to support multer middleware
 */
router.post('/logo', checkPermission('platformConfiguration:manage'), upload.single('file'), platformConfigController.uploadLogo)
router.post('/favicon', checkPermission('platformConfiguration:manage'), upload.single('file'), platformConfigController.uploadFavicon)

/**
 * Protected routes - require manage permission for deletion
 */
registerRoute(router, {
    method: 'delete',
    path: '/assets/:id',
    handler: platformConfigController.deleteAsset,
    permission: 'platformConfiguration:manage',
    description: 'Delete an asset'
})

export default router
