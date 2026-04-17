import PropTypes from 'prop-types'
// material-ui
import { Box, Stack, Typography } from '@mui/material'
import { useTheme } from '@mui/material/styles'
// local
import ApplicationNameSection from './ApplicationNameSection'
import AssetManager from './AssetManager'

// ==============================|| APPLICATION BRANDING TAB ||============================== //

/** Reusable section header with a coloured accent bar. */
const SectionHeader = ({ title }) => {
    const theme = useTheme()
    return (
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
            <Typography variant='h6' color='text.primary' sx={{ fontWeight: 600, letterSpacing: '0.01em' }}>
                {title}
            </Typography>
        </Stack>
    )
}

SectionHeader.propTypes = { title: PropTypes.string.isRequired }

/** Thin horizontal rule used to visually separate the three branding sections. */
const SectionDivider = () => {
    const theme = useTheme()
    return <Box sx={{ borderTop: `1px solid ${theme.palette.divider}` }} />
}

// ─────────────────────────────────────────────────────────────────────────────

const ApplicationBrandingTab = ({
    applicationName,
    originalAppName,
    saving,
    onAppNameChange,
    onSaveAppName,
    logoAssets,
    activeLogo,
    onLogoUpload,
    faviconAssets,
    activeFavicon,
    onFaviconUpload,
    onActivateAsset,
    onDeactivateAsset,
    onDeleteAsset
}) => (
    <Stack spacing={4}>
        {/* ── Application Name ─────────────────────────────────────────────── */}
        <ApplicationNameSection
            applicationName={applicationName}
            originalAppName={originalAppName}
            saving={saving}
            onChange={onAppNameChange}
            onSave={onSaveAppName}
        />

        <SectionDivider />

        {/* ── Logo ─────────────────────────────────────────────────────────── */}
        <Box>
            <SectionHeader title='Logo' />
            <AssetManager
                type='logo'
                assets={logoAssets}
                activeAsset={activeLogo}
                onUpload={onLogoUpload}
                onActivate={onActivateAsset}
                onDeactivate={onDeactivateAsset}
                onDelete={onDeleteAsset}
                saving={saving}
                acceptedTypes='image/png,image/jpeg,image/svg+xml,image/webp'
                description='Upload your company logo. Recommended size: 200x50 pixels. Accepted formats: PNG, JPEG, SVG, WebP.'
            />
        </Box>

        <SectionDivider />

        {/* ── Favicon ──────────────────────────────────────────────────────── */}
        <Box>
            <SectionHeader title='Favicon' />
            <AssetManager
                type='favicon'
                assets={faviconAssets}
                activeAsset={activeFavicon}
                onUpload={onFaviconUpload}
                onActivate={onActivateAsset}
                onDeactivate={onDeactivateAsset}
                onDelete={onDeleteAsset}
                saving={saving}
                acceptedTypes='image/x-icon,image/vnd.microsoft.icon,image/png,image/svg+xml'
                description='Upload your favicon. Recommended size: 32x32 or 16x16 pixels. Accepted formats: ICO, PNG, SVG.'
            />
        </Box>
    </Stack>
)

ApplicationBrandingTab.propTypes = {
    applicationName: PropTypes.string.isRequired,
    originalAppName: PropTypes.string.isRequired,
    saving: PropTypes.bool,
    onAppNameChange: PropTypes.func.isRequired,
    onSaveAppName: PropTypes.func.isRequired,
    logoAssets: PropTypes.array,
    activeLogo: PropTypes.object,
    onLogoUpload: PropTypes.func.isRequired,
    faviconAssets: PropTypes.array,
    activeFavicon: PropTypes.object,
    onFaviconUpload: PropTypes.func.isRequired,
    onActivateAsset: PropTypes.func.isRequired,
    onDeactivateAsset: PropTypes.func.isRequired,
    onDeleteAsset: PropTypes.func.isRequired
}

export default ApplicationBrandingTab
