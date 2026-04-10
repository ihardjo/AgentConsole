import { useState, useEffect, useCallback } from 'react'
import { useSelector } from 'react-redux'

// material-ui
import {
    Box,
    Button,
    Card,
    CardContent,
    CircularProgress,
    Grid,
    IconButton,
    Paper,
    Skeleton,
    Stack,
    Tab,
    Tabs,
    TextField,
    Typography,
    Tooltip,
    Alert,
    Chip
} from '@mui/material'
import { useTheme } from '@mui/material/styles'

// project imports
import ErrorBoundary from '@/ErrorBoundary'
import ViewHeader from '@/layout/MainLayout/ViewHeader'
import MainCard from '@/ui-component/cards/MainCard'
import ConfirmDialog from '@/ui-component/dialog/ConfirmDialog'
import { useConfig } from '@/store/context/ConfigContext'
import { useError } from '@/store/context/ErrorContext'

// API
import platformConfigApi from '@/api/platformConfig'

// Hooks
import useApi from '@/hooks/useApi'
import useConfirm from '@/hooks/useConfirm'
import useNotifier from '@/utils/useNotifier'

// icons
import {
    IconUpload,
    IconTrash,
    IconCheck,
    IconX,
    IconPhoto,
    IconDeviceFloppy,
    IconRefresh
} from '@tabler/icons-react'

// Store
import { store } from '@/store'
import { closeSnackbar as closeSnackbarAction, enqueueSnackbar as enqueueSnackbarAction } from '@/store/actions'

// Constants
import { gridSpacing } from '@/store/constant'

// ==============================|| ASSET CARD COMPONENT ||============================== //

