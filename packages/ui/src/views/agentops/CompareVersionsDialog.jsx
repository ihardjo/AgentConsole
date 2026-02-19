import PropTypes from 'prop-types'
import { useState, useEffect, useCallback } from 'react'
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    Typography,
    Box,
    Chip,
    CircularProgress,
    Alert,
    FormControl,
    Select,
    MenuItem,
    Divider,
    useTheme,
    alpha
} from '@mui/material'
import moment from 'moment'
import {
    IconChevronDown,
    IconChevronRight,
    IconCheck,
    IconArrowsLeftRight,
    IconCirclePlus,
    IconCircleMinus,
    IconArrowsExchange,
    IconBox
} from '@tabler/icons-react'
import chatflowVersionsApi from '@/api/chatflowVersions'
import { AGENTFLOW_ICONS } from '@/store/constant'

// ================================|| CONSTANTS ||================================ //

const CATEGORY_CONFIG = {
    model: { label: 'Model Configuration' },
    messages: { label: 'System Messages' },
    tools: { label: 'Tools & Functions' },
    knowledge: { label: 'Knowledge Base' },
    memory: { label: 'Memory Settings' },
    output: { label: 'Output Configuration' },
    state: { label: 'State Management' },
    scenarios: { label: 'Scenarios' }
}

const NODE_STATUS_CONFIG = {
    added: { label: 'Added', color: 'success', icon: <IconCirclePlus size={16} /> },
    removed: { label: 'Removed', color: 'error', icon: <IconCircleMinus size={16} /> },
    modified: { label: 'Modified', color: 'warning', icon: <IconArrowsExchange size={16} /> },
    unchanged: { label: 'Unchanged', color: 'default', icon: <IconCheck size={16} /> }
}

/**
 * Returns a consistent visible border color that works in both light and dark mode.
 * The project convention is grey[900] + hex alpha suffix for borders.
 */
const getBorderColor = (theme) => theme.palette.grey[900] + '25'

/**
 * Returns a subtle card/surface background that provides contrast against the paper.
 * Uses the project's textBackground palette token.
 */
const getCardBg = (theme) => theme.palette.textBackground.main

/**
 * Returns a hover background using MUI alpha utility for theme-safe opacity.
 */
const getHoverBg = (theme) => alpha(theme.palette.text.primary, 0.04)

/**
 * Resolves the AGENTFLOW_ICONS entry for a given node component name.
 * Falls back to null if no matching icon is found.
 */
const getNodeIcon = (nodeComponentName) => {
    if (!nodeComponentName) return null
    return AGENTFLOW_ICONS.find((icon) => icon.name === nodeComponentName) || null
}

/**
 * Renders the appropriate node icon — either the matching agent flow icon
 * with its branded color, or a generic fallback IconBox.
 */
const NodeIcon = ({ nodeComponentName, size = 18, fallbackColor }) => {
    const iconEntry = getNodeIcon(nodeComponentName)
    if (iconEntry) {
        const IconComponent = iconEntry.icon
        return <IconComponent size={size} color={iconEntry.color} />
    }
    return <IconBox size={size} color={fallbackColor} />
}

NodeIcon.propTypes = {
    nodeComponentName: PropTypes.string,
    size: PropTypes.number,
    fallbackColor: PropTypes.string
}

// ================================|| SUBCOMPONENTS ||================================ //

/**
 * Renders a single value cell in the side-by-side diff view
 */
