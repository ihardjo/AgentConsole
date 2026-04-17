// ==============================|| PLATFORM EVENT HELPERS ||============================== //
// Centralised custom-event dispatchers so every module that needs to notify the
// rest of the application about branding changes imports from a single source.

/**
 * Notify logo-consuming components (e.g. sidebar logo) that the active logo
 * has changed and they should re-fetch / re-render.
 */
export const triggerLogoUpdate = () => {
    window.dispatchEvent(new CustomEvent('platformLogoUpdated', { detail: { timestamp: Date.now() } }))
}

/**
 * Notify favicon-consuming components that the active favicon has changed.
 */
export const triggerFaviconUpdate = () => {
    window.dispatchEvent(new CustomEvent('platformFaviconUpdated', { detail: { timestamp: Date.now() } }))
}

/**
 * Notify consumers (browser-tab title, nav labels, etc.) that the application
 * name has been updated.
 */
export const triggerAppNameUpdate = () => {
    window.dispatchEvent(new CustomEvent('platformAppNameUpdated', { detail: { timestamp: Date.now() } }))
}
