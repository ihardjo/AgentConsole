import { useEffect, useState, useCallback } from 'react'
import { useDispatch } from 'react-redux'
import { enqueueSnackbar as enqueueSnackbarAction, closeSnackbar as closeSnackbarAction } from '@/store/actions'
import moment from 'moment'

// material-ui
import {
    Box,
    Stack,
    Button,
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
    Divider,
    useTheme,
    TextField,
    Switch,
    FormControlLabel,
    Select,
    MenuItem,
    FormControl,
    InputLabel,
    InputAdornment,
    Tabs,
    Tab
} from '@mui/material'
import { useSelector } from 'react-redux'

// project imports
import { StyledTableCell, StyledTableRow } from '@/ui-component/table/TableStyles'
import { StyledButton } from '@/ui-component/button/StyledButton'
import TablePagination, { DEFAULT_ITEMS_PER_PAGE } from '@/ui-component/pagination/TablePagination'
import { parseRepoName } from './index'

// API
import useApi from '@/hooks/useApi'
import gitSyncApi from '@/api/gitSync'
import { useAuth } from '@/hooks/useAuth'

// utils
import useNotifier from '@/utils/useNotifier'

// icons
import {
    IconGitBranch,
    IconGitCommit,
    IconCloudUpload,
    IconCloudDownload,
    IconEye,
    IconEyeOff,
    IconX,
    IconAlertTriangle,
    IconSettings,
    IconHistory,
    IconDeviceFloppy,
    IconKey,
    IconLock,
    IconInfoCircle,
    IconPlugConnected,
    IconTag
} from '@tabler/icons-react'

// ==============================|| GIT SYNC PANEL ||============================== //

