import { useEffect, useState, useCallback } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { enqueueSnackbar as enqueueSnackbarAction, closeSnackbar as closeSnackbarAction } from '@/store/actions'
import moment from 'moment'

// material-ui
import {
    Box,
    Stack,
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    useTheme,
    TextField,
    Typography,
    Chip,
    CircularProgress,
    Table,
    TableBody,
    TableContainer,
    TableHead,
    TableRow,
    Paper,
    IconButton,
    Tooltip,
    Badge
} from '@mui/material'

// project imports
import MainCard from '@/ui-component/cards/MainCard'
import ErrorBoundary from '@/ErrorBoundary'
import ViewHeader from '@/layout/MainLayout/ViewHeader'
import { StyledTableCell, StyledTableRow } from '@/ui-component/table/TableStyles'
import { StyledButton } from '@/ui-component/button/StyledButton'
import { StyledPermissionButton } from '@/ui-component/button/RBACButtons'
import { Dropdown } from '@/ui-component/dropdown/Dropdown'

// API
import useApi from '@/hooks/useApi'
import chatflowVersionsApi from '@/api/chatflowVersions'
import gitSyncApi from '@/api/gitSync'
import { useAuth } from '@/hooks/useAuth'

// utils
import useNotifier from '@/utils/useNotifier'

// icons
import version_empty from '@/assets/images/executions_empty.svg'
import { 
    IconPlus, 
    IconChevronDown, 
    IconDeviceFloppy, 
    IconRestore,
    IconTrash,
    IconAlertTriangle,
    IconEdit,
    IconX,
    IconGitBranch
} from '@tabler/icons-react'

// components
import TablePagination, { DEFAULT_ITEMS_PER_PAGE } from '@/ui-component/pagination/TablePagination'
import VersionListMenu from '@/ui-component/button/VersionListMenu'
import CompareVersionsDialog from './CompareVersionsDialog'
import GitSyncPanel from './GitSyncPanel'

// ==============================|| AGENT OPS - VERSION HISTORY ||============================== //

/**
 * Parse a git remote URL to a short "owner/repo" display string.
 * Handles both HTTPS and SSH formats. Returns null when no URL is provided.
 * Exported so GitSyncPanel can reuse the same logic without duplication.
 */
export function parseRepoName(url) {
    if (!url) return null
    try {
        const cleaned = url.replace(/\.git$/, '')
        const httpsMatch = cleaned.match(/https?:\/\/[^/]+\/(.+)/)
        if (httpsMatch) return httpsMatch[1]
        const sshMatch = cleaned.match(/[^:]+:(.+)/)
        if (sshMatch) return sshMatch[1]
        return cleaned
    } catch {
        return url
    }
}

