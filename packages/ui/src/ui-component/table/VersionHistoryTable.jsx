import { useState } from 'react'
import PropTypes from 'prop-types'
import { useSelector } from 'react-redux'
import moment from 'moment'
import { styled } from '@mui/material/styles'
import {
    Box,
    Chip,
    Paper,
    Skeleton,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    TableSortLabel,
    useTheme,
    IconButton,
    Tooltip
} from '@mui/material'
import { tableCellClasses } from '@mui/material/TableCell'
import { IconHistory, IconRestore, IconTrash, IconGitCompare } from '@tabler/icons-react'

const StyledTableCell = styled(TableCell)(({ theme }) => ({
    borderColor: theme.palette.grey[900] + 25,

    [`&.${tableCellClasses.head}`]: {
        color: theme.palette.grey[900]
    },
    [`&.${tableCellClasses.body}`]: {
        fontSize: 14,
        height: 64
    }
}))

const StyledTableRow = styled(TableRow)(() => ({
    // hide last border
    '&:last-child td, &:last-child th': {
        border: 0
    }
}))

export const VersionHistoryTable = ({
    data,
    isLoading,
    onVersionClick,
    onRestoreClick,
    onDeleteClick,
    onCompareSelect,
    selectedForCompare = [],
    showFlowName = true
}) => {
    const theme = useTheme()
    const customization = useSelector((state) => state.customization)

    const localStorageKeyOrder = 'versions_order'
    const localStorageKeyOrderBy = 'versions_orderBy'

    const [order, setOrder] = useState(localStorage.getItem(localStorageKeyOrder) || 'desc')
    const [orderBy, setOrderBy] = useState(localStorage.getItem(localStorageKeyOrderBy) || 'createdDate')

    const handleRequestSort = (property) => {
        const isAsc = orderBy === property && order === 'asc'
        const newOrder = isAsc ? 'desc' : 'asc'
        setOrder(newOrder)
        setOrderBy(property)
        localStorage.setItem(localStorageKeyOrder, newOrder)
        localStorage.setItem(localStorageKeyOrderBy, property)
    }

    const sortedData = data
        ? [...data].sort((a, b) => {
              if (orderBy === 'version') {
                  return order === 'asc' ? a.version - b.version : b.version - a.version
              } else if (orderBy === 'createdDate') {
                  return order === 'asc'
                      ? new Date(a.createdDate) - new Date(b.createdDate)
                      : new Date(b.createdDate) - new Date(a.createdDate)
              } else if (orderBy === 'chatFlowName') {
                  return order === 'asc'
                      ? (a.chatFlowName || '').localeCompare(b.chatFlowName || '')
                      : (b.chatFlowName || '').localeCompare(a.chatFlowName || '')
              }
              return 0
          })
        : []

    const isSelectedForCompare = (id) => selectedForCompare.includes(id)

    return (
        <>
            <TableContainer
                sx={{ border: 1, borderColor: theme.palette.grey[900] + 25, borderRadius: 2 }}
                component={Paper}
            >
                <Table sx={{ minWidth: 650 }} size='small' aria-label='version history table'>
                    <TableHead
                        sx={{
                            backgroundColor: customization.isDarkMode
                                ? theme.palette.common.black
                                : theme.palette.grey[100],
                            height: 56
                        }}
                    >
                        <TableRow>
                            <StyledTableCell>
                                <TableSortLabel
                                    active={orderBy === 'version'}
                                    direction={orderBy === 'version' ? order : 'asc'}
                                    onClick={() => handleRequestSort('version')}
                                >
                                    Version
                                </TableSortLabel>
                            </StyledTableCell>
                            {showFlowName && (
                                <StyledTableCell>
                                    <TableSortLabel
                                        active={orderBy === 'chatFlowName'}
                                        direction={orderBy === 'chatFlowName' ? order : 'asc'}
                                        onClick={() => handleRequestSort('chatFlowName')}
                                    >
                                        AI Agent
                                    </TableSortLabel>
                                </StyledTableCell>
                            )}
                            {showFlowName && <StyledTableCell>Type</StyledTableCell>}
                            <StyledTableCell>Description</StyledTableCell>
                            <StyledTableCell>Created By</StyledTableCell>
                            <StyledTableCell>
                                <TableSortLabel
                                    active={orderBy === 'createdDate'}
                                    direction={orderBy === 'createdDate' ? order : 'asc'}
                                    onClick={() => handleRequestSort('createdDate')}
                                >
                                    Created Date
                                </TableSortLabel>
                            </StyledTableCell>
                            <StyledTableCell align='right'>Actions</StyledTableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {isLoading ? (
                            <>
                                <StyledTableRow>
                                    <StyledTableCell colSpan={showFlowName ? 7 : 5}>
                                        <Skeleton variant='text' />
                                    </StyledTableCell>
                                </StyledTableRow>
                                <StyledTableRow>
                                    <StyledTableCell colSpan={showFlowName ? 7 : 5}>
                                        <Skeleton variant='text' />
                                    </StyledTableCell>
                                </StyledTableRow>
                            </>
                        ) : sortedData.length === 0 ? (
                            <StyledTableRow>
                                <StyledTableCell colSpan={showFlowName ? 7 : 5} align='center'>
                                    No versions found
                                </StyledTableCell>
                            </StyledTableRow>
                        ) : (
                            sortedData.map((row) => (
                                <StyledTableRow
                                    hover
                                    key={row.id}
                                    sx={{
                                        cursor: 'pointer',
                                        backgroundColor: isSelectedForCompare(row.id)
                                            ? theme.palette.action.selected
                                            : 'inherit'
                                    }}
                                    onClick={() => onVersionClick && onVersionClick(row)}
                                >
                                    <StyledTableCell>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                            <IconHistory size={16} />
                                            v{row.version}
                                        </Box>
                                    </StyledTableCell>
                                    {showFlowName && (
                                        <StyledTableCell>
                                            <Tooltip title={row.chatFlowName || 'Unknown'}>
                                                <Box
                                                    sx={{
                                                        maxWidth: 150,
                                                        overflow: 'hidden',
                                                        textOverflow: 'ellipsis',
                                                        whiteSpace: 'nowrap'
                                                    }}
                                                >
                                                    {row.chatFlowName || 'Unknown'}
                                                </Box>
                                            </Tooltip>
                                        </StyledTableCell>
                                    )}
                                    {showFlowName && (
                                        <StyledTableCell>
                                            <Chip
                                                label={row.chatFlowType === 'AGENTFLOW' ? 'AI Agent' : row.chatFlowType || 'Unknown'}
                                                size='small'
                                                color={row.chatFlowType === 'AGENTFLOW' ? 'primary' : 'default'}
                                                variant='outlined'
                                            />
                                        </StyledTableCell>
                                    )}
                                    <StyledTableCell>
                                        <Tooltip title={row.changeDescription || 'No description'}>
                                            <Box
                                                sx={{
                                                    maxWidth: 200,
                                                    overflow: 'hidden',
                                                    textOverflow: 'ellipsis',
                                                    whiteSpace: 'nowrap'
                                                }}
                                            >
                                                {row.changeDescription || '-'}
                                            </Box>
                                        </Tooltip>
                                    </StyledTableCell>
                                    <StyledTableCell>{row.createdBy || '-'}</StyledTableCell>
                                    <StyledTableCell>
                                        {row.createdDate ? moment(row.createdDate).format('YYYY-MM-DD HH:mm') : '-'}
                                    </StyledTableCell>
                                    <StyledTableCell align='right'>
                                        <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 0.5 }}>
                                            <Tooltip title='Select for compare'>
                                                <IconButton
                                                    size='small'
                                                    onClick={(e) => {
                                                        e.stopPropagation()
                                                        onCompareSelect && onCompareSelect(row.id)
                                                    }}
                                                    color={isSelectedForCompare(row.id) ? 'primary' : 'default'}
                                                >
                                                    <IconGitCompare size={18} />
                                                </IconButton>
                                            </Tooltip>
                                            <Tooltip title='Restore version'>
                                                <IconButton
                                                    size='small'
                                                    onClick={(e) => {
                                                        e.stopPropagation()
                                                        onRestoreClick && onRestoreClick(row)
                                                    }}
                                                >
                                                    <IconRestore size={18} />
                                                </IconButton>
                                            </Tooltip>
                                            <Tooltip title='Delete version'>
                                                <IconButton
                                                    size='small'
                                                    onClick={(e) => {
                                                        e.stopPropagation()
                                                        onDeleteClick && onDeleteClick(row)
                                                    }}
                                                    color='error'
                                                >
                                                    <IconTrash size={18} />
                                                </IconButton>
                                            </Tooltip>
                                        </Box>
                                    </StyledTableCell>
                                </StyledTableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </TableContainer>
        </>
    )
}

VersionHistoryTable.propTypes = {
    data: PropTypes.array,
    isLoading: PropTypes.bool,
    onVersionClick: PropTypes.func,
    onRestoreClick: PropTypes.func,
    onDeleteClick: PropTypes.func,
    onCompareSelect: PropTypes.func,
    selectedForCompare: PropTypes.array,
    showFlowName: PropTypes.bool
}

export default VersionHistoryTable
