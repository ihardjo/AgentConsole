import { useState, useEffect, useRef } from 'react'
import PropTypes from 'prop-types'
// material-ui
import { Box, Button, Chip, CircularProgress, IconButton, Stack, Tooltip, Typography } from '@mui/material'
import { useTheme } from '@mui/material/styles'
// icons
import { IconCheck, IconPhoto, IconTrash, IconX } from '@tabler/icons-react'
// API
import platformConfigApi from '@/api/platformConfig'

// ==============================|| ASSET CARD — horizontal list row ||============================== //

const AssetCard = ({ asset, isActive, onActivate, onDeactivate, onDelete, saving }) => {
    const theme = useTheme()
    const [imageUrl, setImageUrl] = useState(null)
    const [imageError, setImageError] = useState(false)
    const blobUrlRef = useRef(null)

    useEffect(() => {
        let cancelled = false
        const loadPreview = async () => {
            try {
                const response = await platformConfigApi.getAssetFile(asset.id)
                if (cancelled) return
                if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current)
                const url = URL.createObjectURL(response.data)
                blobUrlRef.current = url
                setImageUrl(url)
            } catch (err) {
                if (!cancelled) {
                    console.error('Error loading asset preview:', err)
                    setImageError(true)
                }
            }
        }
        loadPreview()
        return () => {
            cancelled = true
            if (blobUrlRef.current) {
                URL.revokeObjectURL(blobUrlRef.current)
                blobUrlRef.current = null
            }
        }
    }, [asset.id])

    const formatFileSize = (bytes) => {
        if (bytes === 0) return '0 Bytes'
        const k = 1024
        const sizes = ['Bytes', 'KB', 'MB']
        const i = Math.floor(Math.log(bytes) / Math.log(k))
        return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`
    }

    const formatDate = (dateString) => new Date(dateString).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

    // Checkerboard transparency pattern (reused for thumbnail background)
    const checkerboard = {
        backgroundImage: `linear-gradient(45deg, ${theme.palette.action.hover} 25%, transparent 25%),
                          linear-gradient(-45deg, ${theme.palette.action.hover} 25%, transparent 25%),
                          linear-gradient(45deg, transparent 75%, ${theme.palette.action.hover} 75%),
                          linear-gradient(-45deg, transparent 75%, ${theme.palette.action.hover} 75%)`,
        backgroundSize: '10px 10px',
        backgroundPosition: '0 0, 0 5px, 5px -5px, -5px 0px'
    }

    return (
        <Stack
            direction='row'
            alignItems='center'
            spacing={2}
            sx={{
                px: 2,
                py: 1.25,
                borderRadius: 1.5,
                border: `1px solid ${isActive ? theme.palette.primary.main : theme.palette.divider}`,
                backgroundColor: isActive
                    ? theme.palette.primary.main + (theme.palette.mode === 'dark' ? '12' : '08')
                    : theme.palette.background.paper,
                transition: 'all 0.15s ease-in-out',
                '&:hover': {
                    borderColor: isActive ? theme.palette.primary.main : theme.palette.primary.light,
                    backgroundColor: isActive
                        ? theme.palette.primary.main + (theme.palette.mode === 'dark' ? '18' : '10')
                        : theme.palette.action.hover
                }
            }}
        >
            {/* Active accent bar */}
            {isActive && (
                <Box
                    sx={{
                        position: 'absolute',
                        left: 0,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        width: 3,
                        height: 32,
                        borderRadius: '0 2px 2px 0',
                        backgroundColor: theme.palette.primary.main
                    }}
                />
            )}

            {/* Thumbnail */}
            <Box
                sx={{
                    width: 56,
                    height: 40,
                    flexShrink: 0,
                    borderRadius: 1,
                    overflow: 'hidden',
                    border: `1px solid ${theme.palette.divider}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    ...checkerboard
                }}
            >
                {imageError ? (
                    <IconPhoto size={20} color={theme.palette.text.disabled} />
                ) : imageUrl ? (
                    <img src={imageUrl} alt={asset.fileName} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                ) : (
                    <CircularProgress size={14} />
                )}
            </Box>

            {/* File info */}
            <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                <Tooltip title={asset.fileName} placement='top'>
                    <Typography
                        variant='body2'
                        color='text.primary'
                        noWrap
                        sx={{ fontWeight: 600, letterSpacing: '0.01em', lineHeight: 1.3 }}
                    >
                        {asset.fileName}
                    </Typography>
                </Tooltip>
                <Stack direction='row' spacing={0.75} alignItems='center' sx={{ mt: 0.25 }}>
                    <Typography variant='caption' color='text.secondary' sx={{ fontWeight: 500 }}>
                        {formatFileSize(asset.fileSize)}
                    </Typography>
                    {asset.createdDate && (
                        <>
                            <Typography variant='caption' color='text.disabled'>
                                ·
                            </Typography>
                            <Typography variant='caption' color='text.secondary'>
                                {formatDate(asset.createdDate)}
                            </Typography>
                        </>
                    )}
                </Stack>
            </Box>

            {/* Status + actions */}
            <Stack direction='row' spacing={1} alignItems='center' sx={{ flexShrink: 0 }}>
                {isActive ? (
                    <>
                        <Chip
                            icon={<IconCheck size={12} />}
                            label='Active'
                            color='primary'
                            size='small'
                            sx={{
                                fontWeight: 600,
                                fontSize: '0.7rem',
                                height: 24,
                                '& .MuiChip-icon': { ml: 0.5 }
                            }}
                        />
                        <Button
                            size='small'
                            variant='outlined'
                            onClick={() => onDeactivate(asset.id)}
                            disabled={saving}
                            startIcon={<IconX size={14} />}
                            sx={{
                                borderRadius: 1,
                                textTransform: 'none',
                                fontSize: '0.75rem',
                                fontWeight: 500,
                                py: 0.5,
                                px: 1.5
                            }}
                        >
                            Deactivate
                        </Button>
                    </>
                ) : (
                    <>
                        <Button
                            size='small'
                            variant='outlined'
                            onClick={() => onActivate(asset.id)}
                            disabled={saving}
                            startIcon={<IconCheck size={14} />}
                            sx={{
                                borderRadius: 1,
                                textTransform: 'none',
                                fontSize: '0.75rem',
                                fontWeight: 500,
                                py: 0.5,
                                px: 1.5,
                                borderColor: theme.palette.primary.main,
                                color: theme.palette.primary.main,
                                '&:hover': {
                                    backgroundColor: theme.palette.primary.main + '14'
                                }
                            }}
                        >
                            Set Active
                        </Button>
                        <Tooltip title='Delete'>
                            <IconButton
                                size='small'
                                color='error'
                                onClick={() => onDelete(asset.id)}
                                disabled={saving}
                                sx={{ borderRadius: 1 }}
                            >
                                <IconTrash size={16} />
                            </IconButton>
                        </Tooltip>
                    </>
                )}
            </Stack>
        </Stack>
    )
}

AssetCard.propTypes = {
    asset: PropTypes.shape({
        id: PropTypes.any,
        fileName: PropTypes.string,
        fileSize: PropTypes.number,
        createdDate: PropTypes.string
    }).isRequired,
    isActive: PropTypes.bool,
    onActivate: PropTypes.func,
    onDeactivate: PropTypes.func,
    onDelete: PropTypes.func,
    saving: PropTypes.bool
}

export default AssetCard
