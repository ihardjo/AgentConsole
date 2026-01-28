import PropTypes from 'prop-types'
import { useRef, useState, useEffect, useCallback } from 'react'

// material-ui
import { IconButton, Box, OutlinedInput, Toolbar, Typography } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import { StyledFab } from '@/ui-component/button/StyledFab'

// icons
import { IconSearch, IconArrowLeft, IconEdit } from '@tabler/icons-react'

import useSearchShortcut from '@/hooks/useSearchShortcut'
import { getOS } from '@/utils/genericHelper'

// Default debounce delay (300ms is industry standard for search inputs)
const DEFAULT_DEBOUNCE_DELAY = 300

const os = getOS()
const isMac = os === 'macos'
const isDesktop = isMac || os === 'windows' || os === 'linux'
const keyboardShortcut = isMac ? '[ ⌘ + F ]' : '[ Ctrl + F ]'

const ViewHeader = ({
    children,
    filters = null,
    onSearchChange,
    search,
    searchPlaceholder = 'Search',
    searchValue,
    debounceDelay = DEFAULT_DEBOUNCE_DELAY,
    title,
    description,
    isBackButton,
    onBack,
    isEditButton,
    onEdit
}) => {
    const theme = useTheme()
    const searchInputRef = useRef()
    useSearchShortcut(searchInputRef)

    // Internal state for controlled input when debouncing
    const [internalSearchValue, setInternalSearchValue] = useState(searchValue || '')
    const debounceTimerRef = useRef(null)
    const isFirstRender = useRef(true)

    // Sync internal value with external searchValue prop
    useEffect(() => {
        if (searchValue !== undefined) {
            setInternalSearchValue(searchValue)
        }
    }, [searchValue])

    // Debounced search handler
    const handleDebouncedSearch = useCallback(
        (event) => {
            const value = event.target.value
            setInternalSearchValue(value)

            // Clear any existing timer
            if (debounceTimerRef.current) {
                clearTimeout(debounceTimerRef.current)
            }

            // Set up new debounced call
            debounceTimerRef.current = setTimeout(() => {
                if (onSearchChange) {
                    onSearchChange(event)
                }
            }, debounceDelay)
        },
        [onSearchChange, debounceDelay]
    )

    // Cleanup timer on unmount
    useEffect(() => {
        return () => {
            if (debounceTimerRef.current) {
                clearTimeout(debounceTimerRef.current)
            }
        }
    }, [])

    return (
        <Box sx={{ flexGrow: 1, py: 1.25, width: '100%' }}>
            <Toolbar
                disableGutters={true}
                sx={{
                    p: 0,
                    display: 'flex',
                    justifyContent: 'space-between',
                    width: '100%'
                }}
            >
                <Box sx={{ display: 'flex', alignItems: 'center', flexDirection: 'row' }}>
                    {isBackButton && (
                        <StyledFab sx={{ mr: 3 }} size='small' color='secondary' aria-label='back' title='Back' onClick={onBack}>
                            <IconArrowLeft />
                        </StyledFab>
                    )}
                    <Box sx={{ display: 'flex', alignItems: 'start', flexDirection: 'column' }}>
                        <Typography
                            sx={{
                                fontSize: '1.8rem',
                                fontWeight: 600,
                                display: '-webkit-box',
                                WebkitLineClamp: 3,
                                WebkitBoxOrient: 'vertical',
                                textOverflow: 'ellipsis',
                                overflow: 'hidden',
                                flex: 1,
                                maxWidth: 'calc(100vh - 100px)'
                            }}
                            variant='h1'
                        >
                            {title}
                        </Typography>
                        {description && (
                            <Typography
                                sx={{
                                    fontSize: '1rem',
                                    fontWeight: 500,
                                    mt: 2,
                                    display: '-webkit-box',
                                    WebkitLineClamp: 5,
                                    WebkitBoxOrient: 'vertical',
                                    textOverflow: 'ellipsis',
                                    overflow: 'hidden',
                                    flex: 1,
                                    maxWidth: 'calc(100vh - 100px)'
                                }}
                            >
                                {description}
                            </Typography>
                        )}
                    </Box>
                    {isEditButton && (
                        <IconButton sx={{ ml: 3 }} color='secondary' title='Edit' onClick={onEdit}>
                            <IconEdit />
                        </IconButton>
                    )}
                </Box>
                <Box sx={{ height: 40, display: 'flex', alignItems: 'center', gap: 1 }}>
                    {search && (
                        <OutlinedInput
                            inputRef={searchInputRef}
                            size='small'
                            sx={{
                                width: '325px',
                                height: '100%',
                                display: { xs: 'none', sm: 'flex' },
                                borderRadius: 2,

                                '& .MuiOutlinedInput-notchedOutline': {
                                    borderRadius: 2
                                }
                            }}
                            variant='outlined'
                            placeholder={`${searchPlaceholder} ${isDesktop ? keyboardShortcut : ''}`}
                            value={internalSearchValue}
                            onChange={handleDebouncedSearch}
                            startAdornment={
                                <Box
                                    sx={{
                                        color: theme.palette.grey[400],
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        mr: 1
                                    }}
                                >
                                    <IconSearch style={{ color: 'inherit', width: 16, height: 16 }} />
                                </Box>
                            }
                            type='search'
                        />
                    )}
                    {filters}
                    {children}
                </Box>
            </Toolbar>
        </Box>
    )
}

ViewHeader.propTypes = {
    children: PropTypes.node,
    filters: PropTypes.node,
    onSearchChange: PropTypes.func,
    search: PropTypes.bool,
    searchPlaceholder: PropTypes.string,
    searchValue: PropTypes.string,
    debounceDelay: PropTypes.number,
    title: PropTypes.string,
    description: PropTypes.string,
    isBackButton: PropTypes.bool,
    onBack: PropTypes.func,
    isEditButton: PropTypes.bool,
    onEdit: PropTypes.func
}

export default ViewHeader
