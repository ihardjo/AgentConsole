import { useEffect } from 'react'

// ─── helpers ─────────────────────────────────────────────────────────────────

/**
 * Apply (or clear) the favicon <link> tag in <head>.
 * Pass a non-empty URL string to activate a custom favicon,
 * or '' / falsy to fall back to /favicon.ico.
 */
const applyFavicon = (url) => {
    const faviconUrl = url || '/favicon.ico'
    const appleTouchUrl = url || '/logo192.png'

    let faviconLink = document.querySelector("link[rel*='icon']")
    if (!faviconLink) {
        faviconLink = document.createElement('link')
        faviconLink.rel = 'icon'
        document.head.appendChild(faviconLink)
    }
    faviconLink.href = faviconUrl

    const appleTouchIcon = document.querySelector("link[rel='apple-touch-icon']")
    if (appleTouchIcon) appleTouchIcon.href = appleTouchUrl
}

// ─── hook ────────────────────────────────────────────────────────────────────

/**
 * Hook to apply and update the favicon for authenticated / public layouts.
 *
 * Strategy:
 *   • On every layout mount we first check localStorage (`platform_favicon_active`)
 *     and apply it instantly — zero network round-trip for warm loads.
 *   • When a `platformFaviconUpdated` / `platformLogoUpdated` / `platformAppNameUpdated`
 *     event fires we skip the cache and re-validate with the server, then update the
 *     cache so the next page load stays warm.
 *
 * The document.title / appName is managed exclusively by ConfigContext — this hook
 * does NOT touch it, eliminating the dual-writer race condition.
 */
export const usePlatformConfig = () => {
    useEffect(() => {
        /**
         * Apply the favicon, optionally bypassing the localStorage cache.
         * @param {boolean} skipCache  When true, always hits the network.
         */
        const loadFavicon = async (skipCache = false) => {
            try {
                // ── 1. Cache-first ──────────────────────────────────────────
                if (!skipCache) {
                    const cached = localStorage.getItem('platform_favicon_active')
                    if (cached !== null) {
                        // Cache hit: apply immediately without any network request.
                        if (cached === '1') {
                            // Use a fresh timestamp so the browser actually fetches
                            // the current file rather than a stale browser-cache entry.
                            applyFavicon(`${window.location.origin}/api/v1/platform-configuration/favicon?t=${Date.now()}`)
                        } else {
                            applyFavicon('')
                        }
                        return
                    }
                }

                // ── 2. Network fetch (cache miss or forced refresh) ─────────
                // IMPORTANT: check status === 200 explicitly.
                // response.ok is true for any 2xx — including 204 No Content
                // (what the server returns when no favicon is active).
                // Using response.ok would set the <link> href to the API URL
                // even when the response has no body, breaking the favicon.
                const faviconResponse = await fetch(`${window.location.origin}/api/v1/platform-configuration/favicon?t=${Date.now()}`)

                if (faviconResponse.status === 200) {
                    const faviconUrl = `${window.location.origin}/api/v1/platform-configuration/favicon?t=${Date.now()}`
                    try {
                        localStorage.setItem('platform_favicon_active', '1')
                    } catch (_) {
                        // intentionally empty
                    }
                    applyFavicon(faviconUrl)
                } else {
                    // 204 No Content (no active favicon) or any other non-200 response
                    // → explicitly reset to the default favicon so a previously-active
                    //   custom favicon is cleared in all layouts / menus.
                    try {
                        localStorage.setItem('platform_favicon_active', '0')
                    } catch (_) {
                        // intentionally empty
                    }
                    applyFavicon('')
                }
            } catch (error) {
                // Network error — leave whatever is currently set untouched.
                console.log('Could not reach platform configuration endpoint for favicon')
            }
        }

        // Initial load — use cache if available.
        loadFavicon(false)

        // ── Event listeners ────────────────────────────────────────────────
        // Only the favicon event matters here — logo and app-name changes do
        // not affect the favicon state, so those events are intentionally
        // not listened to in this hook.
        const handleFaviconUpdate = () => loadFavicon(true)

        window.addEventListener('platformFaviconUpdated', handleFaviconUpdate)

        return () => {
            window.removeEventListener('platformFaviconUpdated', handleFaviconUpdate)
        }
    }, [])
}
