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
import { IconGitBranch } from '@tabler/icons-react'

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

const NODE_COLOR = '#E91E63' // Pink for Condition

// ===========================|| CONDITION NODE ||=========================== //

const ConditionNode = ({ data }) => {
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
                        <IconGitBranch size={24} color='white' />
                    </Box>
                    <Box>
                        <Typography sx={{ fontSize: '0.85rem', fontWeight: 500 }}>{data.label || 'Condition'}</Typography>
                        <Typography
                            sx={{
                                fontSize: '0.7rem',
                                color: 'text.secondary',
                                maxWidth: 120,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis'
                            }}
                        >
                            {data.expression || 'No expression'}
                        </Typography>
                    </Box>
                </Box>

                {/* True output handle */}
                <Handle
                    type='source'
                    position={Position.Right}
                    id={`${data.id}-true`}
                    style={{
                        width: 12,
                        height: 12,
                        backgroundColor: '#4CAF50',
                        border: '2px solid white',
                        right: -6,
                        top: '30%'
                    }}
                />
                <Typography
                    sx={{
                        position: 'absolute',
                        right: 8,
                        top: '25%',
                        fontSize: '0.6rem',
                        color: '#4CAF50',
                        fontWeight: 600
                    }}
                >
                    True
                </Typography>

                {/* False output handle */}
                <Handle
                    type='source'
                    position={Position.Right}
                    id={`${data.id}-false`}
                    style={{
                        width: 12,
                        height: 12,
                        backgroundColor: '#f44336',
                        border: '2px solid white',
                        right: -6,
                        top: '70%'
                    }}
                />
                <Typography
                    sx={{
                        position: 'absolute',
                        right: 8,
                        top: '65%',
                        fontSize: '0.6rem',
                        color: '#f44336',
                        fontWeight: 600
                    }}
                >
                    False
                </Typography>
            </CardWrapper>
        </div>
    )
}

ConditionNode.propTypes = {
    data: PropTypes.object
}

export default memo(ConditionNode)