const AssetCard = ({ asset, isActive, onActivate, onDeactivate, onDelete, saving, theme, isCompact = false }) => {
    const [imageUrl, setImageUrl] = useState(null)
    const [imageError, setImageError] = useState(false)
    const [isHovered, setIsHovered] = useState(false)

    useEffect(() => {
        // Load asset preview
        const loadPreview = async () => {
            try {
                const response = await platformConfigApi.getAssetFile(asset.id)
                const url = URL.createObjectURL(response.data)
                setImageUrl(url)
            } catch (error) {
                console.error('Error loading asset preview:', error)
                setImageError(true)
            }
        }
        loadPreview()

        return () => {
            if (imageUrl) {
                URL.revokeObjectURL(imageUrl)
            }
        }
    }, [asset.id])

    const formatFileSize = (bytes) => {
        if (bytes === 0) return '0 Bytes'
        const k = 1024
        const sizes = ['Bytes', 'KB', 'MB']
        const i = Math.floor(Math.log(bytes) / Math.log(k))
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
    }

    const formatDate = (dateString) => {
        return new Date(dateString).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        })
    }

    return (
        <Card
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            sx={{
                position: 'relative',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                border: isActive ? `2px solid ${theme.palette.primary.main}` : '1px solid',
                borderColor: isActive ? theme.palette.primary.main : theme.palette.divider,
                borderRadius: 2,
                transition: 'all 0.2s ease-in-out',
                transform: isHovered ? 'translateY(-4px)' : 'none',
                boxShadow: isHovered ? theme.shadows[8] : isActive ? theme.shadows[4] : theme.shadows[1],
                overflow: 'hidden',
                backgroundColor: theme.palette.background.paper,
                '&:hover': {
                    borderColor: isActive ? theme.palette.primary.main : theme.palette.primary.light
                }
            }}
        >
            {/* Active Badge */}
            {isActive && (
                <Box
                    sx={{
                        position: 'absolute',
                        top: 12,
                        right: 12,
                        zIndex: 1
                    }}
                >
                    <Chip
                        icon={<IconCheck size={14} />}
                        label='Active'
                        color='primary'
                        size='small'
                        sx={{
                            fontWeight: 600,
                            fontSize: '0.7rem',
                            letterSpacing: '0.02em',
                            boxShadow: theme.shadows[2],
                            '& .MuiChip-icon': { ml: 0.5 }
                        }}
                    />
                </Box>
            )}

            {/* Preview Area */}
            <Box
                sx={{
                    position: 'relative',
                    height: isCompact ? 100 : 140,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: theme.palette.mode === 'dark' 
                        ? 'rgba(255,255,255,0.05)' 
                        : 'rgba(0,0,0,0.02)',
                    borderBottom: `1px solid ${theme.palette.divider}`,
                    p: 2
                }}
            >
                {imageError ? (
                    <Box sx={{ textAlign: 'center' }}>
                        <IconPhoto size={40} color={theme.palette.text.disabled} />
                        <Typography variant='caption' color='text.disabled' display='block'>
                            Preview unavailable
                        </Typography>
                    </Box>
                ) : imageUrl ? (
                    <Box
                        sx={{
                            width: '100%',
                            height: '100%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            // Checkerboard pattern for transparency
                            backgroundImage: `linear-gradient(45deg, ${theme.palette.action.hover} 25%, transparent 25%), 
                                              linear-gradient(-45deg, ${theme.palette.action.hover} 25%, transparent 25%), 
                                              linear-gradient(45deg, transparent 75%, ${theme.palette.action.hover} 75%), 
                                              linear-gradient(-45deg, transparent 75%, ${theme.palette.action.hover} 75%)`,
                            backgroundSize: '16px 16px',
                            backgroundPosition: '0 0, 0 8px, 8px -8px, -8px 0px',
                            borderRadius: 1
                        }}
                    >
                        <img
                            src={imageUrl}
                            alt={asset.fileName}
                            style={{
                                maxHeight: '100%',
                                maxWidth: '100%',
                                objectFit: 'contain'
                            }}
                        />
                    </Box>
                ) : (
                    <CircularProgress size={28} />
                )}
            </Box>

            {/* Info Section */}
            <CardContent sx={{ flexGrow: 1, p: 2, '&:last-child': { pb: 2 } }}>
                <Tooltip title={asset.fileName} placement='top'>
                    <Typography 
                        variant='subtitle2' 
                        color='text.primary'
                        noWrap 
                        sx={{ 
                            fontWeight: 600,
                            mb: 0.5,
                            letterSpacing: '0.01em'
                        }}
                    >
                        {asset.fileName}
                    </Typography>
                </Tooltip>
                
                <Stack direction='row' spacing={1} alignItems='center' sx={{ mb: 1.5 }}>
                    <Typography 
                        variant='caption' 
                        color='text.secondary'
                        sx={{ 
                            fontWeight: 500,
                            letterSpacing: '0.02em'
                        }}
                    >
                        {formatFileSize(asset.fileSize)}
                    </Typography>
                    {asset.createdDate && (
                        <>
                            <Typography variant='caption' color='text.disabled'>•</Typography>
                            <Typography 
                                variant='caption' 
                                color='text.secondary'
                                sx={{ letterSpacing: '0.02em' }}
                            >
                                {formatDate(asset.createdDate)}
                            </Typography>
                        </>
                    )}
                </Stack>

                {/* Actions */}
                <Stack direction='row' spacing={1} justifyContent='flex-start'>
                    {isActive ? (
                        <Button
                            size='small'
                            variant='outlined'
                            color='inherit'
                            onClick={() => onDeactivate(asset.id)}
                            disabled={saving}
                            startIcon={<IconX size={16} />}
                            sx={{ 
                                borderRadius: 1.5,
                                textTransform: 'none',
                                fontSize: '0.75rem',
                                fontWeight: 500,
                                borderColor: theme.palette.divider,
                                '&:hover': {
                                    borderColor: theme.palette.text.primary,
                                    backgroundColor: theme.palette.action.hover
                                }
                            }}
                        >
                            Deactivate
                        </Button>
                    ) : (
                        <>
                            <Button
                                size='small'
                                variant='contained'
                                color='primary'
                                onClick={() => onActivate(asset.id)}
                                disabled={saving}
                                startIcon={<IconCheck size={16} />}
                                sx={{ 
                                    borderRadius: 1.5,
                                    textTransform: 'none',
                                    fontSize: '0.75rem',
                                    fontWeight: 500,
                                    boxShadow: theme.shadows[2],
                                    '&:hover': {
                                        boxShadow: theme.shadows[4]
                                    }
                                }}
                            >
                                Activate
                            </Button>
                            <Tooltip title='Delete'>
                                <IconButton
                                    size='small'
                                    color='error'
                                    onClick={() => onDelete(asset.id)}
                                    disabled={saving}
                                    sx={{
                                        border: `1px solid ${theme.palette.error.main}`,
                                        borderRadius: 1.5,
                                        transition: 'all 0.2s ease-in-out',
                                        '&:hover': {
                                            backgroundColor: theme.palette.error.main,
                                            color: theme.palette.error.contrastText,
                                            transform: 'scale(1.05)'
                                        }
                                    }}
                                >
                                    <IconTrash size={16} />
                                </IconButton>
                            </Tooltip>
                        </>
                    )}
                </Stack>
            </CardContent>
        </Card>
    )
}

