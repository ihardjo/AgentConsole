import PropTypes from 'prop-types'
import { memo, useState } from 'react'
import { Handle, Position } from 'reactflow'
import { useSelector } from 'react-redux'

// material-ui
import { styled, useTheme, alpha, darken, lighten } from '@mui/material/styles'
import { Box, Typography } from '@mui/material'

// project imports
import MainCard from '@/ui-component/cards/MainCard'

// icons
import { IconRepeat } from '@tabler/icons-react'

const CardWrapper = styled(MainCard)(({ theme }) => ({
    background: theme.palette.card.main,
    color: theme.darkTextPrimary,
    border: 'solid 1px',
    width: 'max-content',
    height: 'auto',
    padding: '10px',
    boxShadow: 'none',
    minWidth: '150px'
}))

const NODE_COLOR = '#795548' // Brown for Loop

// ===========================|| LOOP NODE ||=========================== //

const LoopNode = ({ data }) => {
    const theme = useTheme()
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
                {/* Input handle */}
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
                        <IconRepeat size={24} color='white' />
                    </Box>
                    <Box>
                        <Typography sx={{ fontSize: '0.85rem', fontWeight: 500 }}>{data.label || 'Loop'}</Typography>
                        <Typography
                            sx={{
                                fontSize: '0.7rem',
                                color: 'text.secondary',
                                maxWidth: 120,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis'
                            }}
                        >
                            {data.loopToNodeLabel ? `To: ${data.loopToNodeLabel}` : 'No target'}
                        </Typography>
                        <Typography
                            sx={{
                                fontSize: '0.65rem',
                                color: 'text.secondary'
                            }}
                        >
                            Max: {data.maxIterations || 3} iterations
                        </Typography>
                    </Box>
                </Box>

                {/* No output handle - Loop node redirects execution, doesn't continue forward */}
            </CardWrapper>
        </div>
    )
}

LoopNode.propTypes = {
    data: PropTypes.object
}

export default memo(LoopNode)
