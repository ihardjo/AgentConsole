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
import { IconSubtask } from '@tabler/icons-react'

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

const NODE_COLOR = '#009688' // Teal for SubWorkflow

// ===========================|| SUBWORKFLOW NODE ||=========================== //

const SubWorkflowNode = ({ data }) => {
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

    const workflowName = data.workflowName || 'Not selected'
    const waitForCompletion = data.waitForCompletion !== false

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
                        <IconSubtask size={24} color='white' />
                    </Box>
                    <Box>
                        <Typography sx={{ fontSize: '0.85rem', fontWeight: 500 }}>{data.label || 'SubWorkflow'}</Typography>
                        <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary' }}>
                            {data.workflowId ? workflowName : 'Select workflow'}
                        </Typography>
                        <Typography sx={{ fontSize: '0.65rem', color: 'text.secondary', fontStyle: 'italic' }}>
                            {waitForCompletion ? 'Waits for completion' : 'Fire & forget'}
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

SubWorkflowNode.propTypes = {
    data: PropTypes.object
}

export default memo(SubWorkflowNode)
