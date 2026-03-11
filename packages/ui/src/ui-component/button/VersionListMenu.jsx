import { useState } from 'react'
import PropTypes from 'prop-types'

import { styled, alpha } from '@mui/material/styles'
import Menu from '@mui/material/Menu'
import { PermissionMenuItem } from '@/ui-component/button/RBACButtons'
import EditIcon from '@mui/icons-material/Edit'
import Divider from '@mui/material/Divider'
import Button from '@mui/material/Button'
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown'
import { IconRestore, IconTrash, IconArrowsLeftRight } from '@tabler/icons-react'

const StyledMenu = styled((props) => (
    <Menu
        elevation={0}
        anchorOrigin={{
            vertical: 'bottom',
            horizontal: 'right'
        }}
        transformOrigin={{
            vertical: 'top',
            horizontal: 'right'
        }}
        {...props}
    />
))(({ theme }) => ({
    '& .MuiPaper-root': {
        borderRadius: 6,
        marginTop: theme.spacing(1),
        minWidth: 180,
        boxShadow:
            'rgb(255, 255, 255) 0px 0px 0px 0px, rgba(0, 0, 0, 0.05) 0px 0px 0px 1px, rgba(0, 0, 0, 0.1) 0px 10px 15px -3px, rgba(0, 0, 0, 0.05) 0px 4px 6px -2px',
        '& .MuiMenu-list': {
            padding: '4px 0'
        },
        '& .MuiMenuItem-root': {
            '& .MuiSvgIcon-root': {
                fontSize: 18,
                color: theme.palette.text.secondary,
                marginRight: theme.spacing(1.5)
            },
            '&:active': {
                backgroundColor: alpha(theme.palette.primary.main, theme.palette.action.selectedOpacity)
            }
        }
    }
}))

export default function VersionListMenu({ version, chatFlowName, allVersions, onCompare, onEdit, onRestore, onDelete }) {
    const [anchorEl, setAnchorEl] = useState(null)
    const open = Boolean(anchorEl)

    const handleClick = (event) => {
        event.stopPropagation()
        setAnchorEl(event.currentTarget)
    }

    const handleClose = (event) => {
        if (event) {
            event.stopPropagation()
        }
        setAnchorEl(null)
    }

    const handleCompare = (event) => {
        event.stopPropagation()
        handleClose(event)
        if (onCompare) {
            onCompare({ ...version, chatFlowName })
        }
    }

    const handleEdit = (event) => {
        event.stopPropagation()
        handleClose(event)
        if (onEdit) {
            onEdit({ ...version, chatFlowName })
        }
    }

    const handleRestore = (event) => {
        event.stopPropagation()
        handleClose(event)
        if (onRestore) {
            onRestore({ ...version, chatFlowName })
        }
    }

    const handleDelete = (event) => {
        event.stopPropagation()
        handleClose(event)
        if (onDelete) {
            onDelete({ ...version, chatFlowName })
        }
    }

    return (
        <div>
            <Button
                id='version-menu-button'
                aria-controls={open ? 'version-menu' : undefined}
                aria-haspopup='true'
                aria-expanded={open ? 'true' : undefined}
                disableElevation
                onClick={handleClick}
                endIcon={<KeyboardArrowDownIcon />}
                size='small'
                sx={{ fontSize: '14px' }}
            >
                Options
            </Button>
            <StyledMenu
                id='version-menu'
                MenuListProps={{
                    'aria-labelledby': 'version-menu-button'
                }}
                anchorEl={anchorEl}
                open={open}
                onClose={handleClose}
            >
                <PermissionMenuItem permissionId='agentops:view' onClick={handleCompare} disableRipple disabled={!allVersions || allVersions.length < 1}>
                    <IconArrowsLeftRight style={{ fontSize: 18, marginRight: 12 }} />
                    Compare
                </PermissionMenuItem>
                <Divider sx={{ my: 0.5 }} />
                <PermissionMenuItem permissionId='agentops:update' onClick={handleEdit} disableRipple>
                    <EditIcon style={{ fontSize: 24, marginRight: 12 }} />
                    Edit Description
                </PermissionMenuItem>
                <PermissionMenuItem permissionId='agentops:restore' onClick={handleRestore} disableRipple>
                    <IconRestore style={{ fontSize: 18, marginRight: 12 }} />
                    Restore
                </PermissionMenuItem>
                <Divider sx={{ my: 0.5 }} />
                <PermissionMenuItem permissionId='agentops:delete' onClick={handleDelete} disableRipple>
                    <IconTrash style={{ fontSize: 18, marginRight: 12 }} />
                    Delete
                </PermissionMenuItem>
            </StyledMenu>
        </div>
    )
}

VersionListMenu.propTypes = {
    version: PropTypes.object.isRequired,
    chatFlowName: PropTypes.string.isRequired,
    allVersions: PropTypes.array,
    onCompare: PropTypes.func,
    onEdit: PropTypes.func,
    onRestore: PropTypes.func,
    onDelete: PropTypes.func
}
