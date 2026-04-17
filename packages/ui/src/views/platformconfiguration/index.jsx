import { useState } from 'react'
// material-ui
import { Box, IconButton, Skeleton, Stack, Tab, Tabs, Tooltip } from '@mui/material'
import { useTheme } from '@mui/material/styles'
// icons
import { IconRefresh } from '@tabler/icons-react'
// project imports
import ErrorBoundary from '@/ErrorBoundary'
import ViewHeader from '@/layout/MainLayout/ViewHeader'
import MainCard from '@/ui-component/cards/MainCard'
import ConfirmDialog from '@/ui-component/dialog/ConfirmDialog'
import { useError } from '@/store/context/ErrorContext'
// feature hooks & components
import usePlatformConfigView from './usePlatformConfigView'
import ApplicationBrandingTab from './ApplicationBrandingTab'
import AgentPerformanceUrlTab from './AgentPerformanceUrlTab'

// ==============================|| PLATFORM CONFIGURATION VIEW ||============================== //

const TAB_BRANDING = 0
const TAB_AGENT_PERF = 1

const PlatformConfiguration = () => {
    const theme = useTheme()
    const { error } = useError()
    const [tabValue, setTabValue] = useState(TAB_BRANDING)

    const {
        isLoading,
        saving,
        applicationName,
        setApplicationName,
        originalAppName,
        handleSaveAppName,
        agentPerformanceUrl,
        setAgentPerformanceUrl,
        originalAgentPerformanceUrl,
        handleSaveAgentPerformanceUrl,
        logoAssets,
        faviconAssets,
        activeConfig,
        handleUpload,
        handleActivateAsset,
        handleDeactivateAsset,
        handleDeleteAsset,
        loadData
    } = usePlatformConfigView()

    return (
        <MainCard>
            {error ? (
                <ErrorBoundary error={error} />
            ) : (
                <Stack flexDirection='column' sx={{ gap: 3 }}>
                    <ViewHeader title='Platform Configuration' description='Customize your application branding - name, logo, and favicon'>
                        <Tooltip title='Refresh'>
                            <IconButton
                                onClick={loadData}
                                disabled={isLoading || saving}
                                sx={{
                                    border: `1px solid ${theme.palette.divider}`,
                                    borderRadius: 1.5,
                                    transition: 'all 0.2s ease-in-out',
                                    color: theme.palette.text.secondary,
                                    '&:hover': {
                                        borderColor: theme.palette.primary.main,
                                        backgroundColor: theme.palette.primary.main + (theme.palette.mode === 'dark' ? '15' : '08'),
                                        color: theme.palette.primary.main,
                                        transform: 'scale(1.05)',
                                        '& svg': { transform: 'rotate(-45deg)' }
                                    },
                                    '&.Mui-disabled': {
                                        borderColor: theme.palette.divider,
                                        color: theme.palette.action.disabled
                                    },
                                    '& svg': { transition: 'transform 0.3s ease-in-out' }
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
                            <Box sx={{ borderBottom: 1, borderColor: 'divider', mt: -2 }}>
                                <Tabs value={tabValue} onChange={(_, val) => setTabValue(val)}>
                                    <Tab label='Application Branding' />
                                    <Tab label='Agent Performance URL' />
                                </Tabs>
                            </Box>

                            {tabValue === TAB_BRANDING && (
                                <ApplicationBrandingTab
                                    applicationName={applicationName}
                                    originalAppName={originalAppName}
                                    saving={saving}
                                    onAppNameChange={setApplicationName}
                                    onSaveAppName={handleSaveAppName}
                                    logoAssets={logoAssets}
                                    activeLogo={activeConfig?.activeLogo}
                                    onLogoUpload={(file) => handleUpload('logo', file)}
                                    faviconAssets={faviconAssets}
                                    activeFavicon={activeConfig?.activeFavicon}
                                    onFaviconUpload={(file) => handleUpload('favicon', file)}
                                    onActivateAsset={handleActivateAsset}
                                    onDeactivateAsset={handleDeactivateAsset}
                                    onDeleteAsset={handleDeleteAsset}
                                />
                            )}

                            {tabValue === TAB_AGENT_PERF && (
                                <AgentPerformanceUrlTab
                                    agentPerformanceUrl={agentPerformanceUrl}
                                    originalAgentPerformanceUrl={originalAgentPerformanceUrl}
                                    saving={saving}
                                    onChange={setAgentPerformanceUrl}
                                    onSave={handleSaveAgentPerformanceUrl}
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