const GitSyncPanel = ({ onStatusChange } = {}) => {
    const theme = useTheme()
    const dispatch = useDispatch()
    const customization = useSelector((state) => state.customization)
    const borderColor = theme.palette.grey[900] + 25
    const { hasPermission } = useAuth()

    useNotifier()

    const enqueueSnackbar = (...args) => dispatch(enqueueSnackbarAction(...args))
    const closeSnackbar = (...args) => dispatch(closeSnackbarAction(...args))

    /**
     * Convenience wrapper — eliminates the repeated key/action boilerplate across
     * every push/pull/fetch/save handler.
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
    const getStatusApi = useApi(gitSyncApi.getStatus)
    const getLogApi = useApi(gitSyncApi.getLog)

    const getConfigApi = useApi(gitSyncApi.getConfig)

    // ── Inner tab: "Activity" vs "Configuration" ──────────────────────
    const [innerTab, setInnerTab] = useState(0)

    // State
    const [gitStatus, setGitStatus] = useState(null)
    const [gitEnabled, setGitEnabled] = useState(false)
    const [commitLog, setCommitLog] = useState([])
    const [isLoading, setIsLoading] = useState(true)
    const [isPushing, setIsPushing] = useState(false)
    const [isPulling, setIsPulling] = useState(false)
    const [isFetching, setIsFetching] = useState(false)

    // Pagination
    const [currentPage, setCurrentPage] = useState(1)
    const [pageLimit, setPageLimit] = useState(DEFAULT_ITEMS_PER_PAGE)
    const [totalCommits, setTotalCommits] = useState(0)

    // ── Config form state ─────────────────────────────────────────────
    const DEFAULT_CONFIG = {
        enabled: false,
        remoteUrl: '',
        branch: 'main',
        authMethod: 'token',
        accessToken: '',
        sshKeyPath: ''
    }
    const [configForm, setConfigForm] = useState(DEFAULT_CONFIG)
    const [savedConfig, setSavedConfig] = useState(DEFAULT_CONFIG)
    const [isSavingConfig, setIsSavingConfig] = useState(false)
    const [isTesting, setIsTesting] = useState(false)
    const [testConnectionPassed, setTestConnectionPassed] = useState(false)
    const [showToken, setShowToken] = useState(false)

    // Derived: true only when the form actually differs from the last saved snapshot
    const configFormDirty = Object.keys(DEFAULT_CONFIG).some(
        (k) => configForm[k] !== savedConfig[k]
    )

    const onChange = (page, pageLimit) => {
        setCurrentPage(page)
        setPageLimit(pageLimit)
    }

    const fetchStatus = useCallback(() => {
        getStatusApi.request()
    }, [])

    const fetchLog = useCallback(({ showSpinner = true } = {}) => {
        if (showSpinner) setIsLoading(true)
        getLogApi.request({ page: currentPage, pageSize: pageLimit })
    }, [currentPage, pageLimit])

    // ─── Handlers ──────────────────────────────────────────────────────

    const handlePush = async () => {
        setIsPushing(true)
        try {
            const resp = await gitSyncApi.push()
            const data = resp.data?.data
            showSnackbar(
                `Pushed ${data?.versionsWritten ?? 0} version(s) to git${data?.pushed ? ' remote' : ''}`,
                'success'
            )
            fetchStatus()
            fetchLog()
            if (onStatusChange) onStatusChange()
        } catch (error) {
            showSnackbar(
                `Push failed: ${error?.response?.data?.message || error?.message || 'Unknown error'}`,
                'error',
                true
            )
        } finally {
            setIsPushing(false)
        }
    }

    const handlePull = async () => {
        setIsPulling(true)
        try {
            const resp = await gitSyncApi.pull()
            const data = resp.data?.data
            const parts = []
            if (data?.versionsImported > 0) parts.push(`${data.versionsImported} version(s)`)
            if (data?.flowsCreated > 0) parts.push(`${data.flowsCreated} new flow(s)`)
            const msg = parts.length > 0
                ? `Pulled and imported ${parts.join(' and ')} from remote`
                : data?.pulled
                    ? 'Pulled from remote — no new versions to import'
                    : 'Already up to date'
            showSnackbar(msg, parts.length > 0 ? 'success' : 'info')
            fetchStatus()
            fetchLog()
            if (onStatusChange) onStatusChange()
        } catch (error) {
            showSnackbar(
                `Pull failed: ${error?.response?.data?.message || error?.message || 'Unknown error'}`,
                'error',
                true
            )
        } finally {
            setIsPulling(false)
        }
    }

    const handleFetch = async () => {
        setIsFetching(true)
        try {
            await gitSyncApi.fetch()
            showSnackbar('Fetched latest updates from remote', 'success')
            fetchStatus()
            // Reset to page 1 so the log always shows the newest commits first
            setCurrentPage(1)
            fetchLog()
        } catch (error) {
            showSnackbar(
                `Fetch failed: ${error?.response?.data?.message || error?.message || 'Unknown error'}`,
                'error',
                true
            )
        } finally {
            setIsFetching(false)
        }
    }


    // ─── Effects ───────────────────────────────────────────────────────

    useEffect(() => {
        fetchStatus()
        getConfigApi.request()
    }, [])

    useEffect(() => {
        fetchLog({ showSpinner: false })
    }, [currentPage, pageLimit])

    useEffect(() => {
        if (getStatusApi.data) {
            setGitEnabled(getStatusApi.data.enabled !== false)
            setGitStatus(getStatusApi.data.data || null)
        }
    }, [getStatusApi.data])

    useEffect(() => {
        if (getLogApi.data) {
            setCommitLog(getLogApi.data.data || [])
            setTotalCommits(getLogApi.data.total ?? 0)
            setIsLoading(false)
        }
    }, [getLogApi.data])

    useEffect(() => {
        if (getLogApi.loading === false) {
            setIsLoading(false)
        }
    }, [getLogApi.loading])

    useEffect(() => {
        if (getConfigApi.data?.data) {
            const c = getConfigApi.data.data
            const loaded = {
                enabled: c.enabled ?? false,
                remoteUrl: c.remoteUrl ?? '',
                branch: c.branch ?? 'main',
                authMethod: c.authMethod ?? 'token',
                accessToken: c.accessToken ?? '',
                sshKeyPath: c.sshKeyPath ?? ''
            }
            setConfigForm(loaded)
            setSavedConfig(loaded)
        }
    }, [getConfigApi.data])

    // ─── Config form helpers ──────────────────────────────────────────

    const handleConfigChange = (field) => (e) => {
        const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value
        setConfigForm((prev) => ({ ...prev, [field]: value }))
        // Any config change invalidates a previous successful test
        setTestConnectionPassed(false)
    }

    const handleSaveConfig = async () => {
        // Guard: test connection must pass before saving when enabling
        if (configForm.enabled && !testConnectionPassed) {
            showSnackbar(
                'Please run a successful Test Connection before saving the configuration.',
                'warning'
            )
            return
        }

        setIsSavingConfig(true)
        try {
            // ── Disabling: wipe everything ────────────────────────────────
            if (!configForm.enabled) {
                await gitSyncApi.disable()
                fetchStatus()
                fetchLog()
                getConfigApi.request()
                setSavedConfig(configForm)
                setTestConnectionPassed(false)
                if (onStatusChange) onStatusChange()
                showSnackbar(
                    'Git Sync disabled — all configuration and local repository data have been cleared.',
                    'info'
                )
                return
            }

            // ── Enabling / updating ───────────────────────────────────────
            const resp = await gitSyncApi.updateConfig(configForm)
            fetchStatus()
            fetchLog()
            getConfigApi.request()
            setSavedConfig(configForm)

            if (onStatusChange) onStatusChange()

            const saved = resp.data
            if (saved?.initialized === false) {
                showSnackbar(
                    saved.message || 'Configuration saved, but Git initialisation failed. Check the server logs.',
                    'warning',
                    true
                )
            } else {
                showSnackbar('Git Sync configuration saved — use Push to upload to remote', 'success')
            }
        } catch (error) {
            showSnackbar(
                `Failed to save config: ${error?.response?.data?.message || error?.message || 'Unknown error'}`,
                'error',
                true
            )
        } finally {
            setIsSavingConfig(false)
        }
    }

    const handleTestConnection = async () => {
        setIsTesting(true)
        try {
            const resp = await gitSyncApi.testConnection(configForm)
            const data = resp.data
            if (data?.success) {
                setTestConnectionPassed(true)
                showSnackbar(
                    'Connection successful — remote is reachable and credentials are valid',
                    'success'
                )
            } else {
                setTestConnectionPassed(false)
                showSnackbar(`Connection failed: ${data?.error || 'Unknown error'}`, 'error', true)
            }
        } catch (error) {
            setTestConnectionPassed(false)
            showSnackbar(
                `Connection test failed: ${error?.response?.data?.message || error?.message || 'Unknown error'}`,
                'error',
                true
            )
        } finally {
            setIsTesting(false)
        }
    }

    // ─── Parse commit message for structured display ───────────────────

    const parseCommitMessage = (message) => {
        if (!message) return { title: 'No message', entityId: '', action: '', author: '' }
        const lines = message.split('\n')
        const title = lines[0] || 'No message'

        const meta = {}
        lines.forEach((line) => {
            const match = line.match(/^(Entity ID|Entity Type|Action|Author|Timestamp):\s*(.+)$/)
            if (match) {
                meta[match[1].toLowerCase().replace(/\s/g, '_')] = match[2]
            }
        })

        return { title, ...meta }
    }

    /**
     * Render ref decorator chips for a single commit row.
     * Input examples: ['HEAD -> main', 'origin/main', 'tag: v1.0']
     */
    const renderRefChips = (refs) => {
        if (!refs?.length) return null

        // "origin/HEAD" is a symbolic pointer on the remote side — it adds no
        // meaningful information for the user and clutters every commit row.
        const visibleRefs = refs.filter((r) => r !== 'origin/HEAD')
        if (!visibleRefs.length) return null

        const branchColor = customization.isDarkMode ? theme.palette.success.main : theme.palette.success.dark
        const remoteColor = customization.isDarkMode ? theme.palette.success.light : theme.palette.success.dark
        const headBg      = customization.isDarkMode ? theme.palette.warning.main  : theme.palette.warning.dark
        const headText    = customization.isDarkMode ? theme.palette.grey[900]      : '#ffffff'

        return (
            <Stack direction='row' gap={0.5} flexWrap='wrap'>
                {visibleRefs.map((ref) => {
                    // "HEAD -> main"  → HEAD badge + local branch chip
                    if (ref.startsWith('HEAD -> ')) {
                        const branch = ref.replace('HEAD -> ', '')
                        return [
                            <Chip key='HEAD' label='HEAD' size='small' variant='filled'
                                sx={{ fontSize: '0.65rem', height: 18, fontWeight: 700, backgroundColor: headBg, color: headText }} />,
                            <Chip key={branch} label={branch}
                                icon={<IconGitBranch size={10} style={{ color: branchColor }} />}
                                size='small' variant='outlined'
                                sx={{ fontSize: '0.65rem', height: 18, borderColor: branchColor, color: branchColor }} />
                        ]
                    }
                    // "tag: v1.0"
                    if (ref.startsWith('tag: ')) {
                        const tag = ref.replace('tag: ', '')
                        return (
                            <Chip key={ref} label={tag}
                                icon={<IconTag size={10} />}
                                size='small' color='secondary' variant='outlined'
                                sx={{ fontSize: '0.65rem', height: 18 }} />
                        )
                    }
                    // "origin/main" or any other remote ref
                    if (ref.includes('/')) {
                        return (
                            <Chip key={ref} label={ref}
                                icon={<IconGitBranch size={10} style={{ color: remoteColor }} />}
                                size='small' variant='outlined'
                                sx={{ fontSize: '0.65rem', height: 18, borderColor: remoteColor, color: remoteColor }} />
                        )
                    }
                    // bare local branch name
                    return (
                        <Chip key={ref} label={ref}
                            icon={<IconGitBranch size={10} style={{ color: branchColor }} />}
                            size='small' variant='outlined'
                            sx={{ fontSize: '0.65rem', height: 18, borderColor: branchColor, color: branchColor }} />
                    )
                })}
            </Stack>
        )
    }

    // ─── Render ────────────────────────────────────────────────────────

    // ── Shared inner tab strip ─────────────────────────────────────────
    const innerTabSx = {
        minHeight: 40,
        '& .MuiTab-root': {
            minHeight: 40,
            textTransform: 'none',
            fontWeight: 500,
            fontSize: '0.875rem',
            color: customization.isDarkMode ? theme.palette.grey[400] : theme.palette.grey[600],
            gap: 0.5,
            '&:hover': {
                color: theme.palette.primary.main,
                backgroundColor: customization.isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
                borderRadius: '6px 6px 0 0'
            }
        },
        '& .Mui-selected': { fontWeight: 600, color: `${theme.palette.primary.main} !important` },
        '& .MuiTabs-indicator': { height: 2, borderRadius: '2px 2px 0 0', backgroundColor: theme.palette.primary.main }
    }

    // ── Config form (shared — always visible so user can enable sync) ──
    const canEdit = hasPermission('agentops:git-sync')

    // Save is blocked when enabling until test connection passes
    const saveBlockedByTest = configForm.enabled && !testConnectionPassed

    const configPanel = (
        <Stack flexDirection='column' sx={{ gap: 3, pt: 1 }}>
            {/* Enable toggle */}
            <Paper
                sx={{
                    p: 2.5,
                    border: 1,
                    borderColor: borderColor,
                    borderRadius: 2,
                    backgroundColor: customization.isDarkMode ? theme.palette.background.paper : theme.palette.grey[50]
                }}
            >
                <Stack direction='row' alignItems='center' justifyContent='space-between'>
                    <Box>
                        <Typography variant='subtitle2' color='text.primary'>
                            Enable Git Sync
                        </Typography>
                        <Typography variant='caption' color='text.secondary'>
                            Commit every version save to a Git repository and push to a remote
                        </Typography>
                    </Box>
                    <FormControlLabel
                        control={
                            <Switch
                                checked={configForm.enabled}
                                onChange={handleConfigChange('enabled')}
                                disabled={!canEdit}
                                color='primary'
                            />
                        }
                        label={configForm.enabled ? 'Enabled' : 'Disabled'}
                        labelPlacement='start'
                        sx={{ mr: 0, '& .MuiFormControlLabel-label': { fontSize: '0.875rem' } }}
                    />
                </Stack>
            </Paper>

            {/* Repository Settings — only visible when enabled */}
            {configForm.enabled && (
                <>
                    <Box>
                        <Typography variant='overline' color='text.secondary' sx={{ letterSpacing: '0.08em', display: 'block', mb: 1.5 }}>
                            Repository Settings
                        </Typography>
                        <Stack flexDirection='column' sx={{ gap: 2 }}>
                            <Stack direction='row' gap={2}>
                                <TextField
                                    label='Remote URL'
                                    value={configForm.remoteUrl}
                                    onChange={handleConfigChange('remoteUrl')}
                                    disabled={!canEdit}
                                    size='small'
                                    sx={{ flex: 3 }}
                                    placeholder='https://github.com/org/repo.git'
                                    required
                                />
                                <TextField
                                    label='Branch'
                                    value={configForm.branch}
                                    onChange={handleConfigChange('branch')}
                                    disabled={!canEdit}
                                    size='small'
                                    sx={{ flex: 1 }}
                                    placeholder='main'
                                />
                            </Stack>
                        </Stack>
                    </Box>

                    {/* Auth Settings */}
                    <Box>
                        <Typography variant='overline' color='text.secondary' sx={{ letterSpacing: '0.08em', display: 'block', mb: 1.5 }}>
                            Authentication
                        </Typography>
                        <Stack direction='row' alignItems='flex-start' flexWrap='wrap' sx={{ gap: 2 }}>
                            <FormControl size='small' sx={{ width: 180, flexShrink: 0 }} disabled={!canEdit}>
                                <InputLabel>Auth Method</InputLabel>
                                <Select
                                    value={configForm.authMethod}
                                    label='Auth Method'
                                    onChange={handleConfigChange('authMethod')}
                                >
                                    <MenuItem value='token'>
                                        <Stack direction='row' alignItems='center' gap={1}>
                                            <IconKey size={16} /> Access Token
                                        </Stack>
                                    </MenuItem>
                                    <MenuItem value='ssh'>
                                        <Stack direction='row' alignItems='center' gap={1}>
                                            <IconLock size={16} /> SSH Key
                                        </Stack>
                                    </MenuItem>
                                </Select>
                            </FormControl>

                            {configForm.authMethod === 'token' && (
                                <>
                                    <TextField
                                        label='Access Token'
                                        value={configForm.accessToken}
                                        onChange={handleConfigChange('accessToken')}
                                        disabled={!canEdit}
                                        size='small'
                                        type={showToken ? 'text' : 'password'}
                                        sx={{ flex: 1, minWidth: 220, maxWidth: 400 }}
                                        placeholder='ghp_••••••••••••••••'
                                        InputProps={{
                                            endAdornment: (
                                                <InputAdornment position='end'>
                                                    <Tooltip title={showToken ? 'Hide token' : 'Show token'}>
                                                        <IconButton
                                                            size='small'
                                                            onClick={() => setShowToken((v) => !v)}
                                                            edge='end'
                                                            disabled={!canEdit}
                                                        >
                                                            {showToken ? <IconEyeOff size={16} /> : <IconEye size={16} />}
                                                        </IconButton>
                                                    </Tooltip>
                                                </InputAdornment>
                                            )
                                        }}
                                    />
                                    <Tooltip
                                        arrow
                                        placement='top'
                                        title={
                                            <Box sx={{ p: 0.5, fontSize: '0.8rem', lineHeight: 1.6 }}>
                                                <strong>GitHub:</strong> Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token. Grant <em>Contents: Read and write</em> permission.
                                                <br /><br />
                                                <strong>GitLab:</strong> Preferences → Access Tokens → Add new token. Select <em>read_repository</em> and <em>write_repository</em> scopes.
                                                <br /><br />
                                                <strong>Bitbucket:</strong> Personal settings → App passwords → Create app password. Grant <em>Repositories: Read & Write</em>.
                                            </Box>
                                        }
                                    >
                                        <Box component='span' sx={{ display: 'flex', alignSelf: 'center', cursor: 'help', opacity: 0.6, lineHeight: 0 }}>
                                            <IconInfoCircle size={16} />
                                        </Box>
                                    </Tooltip>
                                </>
                            )}

                            {configForm.authMethod === 'ssh' && (
                                <>
                                    <TextField
                                        label='SSH Key Path'
                                        value={configForm.sshKeyPath}
                                        onChange={handleConfigChange('sshKeyPath')}
                                        disabled={!canEdit}
                                        size='small'
                                        sx={{ flex: 1, minWidth: 220, maxWidth: 400 }}
                                        placeholder='/root/.ssh/id_ed25519'
                                    />
                                    <Tooltip
                                        arrow
                                        placement='top'
                                        title={
                                            <Box sx={{ p: 0.5, fontSize: '0.8rem', lineHeight: 1.6 }}>
                                                <strong>Generate a key:</strong>
                                                <br />
                                                <code style={{ fontSize: '0.75rem' }}>ssh-keygen -t ed25519 -C "your@email.com"</code>
                                                <br /><br />
                                                <strong>Add public key to your provider:</strong>
                                                <br />
                                                Copy <code style={{ fontSize: '0.75rem' }}>~/.ssh/id_ed25519.pub</code> and add it as a deploy key in your repository settings (GitHub: Settings → Deploy keys, GitLab: Settings → Repository → Deploy keys).
                                                <br /><br />
                                                Enter the <em>private</em> key path below (e.g. <code style={{ fontSize: '0.75rem' }}>~/.ssh/id_ed25519</code>).
                                            </Box>
                                        }
                                    >
                                        <Box component='span' sx={{ display: 'flex', alignSelf: 'center', cursor: 'help', opacity: 0.6, lineHeight: 0 }}>
                                            <IconInfoCircle size={16} />
                                        </Box>
                                    </Tooltip>
                                </>
                            )}
                        </Stack>
                    </Box>
                </>
            )}

            {canEdit && (
                <Box>
                    <Divider sx={{ mb: 2.5 }} />
                    <Stack direction='column' gap={1.5}>
                        <Stack direction='row' gap={1.5} alignItems='center' flexWrap='wrap'>
                            <Button
                                variant='contained'
                                startIcon={isSavingConfig ? <CircularProgress size={14} color='inherit' /> : <IconDeviceFloppy size={16} />}
                                onClick={handleSaveConfig}
                                disabled={isSavingConfig || !configFormDirty || saveBlockedByTest}
                            >
                                {isSavingConfig ? 'Saving...' : 'Save Configuration'}
                            </Button>
                            {configForm.enabled && (
                                <Button
                                    variant='outlined'
                                    color={testConnectionPassed ? 'success' : 'primary'}
                                    startIcon={isTesting ? <CircularProgress size={14} /> : <IconPlugConnected size={16} />}
                                    onClick={handleTestConnection}
                                    disabled={isTesting}
                                >
                                    {isTesting ? 'Testing...' : testConnectionPassed ? 'Connection Verified ✓' : 'Test Connection'}
                                </Button>
                            )}
                            {configFormDirty && !saveBlockedByTest && (
                                <Typography variant='caption' color='text.secondary'>
                                    Unsaved changes
                                </Typography>
                            )}
                        </Stack>
                    </Stack>
                </Box>
            )}
        </Stack>
    )

    // ── When Git sync is disabled — show config only ───────────────────
    if (!gitEnabled) {
        return (
            <Stack flexDirection='column' sx={{ gap: 3 }}>
                <Box
                    sx={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 1.5,
                        p: 2,
                        borderRadius: 2,
                        border: `1px solid ${customization.isDarkMode ? 'rgba(41, 121, 255, 0.3)' : 'rgba(3, 169, 244, 0.25)'}`,
                        background: customization.isDarkMode
                            ? 'linear-gradient(135deg, rgba(41, 121, 255, 0.12) 0%, rgba(41, 121, 255, 0.06) 100%)'
                            : 'linear-gradient(135deg, rgba(227, 242, 253, 1) 0%, rgba(200, 230, 255, 0.5) 100%)'
                    }}
                >
                    <IconInfoCircle
                        size={18}
                        style={{
                            color: customization.isDarkMode ? theme.palette.primary.light : theme.palette.primary.main,
                            flexShrink: 0,
                            marginTop: 2
                        }}
                    />
                    <Typography
                        variant='body2'
                        sx={{ color: customization.isDarkMode ? theme.palette.text.primary : theme.palette.text.secondary }}
                    >
                        Git Sync is currently <strong>disabled</strong>. Configure the settings below and toggle it on to start tracking version changes as Git commits.
                    </Typography>
                </Box>
                {configPanel}
            </Stack>
        )
    }

    const repoName = parseRepoName(getStatusApi.data?.remoteUrl)

    return (
        <Stack flexDirection='column' sx={{ gap: 3 }}>
            {/* ── Inner tabs: Activity | Configuration ────────────────────── */}
            <Box sx={{ borderBottom: 1, borderColor: customization.isDarkMode ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)' }}>
                <Tabs value={innerTab} onChange={(_, v) => setInnerTab(v)} sx={innerTabSx}>
                    <Tab icon={<IconHistory size={15} />} iconPosition='start' label='Activity' />
                    <Tab icon={<IconSettings size={15} />} iconPosition='start' label='Configuration' />
                </Tabs>
            </Box>

            {/* ── Activity tab ──────────────────────────────────────────────── */}
            {innerTab === 0 && (
                <Stack flexDirection='column' sx={{ gap: 3 }}>
            {/* Not-initialized warning */}
            {getStatusApi.data?.initialized === false && (
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
                        size={18}
                        style={{
                            color: customization.isDarkMode ? theme.palette.warning.main : '#ed6c02',
                            flexShrink: 0,
                            marginTop: 2
                        }}
                    />
                    <Typography
                        variant='body2'
                        sx={{ color: customization.isDarkMode ? theme.palette.text.primary : theme.palette.text.secondary }}
                    >
                        Git Sync is <strong>enabled</strong> but not yet initialized.{' '}
                        {getStatusApi.data?.message || 'Check the repo path in the Configuration tab.'}
                    </Typography>
                </Box>
            )}

            {/* Last error alert */}
            {getStatusApi.data?.lastError && (
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
                        size={18}
                        style={{
                            color: customization.isDarkMode ? theme.palette.error.light : theme.palette.error.dark,
                            flexShrink: 0,
                            marginTop: 2
                        }}
                    />
                    <Box>
                        <Typography
                            variant='body2'
                            sx={{
                                fontWeight: 600,
                                mb: 0.5,
                                color: customization.isDarkMode ? theme.palette.error.light : theme.palette.error.dark
                            }}
                        >
                            Git Sync Error
                        </Typography>
                        <Typography
                            variant='body2'
                            sx={{
                                fontFamily: '"JetBrains Mono", "Fira Code", monospace',
                                fontSize: '0.8rem',
                                whiteSpace: 'pre-wrap',
                                wordBreak: 'break-word',
                                color: customization.isDarkMode ? theme.palette.text.primary : theme.palette.text.secondary
                            }}
                        >
                            {getStatusApi.data.lastError}
                        </Typography>
                    </Box>
                </Box>
            )}

            {/* Status Bar */}
            <Paper
                sx={{
                    p: 2,
                    border: 1,
                    borderColor: borderColor,
                    borderRadius: 2,
                    backgroundColor: customization.isDarkMode ? theme.palette.background.paper : theme.palette.grey[50]
                }}
            >
                <Stack direction='row' alignItems='center' justifyContent='space-between' flexWrap='wrap' gap={2}>
                    <Stack direction='row' alignItems='center' gap={2}>
                        <IconGitBranch size={24} color={theme.palette.primary.main} />
                        <Box>
                            {repoName && (
                                <Stack direction='row' alignItems='baseline' gap={0.5}>
                                    <Typography variant='caption' color='text.secondary'>Repository:</Typography>
                                    <Typography variant='body2' color='text.primary' sx={{ fontWeight: 600 }}>
                                        {repoName}
                                    </Typography>
                                </Stack>
                            )}
                            <Stack direction='row' alignItems='baseline' gap={0.5}>
                                <Typography variant='caption' color='text.secondary'>Branch:</Typography>
                                <Typography variant='body2' color='text.primary' sx={{ fontWeight: 600 }}>
                                    {gitStatus?.current || 'Connected'}
                                </Typography>
                            </Stack>
                            {getStatusApi.data?.lastSyncAt && (
                                <Typography variant='caption' color='text.secondary' sx={{ display: 'block' }}>
                                    Last synced: {moment(getStatusApi.data.lastSyncAt).fromNow()}
                                </Typography>
                            )}
                        </Box>
                    </Stack>

                    <Stack direction='row' gap={1}>
                        {hasPermission('agentops:git-sync') && (
                            <>
                                <Button
                                    variant='outlined'
                                    size='small'
                                    startIcon={isFetching ? <CircularProgress size={14} /> : <IconCloudDownload size={16} />}
                                    onClick={handleFetch}
                                    disabled={isFetching || isPulling || isPushing}
                                    color='secondary'
                                >
                                    {isFetching ? 'Fetching...' : 'Fetch'}
                                </Button>
                                <Button
                                    variant='outlined'
                                    size='small'
                                    startIcon={isPulling ? <CircularProgress size={14} /> : <IconCloudDownload size={16} />}
                                    onClick={handlePull}
                                    disabled={isPulling || isPushing || isFetching}
                                >
                                    {isPulling ? 'Pulling...' : 'Pull'}
                                </Button>
                                <Button
                                    variant='contained'
                                    size='small'
                                    startIcon={isPushing ? <CircularProgress size={14} color='inherit' /> : <IconCloudUpload size={16} />}
                                    onClick={handlePush}
                                    disabled={isPushing || isPulling || isFetching}
                                >
                                    {isPushing ? 'Pushing...' : 'Push'}
                                </Button>
                            </>
                        )}
                    </Stack>
                </Stack>
            </Paper>

            {/* Commit Log Table */}
            {isLoading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                    <CircularProgress />
                </Box>
            ) : commitLog.length === 0 ? (
                <Box sx={{ p: 4, textAlign: 'center' }}>
                    <IconGitCommit size={40} color={theme.palette.text.secondary} />
                    <Typography variant='body1' sx={{ mt: 1, color: 'text.secondary' }}>
                        No commits yet
                    </Typography>
                    <Typography variant='body2' color='text.secondary'>
                        Commits will appear here when versions are created, restored, or deleted.
                    </Typography>
                </Box>
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
                                    <StyledTableCell sx={{ width: 100 }}>Commit</StyledTableCell>
                                    <StyledTableCell>Message</StyledTableCell>
                                    <StyledTableCell sx={{ width: 220 }}>Branch / Tag</StyledTableCell>
                                    <StyledTableCell sx={{ width: 180 }}>Author</StyledTableCell>
                                    <StyledTableCell sx={{ width: 200 }}>Date</StyledTableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {commitLog.map((commit) => {
                                    const parsed = parseCommitMessage(commit.message)
                                    return (
                                        <StyledTableRow key={commit.hash} hover>
                                            <StyledTableCell>
                                                <Tooltip title={commit.hash}>
                                                    <Chip
                                                        label={commit.hash.substring(0, 7)}
                                                        size='small'
                                                        variant='outlined'
                                                        icon={<IconGitCommit size={14} />}
                                                        sx={{
                                                            fontFamily: 'monospace',
                                                            fontSize: '0.75rem'
                                                        }}
                                                    />
                                                </Tooltip>
                                            </StyledTableCell>
                                            <StyledTableCell>
                                                <Tooltip title={commit.message}>
                                                    <Typography
                                                        variant='body2'
                                                        sx={{
                                                            maxWidth: 350,
                                                            overflow: 'hidden',
                                                            textOverflow: 'ellipsis',
                                                            whiteSpace: 'nowrap'
                                                        }}
                                                    >
                                                        {parsed.title}
                                                    </Typography>
                                                </Tooltip>
                                            </StyledTableCell>
                                            <StyledTableCell>
                                                {renderRefChips(commit.refs)}
                                            </StyledTableCell>
                                            <StyledTableCell>
                                                <Typography variant='body2' noWrap>
                                                    {commit.author_name || '-'}
                                                </Typography>
                                            </StyledTableCell>
                                            <StyledTableCell>
                                                <Typography variant='body2'>
                                                    {commit.date ? moment(commit.date).format('MMM Do, YYYY HH:mm') : '-'}
                                                </Typography>
                                            </StyledTableCell>
                                        </StyledTableRow>
                                    )
                                })}
                            </TableBody>
                        </Table>
                    </TableContainer>

                    <TablePagination currentPage={currentPage} limit={pageLimit} total={totalCommits} onChange={onChange} />
                </>
            )}
                </Stack>
            )}

            {/* ── Configuration tab ─────────────────────────────────────────── */}
            {innerTab === 1 && configPanel}
        </Stack>
    )
}

export default GitSyncPanel
