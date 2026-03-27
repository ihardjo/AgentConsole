import { useState } from 'react'
import { useSelector } from 'react-redux'

// material-ui
import { styled, useTheme } from '@mui/material/styles'
import { Box, Typography, Drawer, IconButton, Divider, Tooltip } from '@mui/material'

// icons
import { IconPlus, IconX, IconPlayerPlay, IconRobot, IconClock, IconBell, IconGitBranch, IconWorldWww } from '@tabler/icons-react'

const drawerWidth = 280

const StyledDrawer = styled(Drawer)(({ theme }) => ({
    '& .MuiDrawer-paper': {
        width: drawerWidth,
        boxSizing: 'border-box',
        marginTop: '70px',
        height: 'calc(100% - 70px)',
        backgroundColor: theme.palette.background.default
    }
}))

// Node definitions
const TEMPORAL_NODES = [
    {
        type: 'temporalStart',
        label: 'Start',
        description: 'Workflow entry point with input variables',
        icon: IconPlayerPlay,
        color: '#4CAF50',
        defaultData: {
            inputVariables: []
        }
    },
    {
        type: 'temporalAgentFlowCall',
        label: 'AgentFlow Call',
        description: 'Execute an AgentFlow and capture response',
        icon: IconRobot,
        color: '#2196F3',
        defaultData: {
            agentFlowId: '',
            agentFlowName: '',
            question: ''
        }
    },
    {
        type: 'temporalTimer',
        label: 'Timer',
        description: 'Sleep for a specified duration',
        icon: IconClock,
        color: '#FF9800',
        defaultData: {
            duration: '1m' // Default 1 minute
        }
    },
    {
        type: 'temporalSignalWait',
        label: 'Wait for Signal',
        description: 'Pause workflow until external signal received',
        icon: IconBell,
        color: '#9C27B0',
        defaultData: {
            signalName: '',
            timeout: ''
        }
    },
    {
        type: 'temporalCondition',
        label: 'Condition',
        description: 'Branch workflow based on expression',
        icon: IconGitBranch,
        color: '#E91E63',
        defaultData: {
            expression: ''
        }
    },
    {
        type: 'temporalHTTPRequest',
        label: 'HTTP Request',
        description: 'Make external API calls',
        icon: IconWorldWww,
        color: '#00BCD4',
        defaultData: {
            url: '',
            method: 'GET',
            headers: {},
            body: ''
        }
    }
]

const NodeCard = styled(Box)(({ theme, nodeColor }) => ({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1.5),
    padding: theme.spacing(1.5),
    borderRadius: theme.spacing(1),
    border: `1px solid ${theme.palette.divider}`,
    cursor: 'grab',
    backgroundColor: theme.palette.background.paper,
    transition: 'all 0.2s ease-in-out',
    '&:hover': {
        borderColor: nodeColor,
        boxShadow: `0 2px 8px ${nodeColor}33`
    },
    '&:active': {
        cursor: 'grabbing'
    }
}))

// ==============================|| ADD TEMPORAL NODES ||============================== //

const AddTemporalNodes = () => {
    const theme = useTheme()
    const customization = useSelector((state) => state.customization)
    const [open, setOpen] = useState(false)

    const onDragStart = (event, nodeData) => {
        event.dataTransfer.setData('application/reactflow', JSON.stringify(nodeData))
        event.dataTransfer.effectAllowed = 'move'
    }

    return (
        <>
            {/* Floating Add Button */}
            <Tooltip title='Add Node' placement='left'>
                <IconButton
                    onClick={() => setOpen(true)}
                    sx={{
                        position: 'absolute',
                        top: 20,
                        left: 20,
                        zIndex: 10,
                        backgroundColor: theme.palette.primary.main,
                        color: 'white',
                        '&:hover': {
                            backgroundColor: theme.palette.primary.dark
                        }
                    }}
                >
                    <IconPlus size={24} />
                </IconButton>
            </Tooltip>

            {/* Drawer */}
            <StyledDrawer anchor='left' open={open} onClose={() => setOpen(false)} variant='persistent'>
                <Box sx={{ p: 2 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                        <Typography variant='h6' sx={{ fontWeight: 600 }}>
                            Temporal Nodes
                        </Typography>
                        <IconButton onClick={() => setOpen(false)} size='small'>
                            <IconX size={20} />
                        </IconButton>
                    </Box>

                    <Typography variant='body2' color='text.secondary' sx={{ mb: 2 }}>
                        Drag and drop nodes onto the canvas
                    </Typography>

                    <Divider sx={{ mb: 2 }} />

                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                        {TEMPORAL_NODES.map((node) => (
                            <NodeCard key={node.type} nodeColor={node.color} draggable onDragStart={(e) => onDragStart(e, node)}>
                                <Box
                                    sx={{
                                        width: 36,
                                        height: 36,
                                        borderRadius: '8px',
                                        backgroundColor: node.color,
                                        display: 'flex',
                                        justifyContent: 'center',
                                        alignItems: 'center',
                                        flexShrink: 0
                                    }}
                                >
                                    <node.icon size={20} color='white' />
                                </Box>
                                <Box sx={{ overflow: 'hidden' }}>
                                    <Typography sx={{ fontSize: '0.875rem', fontWeight: 500 }}>{node.label}</Typography>
                                    <Typography
                                        sx={{
                                            fontSize: '0.7rem',
                                            color: 'text.secondary',
                                            whiteSpace: 'nowrap',
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis'
                                        }}
                                    >
                                        {node.description}
                                    </Typography>
                                </Box>
                            </NodeCard>
                        ))}
                    </Box>
                </Box>
            </StyledDrawer>
        </>
    )
}

export default AddTemporalNodes
