import { useState } from 'react'
import PropTypes from 'prop-types'
// material-ui
import { Box, Button, Stack, Typography } from '@mui/material'
import { useTheme } from '@mui/material/styles'
// icons
import { IconPhoto, IconUpload } from '@tabler/icons-react'
// local
import AssetCard from './AssetCard'

// ==============================|| ASSET MANAGER ||============================== //

const AssetManager = ({ type, assets, activeAsset, onUpload, onActivate, onDeactivate, onDelete, saving, acceptedTypes, description }) => {
    const theme = useTheme()
    const [dragActive, setDragActive] = useState(false)

    const handleFileChange = (e) => {
        const file = e.target.files?.[0]
        if (file) {
            onUpload(file)
            e.target.value = ''
        }
    }

    const handleDrag = (e) => {
        e.preventDefault()
        e.stopPropagation()
        setDragActive(e.type === 'dragenter' || e.type === 'dragover')
    }

    const handleDrop = (e) => {
        e.preventDefault()
        e.stopPropagation()
        setDragActive(false)
        if (e.dataTransfer.files?.[0]) onUpload(e.dataTransfer.files[0])
    }

    const assetLabel = type === 'logo' ? 'Logo' : 'Favicon'

    // Active first, then the rest — filter by id to avoid duplicates regardless of
    // whether the API response carries an isActive field on list items.
    const sortedAssets = [...(activeAsset ? [{ ...activeAsset, isActive: true }] : []), ...assets.filter((a) => a.id !== activeAsset?.id)]

    return (
        <Stack spacing={2}>
            {/* ── Compact upload bar ────────────────────────────────────────── */}
            <Box
                component='label'
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 2,
                    px: 2.5,
                    py: 1.5,
                    borderRadius: 1.5,
                    cursor: saving ? 'not-allowed' : 'pointer',
                    border: `1.5px dashed ${dragActive ? theme.palette.primary.main : theme.palette.divider}`,
                    backgroundColor: dragActive
                        ? theme.palette.primary.main + (theme.palette.mode === 'dark' ? '18' : '08')
                        : 'transparent',
                    transition: 'all 0.15s ease-in-out',
                    '&:hover': {
                        borderColor: theme.palette.primary.main,
                        backgroundColor: theme.palette.primary.main + (theme.palette.mode === 'dark' ? '12' : '06')
                    }
                }}
            >
                <input type='file' hidden accept={acceptedTypes} onChange={handleFileChange} disabled={saving} />

                {/* Icon */}
                <Box
                    sx={{
                        width: 36,
                        height: 36,
                        flexShrink: 0,
                        borderRadius: 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: dragActive
                            ? theme.palette.primary.main + (theme.palette.mode === 'dark' ? '30' : '15')
                            : theme.palette.action.selected
                    }}
                >
                    <IconUpload size={18} color={dragActive ? theme.palette.primary.main : theme.palette.text.secondary} />
                </Box>

                {/* Text */}
                <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                    <Typography
                        variant='body2'
                        sx={{
                            fontWeight: 600,
                            color: dragActive ? theme.palette.primary.main : theme.palette.text.primary,
                            lineHeight: 1.3
                        }}
                    >
                        {dragActive ? 'Drop to upload' : `Upload ${assetLabel}`}
                    </Typography>
                    <Typography variant='caption' color='text.secondary' noWrap>
                        {description}
                    </Typography>
                </Box>

                {/* Browse button */}
                {!dragActive && (
                    <Button
                        component='span'
                        size='small'
                        variant='outlined'
                        disabled={saving}
                        sx={{
                            flexShrink: 0,
                            textTransform: 'none',
                            fontWeight: 500,
                            fontSize: '0.8rem',
                            borderRadius: 1,
                            py: 0.5,
                            px: 1.5,
                            pointerEvents: 'none' // label handles the click
                        }}
                    >
                        Browse
                    </Button>
                )}
            </Box>

            {/* ── Asset list ────────────────────────────────────────────────── */}
            {sortedAssets.length > 0 ? (
                <Stack spacing={1}>
                    {sortedAssets.map((asset) => (
                        <AssetCard
                            key={asset.id}
                            asset={asset}
                            isActive={asset.isActive}
                            onActivate={onActivate}
                            onDeactivate={onDeactivate}
                            onDelete={onDelete}
                            saving={saving}
                        />
                    ))}
                </Stack>
            ) : (
                /* ── Empty state ──────────────────────────────────────────── */
                <Stack
                    alignItems='center'
                    spacing={1}
                    sx={{
                        py: 4,
                        borderRadius: 1.5,
                        border: `1px dashed ${theme.palette.divider}`
                    }}
                >
                    <Box
                        sx={{
                            width: 40,
                            height: 40,
                            borderRadius: '50%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            backgroundColor: theme.palette.action.hover
                        }}
                    >
                        <IconPhoto size={20} color={theme.palette.text.secondary} />
                    </Box>
                    <Typography variant='body2' color='text.primary' sx={{ fontWeight: 500 }}>
                        No {type === 'logo' ? 'logos' : 'favicons'} uploaded yet
                    </Typography>
                    <Typography variant='caption' color='text.secondary'>
                        Upload your first {assetLabel.toLowerCase()} using the area above
                    </Typography>
                </Stack>
            )}
        </Stack>
    )
}

AssetManager.propTypes = {
    type: PropTypes.oneOf(['logo', 'favicon']).isRequired,
    assets: PropTypes.array,
    activeAsset: PropTypes.object,
    onUpload: PropTypes.func.isRequired,
    onActivate: PropTypes.func.isRequired,
    onDeactivate: PropTypes.func.isRequired,
    onDelete: PropTypes.func.isRequired,
    saving: PropTypes.bool,
    acceptedTypes: PropTypes.string,
    description: PropTypes.string
}

export default AssetManager
