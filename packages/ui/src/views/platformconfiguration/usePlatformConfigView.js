import { useState, useEffect, useCallback } from 'react'
// API
import platformConfigApi from '@/api/platformConfig'
// Hooks
import useApi from '@/hooks/useApi'
import useConfirm from '@/hooks/useConfirm'
import useNotifier from '@/utils/useNotifier'
// Store
import { store } from '@/store'
import { enqueueSnackbar as enqueueSnackbarAction } from '@/store/actions'
// Context
import { useConfig } from '@/store/context/ConfigContext'
// Event helpers
import { triggerLogoUpdate, triggerFaviconUpdate, triggerAppNameUpdate } from './platformEvents'

// ==============================|| usePlatformConfigView HOOK ||============================== //

/**
 * Encapsulates all state, API interactions, and business logic for the
 * Platform Configuration view. Components only consume the returned values
 * and callbacks — they hold no domain logic themselves.
 */
const usePlatformConfigView = () => {
    const { updateDocumentTitle, updateFavicon } = useConfig()

    // API hooks
    const getActiveConfigApi = useApi(platformConfigApi.getActiveConfig)
    const listAssetsApi = useApi(platformConfigApi.listAssets)
    const updateAppNameApi = useApi(platformConfigApi.updateApplicationName)
    const updateAgentPerformanceUrlApi = useApi(platformConfigApi.updateAgentPerformanceUrl)
    const uploadLogoApi = useApi(platformConfigApi.uploadLogo)
    const uploadFaviconApi = useApi(platformConfigApi.uploadFavicon)
    const activateAssetApi = useApi(platformConfigApi.activateAsset)
    const deactivateAssetApi = useApi(platformConfigApi.deactivateAsset)
    const deleteAssetApi = useApi(platformConfigApi.deleteAsset)

    // Local state
    const [applicationName, setApplicationName] = useState('')
    const [originalAppName, setOriginalAppName] = useState('')
    const [agentPerformanceUrl, setAgentPerformanceUrl] = useState('')
    const [originalAgentPerformanceUrl, setOriginalAgentPerformanceUrl] = useState('')
    const [assets, setAssets] = useState([])
    const [activeConfig, setActiveConfig] = useState(null)
    const [isLoading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)

    // Notification helpers
    useNotifier()
    const enqueueSnackbar = (...args) => store.dispatch(enqueueSnackbarAction(...args))

    // Confirm dialog
    const { confirm } = useConfirm()

    // ── Data Loaders ──────────────────────────────────────────────────────────

    /**
     * Load active config and all assets in parallel. Called on mount and via
     * the Refresh button. All state is set atomically before the loading flag
     * is cleared to prevent a flash of empty / stale fields.
     */
    const loadData = useCallback(async () => {
        setLoading(true)
        try {
            const [configRes, assetsRes] = await Promise.all([platformConfigApi.getActiveConfig(), platformConfigApi.listAssets()])
            const configData = configRes.data
            setActiveConfig(configData)
            setApplicationName(configData?.applicationName || '')
            setOriginalAppName(configData?.applicationName || '')
            setAgentPerformanceUrl(configData?.agentPerformanceUrl || '')
            setOriginalAgentPerformanceUrl(configData?.agentPerformanceUrl || '')
            setAssets(assetsRes.data || [])
        } catch (err) {
            console.error('Error loading platform config:', err)
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        loadData()
    }, [loadData])

    // Sync config state whenever a useApi-based mutation refreshes it
    useEffect(() => {
        if (!getActiveConfigApi.data) return
        const data = getActiveConfigApi.data
        setActiveConfig(data)
        setApplicationName(data.applicationName || '')
        setOriginalAppName(data.applicationName || '')
        setAgentPerformanceUrl(data.agentPerformanceUrl || '')
        setOriginalAgentPerformanceUrl(data.agentPerformanceUrl || '')
    }, [getActiveConfigApi.data])

    // Sync asset list whenever a useApi-based mutation refreshes it
    useEffect(() => {
        if (listAssetsApi.data) setAssets(listAssetsApi.data)
    }, [listAssetsApi.data])

    // ── Application Name ──────────────────────────────────────────────────────

    const handleSaveAppName = async () => {
        if (!applicationName.trim()) {
            enqueueSnackbar({ message: 'Application name cannot be empty', options: { variant: 'error' } })
            return
        }
        setSaving(true)
        try {
            await updateAppNameApi.request(applicationName)
            setOriginalAppName(applicationName)
            updateDocumentTitle(applicationName)
            triggerAppNameUpdate()
            enqueueSnackbar({ message: 'Application name updated successfully', options: { variant: 'success' } })
        } catch (err) {
            enqueueSnackbar({ message: err.message || 'Failed to update application name', options: { variant: 'error' } })
        } finally {
            setSaving(false)
        }
    }

    // ── Agent Performance URL ─────────────────────────────────────────────────

    const handleSaveAgentPerformanceUrl = async () => {
        if (!agentPerformanceUrl.trim()) {
            enqueueSnackbar({ message: 'Agent Performance URL cannot be empty', options: { variant: 'error' } })
            return
        }
        setSaving(true)
        try {
            await updateAgentPerformanceUrlApi.request(agentPerformanceUrl)
            setOriginalAgentPerformanceUrl(agentPerformanceUrl)
            enqueueSnackbar({ message: 'Agent Performance URL updated successfully', options: { variant: 'success' } })
        } catch (err) {
            enqueueSnackbar({ message: err.message || 'Failed to update Agent Performance URL', options: { variant: 'error' } })
        } finally {
            setSaving(false)
        }
    }

    // ── Asset Upload ──────────────────────────────────────────────────────────

    const handleUpload = async (type, file) => {
        if (!file) return
        setSaving(true)
        try {
            const uploadApi = type === 'logo' ? uploadLogoApi : uploadFaviconApi
            await uploadApi.request(file)
            enqueueSnackbar({ message: `${type === 'logo' ? 'Logo' : 'Favicon'} uploaded successfully`, options: { variant: 'success' } })
            // Refresh both assets list and active config — the server may auto-activate
            // the first upload, so activeConfig must stay in sync.
            await Promise.all([listAssetsApi.request(), getActiveConfigApi.request()])
        } catch (err) {
            enqueueSnackbar({ message: err.message || `Failed to upload ${type}`, options: { variant: 'error' } })
        } finally {
            setSaving(false)
        }
    }

    // ── Asset Activate ────────────────────────────────────────────────────────

    const handleActivateAsset = async (assetId) => {
        const assetType = assets.find((a) => a.id === assetId)?.assetType
        setSaving(true)
        try {
            await activateAssetApi.request(assetId)
            enqueueSnackbar({ message: 'Asset activated successfully', options: { variant: 'success' } })
            await Promise.all([getActiveConfigApi.request(), listAssetsApi.request()])
            if (assetType === 'favicon') {
                updateFavicon(true)
                triggerFaviconUpdate()
            } else if (assetType === 'logo') {
                triggerLogoUpdate()
            }
        } catch (err) {
            enqueueSnackbar({ message: err.message || 'Failed to activate asset', options: { variant: 'error' } })
        } finally {
            setSaving(false)
        }
    }

    // ── Asset Deactivate ──────────────────────────────────────────────────────

    const handleDeactivateAsset = async (assetId) => {
        const assetType = assets.find((a) => a.id === assetId)?.assetType
        setSaving(true)
        try {
            await deactivateAssetApi.request(assetId)
            enqueueSnackbar({ message: 'Asset deactivated successfully', options: { variant: 'success' } })
            await Promise.all([getActiveConfigApi.request(), listAssetsApi.request()])
            if (assetType === 'favicon') {
                updateFavicon(false)
                triggerFaviconUpdate()
            } else if (assetType === 'logo') {
                triggerLogoUpdate()
            }
        } catch (err) {
            enqueueSnackbar({ message: err.message || 'Failed to deactivate asset', options: { variant: 'error' } })
        } finally {
            setSaving(false)
        }
    }

    // ── Asset Delete ──────────────────────────────────────────────────────────

    const handleDeleteAsset = async (assetId) => {
        const confirmed = await confirm({
            title: 'Delete Asset',
            description: 'Are you sure you want to delete this asset? This action cannot be undone.',
            confirmButtonName: 'Delete'
        })
        if (!confirmed) return

        const asset = assets.find((a) => a.id === assetId)
        const { assetType } = asset ?? {}
        const wasActive = activeConfig?.activeLogo?.id === assetId || activeConfig?.activeFavicon?.id === assetId

        setSaving(true)
        try {
            await deleteAssetApi.request(assetId)
            enqueueSnackbar({ message: 'Asset deleted successfully', options: { variant: 'success' } })
            await listAssetsApi.request()

            // If the active asset was removed, immediately revert the browser UI
            if (wasActive) {
                if (assetType === 'favicon') {
                    updateFavicon(false)
                    triggerFaviconUpdate()
                } else if (assetType === 'logo') {
                    try {
                        localStorage.removeItem('platform_logo_active')
                    } catch (_) {
                        // intentionally empty — localStorage may be unavailable
                    }
                    triggerLogoUpdate()
                }
            }
        } catch (err) {
            enqueueSnackbar({ message: err.message || 'Failed to delete asset', options: { variant: 'error' } })
        } finally {
            setSaving(false)
        }
    }

    // ── Derived values ────────────────────────────────────────────────────────

    const logoAssets = assets.filter((a) => a.assetType === 'logo')
    const faviconAssets = assets.filter((a) => a.assetType === 'favicon')

    return {
        // Loading / saving flags
        isLoading,
        saving,
        // Application name
        applicationName,
        setApplicationName,
        originalAppName,
        handleSaveAppName,
        // Agent Performance URL
        agentPerformanceUrl,
        setAgentPerformanceUrl,
        originalAgentPerformanceUrl,
        handleSaveAgentPerformanceUrl,
        // Assets
        logoAssets,
        faviconAssets,
        activeConfig,
        // Asset handlers
        handleUpload,
        handleActivateAsset,
        handleDeactivateAsset,
        handleDeleteAsset,
        // Misc
        loadData
    }
}

export default usePlatformConfigView