// ==============================|| ASSET MANAGER COMPONENT ||============================== //

const AssetManager = ({
    type,
    assets,
    activeAsset,
    onUpload,
    onActivate,
    onDeactivate,
    onDelete,
    saving,
    theme,
    acceptedTypes,
    description
}) => {
    const [dragActive, setDragActive] = useState(false)

    const handleFileChange = (e) => {
        const file = e.target.files?.[0]
        if (file) {
            onUpload(file)
            e.target.value = '' // Reset input
        }
    }

    const handleDrag = (e) => {
        e.preventDefault()
        e.stopPropagation()
        if (e.type === 'dragenter' || e.type === 'dragover') {
            setDragActive(true)
        } else if (e.type === 'dragleave') {
            setDragActive(false)
        }
    }

    const handleDrop = (e) => {
        e.preventDefault()
        e.stopPropagation()
        setDragActive(false)
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            onUpload(e.dataTransfer.files[0])
        }
    }

    // Filter out active asset from the "all assets" list to avoid duplication
    const inactiveAssets = assets.filter(a => !a.isActive)

    return (
        <Stack spacing={4}>
            {/* Upload Section */}
            <Box>
                <Paper
                    component='label'
                    onDragEnter={handleDrag}
                    onDragLeave={handleDrag}
                    onDragOver={handleDrag}
                    onDrop={handleDrop}
                    sx={{
                        p: 4,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: saving ? 'not-allowed' : 'pointer',
                        border: `2px dashed ${
                            dragActive 
                                ? theme.palette.primary.main 
                                : theme.palette.mode === 'dark'
                                    ? 'rgba(255, 255, 255, 0.3)'
                                    : theme.palette.divider
                        }`,
                        borderRadius: 2,
                        backgroundColor: dragActive 
                            ? theme.palette.primary.main + (theme.palette.mode === 'dark' ? '20' : '10')
                            : theme.palette.mode === 'dark' 
                                ? 'rgba(255,255,255,0.05)' 
                                : 'rgba(0,0,0,0.02)',
                        transition: 'all 0.2s ease-in-out',
                        minHeight: 160,
                        '&:hover': {
                            borderColor: theme.palette.primary.main,
                            backgroundColor: theme.palette.primary.main + (theme.palette.mode === 'dark' ? '15' : '08'),
                            '& .upload-icon': {
                                transform: 'translateY(-4px)',
                                color: theme.palette.primary.main
                            }
                        }
                    }}
                >
                    <input
                        type='file'
                        hidden
                        accept={acceptedTypes}
                        onChange={handleFileChange}
                        disabled={saving}
                    />
                    <IconUpload 
                        className='upload-icon'
                        size={40} 
                        color={
                            dragActive 
                                ? theme.palette.primary.main 
                                : theme.palette.mode === 'dark'
                                    ? 'rgba(255, 255, 255, 0.7)'
                                    : theme.palette.text.secondary
                        }
                        style={{ 
                            marginBottom: 16,
                            transition: 'all 0.2s ease-in-out'
                        }}
                    />
                    <Typography 
                        variant='subtitle1' 
                        sx={{ 
                            fontWeight: 600, 
                            mb: 0.5, 
                            textAlign: 'center',
                            letterSpacing: '0.01em',
                            color: theme.palette.mode === 'dark'
                                ? 'rgba(255, 255, 255, 0.95)'
                                : theme.palette.text.primary
                        }}
                    >
                        {dragActive ? 'Drop your file here' : `Upload ${type === 'logo' ? 'Logo' : 'Favicon'}`}
                    </Typography>
                    <Typography 
                        variant='body2' 
                        sx={{ 
                            textAlign: 'center',
                            fontWeight: 400,
                            letterSpacing: '0.02em',
                            color: theme.palette.mode === 'dark'
                                ? 'rgba(255, 255, 255, 0.7)'
                                : theme.palette.text.secondary
                        }}
                    >
                        Drag and drop or click to browse
                    </Typography>
                    <Typography 
                        variant='caption' 
                        sx={{ 
                            mt: 2, 
                            textAlign: 'center', 
                            maxWidth: 320,
                            lineHeight: 1.5,
                            letterSpacing: '0.02em',
                            fontWeight: 400,
                            color: theme.palette.mode === 'dark'
                                ? 'rgba(255, 255, 255, 0.7)'
                                : theme.palette.text.secondary
                        }}
                    >
                        {description}
                    </Typography>
                </Paper>
            </Box>

            {/* Currently Active Section */}
            {activeAsset && (
                <Box>
                    <Stack direction='row' alignItems='center' spacing={1} sx={{ mb: 2 }}>
                        <Box
                            sx={{
                                width: 4,
                                height: 20,
                                backgroundColor: theme.palette.primary.main,
                                borderRadius: 1,
                                boxShadow: `0 0 8px ${theme.palette.primary.main}40`
                            }}
                        />
                        <Typography 
                            variant='h6' 
                            color='text.primary'
                            sx={{ 
                                fontWeight: 600,
                                letterSpacing: '0.01em'
                            }}
                        >
                            Currently Active
                        </Typography>
                    </Stack>
                    <Grid container spacing={gridSpacing}>
                        <Grid item xs={12} sm={6} md={4} lg={3}>
                            <AssetCard
                                asset={activeAsset}
                                isActive={true}
                                onDeactivate={onDeactivate}
                                onDelete={onDelete}
                                saving={saving}
                                theme={theme}
                            />
                        </Grid>
                    </Grid>
                </Box>
            )}

            {/* All Assets Section */}
            <Box>
                <Stack direction='row' alignItems='center' justifyContent='space-between' sx={{ mb: 2 }}>
                    <Stack direction='row' alignItems='center' spacing={1}>
                        <Box
                            sx={{
                                width: 4,
                                height: 20,
                                backgroundColor: theme.palette.text.secondary,
                                borderRadius: 1,
                                opacity: 0.6
                            }}
                        />
                        <Typography 
                            variant='h6' 
                            color='text.primary'
                            sx={{ 
                                fontWeight: 600,
                                letterSpacing: '0.01em'
                            }}
                        >
                            {activeAsset ? 'Other ' : 'All '}{type === 'logo' ? 'Logos' : 'Favicons'}
                        </Typography>
                        <Chip 
                            label={inactiveAssets.length} 
                            size='small' 
                            sx={{ 
                                height: 22,
                                fontWeight: 600,
                                backgroundColor: theme.palette.action.selected,
                                color: theme.palette.text.primary
                            }} 
                        />
                    </Stack>
                </Stack>
                
                {inactiveAssets.length > 0 && (
                    <Grid container spacing={gridSpacing}>
                        {inactiveAssets.map((asset) => (
                            <Grid item xs={12} sm={6} md={4} lg={3} key={asset.id}>
                                <AssetCard
                                    asset={asset}
                                    isActive={false}
                                    onActivate={onActivate}
                                    onDeactivate={onDeactivate}
                                    onDelete={onDelete}
                                    saving={saving}
                                    theme={theme}
                                    isCompact
                                />
                            </Grid>
                        ))}
                    </Grid>
                )}
            </Box>
        </Stack>
    )
}

