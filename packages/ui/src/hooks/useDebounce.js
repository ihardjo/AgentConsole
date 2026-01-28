import { useState, useEffect, useRef, useCallback } from 'react'

/**
 * Custom hook for debouncing a value
 * @param {any} value - The value to debounce
 * @param {number} delay - The delay in milliseconds (default: 300ms)
 * @returns {any} The debounced value
 */
export const useDebounceValue = (value, delay = 300) => {
    const [debouncedValue, setDebouncedValue] = useState(value)

    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedValue(value)
        }, delay)

        return () => {
            clearTimeout(timer)
        }
    }, [value, delay])

    return debouncedValue
}

/**
 * Custom hook for debouncing a callback function
 * @param {Function} callback - The callback function to debounce
 * @param {number} delay - The delay in milliseconds (default: 300ms)
 * @returns {Function} The debounced callback function
 */
export const useDebounceCallback = (callback, delay = 300) => {
    const timeoutRef = useRef(null)
    const callbackRef = useRef(callback)

    // Update the callback ref whenever callback changes
    useEffect(() => {
        callbackRef.current = callback
    }, [callback])

    const debouncedCallback = useCallback(
        (...args) => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current)
            }

            timeoutRef.current = setTimeout(() => {
                callbackRef.current(...args)
            }, delay)
        },
        [delay]
    )

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current)
            }
        }
    }, [])

    return debouncedCallback
}

/**
 * Custom hook that combines search state management with debouncing
 * Best practice implementation for search with pagination
 * @param {Object} options - Configuration options
 * @param {Function} options.onSearch - Callback function to execute the search API call
 * @param {number} options.delay - Debounce delay in milliseconds (default: 300ms)
 * @param {number} options.minLength - Minimum characters before triggering search (default: 0)
 * @returns {Object} Object containing search state and handlers
 */
export const useDebouncedSearch = ({ onSearch, delay = 300, minLength = 0 }) => {
    const [searchTerm, setSearchTerm] = useState('')
    const [isSearching, setIsSearching] = useState(false)
    const debouncedSearchTerm = useDebounceValue(searchTerm, delay)
    const isFirstRender = useRef(true)

    // Effect to trigger search when debounced value changes
    useEffect(() => {
        // Skip the first render to avoid double API calls
        if (isFirstRender.current) {
            isFirstRender.current = false
            return
        }

        // Only search if meeting minimum length requirement or if empty (to reset)
        if (debouncedSearchTerm.length >= minLength || debouncedSearchTerm === '') {
            setIsSearching(true)
            Promise.resolve(onSearch(debouncedSearchTerm)).finally(() => {
                setIsSearching(false)
            })
        }
    }, [debouncedSearchTerm, onSearch, minLength])

    const handleSearchChange = useCallback((event) => {
        const value = event?.target?.value ?? event
        setSearchTerm(value)
    }, [])

    const clearSearch = useCallback(() => {
        setSearchTerm('')
    }, [])

    return {
        searchTerm,
        debouncedSearchTerm,
        isSearching,
        handleSearchChange,
        clearSearch,
        setSearchTerm
    }
}

export default useDebounceValue
