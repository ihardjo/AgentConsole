import client from './client'

/**
 * Platform Configuration API
 * 
 * API client for managing platform branding assets (logo, favicon) and configuration.
 */

// ========================================
// Public endpoints (no auth required)
// ========================================

/**
 * Get active logo file
 * Returns the logo image directly (for use in <img src>)
 */
const getActiveLogo = () => client.get('/platform-configuration/logo', { responseType: 'blob' })

/**
 * Get active favicon file
 * Returns the favicon image directly
 */
const getActiveFavicon = () => client.get('/platform-configuration/favicon', { responseType: 'blob' })

/**
 * Get application name
 */
const getApplicationName = () => client.get('/platform-configuration/app-name')

// ========================================
// Protected endpoints (auth required)
// ========================================

/**
 * Get active platform configuration
 * Returns full config including active assets and app name
 */
const getActiveConfig = () => client.get('/platform-configuration')

/**
 * Update application name
 * @param {string} applicationName - The new application name
 */
const updateApplicationName = (applicationName) =>
    client.put('/platform-configuration/app-name', { applicationName })

/**
 * Reset configuration to defaults
 */
const resetConfig = () => client.post('/platform-configuration/reset')

// ========================================
// Asset management endpoints
// ========================================

/**
 * List all assets
 * @param {string} [type] - Optional filter by type ('logo' | 'favicon')
 */
const listAssets = (type) => {
    const url = type ? `/platform-configuration/assets?type=${type}` : '/platform-configuration/assets'
    return client.get(url)
}

/**
 * Get asset by ID
 * @param {string} id - Asset ID
 */
const getAsset = (id) => client.get(`/platform-configuration/assets/${id}`)

/**
 * Get asset file by ID
 * @param {string} id - Asset ID
 */
const getAssetFile = (id) => client.get(`/platform-configuration/assets/${id}/file`, { responseType: 'blob' })

/**
 * Upload a new logo
 * @param {File} file - The logo file to upload
 */
const uploadLogo = (file) => {
    const formData = new FormData()
    formData.append('file', file)
    return client.post('/platform-configuration/logo', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
    })
}

/**
 * Upload a new favicon
 * @param {File} file - The favicon file to upload
 */
const uploadFavicon = (file) => {
    const formData = new FormData()
    formData.append('file', file)
    return client.post('/platform-configuration/favicon', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
    })
}

/**
 * Activate an asset (set as active)
 * @param {string} id - Asset ID
 */
const activateAsset = (id) => client.put(`/platform-configuration/assets/${id}/activate`)

/**
 * Deactivate an asset
 * @param {string} id - Asset ID
 */
const deactivateAsset = (id) => client.put(`/platform-configuration/assets/${id}/deactivate`)

/**
 * Delete an asset
 * @param {string} id - Asset ID
 */
const deleteAsset = (id) => client.delete(`/platform-configuration/assets/${id}`)

// ========================================
// Utility functions
// ========================================

/**
 * Get URL for serving active logo
 * Use this for <img src> without making an API call
 */
const getActiveLogoUrl = () => `${client.defaults.baseURL}/platform-configuration/logo`

/**
 * Get URL for serving active favicon
 * Use this for <link href> without making an API call
 */
const getActiveFaviconUrl = () => `${client.defaults.baseURL}/platform-configuration/favicon`

export default {
    // Public
    getActiveLogo,
    getActiveFavicon,
    getApplicationName,
    // Config
    getActiveConfig,
    updateApplicationName,
    resetConfig,
    // Asset management
    listAssets,
    getAsset,
    getAssetFile,
    uploadLogo,
    uploadFavicon,
    activateAsset,
    deactivateAsset,
    deleteAsset,
    // Utility
    getActiveLogoUrl,
    getActiveFaviconUrl
}
