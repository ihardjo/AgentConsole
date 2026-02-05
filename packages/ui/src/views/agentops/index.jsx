import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import { enqueueSnackbar as enqueueSnackbarAction, closeSnackbar as closeSnackbarAction } from '@/store/actions'
import moment from 'moment'

// material-ui
import {
    Box,
    Stack,
    Button,
    Grid,
    Dialog,
    DialogActions,
    DialogContent,
    DialogContentText,
    DialogTitle,
    useTheme,
    Alert,
    TextField,
    Typography,
    Chip,
    CircularProgress,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Paper,
    IconButton,
    Tooltip,
    Collapse
} from '@mui/material'

// project imports
import MainCard from '@/ui-component/cards/MainCard'
import ErrorBoundary from '@/ErrorBoundary'
import ViewHeader from '@/layout/MainLayout/ViewHeader'
import { StyledTableCell, StyledTableRow } from '@/ui-component/table/TableStyles'
import { StyledButton } from '@/ui-component/button/StyledButton'
import { Dropdown } from '@/ui-component/dropdown/Dropdown'

// API
import useApi from '@/hooks/useApi'
import chatflowVersionsApi from '@/api/chatflowVersions'
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
    IconX
} from '@tabler/icons-react'

// components
import VersionHistoryTable from '@/ui-component/table/VersionHistoryTable'
import TablePagination, { DEFAULT_ITEMS_PER_PAGE } from '@/ui-component/pagination/TablePagination'

// ==============================|| AGENT OPS - VERSION HISTORY ||============================== //