const AgentOps = () => {
    const theme = useTheme()
    const dispatch = useDispatch()
    const customization = useSelector((state) => state.customization)
    const borderColor = theme.palette.grey[900] + 25
    const { hasPermission } = useAuth()

    useNotifier()

    const enqueueSnackbar = (...args) => dispatch(enqueueSnackbarAction(...args))
    const closeSnackbar = (...args) => dispatch(closeSnackbarAction(...args))

    /**
     * Convenience wrapper: show a snackbar without repeating the key/action boilerplate.
     * @param {string} message
     * @param {'success'|'error'|'warning'|'info'} variant
     * @param {boolean} [persist] – keep the notification until manually dismissed
     */
    const showSnackbar = (message, variant = 'info', persist = false) => {
        enqueueSnackbar({
            message,
            options: {
                key: new Date().getTime() + Math.random(),
                variant,
                ...(persist ? { persist: true } : {}),
                action: (key) => (
                    <Button style={{ color: 'white' }} onClick={() => closeSnackbar(key)}>
                        <IconX />
                    </Button>
                )
            }
        })
    }

    // API hooks
    const getAllVersionsGroupedApi = useApi(chatflowVersionsApi.getAllVersionsGrouped)
    const getAgentflowsApi = useApi(chatflowVersionsApi.getAgentflowsForVersioning)
    const createVersionApi = useApi(chatflowVersionsApi.createVersion)
    const updateVersionApi = useApi(chatflowVersionsApi.updateVersion)
    const restoreVersionApi = useApi(chatflowVersionsApi.restoreVersion)
    const deleteVersionApi = useApi(chatflowVersionsApi.deleteVersion)

    // State
    const [error, setError] = useState(null)
    const [isLoading, setLoading] = useState(true)
    const [groupedVersions, setGroupedVersions] = useState([])
    const [agentflows, setAgentflows] = useState([])
    const [expandedFlows, setExpandedFlows] = useState({})
    const [search, setSearch] = useState('')
    // Only enable versioning for agentflows (AGENTFLOW). Use 'AI Agents' terminology in the UI.
    const [filters, setFilters] = useState({
        type: 'AGENTFLOW'
    })

    // Git Sync dialog
    const [openGitSyncDialog, setOpenGitSyncDialog] = useState(false)
    const getGitSyncStatusApi = useApi(gitSyncApi.getStatus)

    // Dialog states
    const [openSaveVersionDialog, setOpenSaveVersionDialog] = useState(false)
    const [openEditVersionDialog, setOpenEditVersionDialog] = useState(false)
    const [openRestoreDialog, setOpenRestoreDialog] = useState(false)
    const [openDeleteDialog, setOpenDeleteDialog] = useState(false)
    const [selectedVersion, setSelectedVersion] = useState(null)
    const [restoreHasUnsavedChanges, setRestoreHasUnsavedChanges] = useState(false)
    const [openVersionSelectorDialog, setOpenVersionSelectorDialog] = useState(false)
    const [selectedVersionForCompare, setSelectedVersionForCompare] = useState(null)

    // Save version form state
    const [saveVersionForm, setSaveVersionForm] = useState({
        chatflowId: '',
        changeDescription: ''
    })

    // Edit version form state
    const [editVersionForm, setEditVersionForm] = useState({
        changeDescription: ''
    })

    // Pagination
    const [currentPage, setCurrentPage] = useState(1)
    const [pageLimit, setPageLimit] = useState(DEFAULT_ITEMS_PER_PAGE)
    const [total, setTotal] = useState(0)

    // No tabs: versioning is only for AGENTFLOW

    const onChange = (page, pageLimit) => {
        setCurrentPage(page)
        setPageLimit(pageLimit)
    }

    const fetchVersions = useCallback(() => {
        setLoading(true)
        const params = {
            page: currentPage,
            limit: pageLimit
        }
        if (filters.type) params.type = filters.type
        getAllVersionsGroupedApi.request(params)
    }, [currentPage, pageLimit, filters.type])

    const fetchAgentflows = useCallback(() => {
        getAgentflowsApi.request()
    }, [])

    // Toggle accordion expansion
    const handleAccordionChange = (flowId) => {
        setExpandedFlows((prev) => ({
            ...prev,
            [flowId]: !prev[flowId]
        }))
    }

    // Save version dialog
    const handleOpenSaveVersion = () => {
        setSaveVersionForm({ chatflowId: '', changeDescription: '' })
        fetchAgentflows()
        setOpenSaveVersionDialog(true)
    }

    const handleCloseSaveVersion = () => {
        setOpenSaveVersionDialog(false)
        setSaveVersionForm({ chatflowId: '', changeDescription: '' })
    }

    const handleSaveVersionFormChange = (field) => (event) => {
        setSaveVersionForm((prev) => ({
            ...prev,
            [field]: event.target.value
        }))
    }

    const handleAgentflowSelect = (value) => {
        setSaveVersionForm((prev) => ({
            ...prev,
            chatflowId: value
        }))
    }

    const handleConfirmSaveVersion = async () => {
        if (saveVersionForm.chatflowId) {
            try {
                // Use the unified createVersion endpoint
                // Since flowData is not provided, it will automatically fetch from the chatflow
                await createVersionApi.request(saveVersionForm.chatflowId, {
                    changeDescription: saveVersionForm.changeDescription || 'Manual version save'
                })
            } catch (error) {
                showSnackbar(
                    `Failed to create version: ${
                        typeof error.response?.data === 'object' ? error.response.data.message : error.response?.data || error.message
                    }`,
                    'error',
                    true
                )
            }
        }
    }

    // Edit version dialog
    const handleOpenEditVersion = (version) => {
        setSelectedVersion(version)
        setEditVersionForm({
            changeDescription: version.changeDescription || ''
        })
        setOpenEditVersionDialog(true)
    }

    const handleCloseEditVersion = () => {
        setOpenEditVersionDialog(false)
        setEditVersionForm({ changeDescription: '' })
        setSelectedVersion(null)
    }

    const handleEditVersionFormChange = (event) => {
        setEditVersionForm({
            changeDescription: event.target.value
        })
    }

    const handleConfirmEditVersion = async () => {
        if (selectedVersion) {
            try {
                await updateVersionApi.request(selectedVersion.id, {
                    changeDescription: editVersionForm.changeDescription || ''
                })
                showSnackbar('Version updated successfully', 'success')
                // Refresh the table and close dialog after successful update
                await fetchVersions()
                setOpenEditVersionDialog(false)
                setEditVersionForm({ changeDescription: '' })
                setSelectedVersion(null)
            } catch (error) {
                showSnackbar(
                    `Failed to update version: ${
                        typeof error.response?.data === 'object' ? error.response.data.message : error.response?.data || error.message
                    }`,
                    'error',
                    true
                )
                // Close dialog on error
                setOpenEditVersionDialog(false)
                setEditVersionForm({ changeDescription: '' })
                setSelectedVersion(null)
            }
        }
    }

    // Search handler
    const onSearchChange = (event) => {
        setSearch(event.target.value)
    }

    // Version actions
    const handleVersionClick = (_version) => {
        // TODO: Navigate to version details or open a drawer
    }

    const handleRestoreClick = (version) => {
        setSelectedVersion(version)
        // Detect whether the group this version belongs to has unsaved changes —
        // i.e. the live agentflow flowData doesn't match any saved version.
        const group = groupedVersions.find((g) => g.chatFlowId === version.chatFlowId)
        setRestoreHasUnsavedChanges(!group?.isDeleted && !!group?.hasUnsavedChanges)
        setOpenRestoreDialog(true)
    }

    const handleConfirmRestore = async () => {
        if (selectedVersion) {
            try {
                await restoreVersionApi.request(selectedVersion.id)
                showSnackbar('Version restored successfully', 'success')
                // Refresh the table and close dialog after successful restore
                await fetchVersions()
                setOpenRestoreDialog(false)
                setSelectedVersion(null)
                setRestoreHasUnsavedChanges(false)
                // Refresh git sync status so the badge updates (new commit → out of sync)
                getGitSyncStatusApi.request()
            } catch (error) {
                showSnackbar(
                    `Failed to restore version: ${
                        typeof error.response?.data === 'object' ? error.response.data.message : error.response?.data || error.message
                    }`,
                    'error',
                    true
                )
                // Close dialog on error
                setOpenRestoreDialog(false)
                setRestoreHasUnsavedChanges(false)
            }
        } else {
            setOpenRestoreDialog(false)
            setRestoreHasUnsavedChanges(false)
        }
    }

    // Compare version handlers
    const handleCompareClick = (version) => {
        setSelectedVersionForCompare(version)
        setOpenVersionSelectorDialog(true)
    }

    const handleCloseCompareDialog = () => {
        setOpenVersionSelectorDialog(false)
        setSelectedVersionForCompare(null)
    }

    const handleDeleteClick = (version) => {
        setSelectedVersion(version)
        setOpenDeleteDialog(true)
    }

    const handleConfirmDelete = async () => {
        if (selectedVersion) {
            try {
                await deleteVersionApi.request(selectedVersion.id)
                showSnackbar('Version deleted successfully', 'success')
                // Refresh the table and close dialog after successful delete
                await fetchVersions()
                setOpenDeleteDialog(false)
                setSelectedVersion(null)
                // Refresh git sync status so the badge updates (new commit → out of sync)
                getGitSyncStatusApi.request()
            } catch (error) {
                showSnackbar(
                    `Failed to delete version: ${
                        typeof error.response?.data === 'object' ? error.response.data.message : error.response?.data || error.message
                    }`,
                    'error',
                    true
                )
                // Close dialog on error
                setOpenDeleteDialog(false)
            }
        } else {
            setOpenDeleteDialog(false)
        }
    }

    // Effects
    useEffect(() => {
        fetchVersions()
        getGitSyncStatusApi.request()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentPage, pageLimit, filters.type])

    useEffect(() => {
        if (getAllVersionsGroupedApi.data) {
            try {
                const { data, total } = getAllVersionsGroupedApi.data
                if (!Array.isArray(data)) return
                setGroupedVersions(data)
                setTotal(total)
                // Expand all flows by default
                const expanded = {}
                data.forEach((group) => {
                    expanded[group.chatFlowId] = true
                })
                setExpandedFlows(expanded)
            } catch {
                // Defensive: ignore malformed API response
            }
        }
    }, [getAllVersionsGroupedApi.data])

    useEffect(() => {
        if (getAgentflowsApi.data) {
            setAgentflows(getAgentflowsApi.data || [])
        }
    }, [getAgentflowsApi.data])

    useEffect(() => {
        setLoading(getAllVersionsGroupedApi.loading)
    }, [getAllVersionsGroupedApi.loading])

    useEffect(() => {
        setError(getAllVersionsGroupedApi.error)
    }, [getAllVersionsGroupedApi.error])

    // Refresh after version creation
    useEffect(() => {
        if (createVersionApi.data) {
            showSnackbar('Version created successfully', 'success')
            fetchVersions()
            handleCloseSaveVersion()
            // Refresh git sync status so the badge updates (new commit → out of sync)
            getGitSyncStatusApi.request()
        }
    }, [createVersionApi.data, fetchVersions])

    // Filter grouped versions based on search
    const filteredGroupedVersions = groupedVersions
        .map((group) => {
            // If no search, return all groups
            if (!search || !search.trim()) {
                return group
            }

            const searchLower = search.toLowerCase().trim()

            // Check if group name matches
            const groupNameMatches = group.chatFlowName.toLowerCase().includes(searchLower)

            // Filter versions within the group based on description
            const filteredVersions = group.versions.filter((version) => {
                const descriptionMatches = version.changeDescription
                    ? version.changeDescription.toLowerCase().includes(searchLower)
                    : false
                return descriptionMatches
            })

            // Include the group if:
            // 1. Group name matches, OR
            // 2. At least one version description matches
            if (groupNameMatches || filteredVersions.length > 0) {
                return {
                    ...group,
                    // If group name matches, show all versions; otherwise show only matching versions
                    versions: groupNameMatches ? group.versions : filteredVersions,
                    versionCount: groupNameMatches ? group.versions.length : filteredVersions.length
                }
            }

            return null
        })
        .filter((group) => group !== null)

    // Derive git sync status for the header button indicator
    // States: 'error' | 'conflicts' | 'out-of-sync' | 'active' | 'inactive'
    const gitSyncStatus = getGitSyncStatusApi.data
    const gitSyncLastError = gitSyncStatus?.lastError || null
    const gitSyncLastSyncAt = gitSyncStatus?.lastSyncAt || null
    const isGitSyncFullyActive = gitSyncStatus?.enabled === true && gitSyncStatus?.initialized === true && gitSyncStatus?.hasRemote === true
    const hasConflicts = isGitSyncFullyActive && Array.isArray(gitSyncStatus?.conflicted) && gitSyncStatus.conflicted.length > 0

    const gitSyncState = gitSyncLastError
        ? 'error'
        : hasConflicts
            ? 'conflicts'
            : isGitSyncFullyActive && gitSyncStatus?.outOfSync === true
                ? 'out-of-sync'
                : isGitSyncFullyActive
                    ? 'active'
                    : 'inactive'

    /**
     * Palette tokens per state × mode.
     * dark[state]  = the "primary" colour in dark mode
     * light[state] = the "primary" colour in light mode
     * The inverted variant (used for hover / darker shade) simply swaps
     * .main ↔ .dark.
     */
    const GIT_STATE_PALETTE = {
        error:         { main: theme.palette.error.main,   dark: theme.palette.error.dark   },
        conflicts:     { main: theme.palette.error.main,   dark: theme.palette.error.dark   },
        'out-of-sync': { main: theme.palette.warning.main, dark: theme.palette.warning.dark },
        active:        { main: theme.palette.success.main, dark: theme.palette.success.dark },
        inactive:      { main: theme.palette.text.secondary, dark: theme.palette.text.secondary }
    }

    const palette = GIT_STATE_PALETTE[gitSyncState]
    // In dark mode the lighter token reads better; in light mode use the darker one.
    const gitSyncStateColor     = customization.isDarkMode ? palette.main : palette.dark
    const gitSyncStateColorDark = customization.isDarkMode ? palette.dark : palette.main

    const gitSyncTooltip = {
        error:        `Git Sync Error: ${gitSyncLastError}`,
        conflicts:    `Git Sync: ${gitSyncStatus?.conflicted?.length ?? 0} unresolved conflict(s) — open Git Sync panel`,
        'out-of-sync': 'Git Sync: Local and remote are out of sync',
        active:       'Git Sync is active',
        inactive:     'Git Sync is inactive'
    }[gitSyncState]

    const gitSyncButtonLabel = gitSyncLastSyncAt
        ? `Git Sync · ${moment(gitSyncLastSyncAt).fromNow()}`
        : 'Git Sync'

    // Derive a short human-readable repo name from the remote URL.
    const gitSyncRepoName = parseRepoName(gitSyncStatus?.remoteUrl)

    const gitSyncChipLabel = {
        error:        'Error',
        conflicts:    'Conflicts',
        'out-of-sync': 'Out of Sync',
        active:       'Active',
        inactive:     'Inactive'
    }[gitSyncState]

    return (
        <MainCard>
            {error ? (
                <ErrorBoundary error={error} />
            ) : (
                <Stack flexDirection='column' sx={{ gap: 3 }}>
                    {/* ── Page Header ──────────────────────────────────────────── */}
                    <ViewHeader
                        onSearchChange={onSearchChange}
                        search={true}
                        searchValue={search}
                        searchPlaceholder='Search Name or Description'
                        title='AI Agents Versions'
                        description='Manage AI Agent versions'
                    >
                        <Stack direction='row' gap={1}>
                            <Tooltip title={gitSyncTooltip}>
                                <Button
                                    variant='outlined'
                                    startIcon={
                                        <Badge
                                            variant='dot'
                                            overlap='circular'
                                            anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                                            sx={{
                                                '& .MuiBadge-badge': {
                                                    backgroundColor: gitSyncStateColor,
                                                    width: 8,
                                                    height: 8,
                                                    minWidth: 8,
                                                    borderRadius: '50%',
                                                    border: `1.5px solid ${theme.palette.background.paper}`,
                                                    bottom: 2,
                                                    right: 2
                                                }
                                            }}
                                        >
                                            <IconGitBranch size={18} />
                                        </Badge>
                                    }
                                    onClick={() => setOpenGitSyncDialog(true)}
                                    sx={{
                                        textTransform: 'none',
                                        borderColor: gitSyncStateColor,
                                        color: gitSyncStateColor,
                                        '&:hover': {
                                            borderColor: gitSyncStateColorDark,
                                            backgroundColor: customization.isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)'
                                        }
                                    }}
                                >
                                    {gitSyncButtonLabel}
                                </Button>
                            </Tooltip>
                            {hasPermission('agentops:create') && (
                                <StyledPermissionButton
                                    permissionId='agentops:create'
                                    variant='contained'
                                    startIcon={<IconPlus />}
                                    sx={{ borderRadius: 2, height: '100%' }}
                                    onClick={handleOpenSaveVersion}
                                >
                                    Create Version
                                </StyledPermissionButton>
                            )}
                        </Stack>
                    </ViewHeader>

                    {/* ── Version History ───────────────────────────────────── */}
                    {isLoading ? (
                        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                            <CircularProgress />
                        </Box>
                    ) : filteredGroupedVersions.length === 0 ? (
                        <Stack sx={{ alignItems: 'center', justifyContent: 'center' }} flexDirection='column'>
                            <Box sx={{ p: 2, height: 'auto' }}>
                                <img
                                    style={{ objectFit: 'cover', height: '16vh', width: 'auto' }}
                                    src={version_empty}
                                    alt='No versions'
                                />
                            </Box>
                            <Typography variant='body1' color='text.secondary'>No Versions Yet</Typography>
                        </Stack>
                    ) : (
                        <>
                            <TableContainer component={Paper} sx={{ border: 1, borderColor: borderColor, borderRadius: 2 }}>
                                <Table>
                                    <TableHead 
                                        sx={{ 
                                            backgroundColor: customization.isDarkMode ? theme.palette.common.black : theme.palette.grey[100],
                                            height: 56
                                        }}
                                    >
                                        <TableRow>
                                            <StyledTableCell>Name</StyledTableCell>
                                            <StyledTableCell>Version</StyledTableCell>
                                            <StyledTableCell>Description</StyledTableCell>
                                            <StyledTableCell>Created By</StyledTableCell>
                                            <StyledTableCell>Created Date</StyledTableCell>
                                            <StyledTableCell align='right'>Actions</StyledTableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {filteredGroupedVersions.map((group, index) => (
                                            <>
                                                {/* Agent Flow Row */}
                                                <StyledTableRow
                                                    key={`flow-${group.chatFlowId}`}
                                                    sx={{
                                                        backgroundColor: customization.isDarkMode 
                                                            ? theme.palette.dark.main
                                                            : theme.palette.grey[200],
                                                        cursor: 'pointer'
                                                    }}
                                                    onClick={() => handleAccordionChange(group.chatFlowId)}
                                                >
                                                    <StyledTableCell 
                                                        colSpan={5} 
                                                        sx={{ 
                                                            color: theme.palette.text.primary
                                                        }}
                                                    >
                                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                                            <Typography 
                                                                variant='subtitle1' 
                                                                fontWeight='bold'
                                                                color='text.primary'
                                                            >
                                                                {group.chatFlowName}
                                                            </Typography>
                                                            <Chip
                                                                label={`${group.versionCount} version${group.versionCount !== 1 ? 's' : ''}`}
                                                                size='small'
                                                                color='primary'
                                                                variant='outlined'
                                                            />
                                                            {!group.isDeleted && group.hasUnsavedChanges && (
                                                                <Tooltip title='This agentflow has changes that have not been saved as a version yet'>
                                                                    <Chip
                                                                        label='Unsaved Changes'
                                                                        size='small'
                                                                        variant='outlined'
                                                                        sx={{
                                                                            borderColor: theme.palette.warning.main,
                                                                            color: theme.palette.warning.main,
                                                                            fontWeight: 600
                                                                        }}
                                                                    />
                                                                </Tooltip>
                                                            )}
                                                        </Box>
                                                    </StyledTableCell>
                                                    <StyledTableCell align='right'>
                                                        <IconButton
                                                            size='small'
                                                            onClick={(e) => {
                                                                e.stopPropagation()
                                                                handleAccordionChange(group.chatFlowId)
                                                            }}
                                                            sx={{
                                                                color: theme.palette.text.secondary
                                                            }}
                                                        >
                                                            <IconChevronDown
                                                                size={20}
                                                                style={{
                                                                    transform: expandedFlows[group.chatFlowId] ? 'rotate(0deg)' : 'rotate(-90deg)',
                                                                    transition: 'transform 0.2s'
                                                                }}
                                                            />
                                                        </IconButton>
                                                    </StyledTableCell>
                                                </StyledTableRow>
                                                
                                                {/* Versions Rows (Collapsible) */}
                                                {expandedFlows[group.chatFlowId] && group.versions.map((version) => (
                                                    <StyledTableRow
                                                        key={version.id}
                                                        hover
                                                        sx={{
                                                            cursor: 'pointer'
                                                        }}
                                                        onClick={() => handleVersionClick && handleVersionClick(version)}
                                                    >
                                                        <StyledTableCell>{group.chatFlowName}</StyledTableCell>
                                                        <StyledTableCell>
                                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                                v{version.version}
                                                                {!group.isDeleted && group.activeVersionId === version.id && (
                                                                    <Chip
                                                                        label='Active'
                                                                        size='small'
                                                                        sx={{
                                                                            backgroundColor: theme.palette.success.main,
                                                                            color: theme.palette.success.contrastText,
                                                                            fontWeight: 600,
                                                                            height: 20,
                                                                            fontSize: '0.7rem'
                                                                        }}
                                                                    />
                                                                )}
                                                            </Box>
                                                        </StyledTableCell>
                                                        <StyledTableCell>
                                                            <Tooltip title={version.changeDescription || 'No description'}>
                                                                <Box
                                                                    sx={{
                                                                        maxWidth: 200,
                                                                        overflow: 'hidden',
                                                                        textOverflow: 'ellipsis',
                                                                        whiteSpace: 'nowrap'
                                                                    }}
                                                                >
                                                                    {version.changeDescription || '-'}
                                                                </Box>
                                                            </Tooltip>
                                                        </StyledTableCell>
                                                        <StyledTableCell>{version.createdBy || '-'}</StyledTableCell>
                                                        <StyledTableCell>
                                                            {version.createdDate ? moment(version.createdDate).format('MMMM Do, YYYY HH:mm:ss') : '-'}
                                                        </StyledTableCell>
                                                        <StyledTableCell align='right'>
                                                            <VersionListMenu
                                                                version={version}
                                                                chatFlowName={group.chatFlowName}
                                                                allVersions={group.versions}
                                                                onCompare={handleCompareClick}
                                                                onEdit={handleOpenEditVersion}
                                                                onRestore={handleRestoreClick}
                                                                onDelete={handleDeleteClick}
                                                            />
                                                        </StyledTableCell>
                                                    </StyledTableRow>
                                                ))}
                                            </>
                                        ))}
                                    </TableBody>
                                </Table>
                            </TableContainer>
                            
                            {/* Pagination */}
                            <TablePagination
                                currentPage={currentPage}
                                limit={pageLimit}
                                total={total}
                                onChange={onChange}
                            />
                        </>
                    )}
                </Stack>
            )}

            {/* Save Version Dialog */}
            <Dialog open={openSaveVersionDialog} onClose={handleCloseSaveVersion} maxWidth='sm' fullWidth>
                <DialogTitle sx={{ fontSize: '1rem' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <IconDeviceFloppy size={20} />
                        Create Version
                    </Box>
                </DialogTitle>
                <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <Box>
                        <Box sx={{ display: 'flex', flexDirection: 'row' }}>
                            <Typography>
                                Select AI Agent<span style={{ color: theme.palette.error.main }}>&nbsp;*</span>
                            </Typography>
                        </Box>
                        <Dropdown
                            name='chatflowId'
                            options={agentflows.map((flow) => ({
                                label: flow.name,
                                name: flow.id
                            }))}
                            onSelect={handleAgentflowSelect}
                            value={saveVersionForm.chatflowId || 'choose an option'}
                            loading={getAgentflowsApi.loading}
                        />
                    </Box>
                    <Box>
                        <Typography>Version Description (optional)</Typography>
                        <TextField
                            fullWidth
                            multiline
                            rows={3}
                            size='small'
                            placeholder='Describe the changes in this version...'
                            value={saveVersionForm.changeDescription}
                            onChange={handleSaveVersionFormChange('changeDescription')}
                            sx={{ mt: 0.5 }}
                        />
                    </Box>
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 2 }}>
                    <Button onClick={handleCloseSaveVersion}>Cancel</Button>
                    <StyledButton
                        variant='contained'
                        onClick={handleConfirmSaveVersion}
                        disabled={!saveVersionForm.chatflowId || createVersionApi.loading}
                    >
                        {createVersionApi.loading ? 'Saving...' : 'Save Version'}
                    </StyledButton>
                </DialogActions>
            </Dialog>

            {/* Edit Version Dialog */}
            <Dialog open={openEditVersionDialog} onClose={handleCloseEditVersion} maxWidth='sm' fullWidth>
                <DialogTitle sx={{ fontSize: '1rem' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <IconEdit size={20} />
                        Edit Version Description
                    </Box>
                </DialogTitle>
                <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <Box>
                        <Typography>
                            Version: <strong>v{selectedVersion?.version}</strong>
                        </Typography>
                        <Typography variant='body2' color='text.secondary'>
                            {selectedVersion?.chatFlowName}
                        </Typography>
                    </Box>
                    <Box>
                        <Typography>Version Description</Typography>
                        <TextField
                            fullWidth
                            multiline
                            rows={3}
                            size='small'
                            placeholder='Describe the changes in this version...'
                            value={editVersionForm.changeDescription}
                            onChange={handleEditVersionFormChange}
                            sx={{ mt: 0.5 }}
                        />
                    </Box>
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 2 }}>
                    <Button onClick={handleCloseEditVersion}>Cancel</Button>
                    <StyledButton
                        variant='contained'
                        onClick={handleConfirmEditVersion}
                        disabled={updateVersionApi.loading}
                    >
                        {updateVersionApi.loading ? 'Saving...' : 'Save Changes'}
                    </StyledButton>
                </DialogActions>
            </Dialog>

            {/* Restore Confirmation Dialog */}
            <Dialog open={openRestoreDialog} onClose={() => { setOpenRestoreDialog(false); setRestoreHasUnsavedChanges(false) }} fullWidth maxWidth='sm'>
                <DialogTitle sx={{ fontSize: '1rem' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <IconRestore size={20} />
                        Restore {selectedVersion?.chatFlowName} to version v{selectedVersion?.version}
                    </Box>
                </DialogTitle>
                <DialogContent sx={{ pt: 2, pb: 1, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                    {/* Always-visible: restore will overwrite the current live config */}
                    <Box
                        sx={{
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: 1.5,
                            p: 2,
                            borderRadius: 2,
                            border: `1px solid ${customization.isDarkMode ? 'rgba(255, 193, 7, 0.3)' : 'rgba(237, 108, 2, 0.2)'}`,
                            background: customization.isDarkMode
                                ? 'linear-gradient(135deg, rgba(255, 193, 7, 0.12) 0%, rgba(255, 152, 0, 0.08) 100%)'
                                : 'linear-gradient(135deg, rgba(255, 244, 229, 1) 0%, rgba(255, 236, 204, 0.6) 100%)'
                        }}
                    >
                        <IconAlertTriangle
                            size={20}
                            style={{
                                color: customization.isDarkMode ? '#ffc107' : '#ed6c02',
                                flexShrink: 0,
                                marginTop: 2
                            }}
                        />
                        <Typography
                            variant='body2'
                            sx={{
                                fontWeight: 600,
                                color: customization.isDarkMode ? theme.palette.warning.dark : '#b45309'
                            }}
                        >
                            This will replace the current configuration of{' '}
                            <strong>{selectedVersion?.chatFlowName}</strong> with version{' '}
                            <strong>v{selectedVersion?.version}</strong>.
                        </Typography>
                    </Box>

                    {/* Conditional: only shown when the live flow has unsaved changes */}
                    {restoreHasUnsavedChanges && (
                        <Box
                            sx={{
                                display: 'flex',
                                alignItems: 'flex-start',
                                gap: 1.5,
                                p: 2,
                                borderRadius: 2,
                                border: `1px solid ${customization.isDarkMode ? 'rgba(244, 67, 54, 0.3)' : 'rgba(211, 47, 47, 0.2)'}`,
                                background: customization.isDarkMode
                                    ? 'linear-gradient(135deg, rgba(244, 67, 54, 0.12) 0%, rgba(211, 47, 47, 0.08) 100%)'
                                    : 'linear-gradient(135deg, rgba(253, 237, 237, 1) 0%, rgba(255, 220, 220, 0.6) 100%)'
                            }}
                        >
                            <IconAlertTriangle
                                size={20}
                                style={{
                                    color: customization.isDarkMode ? '#f44336' : '#d32f2f',
                                    flexShrink: 0,
                                    marginTop: 2
                                }}
                            />
                            <Box>
                                <Typography
                                    variant='body2'
                                    sx={{
                                        fontWeight: 600,
                                        color: customization.isDarkMode ? theme.palette.error.light : theme.palette.error.dark
                                    }}
                                >
                                    This agentflow has unsaved changes.
                                </Typography>
                                <Typography
                                    variant='body2'
                                    sx={{
                                        mt: 0.5,
                                        color: customization.isDarkMode ? theme.palette.text.primary : theme.palette.text.secondary
                                    }}
                                >
                                    Any changes made since the last saved version will be permanently lost.
                                </Typography>
                            </Box>
                        </Box>
                    )}
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 2 }}>
                    <Button onClick={() => { setOpenRestoreDialog(false); setRestoreHasUnsavedChanges(false) }}>Cancel</Button>
                    <StyledButton
                        variant='contained'
                        onClick={handleConfirmRestore}
                        disabled={restoreVersionApi.loading}
                    >
                        {restoreVersionApi.loading ? 'Restoring...' : 'Restore'}
                    </StyledButton>
                </DialogActions>
            </Dialog>

            {/* Delete Confirmation Dialog */}
            <Dialog open={openDeleteDialog} onClose={() => setOpenDeleteDialog(false)} fullWidth maxWidth='sm'>
                <DialogTitle sx={{ fontSize: '1rem' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <IconTrash size={20} />
                        Delete {selectedVersion?.chatFlowName} version v{selectedVersion?.version}
                    </Box>
                </DialogTitle>
                <DialogContent sx={{ pt: 2, pb: 1 }}>
                    <Box
                        sx={{
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: 1.5,
                            p: 2,
                            borderRadius: 2,
                            border: `1px solid ${customization.isDarkMode ? 'rgba(244, 67, 54, 0.3)' : 'rgba(211, 47, 47, 0.2)'}`,
                            background: customization.isDarkMode
                                ? 'linear-gradient(135deg, rgba(244, 67, 54, 0.12) 0%, rgba(211, 47, 47, 0.08) 100%)'
                                : 'linear-gradient(135deg, rgba(253, 237, 237, 1) 0%, rgba(255, 220, 220, 0.6) 100%)'
                        }}
                    >
                        <IconAlertTriangle
                            size={20}
                            style={{
                                color: customization.isDarkMode ? '#f44336' : '#d32f2f',
                                flexShrink: 0,
                                marginTop: 2
                            }}
                        />
                        <Box>
                            <Typography
                                variant='body2'
                                sx={{
                                    fontWeight: 600,
                                    color: customization.isDarkMode ? theme.palette.error.light : theme.palette.error.dark
                                }}
                            >
                                This action cannot be undone.
                            </Typography>
                            <Typography
                                variant='body2'
                                sx={{
                                    mt: 0.5,
                                    color: customization.isDarkMode ? theme.palette.text.primary : theme.palette.text.secondary
                                }}
                            >
                                This will permanently remove this version from the history.
                            </Typography>
                        </Box>
                    </Box>
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 2 }}>
                    <Button onClick={() => setOpenDeleteDialog(false)}>Cancel</Button>
                    <StyledButton 
                        variant='contained' 
                        color='error'
                        onClick={handleConfirmDelete}
                    >
                        Delete
                    </StyledButton>
                </DialogActions>
            </Dialog>

            {/* Compare Versions Dialog */}
            <CompareVersionsDialog
                open={openVersionSelectorDialog}
                onClose={handleCloseCompareDialog}
                selectedVersion={selectedVersionForCompare}
                versions={selectedVersionForCompare ? groupedVersions.find(g => g.versions.some(v => v.id === selectedVersionForCompare.id))?.versions || [] : []}
                activeFlowChatflowId={selectedVersionForCompare?.chatFlowId || null}
            />

            {/* Git Sync Dialog */}
            <Dialog
                open={openGitSyncDialog}
                onClose={() => setOpenGitSyncDialog(false)}
                maxWidth='md'
                fullWidth
                PaperProps={{
                    sx: {
                        height: '85vh',
                        maxHeight: '85vh',
                        display: 'flex',
                        flexDirection: 'column'
                    }
                }}
            >
                <DialogTitle sx={{ fontSize: '1rem', pb: 1, pr: 6 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <IconGitBranch size={20} />
                        Git Sync
                        <Chip
                            label={gitSyncChipLabel}
                            size='small'
                            sx={{
                                backgroundColor: `${gitSyncStateColor}20`,
                                color: gitSyncStateColor,
                                fontWeight: 600,
                                fontSize: '0.75rem'
                            }}
                        />
                    </Box>
                    <IconButton
                        onClick={() => setOpenGitSyncDialog(false)}
                        size='small'
                        sx={{ position: 'absolute', right: 12, top: 12 }}
                    >
                        <IconX size={18} />
                    </IconButton>
                </DialogTitle>
                <DialogContent
                    sx={{
                        flex: 1,
                        overflow: 'auto',
                        pt: '8px !important'
                    }}
                >
                    <GitSyncPanel onStatusChange={() => getGitSyncStatusApi.request()} />
                </DialogContent>
            </Dialog>
        </MainCard>
    )
}

export default AgentOps