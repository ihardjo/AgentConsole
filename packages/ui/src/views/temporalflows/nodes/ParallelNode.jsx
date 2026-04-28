import PropTypes from 'prop-types'
import { memo, useState } from 'react'
import { Handle, Position } from 'reactflow'
import { useSelector } from 'react-redux'

// material-ui
import { styled, alpha, darken, lighten } from '@mui/material/styles'
import { Box, Typography } from '@mui/material'

// project imports
import MainCard from '@/ui-component/cards/MainCard'

// icons
import { IconGitFork, IconGitMerge } from '@tabler/icons-react'

const CardWrapper = styled(MainCard)(({ theme }) => ({
    background: theme.palette.card.main,
    color: theme.darkTextPrimary,
    border: 'solid 1px',
    width: 'max-content',
    height: 'auto',
    padding: '10px',
    boxShadow: 'none',
    minWidth: '160px'
}))

const NODE_COLOR = '#673AB7' // Deep Purple for Parallel

// ===========================|| PARALLEL NODE ||=========================== //

const ParallelNode = ({ data }) => {
    const customization = useSelector((state) => state.customization)
    const [isHovered, setIsHovered] = useState(false)

    const getStateColor = () => {
        if (data.selected) return NODE_COLOR
        if (isHovered) return alpha(NODE_COLOR, 0.8)
        return alpha(NODE_COLOR, 0.5)
    }

    const getBackgroundColor = () => {
        if (customization.isDarkMode) {
            return isHovered ? darken(NODE_COLOR, 0.7) : darken(NODE_COLOR, 0.8)
        }
        return isHovered ? lighten(NODE_COLOR, 0.8) : lighten(NODE_COLOR, 0.9)
    }

    const mode = data.mode || 'fork'
    const isFork = mode === 'fork'
    const Icon = isFork ? IconGitFork : IconGitMerge
    const modeLabel = isFork ? 'Fork' : 'Join'
    const branchCount = data.branchCount || 2

    return (
        <div onMouseEnter={() => setIsHovered(true)} onMouseLeave={() => setIsHovered(false)}>
            <CardWrapper
                content={false}
                sx={{
                    borderColor: getStateColor(),
                    borderWidth: '1px',
                    boxShadow: data.selected ? `0 0 0 1px ${getStateColor()} !important` : 'none',
                    backgroundColor: getBackgroundColor(),
                    '&:hover': {
                        boxShadow: data.selected ? `0 0 0 1px ${getStateColor()} !important` : 'none'
                    }
                }}
                border={false}
            >
                {/* Input handle(s) */}
                {isFork ? (
                    // Fork mode: single input
                    <Handle
                        type='target'
                        position={Position.Left}
                        id={`${data.id}-input`}
                        style={{
                            width: 12,
                            height: 12,
                            backgroundColor: NODE_COLOR,
                            border: '2px solid white',
                            left: -6
                        }}
                    />
                ) : (
                    // Join mode: multiple inputs (one per branch)
                    Array.from({ length: branchCount }).map((_, index) => (
                        <Handle
                            key={`input-${index}`}
                            type='target'
                            position={Position.Left}
                            id={`${data.id}-input-${index}`}
                            style={{
                                width: 10,
                                height: 10,
                                backgroundColor: NODE_COLOR,
                                border: '2px solid white',
                                left: -5,
                                top: `${((index + 1) / (branchCount + 1)) * 100}%`
                            }}
                        />
                    ))
                )}

                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    <Box
                        sx={{
                            width: 40,
                            height: 40,
                            borderRadius: '10px',
                            backgroundColor: NODE_COLOR,
                            display: 'flex',
                            justifyContent: 'center',
                            alignItems: 'center'
                        }}
                    >
                        <Icon size={24} color='white' />
                    </Box>
                    <Box>
                        <Typography sx={{ fontSize: '0.85rem', fontWeight: 500 }}>{data.label || 'Parallel'}</Typography>
                        <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary' }}>
                            {modeLabel} ({branchCount} branches)
                        </Typography>
                    </Box>
                </Box>

                {/* Output handle(s) */}
                {isFork ? (
                    // Fork mode: multiple outputs (one per branch)
                    Array.from({ length: branchCount }).map((_, index) => (
                        <Handle
                            key={`output-${index}`}
                            type='source'
                            position={Position.Right}
                            id={`${data.id}-output-${index}`}
                            style={{
                                width: 10,
                                height: 10,
                                backgroundColor: NODE_COLOR,
                                border: '2px solid white',
                                right: -5,
                                top: `${((index + 1) / (branchCount + 1)) * 100}%`
                            }}
                        />
                    ))
                ) : (
                    // Join mode: single output
                    <Handle
                        type='source'
                        position={Position.Right}
                        id={`${data.id}-output`}
                        style={{
                            width: 12,
                            height: 12,
                            backgroundColor: NODE_COLOR,
                            border: '2px solid white',
                            right: -6
                        }}
                    />
                )}
            </CardWrapper>
        </div>
    )
}

ParallelNode.propTypes = {
    data: PropTypes.object
}

export default memo(ParallelNode)
