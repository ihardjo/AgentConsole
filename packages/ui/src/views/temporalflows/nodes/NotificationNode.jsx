import PropTypes from 'prop-types'
import { memo, useState } from 'react'
import { Handle, Position } from 'reactflow'
import { useSelector } from 'react-redux'

// material-ui
import { styled, alpha, darken, lighten } from '@mui/material/styles'
import { Box, Typography, Chip, Stack } from '@mui/material'

// project imports
import MainCard from '@/ui-component/cards/MainCard'

// icons
import { IconBell, IconMail, IconMessage, IconWebhook } from '@tabler/icons-react'

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

const NODE_COLOR = '#E91E63' // Pink for Notification

// Channel icons mapping
const CHANNEL_ICONS = {
    email: IconMail,
    sms: IconMessage,
    webhook: IconWebhook
}

// ===========================|| NOTIFICATION NODE ||=========================== //

const NotificationNode = ({ data }) => {
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

    // Get enabled channels
    const enabledChannels = []
    if (data.emailEnabled) enabledChannels.push('email')
    if (data.smsEnabled) enabledChannels.push('sms')
    if (data.webhookEnabled) enabledChannels.push('webhook')

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
                        <IconBell size={24} color='white' />
                    </Box>
                    <Box>
                        <Typography sx={{ fontSize: '0.85rem', fontWeight: 500 }}>{data.label || 'Notification'}</Typography>
                        {enabledChannels.length > 0 ? (
                            <Stack direction='row' spacing={0.5} sx={{ mt: 0.5 }}>
                                {enabledChannels.map((channel) => {
                                    const Icon = CHANNEL_ICONS[channel]
                                    return (
                                        <Chip
                                            key={channel}
                                            icon={<Icon size={12} />}
                                            label={channel}
                                            size='small'
                                            sx={{
                                                height: 18,
                                                fontSize: '0.65rem',
                                                '& .MuiChip-icon': { fontSize: 12 },
                                                '& .MuiChip-label': { px: 0.5 }
                                            }}
                                        />
                                    )
                                })}
                            </Stack>
                        ) : (
                            <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary' }}>No channels configured</Typography>
                        )}
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

NotificationNode.propTypes = {
    data: PropTypes.object
}

export default memo(NotificationNode)