const DiffValue = ({ value, side, changeType }) => {
    const theme = useTheme()

    const isEmpty = value === null || value === undefined || value === '' || (Array.isArray(value) && value.length === 0)
    const isRemoved = side === 'left' && changeType === 'added'
    const isAdded = side === 'right' && changeType === 'removed'
    const isOldSide = side === 'left' && changeType !== 'added'
    const isNewSide = side === 'right' && changeType !== 'removed'

    if (isEmpty || isRemoved || isAdded) {
        return (
            <Box
                sx={{
                    px: 1.5,
                    py: 1,
                    minHeight: 36,
                    display: 'flex',
                    alignItems: 'center',
                    backgroundColor: alpha(theme.palette.text.primary, 0.02),
                    borderRadius: 0.5
                }}
            >
                <Typography variant='body2' color='text.disabled' sx={{ fontStyle: 'italic' }}>
                    —
                </Typography>
            </Box>
        )
    }

    const bgColor = isOldSide
        ? alpha(theme.palette.error.main, theme.palette.mode === 'dark' ? 0.12 : 0.06)
        : isNewSide
          ? alpha(theme.palette.success.main, theme.palette.mode === 'dark' ? 0.12 : 0.06)
          : 'transparent'

    const displayValue = typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value)
    const isMultiline = displayValue.length > 80 || displayValue.includes('\n')

    return (
        <Box
            sx={{
                px: 1.5,
                py: 1,
                minHeight: 36,
                display: 'flex',
                alignItems: 'flex-start',
                backgroundColor: bgColor,
                borderRadius: 0.5
            }}
        >
            <Typography
                variant='body2'
                sx={{
                    wordBreak: 'break-word',
                    whiteSpace: isMultiline ? 'pre-wrap' : 'normal',
                    fontFamily: isMultiline ? 'monospace' : 'inherit',
                    fontSize: isMultiline ? '0.75rem' : '0.8125rem',
                    color: 'text.primary'
                }}
            >
                {displayValue}
            </Typography>
        </Box>
    )
}

DiffValue.propTypes = {
    value: PropTypes.any,
    side: PropTypes.oneOf(['left', 'right']).isRequired,
    changeType: PropTypes.string.isRequired
}

/**
 * A single change row showing property name + side-by-side old/new values
 */
const ChangeRow = ({ change }) => {
    const theme = useTheme()

    const changeTypeConfig = {
        added: { icon: <IconCirclePlus size={14} />, color: theme.palette.success.main },
        removed: { icon: <IconCircleMinus size={14} />, color: theme.palette.error.main },
        modified: { icon: <IconArrowsExchange size={14} />, color: theme.palette.warning.dark }
    }

    const config = changeTypeConfig[change.changeType] || changeTypeConfig.modified

    return (
        <Box sx={{ mb: 1.5 }}>
            {/* Property header */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                <Box sx={{ color: config.color, display: 'flex', alignItems: 'center' }}>{config.icon}</Box>
                <Typography variant='body2' sx={{ fontWeight: 600, flex: 1 }}>
                    {change.property}
                </Typography>
            </Box>

            {/* Side-by-side values */}
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, pl: 2.5 }}>
                <DiffValue value={change.oldValue} side='left' changeType={change.changeType} />
                <DiffValue value={change.newValue} side='right' changeType={change.changeType} />
            </Box>
        </Box>
    )
}

ChangeRow.propTypes = {
    change: PropTypes.object.isRequired
}

/**
 * Collapsible category group (used inside a node group)
 */
const CategoryGroup = ({ category, changes }) => {
    const theme = useTheme()
    const [expanded, setExpanded] = useState(true)

    const config = CATEGORY_CONFIG[category] || { label: category }

    return (
        <Box
            sx={{
                mb: 1,
                border: `1px solid ${getBorderColor(theme)}`,
                borderRadius: 1,
                overflow: 'hidden'
            }}
        >
            <Box
                onClick={() => setExpanded(!expanded)}
                sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    px: 1.5,
                    py: 1,
                    cursor: 'pointer',
                    backgroundColor: getCardBg(theme),
                    '&:hover': {
                        backgroundColor: getHoverBg(theme)
                    }
                }}
            >
                {expanded ? <IconChevronDown size={14} /> : <IconChevronRight size={14} />}
                <Typography variant='body2' sx={{ fontWeight: 600, flex: 1 }}>
                    {config.label}
                </Typography>
                <Chip label={changes.length} size='small' sx={{ height: 18, fontSize: '0.65rem', fontWeight: 600 }} />
            </Box>

            {expanded && (
                <Box sx={{ px: 1.5, py: 1 }}>
                    {changes.map((change, index) => (
                        <ChangeRow key={`${change.property}-${index}`} change={change} />
                    ))}
                </Box>
            )}
        </Box>
    )
}