const AgentOps = () => {
    const theme = useTheme()
    const navigate = useNavigate()
    const dispatch = useDispatch()
    const customization = useSelector((state) => state.customization)
    const borderColor = theme.palette.grey[900] + 25
    const { hasPermission } = useAuth()

    useNotifier()

    const enqueueSnackbar = (...args) => dispatch(enqueueSnackbarAction(...args))
    const closeSnackbar = (...args) => dispatch(closeSnackbarAction(...args))

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

    // Dialog states
    const [openSaveVersionDialog, setOpenSaveVersionDialog] = useState(false)
    const [openEditVersionDialog, setOpenEditVersionDialog] = useState(false)
    const [openRestoreDialog, setOpenRestoreDialog] = useState(false)
    const [openDeleteDialog, setOpenDeleteDialog] = useState(false)
    const [selectedVersion, setSelectedVersion] = useState(null)

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
                enqueueSnackbar({
                    message: `Failed to create version: ${
                        typeof error.response?.data === 'object' ? error.response.data.message : error.response?.data || error.message
                    }`,
                    options: {
                        key: new Date().getTime() + Math.random(),
                        variant: 'error',
                        persist: true,
                        action: (key) => (
                            <Button style={{ color: 'white' }} onClick={() => closeSnackbar(key)}>
                                <IconX />
                            </Button>
                        )
                    }
                })
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
            } catch (error) {
                enqueueSnackbar({
                    message: `Failed to update version: ${
                        typeof error.response?.data === 'object' ? error.response.data.message : error.response?.data || error.message
                    }`,
                    options: {
                        key: new Date().getTime() + Math.random(),
                        variant: 'error',
                        persist: true,
                        action: (key) => (
                            <Button style={{ color: 'white' }} onClick={() => closeSnackbar(key)}>
                                <IconX />
                            </Button>
                        )
                    }
                })
            }
        }
    }

    // Search handler
    const onSearchChange = (event) => {
        setSearch(event.target.value)
    }

    // Version actions
    const handleVersionClick = (version) => {
        // Navigate to version details or open a drawer
        console.log('View version details:', version)
    }

    const handleRestoreClick = (version) => {
        setSelectedVersion(version)
        setOpenRestoreDialog(true)
    }

    const handleConfirmRestore = async () => {
        if (selectedVersion) {
            try {
                await restoreVersionApi.request(selectedVersion.id)
                enqueueSnackbar({
                    message: 'Version restored successfully',
                    options: {
                        key: new Date().getTime() + Math.random(),
                        variant: 'success',
                        action: (key) => (
                            <Button style={{ color: 'white' }} onClick={() => closeSnackbar(key)}>
                                <IconX />
                            </Button>
                        )
                    }
                })
            } catch (error) {
                enqueueSnackbar({
                    message: `Failed to restore version: ${
                        typeof error.response?.data === 'object' ? error.response.data.message : error.response?.data || error.message
                    }`,
                    options: {
                        key: new Date().getTime() + Math.random(),
                        variant: 'error',
                        persist: true,
                        action: (key) => (
                            <Button style={{ color: 'white' }} onClick={() => closeSnackbar(key)}>
                                <IconX />
                            </Button>
                        )
                    }
                })
            }
        }
        setOpenRestoreDialog(false)
    }

    const handleDeleteClick = (version) => {
        setSelectedVersion(version)
        setOpenDeleteDialog(true)
    }

    const handleConfirmDelete = async () => {
        if (selectedVersion) {
            try {
                await deleteVersionApi.request(selectedVersion.id)
                enqueueSnackbar({
                    message: 'Version deleted successfully',
                    options: {
                        key: new Date().getTime() + Math.random(),
                        variant: 'success',
                        action: (key) => (
                            <Button style={{ color: 'white' }} onClick={() => closeSnackbar(key)}>
                                <IconX />
                            </Button>
                        )
                    }
                })
            } catch (error) {
                enqueueSnackbar({
                    message: `Failed to delete version: ${
                        typeof error.response?.data === 'object' ? error.response.data.message : error.response?.data || error.message
                    }`,
                    options: {
                        key: new Date().getTime() + Math.random(),
                        variant: 'error',
                        persist: true,
                        action: (key) => (
                            <Button style={{ color: 'white' }} onClick={() => closeSnackbar(key)}>
                                <IconX />
                            </Button>
                        )
                    }
                })
            }
        }
        setOpenDeleteDialog(false)
    }

    // Effects
    useEffect(() => {
        fetchVersions()
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
            } catch (e) {
                console.error(e)
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
            enqueueSnackbar({
                message: 'Version created successfully',
                options: {
                    key: new Date().getTime() + Math.random(),
                    variant: 'success',
                    action: (key) => (
                        <Button style={{ color: 'white' }} onClick={() => closeSnackbar(key)}>
                            <IconX />
                        </Button>
                    )
                }
            })
            fetchVersions()
            handleCloseSaveVersion()
        }
    }, [createVersionApi.data])

    // Refresh after restore
    useEffect(() => {
        if (restoreVersionApi.data) {
            fetchVersions()
            setSelectedVersion(null)
        }
    }, [restoreVersionApi.data])

    // Refresh after update
    useEffect(() => {
        if (updateVersionApi.data) {
            enqueueSnackbar({
                message: 'Version updated successfully',
                options: {
                    key: new Date().getTime() + Math.random(),
                    variant: 'success',
                    action: (key) => (
                        <Button style={{ color: 'white' }} onClick={() => closeSnackbar(key)}>
                            <IconX />
                        </Button>
                    )
                }
            })
            fetchVersions()
            handleCloseEditVersion()
        }
    }, [updateVersionApi.data])

    // Refresh after delete
    useEffect(() => {
        if (deleteVersionApi.data) {
            fetchVersions()
            setSelectedVersion(null)
        }
    }, [deleteVersionApi.data])

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

    return (
        <MainCard>
            {error ? (
                <ErrorBoundary error={error} />
            ) : (
                <Stack flexDirection='column' sx={{ gap: 3 }}>
                    <ViewHeader
                        onSearchChange={onSearchChange}
                        search={true}
                        searchValue={search}
                        searchPlaceholder='Search Name or Description'
                        title='AI Agents Versions'
                        description='Manage AI Agent versions'
                    >
                        {hasPermission('agentops:create') && (
                            <Button
                                variant='contained'
                                startIcon={<IconPlus />}
                                onClick={handleOpenSaveVersion}
                            >
                                Create Version
                            </Button>
                        )}
                    </ViewHeader>

                    {/* Grouped Version History */}
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
                            <div>{search ? 'No versions match your search' : 'No versions found'}</div>
                            {!search && <div>Create a version by clicking "Create Version" above</div>}
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
                                                            ? '#1a1a1a'
                                                            : theme.palette.grey[300],
                                                        '&:hover': {
                                                            backgroundColor: customization.isDarkMode
                                                                ? '#252525'
                                                                : theme.palette.grey[300]
                                                        },
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
                                                                color: theme.palette.text.primary
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
                                                            v{version.version}
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
                                                            <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 0.5 }}>
                                                                {hasPermission('agentops:update') && (
                                                                    <Tooltip title='Edit description'>
                                                                        <IconButton
                                                                            size='small'
                                                                            onClick={(e) => {
                                                                                e.stopPropagation()
                                                                                handleOpenEditVersion({ ...version, chatFlowName: group.chatFlowName })
                                                                            }}
                                                                            sx={{
                                                                                color: theme.palette.text.primary
                                                                            }}
                                                                        >
                                                                            <IconEdit size={18} />
                                                                        </IconButton>
                                                                    </Tooltip>
                                                                )}
                                                                {hasPermission('agentops:restore') && (
                                                                    <Tooltip title='Restore version'>
                                                                        <IconButton
                                                                            size='small'
                                                                            onClick={(e) => {
                                                                                e.stopPropagation()
                                                                                handleRestoreClick && handleRestoreClick({ ...version, chatFlowName: group.chatFlowName })
                                                                            }}
                                                                            sx={{
                                                                                color: theme.palette.text.primary
                                                                            }}
                                                                        >
                                                                            <IconRestore size={18} />
                                                                        </IconButton>
                                                                    </Tooltip>
                                                                )}
                                                                {hasPermission('agentops:delete') && (
                                                                    <Tooltip title='Delete version'>
                                                                        <IconButton
                                                                            size='small'
                                                                            onClick={(e) => {
                                                                                e.stopPropagation()
                                                                                handleDeleteClick && handleDeleteClick({ ...version, chatFlowName: group.chatFlowName })
                                                                            }}
                                                                            color='error'
                                                                        >
                                                                            <IconTrash size={18} />
                                                                        </IconButton>
                                                                    </Tooltip>
                                                                )}
                                                            </Box>
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
                <DialogTitle style={{ fontSize: '1rem' }}>
                    <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center' }}>
                        <IconDeviceFloppy style={{ marginRight: '10px' }} />
                        Create Version
                    </div>
                </DialogTitle>
                <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <Box>
                        <div style={{ display: 'flex', flexDirection: 'row' }}>
                            <Typography>
                                Select AI Agent<span style={{ color: 'red' }}>&nbsp;*</span>
                            </Typography>
                            <div style={{ flexGrow: 1 }}></div>
                        </div>
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
                <DialogTitle style={{ fontSize: '1rem' }}>
                    <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center' }}>
                        <IconEdit style={{ marginRight: '10px' }} />
                        Edit Version Description
                    </div>
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
            <Dialog open={openRestoreDialog} onClose={() => setOpenRestoreDialog(false)} fullWidth maxWidth='sm'>
                <DialogTitle style={{ fontSize: '1rem' }}>
                    <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center' }}>
                        <IconRestore style={{ marginRight: '10px' }} />
                        Restore {selectedVersion?.chatFlowName} to version v{selectedVersion?.version}
                    </div>
                </DialogTitle>
                <DialogContent sx={{ pt: 2, pb: 1 }}>
                    <Alert 
                        severity='warning' 
                        sx={{ 
                            backgroundColor: theme.palette.mode === 'dark' ? 'rgba(255, 152, 0, 0.2)' : 'rgb(255, 244, 229)',
                            '& .MuiAlert-icon': {
                                color: theme.palette.mode === 'dark' ? '#ffb74d' : '#ed6c02'
                            },
                            '& .MuiAlert-message': {
                                color: theme.palette.mode === 'dark' ? '#1a1a1a' : 'inherit'
                            }
                        }}
                    >
                        <Typography variant='body2' sx={{ fontWeight: 500, color: theme.palette.mode === 'dark' ? '#1a1a1a' : 'inherit' }}>
                            This will replace the current configuration.
                        </Typography>
                        <Typography variant='body2' sx={{ mt: 0.5, color: theme.palette.mode === 'dark' ? '#1a1a1a' : 'inherit' }}>
                            The current configuration will be backed up automatically before restoring.
                        </Typography>
                    </Alert>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setOpenRestoreDialog(false)}>Cancel</Button>
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
                <DialogTitle style={{ fontSize: '1rem' }}>
                    <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center' }}>
                        <IconTrash style={{ marginRight: '10px' }} />
                        Delete {selectedVersion?.chatFlowName} version v{selectedVersion?.version}
                    </div>
                </DialogTitle>
                <DialogContent sx={{ pt: 2, pb: 1 }}>
                    <Alert 
                        severity='error' 
                        icon={<IconAlertTriangle />}
                        sx={{ 
                            backgroundColor: theme.palette.mode === 'dark' ? 'rgba(211, 47, 47, 0.2)' : 'rgb(253, 237, 237)',
                            '& .MuiAlert-icon': {
                                color: theme.palette.mode === 'dark' ? '#f44336' : '#d32f2f'
                            },
                            '& .MuiAlert-message': {
                                color: theme.palette.mode === 'dark' ? '#1a1a1a' : 'inherit'
                            }
                        }}
                    >
                        <Typography variant='body2' sx={{ fontWeight: 500, color: theme.palette.mode === 'dark' ? '#1a1a1a' : 'inherit' }}>
                            This action cannot be undone.
                        </Typography>
                        <Typography variant='body2' sx={{ mt: 0.5, color: theme.palette.mode === 'dark' ? '#1a1a1a' : 'inherit' }}>
                            This will permanently remove this version from the history.
                        </Typography>
                    </Alert>
                </DialogContent>
                <DialogActions>
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
        </MainCard>
    )
}

export default AgentOps