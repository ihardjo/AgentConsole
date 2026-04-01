import { useState, useEffect, useRef, useMemo } from 'react'
import PropTypes from 'prop-types'
import { TextField, Popover } from '@mui/material'
import TemporalSelectVariable from './TemporalSelectVariable'
import { getAvailableVariables } from '@/utils/temporalHelper'

/**
 * TemporalTemplateInput - A text input with variable autocomplete.
 * When the user types '{{', a popover appears with available variables.
 * Selecting a variable inserts '{{variable.path}}' into the text.
 */
const TemporalTemplateInput = ({
    label,
    value,
    onChange,
    placeholder,
    helperText,
    multiline = false,
    rows = 1,
    disabled = false,
    nodes = [],
    edges = [],
    nodeId = '',
    fullWidth = true,
    size = 'medium'
}) => {
    const [localValue, setLocalValue] = useState(value || '')
    const [anchorEl, setAnchorEl] = useState(null)
    const inputRef = useRef(null)
    const cursorPositionRef = useRef(0)

    const openPopover = Boolean(anchorEl)

    // Get available variables for autocomplete
    const availableVariables = useMemo(() => {
        if (!nodes.length || !nodeId) return []
        return getAvailableVariables(nodes, edges, nodeId)
    }, [nodes, edges, nodeId])

    // Sync with external value
    useEffect(() => {
        setLocalValue(value || '')
    }, [value])

    // Detect when user types '{{'
    useEffect(() => {
        if (typeof localValue === 'string' && localValue.endsWith('{{')) {
            // Store cursor position before opening popover
            if (inputRef.current) {
                const inputElement = inputRef.current.querySelector('input, textarea')
                if (inputElement) {
                    cursorPositionRef.current = inputElement.selectionStart
                }
            }
            setAnchorEl(inputRef.current)
        }
    }, [localValue])

    const handleClosePopover = () => {
        setAnchorEl(null)
    }

    const handleChange = (e) => {
        const newValue = e.target.value
        setLocalValue(newValue)
        onChange(newValue)
    }

    const handleSelectVariable = (variable) => {
        // Replace the trailing '{{' with the complete variable reference
        // The value already ends with '{{', so we just append the path and '}}'
        const newValue = localValue.slice(0, -2) + `{{${variable.actualPath}}}`
        setLocalValue(newValue)
        onChange(newValue)
        handleClosePopover()

        // Focus back on input
        setTimeout(() => {
            if (inputRef.current) {
                const inputElement = inputRef.current.querySelector('input, textarea')
                if (inputElement) {
                    inputElement.focus()
                    // Move cursor to end
                    inputElement.setSelectionRange(newValue.length, newValue.length)
                }
            }
        }, 10)
    }

    return (
        <>
            <TextField
                ref={inputRef}
                label={label}
                value={localValue}
                onChange={handleChange}
                placeholder={placeholder}
                helperText={helperText}
                multiline={multiline}
                rows={rows}
                disabled={disabled}
                fullWidth={fullWidth}
                size={size}
            />
            <Popover
                open={openPopover}
                anchorEl={anchorEl}
                onClose={handleClosePopover}
                anchorOrigin={{
                    vertical: 'bottom',
                    horizontal: 'left'
                }}
                transformOrigin={{
                    vertical: 'top',
                    horizontal: 'left'
                }}
            >
                <TemporalSelectVariable variables={availableVariables} disabled={disabled} onSelectVariable={handleSelectVariable} />
            </Popover>
        </>
    )
}

TemporalTemplateInput.propTypes = {
    label: PropTypes.string,
    value: PropTypes.string,
    onChange: PropTypes.func.isRequired,
    placeholder: PropTypes.string,
    helperText: PropTypes.string,
    multiline: PropTypes.bool,
    rows: PropTypes.number,
    disabled: PropTypes.bool,
    nodes: PropTypes.array,
    edges: PropTypes.array,
    nodeId: PropTypes.string,
    fullWidth: PropTypes.bool,
    size: PropTypes.oneOf(['small', 'medium'])
}

export default TemporalTemplateInput