// ==============================|| PLATFORM CONFIGURATION ||============================== //

// Helper function to reset favicon to default
const resetFavicon = () => {
    let faviconLink = document.querySelector("link[rel*='icon']")
    if (faviconLink) {
        faviconLink.href = '/favicon.ico'
    }
    const appleTouchIcon = document.querySelector("link[rel='apple-touch-icon']")
    if (appleTouchIcon) {
        appleTouchIcon.href = '/logo192.png'
    }
}

// Helper function to trigger logo update event (for components that display the logo)
const triggerLogoUpdate = () => {
    // Dispatch a custom event that logo components can listen to
    window.dispatchEvent(new CustomEvent('platformLogoUpdated', { detail: { timestamp: Date.now() } }))
}

// Helper function to trigger favicon update event
const triggerFaviconUpdate = () => {
    window.dispatchEvent(new CustomEvent('platformFaviconUpdated', { detail: { timestamp: Date.now() } }))
}

// Helper function to trigger app name update event
const triggerAppNameUpdate = () => {
    window.dispatchEvent(new CustomEvent('platformAppNameUpdated', { detail: { timestamp: Date.now() } }))
}

const PlatformConfiguration = () => {
    const theme = useTheme()
    const customization = useSelector((state) => state.customization)
    const { updateDocumentTitle, updateFavicon } = useConfig()
    const { error, setError } = useError()

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

    // State
    const [tabValue, setTabValue] = useState(0)
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
    const closeSnackbar = (...args) => store.dispatch(closeSnackbarAction(...args))

    // Confirm dialog
    const { confirm } = useConfirm()

    // Load initial data
    const loadData = useCallback(async () => {
        setLoading(true)
        try {
            const [configRes, assetsRes] = await Promise.all([
                getActiveConfigApi.request(),
                listAssetsApi.request()
            ])
        } catch (error) {
            console.error('Error loading platform config:', error)
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        loadData()
    }, [])

    // Handle config response
    useEffect(() => {
        if (getActiveConfigApi.data) {
            setActiveConfig(getActiveConfigApi.data)
            setApplicationName(getActiveConfigApi.data.applicationName || '')
            setOriginalAppName(getActiveConfigApi.data.applicationName || '')
            setAgentPerformanceUrl(getActiveConfigApi.data.agentPerformanceUrl || '')
            setOriginalAgentPerformanceUrl(getActiveConfigApi.data.agentPerformanceUrl || '')
        }
    }, [getActiveConfigApi.data])

    // Handle assets response
    useEffect(() => {
        if (listAssetsApi.data) {
            setAssets(listAssetsApi.data)
        }
    }, [listAssetsApi.data])

    // Tab change handler
    const handleTabChange = (event, newValue) => {
        setTabValue(newValue)
    }

    // Save application name
    const handleSaveAppName = async () => {
        if (!applicationName.trim()) {
            enqueueSnackbar({
                message: 'Application name cannot be empty',
                options: { variant: 'error' }
            })
            return
        }

        setSaving(true)
        try {
            await updateAppNameApi.request(applicationName)
            setOriginalAppName(applicationName)
            // Update the browser tab title immediately
            updateDocumentTitle(applicationName)
            // Trigger event for other components to update
            triggerAppNameUpdate()
            enqueueSnackbar({
                message: 'Application name updated successfully',
                options: { variant: 'success' }
            })
        } catch (error) {
            enqueueSnackbar({
                message: error.message || 'Failed to update application name',
                options: { variant: 'error' }
            })
        } finally {
            setSaving(false)
        }
    }

    // Save Agent Performance URL
    const handleSaveAgentPerformanceUrl = async () => {
        if (!agentPerformanceUrl.trim()) {
            enqueueSnackbar({
                message: 'Agent Performance URL cannot be empty',
                options: { variant: 'error' }
            })
            return
        }

        setSaving(true)
        try {
            await updateAgentPerformanceUrlApi.request(agentPerformanceUrl)
            setOriginalAgentPerformanceUrl(agentPerformanceUrl)
            enqueueSnackbar({
                message: 'Agent Performance URL updated successfully',
                options: { variant: 'success' }
            })
        } catch (error) {
            enqueueSnackbar({
                message: error.message || 'Failed to update Agent Performance URL',
                options: { variant: 'error' }
            })
        } finally {
            setSaving(false)
        }
    }

    // Upload handler
    const handleUpload = async (type, file) => {
        if (!file) return

        setSaving(true)
        try {
            const uploadFn = type === 'logo' ? uploadLogoApi : uploadFaviconApi
            await uploadFn.request(file)
            enqueueSnackbar({
                message: `${type === 'logo' ? 'Logo' : 'Favicon'} uploaded successfully`,
                options: { variant: 'success' }
            })
            // Refresh assets
            await listAssetsApi.request()
        } catch (error) {
            enqueueSnackbar({
                message: error.message || `Failed to upload ${type}`,
                options: { variant: 'error' }
            })
        } finally {
            setSaving(false)
        }
    }

    // Activate asset
    const handleActivateAsset = async (assetId) => {
        // Find the asset to determine its type
        const asset = assets.find(a => a.id === assetId)
        const assetType = asset?.assetType
        
        setSaving(true)
        try {
            await activateAssetApi.request(assetId)
            enqueueSnackbar({
                message: 'Asset activated successfully',
                options: { variant: 'success' }
            })
            // Refresh data
            await Promise.all([
                getActiveConfigApi.request(),
                listAssetsApi.request()
            ])
            
            // Hot reload: Update the asset in the browser immediately
            if (assetType === 'favicon') {
                updateFavicon(true) // Uses public route to fetch active favicon
                triggerFaviconUpdate() // Trigger event for other components
            } else if (assetType === 'logo') {
                triggerLogoUpdate()
            }
        } catch (error) {
            enqueueSnackbar({
                message: error.message || 'Failed to activate asset',
                options: { variant: 'error' }
            })
        } finally {
            setSaving(false)
        }
    }

    // Deactivate asset
    const handleDeactivateAsset = async (assetId) => {
        // Find the asset to determine its type
        const asset = assets.find(a => a.id === assetId)
        const assetType = asset?.assetType
        
        setSaving(true)
        try {
            await deactivateAssetApi.request(assetId)
            enqueueSnackbar({
                message: 'Asset deactivated successfully',
                options: { variant: 'success' }
            })
            // Refresh data
            await Promise.all([
                getActiveConfigApi.request(),
                listAssetsApi.request()
            ])
            
            // Hot reload: Reset to default when deactivated
            if (assetType === 'favicon') {
                resetFavicon() // Reset to default favicon
            } else if (assetType === 'logo') {
                triggerLogoUpdate()
            }
        } catch (error) {
            enqueueSnackbar({
                message: error.message || 'Failed to deactivate asset',
                options: { variant: 'error' }
            })
        } finally {
            setSaving(false)
        }
    }

    // Delete asset
    const handleDeleteAsset = async (assetId) => {
        const confirmResult = await confirm({
            title: 'Delete Asset',
            description: 'Are you sure you want to delete this asset? This action cannot be undone.',
            confirmButtonName: 'Delete'
        })

        if (confirmResult) {
            setSaving(true)
            try {
                await deleteAssetApi.request(assetId)
                enqueueSnackbar({
                    message: 'Asset deleted successfully',
                    options: { variant: 'success' }
                })
                // Refresh assets
                await listAssetsApi.request()
            } catch (error) {
                enqueueSnackbar({
                    message: error.message || 'Failed to delete asset',
                    options: { variant: 'error' }
                })
            } finally {
                setSaving(false)
            }
        }
    }

    // Filter assets by type
    const logoAssets = assets.filter(a => a.assetType === 'logo')
    const faviconAssets = assets.filter(a => a.assetType === 'favicon')

    return (
        <MainCard>
            {error ? (
                <ErrorBoundary error={error} />
            ) : (
                <Stack flexDirection='column' sx={{ gap: 3 }}>
                    <ViewHeader
                        title='Platform Configuration'
                        description='Customize your application branding - name, logo, and favicon'
                    >
                        <Tooltip title='Refresh'>
                            <IconButton 
                                onClick={loadData} 
                                disabled={isLoading || saving}
                                sx={{
                                    border: `1px solid ${
                                        theme.palette.mode === 'dark'
                                            ? 'rgba(255, 255, 255, 0.23)'
                                            : theme.palette.divider
                                    }`,
                                    borderRadius: 1.5,
                                    transition: 'all 0.2s ease-in-out',
                                    color: theme.palette.mode === 'dark'
                                        ? 'rgba(255, 255, 255, 0.7)'
                                        : theme.palette.text.secondary,
                                    '&:hover': {
                                        borderColor: theme.palette.primary.main,
                                        backgroundColor: theme.palette.primary.main + (theme.palette.mode === 'dark' ? '15' : '08'),
                                        color: theme.palette.primary.main,
                                        transform: 'scale(1.05)',
                                        '& svg': {
                                            transform: 'rotate(-45deg)'
                                        }
                                    },
                                    '&.Mui-disabled': {
                                        borderColor: theme.palette.mode === 'dark'
                                            ? 'rgba(255, 255, 255, 0.12)'
                                            : theme.palette.divider,
                                        color: theme.palette.mode === 'dark'
                                            ? 'rgba(255, 255, 255, 0.3)'
                                            : theme.palette.action.disabled
                                    },
                                    '& svg': {
                                        transition: 'transform 0.3s ease-in-out'
                                    }
                                }}
                            >
                                <IconRefresh size={20} />
                            </IconButton>
                        </Tooltip>
                    </ViewHeader>

                    {isLoading && (
                        <Box>
                            <Skeleton variant='rounded' height={48} sx={{ mb: 2 }} />
                            <Skeleton variant='rounded' height={200} />
                        </Box>
                    )}

                    {!isLoading && (
                        <>
                            <Tabs 
                                value={tabValue} 
                                onChange={handleTabChange}
                                sx={{
                                    '& .MuiTab-root': {
                                        textTransform: 'none',
                                        fontWeight: 500,
                                        fontSize: '0.95rem',
                                        letterSpacing: '0.01em',
                                        minHeight: 48,
                                        transition: 'all 0.2s ease-in-out',
                                        '&:hover': {
                                            color: theme.palette.primary.main,
                                            backgroundColor: theme.palette.action.hover
                                        }
                                    },
                                    '& .Mui-selected': {
                                        fontWeight: 600
                                    },
                                    '& .MuiTabs-indicator': {
                                        height: 3,
                                        borderRadius: '3px 3px 0 0'
                                    }
                                }}
                            >
                                <Tab label='Application Name' />
                                <Tab label='Agent Performance URL' />
                                <Tab label='Logo' />
                                <Tab label='Favicon' />
                            </Tabs>

                            {/* Application Name Tab */}
                            {tabValue === 0 && (
                                <Box>
                                    <Typography 
                                        variant='body2' 
                                        color='text.secondary' 
                                        sx={{ 
                                            mb: 2,
                                            lineHeight: 1.6,
                                            letterSpacing: '0.01em'
                                        }}
                                    >
                                        Set the name of your application. This will be displayed in the browser tab and throughout the application.
                                    </Typography>
                                    <Stack direction='row' spacing={2} alignItems='center'>
                                        <TextField
                                            label='Application Name'
                                            value={applicationName}
                                            onChange={(e) => setApplicationName(e.target.value)}
                                            variant='outlined'
                                            size='small'
                                            sx={{ 
                                                width: 300,
                                                '& .MuiOutlinedInput-root': {
                                                    backgroundColor: theme.palette.mode === 'dark' 
                                                        ? 'rgba(255, 255, 255, 0.05)' 
                                                        : 'transparent',
                                                    '&:hover fieldset': {
                                                        borderColor: theme.palette.primary.main
                                                    }
                                                },
                                                '& .MuiInputLabel-root': {
                                                    color: theme.palette.mode === 'dark'
                                                        ? 'rgba(255, 255, 255, 0.7)'
                                                        : undefined
                                                }
                                            }}
                                        />
                                        <Button
                                            variant='contained'
                                            onClick={handleSaveAppName}
                                            disabled={saving || applicationName === originalAppName}
                                            startIcon={saving ? <CircularProgress size={16} /> : <IconDeviceFloppy size={18} />}
                                            sx={{
                                                textTransform: 'none',
                                                fontWeight: 600,
                                                letterSpacing: '0.02em',
                                                boxShadow: theme.shadows[3],
                                                px: 3,
                                                '&:hover': {
                                                    boxShadow: theme.shadows[6]
                                                },
                                                '&.Mui-disabled': {
                                                    backgroundColor: theme.palette.mode === 'dark'
                                                        ? 'rgba(255, 255, 255, 0.12)'
                                                        : undefined
                                                }
                                            }}
                                        >
                                            Save
                                        </Button>
                                    </Stack>
                                    {applicationName !== originalAppName && (
                                        <Alert 
                                            severity='info' 
                                            sx={{ 
                                                mt: 2,
                                                '& .MuiAlert-message': {
                                                    fontSize: '0.875rem',
                                                    letterSpacing: '0.01em'
                                                }
                                            }}
                                        >
                                            You have unsaved changes. Click Save to apply.
                                        </Alert>
                                    )}
                                </Box>
                            )}

                            {/* Agent Performance URL Tab */}
                            {tabValue === 1 && (
                                <Box>
                                    <Typography 
                                        variant='body2' 
                                        color='text.secondary' 
                                        sx={{ 
                                            mb: 2,
                                            lineHeight: 1.6,
                                            letterSpacing: '0.01em'
                                        }}
                                    >
                                        Set the Agent Performance URL for agent performance and monitoring. This will be used to track and analyze your AI agent's performance.
                                    </Typography>
                                    <Stack direction='row' spacing={2} alignItems='center'>
                                        <TextField
                                            label='Agent Performance URL'
                                            value={agentPerformanceUrl}
                                            onChange={(e) => setAgentPerformanceUrl(e.target.value)}
                                            variant='outlined'
                                            size='small'
                                            placeholder='https://example.com/agent-performance/'
                                            sx={{ 
                                                width: 400,
                                                '& .MuiOutlinedInput-root': {
                                                    backgroundColor: theme.palette.mode === 'dark' 
                                                        ? 'rgba(255, 255, 255, 0.05)' 
                                                        : 'transparent',
                                                    '&:hover fieldset': {
                                                        borderColor: theme.palette.primary.main
                                                    }
                                                },
                                                '& .MuiInputLabel-root': {
                                                    color: theme.palette.mode === 'dark'
                                                        ? 'rgba(255, 255, 255, 0.7)'
                                                        : undefined
                                                }
                                            }}
                                        />
                                        <Button
                                            variant='contained'
                                            onClick={handleSaveAgentPerformanceUrl}
                                            disabled={saving || agentPerformanceUrl === originalAgentPerformanceUrl}
                                            startIcon={saving ? <CircularProgress size={16} /> : <IconDeviceFloppy size={18} />}
                                            sx={{
                                                textTransform: 'none',
                                                fontWeight: 600,
                                                letterSpacing: '0.02em',
                                                boxShadow: theme.shadows[3],
                                                px: 3,
                                                '&:hover': {
                                                    boxShadow: theme.shadows[6]
                                                },
                                                '&.Mui-disabled': {
                                                    backgroundColor: theme.palette.mode === 'dark'
                                                        ? 'rgba(255, 255, 255, 0.12)'
                                                        : undefined
                                                }
                                            }}
                                        >
                                            Save
                                        </Button>
                                    </Stack>
                                    {agentPerformanceUrl !== originalAgentPerformanceUrl && (
                                        <Alert 
                                            severity='info' 
                                            sx={{ 
                                                mt: 2,
                                                '& .MuiAlert-message': {
                                                    fontSize: '0.875rem',
                                                    letterSpacing: '0.01em'
                                                }
                                            }}
                                        >
                                            You have unsaved changes. Click Save to apply.
                                        </Alert>
                                    )}
                                </Box>
                            )}

                            {/* Logo Tab */}
                            {tabValue === 2 && (
                                <AssetManager
                                    type='logo'
                                    assets={logoAssets}
                                    activeAsset={activeConfig?.activeLogo}
                                    onUpload={(file) => handleUpload('logo', file)}
                                    onActivate={handleActivateAsset}
                                    onDeactivate={handleDeactivateAsset}
                                    onDelete={handleDeleteAsset}
                                    saving={saving}
                                    theme={theme}
                                    acceptedTypes='image/png,image/jpeg,image/svg+xml,image/webp'
                                    description='Upload your company logo. Recommended size: 200x50 pixels. Accepted formats: PNG, JPEG, SVG, WebP.'
                                />
                            )}

                            {/* Favicon Tab */}
                            {tabValue === 3 && (
                                <AssetManager
                                    type='favicon'
                                    assets={faviconAssets}
                                    activeAsset={activeConfig?.activeFavicon}
                                    onUpload={(file) => handleUpload('favicon', file)}
                                    onActivate={handleActivateAsset}
                                    onDeactivate={handleDeactivateAsset}
                                    onDelete={handleDeleteAsset}
                                    saving={saving}
                                    theme={theme}
                                    acceptedTypes='image/x-icon,image/vnd.microsoft.icon,image/png,image/svg+xml'
                                    description='Upload your favicon. Recommended size: 32x32 or 16x16 pixels. Accepted formats: ICO, PNG, SVG.'
                                />
                            )}
                        </>
                    )}
                </Stack>
            )}
            <ConfirmDialog />
        </MainCard>
    )
}

export default PlatformConfiguration