CategoryGroup.propTypes = {
    category: PropTypes.string.isRequired,
    changes: PropTypes.array.isRequired
}

/**
 * Collapsible node group — groups all changes for a single node.
 * Shows node name, type, status, and nested category groups.
 */
const NodeGroup = ({ node }) => {
    const theme = useTheme()
    const isExpandable = node.nodeStatus === 'modified' && node.comparison
    const [expanded, setExpanded] = useState(isExpandable)

    const statusConfig = NODE_STATUS_CONFIG[node.nodeStatus] || NODE_STATUS_CONFIG.unchanged
    const statusColors = {
        added: theme.palette.success.main,
        removed: theme.palette.error.main,
        modified: theme.palette.warning.dark,
        unchanged: theme.palette.text.secondary
    }
    const borderColor = statusColors[node.nodeStatus] || getBorderColor(theme)

    const activeCategories = node.comparison?.categorizedChanges
        ? Object.entries(node.comparison.categorizedChanges).filter(([, changes]) => changes.length > 0)
        : []

    return (
        <Box
            sx={{
                mb: 2,
                border: `1px solid ${getBorderColor(theme)}`,
                borderLeft: `3px solid ${borderColor}`,
                borderRadius: 1.5,
                overflow: 'hidden'
            }}
        >
            {/* Node header */}
            <Box
                onClick={() => isExpandable && setExpanded(!expanded)}
                sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.5,
                    px: 2,
                    py: 1.5,
                    cursor: isExpandable ? 'pointer' : 'default',
                    backgroundColor: getCardBg(theme),
                    '&:hover': isExpandable
                        ? { backgroundColor: getHoverBg(theme) }
                        : {}
                }}
            >
                {isExpandable && (
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        {expanded ? <IconChevronDown size={16} /> : <IconChevronRight size={16} />}
                    </Box>
                )}
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <NodeIcon nodeComponentName={node.nodeComponentName} size={18} fallbackColor={borderColor} />
                </Box>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant='subtitle2' sx={{ fontWeight: 700 }}>
                            {node.nodeName}
                        </Typography>
                        <Chip
                            label={node.nodeType}
                            size='small'
                            variant='outlined'
                            sx={{ height: 20, fontSize: '0.65rem', borderColor: getBorderColor(theme), color: 'text.secondary' }}
                        />
                    </Box>
                    <Typography variant='caption' color='text.secondary' sx={{ fontFamily: 'monospace', fontSize: '0.65rem', opacity: 0.7 }}>
                        {node.nodeId}
                    </Typography>
                </Box>
                <Chip
                    label={statusConfig.label}
                    size='small'
                    icon={statusConfig.icon}
                    color={statusConfig.color}
                    sx={{ fontWeight: 600, fontSize: '0.7rem', height: 24, '& .MuiChip-icon': { fontSize: 14 } }}
                />
                {node.comparison && (
                    <Chip
                        label={`${node.comparison.summary.totalChanges} change${node.comparison.summary.totalChanges !== 1 ? 's' : ''}`}
                        size='small'
                        sx={{ height: 20, fontSize: '0.65rem' }}
                    />
                )}
            </Box>

            {/* Node details — category groups */}
            {expanded && isExpandable && (
                <Box sx={{ px: 2, py: 1.5 }}>
                    {activeCategories.map(([category, changes]) => (
                        <CategoryGroup key={category} category={category} changes={changes} />
                    ))}
                </Box>
            )}
        </Box>
    )
}

