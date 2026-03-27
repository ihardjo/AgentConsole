import { memo } from 'react'
import { getBezierPath } from 'reactflow'
import { useTheme } from '@mui/material/styles'

const TemporalEdge = ({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, style = {}, markerEnd, data }) => {
    const theme = useTheme()

    const [edgePath, labelX, labelY] = getBezierPath({
        sourceX,
        sourceY,
        sourcePosition,
        targetX,
        targetY,
        targetPosition
    })

    const edgeLabel = data?.edgeLabel

    return (
        <>
            <path
                id={id}
                style={{
                    strokeWidth: 2,
                    stroke: theme.palette.primary.main,
                    ...style
                }}
                className='react-flow__edge-path'
                d={edgePath}
                markerEnd={markerEnd}
            />
            {edgeLabel && (
                <foreignObject
                    width={60}
                    height={24}
                    x={labelX - 30}
                    y={labelY - 12}
                    className='edgebutton-foreignobject'
                    requiredExtensions='http://www.w3.org/1999/xhtml'
                >
                    <div
                        style={{
                            display: 'flex',
                            justifyContent: 'center',
                            alignItems: 'center',
                            width: '100%',
                            height: '100%',
                            backgroundColor: edgeLabel === 'True' ? '#4CAF50' : '#f44336',
                            borderRadius: '4px',
                            color: 'white',
                            fontSize: '10px',
                            fontWeight: 600
                        }}
                    >
                        {edgeLabel}
                    </div>
                </foreignObject>
            )}
        </>
    )
}

export default memo(TemporalEdge)
