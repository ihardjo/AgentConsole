import PropTypes from 'prop-types'
import { memo, useState } from 'react'
import { Handle, Position } from 'reactflow'
import { useSelector } from 'react-redux'

// material-ui
import { styled, useTheme, alpha, darken, lighten } from '@mui/material/styles'
import { Box, Typography, Chip } from '@mui/material'

// project imports
import MainCard from '@/ui-component/cards/MainCard'

// icons
import { IconWorldWww } from '@tabler/icons-react'

const CardWrapper = styled(MainCard)(({ theme }) => ({
    background: theme.palette.card.main,
    color: theme.darkTextPrimary,
    border: 'solid 1px',
    width: 'max-content',
    height: 'auto',
    padding: '10px',
    boxShadow: 'none',
    minWidth: '180px'
}))

const NODE_COLOR = '#00BCD4' // Cyan for HTTP Request

// ===========================|| HTTP REQUEST NODE ||=========================== //

const HTTPRequestNode = ({ data }) => {
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

    const getMethodColor = (method) => {
        const colors = {
            GET: '#4CAF50',
            POST: '#2196F3',
            PUT: '#FF9800',
            DELETE: '#f44336',
            PATCH: '#9C27B0'
        }
        return colors[method] || '#666'
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
                        <IconWorldWww size={24} color='white' />
                    </Box>
                    <Box>
                        <Typography sx={{ fontSize: '0.85rem', fontWeight: 500 }}>{data.label || 'HTTP Request'}</Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
                            {data.method && (
                                <Chip
                                    label={data.method}
                                    size='small'
                                    sx={{
                                        fontSize: '0.6rem',
                                        height: 16,
                                        backgroundColor: getMethodColor(data.method),
                                        color: 'white',
                                        fontWeight: 600
                                    }}
                                />
                            )}
                        </Box>
                        <Typography
                            sx={{
                                fontSize: '0.65rem',
                                color: 'text.secondary',
                                maxWidth: 140,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap'
                            }}
                        >
                            {data.url || 'No URL set'}
                        </Typography>
                    </Box>
                </Box>

                {/* Output handle */}
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
            </CardWrapper>
        </div>
    )
}

HTTPRequestNode.propTypes = {
    data: PropTypes.object
}

export default memo(HTTPRequestNode)