NodeGroup.propTypes = {
    node: PropTypes.object.isRequired
}

// ================================|| MAIN DIALOG ||================================ //

/**
 * Unified Compare Versions Dialog
 *
 * - Side-by-side version selector at the top
 * - Multi-node comparison grouped by node (id + name)
 * - Shows added, removed, modified, and unchanged nodes
 */
const CompareVersionsDialog = ({ open, onClose, selectedVersion, versions }) => {
    const theme = useTheme()
    const [versionAId, setVersionAId] = useState('')
    const [compareWithVersionId, setCompareWithVersionId] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState(null)
    const [comparisonData, setComparisonData] = useState(null)

    const allVersions = versions || []
    const availableVersionsForA = allVersions.filter((v) => v.id !== compareWithVersionId)
    const availableVersionsForB = allVersions.filter((v) => v.id !== versionAId)
    const hasComparison = !!comparisonData
    const flowComparison = comparisonData?.comparison
    const flowSummary = flowComparison?.summary
    const nodeResults = flowComparison?.nodes || []

    // Separate nodes by status for display
    const changedNodes = nodeResults.filter((n) => n.nodeStatus !== 'unchanged')
    const unchangedNodes = nodeResults.filter((n) => n.nodeStatus === 'unchanged')

    // Initialise Version A from the selectedVersion prop when the dialog opens
    useEffect(() => {
        if (open && selectedVersion?.id) {
            setVersionAId(selectedVersion.id)
        }
    }, [open, selectedVersion])

    // Reset state when dialog closes
    useEffect(() => {
        if (!open) {
            setVersionAId('')
            setCompareWithVersionId('')
            setComparisonData(null)
            setError(null)
        }
    }, [open])

    const fetchComparison = useCallback(
        async (versionA, versionB) => {
            if (!versionA || !versionB) return

            setLoading(true)
            setError(null)
            setComparisonData(null)

            try {
                const response = await chatflowVersionsApi.compareVersions(versionA, versionB)
                setComparisonData(response.data)
            } catch (err) {
                setError(err?.response?.data?.message || 'Failed to compare versions')
            } finally {
                setLoading(false)
            }
        },
        []
    )

    const handleVersionASelect = (e) => {
        const newVersionAId = e.target.value
        setVersionAId(newVersionAId)

        if (newVersionAId && compareWithVersionId) {
            fetchComparison(newVersionAId, compareWithVersionId)
        } else {
            setComparisonData(null)
        }
    }

    const handleVersionBSelect = (e) => {
        const versionBId = e.target.value
        setCompareWithVersionId(versionBId)

        if (versionAId && versionBId) {
            fetchComparison(versionAId, versionBId)
        } else {
            setComparisonData(null)
        }
    }

    return (
        <Dialog open={open} onClose={onClose} maxWidth='lg' fullWidth>
            <DialogTitle>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <IconArrowsLeftRight size={22} />
                    <Typography variant='h4'>Compare Versions</Typography>
                </Box>
            </DialogTitle>

            <DialogContent sx={{ pb: 1 }}>
                {/* ── Side-by-side version selector ── */}
                <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, mt: 1, mb: 2 }}>
                    {/* Version A (selector) */}
                    <Box>
                        <Typography
                            variant='caption'
                            sx={{ fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, color: 'text.secondary', mb: 0.5, display: 'block' }}
                        >
                            Version A (Base)
                        </Typography>
                        <FormControl fullWidth>
                            <Select
                                value={versionAId}
                                onChange={handleVersionASelect}
                                displayEmpty
                                size='small'
                                sx={{ minHeight: 68, '& .MuiSelect-select': { py: 1.5, background: 'inherit' } }}
                            >
                                <MenuItem value='' disabled>
                                    <Typography color='text.secondary' variant='body2'>
                                        Select base version…
                                    </Typography>
                                </MenuItem>
                                {availableVersionsForA.map((version) => (
                                    <MenuItem key={version.id} value={version.id}>
                                        <Box>
                                            <Typography variant='body2' sx={{ fontWeight: 600 }}>
                                                v{version.version}
                                            </Typography>
                                            <Typography variant='caption' color='text.secondary' sx={{ display: 'block' }}>
                                                {version.changeDescription || 'No description'} • {moment(version.createdDate).format('MMM DD, YY')}
                                            </Typography>
                                        </Box>
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    </Box>

                    {/* Version B (selector) */}
                    <Box>
                        <Typography
                            variant='caption'
                            sx={{ fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, color: 'text.secondary', mb: 0.5, display: 'block' }}
                        >
                            Version B (Compare With)
                        </Typography>
                        <FormControl fullWidth>
                            <Select
                                value={compareWithVersionId}
                                onChange={handleVersionBSelect}
                                displayEmpty
                                size='small'
                                sx={{ minHeight: 68, '& .MuiSelect-select': { py: 1.5, background: 'inherit' } }}
                            >
                                <MenuItem value='' disabled>
                                    <Typography color='text.secondary' variant='body2'>
                                        Select a version to compare…
                                    </Typography>
                                </MenuItem>
                                {availableVersionsForB.map((version) => (
                                    <MenuItem key={version.id} value={version.id}>
                                        <Box>
                                            <Typography variant='body2' sx={{ fontWeight: 600 }}>
                                                v{version.version}
                                            </Typography>
                                            <Typography variant='caption' color='text.secondary' sx={{ display: 'block' }}>
                                                {version.changeDescription || 'No description'} • {moment(version.createdDate).format('MMM DD, YY')}
                                            </Typography>
                                        </Box>
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    </Box>
                </Box>

                {/* ── Divider ── */}
                {(loading || error || hasComparison) && <Divider sx={{ mb: 2 }} />}

                {/* ── Comparison results ── */}
                {loading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 6 }}>
                        <CircularProgress size={32} />
                        <Typography variant='body2' color='text.secondary' sx={{ ml: 2 }}>
                            Comparing versions…
                        </Typography>
                    </Box>
                ) : error ? (
                    <Alert severity='error' sx={{ mb: 2 }}>
                        {error}
                    </Alert>
                ) : hasComparison ? (
                    <Box>
                        {/* ── Flow-level summary ── */}
                        <Box
                            sx={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 1,
                                mb: 2,
                                p: 1.5,
                                borderRadius: 1.5,
                                backgroundColor: getCardBg(theme),
                                border: `1px solid ${getBorderColor(theme)}`,
                                flexWrap: 'wrap'
                            }}
                        >
                            <Typography variant='subtitle2' sx={{ fontWeight: 600, mr: 0.5 }}>
                                Summary
                            </Typography>
                            <Chip label={`${flowSummary.totalNodes} node${flowSummary.totalNodes !== 1 ? 's' : ''}`} size='small' sx={{ height: 22 }} />
                            {flowSummary.nodesModified > 0 && (
                                <Chip
                                    label={`${flowSummary.nodesModified} modified`}
                                    size='small'
                                    sx={{ height: 22, backgroundColor: theme.palette.warning.dark, color: theme.palette.getContrastText(theme.palette.warning.dark) }}
                                />
                            )}
                            {flowSummary.nodesAdded > 0 && (
                                <Chip
                                    label={`${flowSummary.nodesAdded} added`}
                                    size='small'
                                    sx={{ height: 22, backgroundColor: theme.palette.success.main, color: theme.palette.getContrastText(theme.palette.success.main) }}
                                />
                            )}
                            {flowSummary.nodesRemoved > 0 && (
                                <Chip
                                    label={`${flowSummary.nodesRemoved} removed`}
                                    size='small'
                                    sx={{ height: 22, backgroundColor: theme.palette.error.main, color: theme.palette.getContrastText(theme.palette.error.main) }}
                                />
                            )}
                            {flowSummary.totalPropertyChanges > 0 && (
                                <Chip
                                    label={`${flowSummary.totalPropertyChanges} property change${flowSummary.totalPropertyChanges !== 1 ? 's' : ''}`}
                                    size='small'
                                    variant='outlined'
                                    sx={{ height: 22 }}
                                />
                            )}
                            <Box sx={{ flex: 1 }} />
                        </Box>

                        {/* ── No changes ── */}
                        {changedNodes.length === 0 && (
                            <Box sx={{ textAlign: 'center', py: 4 }}>
                                <IconCheck size={40} color={theme.palette.success.main} />
                                <Typography variant='h6' sx={{ mt: 1 }}>
                                    No differences found
                                </Typography>
                                <Typography variant='body2' color='text.secondary'>
                                    These two versions are identical across all {flowSummary.totalNodes} nodes.
                                </Typography>
                            </Box>
                        )}

                        {/* ── Changed nodes ── */}
                        {changedNodes.map((node) => (
                            <NodeGroup key={node.nodeId} node={node} />
                        ))}

                        {/* ── Unchanged nodes (collapsed) ── */}
                        {unchangedNodes.length > 0 && (
                            <UnchangedNodesSection nodes={unchangedNodes} />
                        )}
                    </Box>
                ) : null}
            </DialogContent>

            <DialogActions sx={{ px: 3, pb: 2 }}>
                <Button onClick={onClose} variant='contained'>
                    Close
                </Button>
            </DialogActions>
        </Dialog>
    )
}

/**
 * Collapsible section listing unchanged nodes
 */
const UnchangedNodesSection = ({ nodes }) => {
    const theme = useTheme()
    const [expanded, setExpanded] = useState(false)

    return (
        <Box
            sx={{
                mt: 1,
                border: `1px solid ${getBorderColor(theme)}`,
                borderRadius: 1.5,
                overflow: 'hidden'
            }}
        >
            <Box
                onClick={() => setExpanded(!expanded)}
                sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    px: 2,
                    py: 1.25,
                    cursor: 'pointer',
                    backgroundColor: getCardBg(theme),
                    '&:hover': {
                        backgroundColor: getHoverBg(theme)
                    }
                }}
            >
                {expanded ? <IconChevronDown size={16} /> : <IconChevronRight size={16} />}
                <IconCheck size={16} color={theme.palette.success.main} />
                <Typography variant='body2' sx={{ fontWeight: 600, flex: 1 }}>
                    Unchanged Nodes
                </Typography>
                <Chip label={nodes.length} size='small' sx={{ height: 20, fontSize: '0.7rem' }} />
            </Box>
            {expanded && (
                <Box sx={{ px: 2, py: 1 }}>
                    {nodes.map((node) => (
                        <Box key={node.nodeId} sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.5 }}>
                            <NodeIcon nodeComponentName={node.nodeComponentName} size={14} fallbackColor={theme.palette.text.secondary} />
                            <Typography variant='body2'>{node.nodeName}</Typography>
                            <Chip label={node.nodeType} size='small' variant='outlined' sx={{ height: 18, fontSize: '0.6rem', borderColor: getBorderColor(theme), color: 'text.secondary' }} />
                            <Typography variant='caption' color='text.secondary' sx={{ fontFamily: 'monospace', fontSize: '0.6rem', opacity: 0.7 }}>
                                {node.nodeId}
                            </Typography>
                        </Box>
                    ))}
                </Box>
            )}
        </Box>
    )
}

UnchangedNodesSection.propTypes = {
    nodes: PropTypes.array.isRequired
}

CompareVersionsDialog.propTypes = {
    open: PropTypes.bool.isRequired,
    onClose: PropTypes.func.isRequired,
    selectedVersion: PropTypes.object,
    versions: PropTypes.array
}

export default CompareVersionsDialog
