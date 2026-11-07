/**
 * TerraWatch WebGIS Breakpoint Definitions
 * Standardized breakpoints for emergency operations center responsive layouts.
 */

export const BREAKPOINTS = Object.freeze({
  xs: 0,
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  xxl: 1536,
});

/**
 * Screen size classification helper
 * @param {number} width - Viewport width in pixels
 * @returns {'mobile' | 'tablet' | 'desktop' | 'wide'}
 */
export function getDeviceCategory(width) {
  if (width < BREAKPOINTS.sm) return 'mobile';
  if (width < BREAKPOINTS.lg) return 'tablet';
  if (width < BREAKPOINTS.xxl) return 'desktop';
  return 'wide';
}

/**
 * Check if width is mobile (< 640px)
 * @param {number} width 
 * @returns {boolean}
 */
export function isMobileWidth(width) {
  return width < BREAKPOINTS.sm;
}

/**
 * Check if width is tablet (640px - 1023px)
 * @param {number} width 
 * @returns {boolean}
 */
export function isTabletWidth(width) {
  return width >= BREAKPOINTS.sm && width < BREAKPOINTS.lg;
}

/**
 * Check if width is desktop (>= 1024px)
 * @param {number} width 
 * @returns {boolean}
 */
export function isDesktopWidth(width) {
  return width >= BREAKPOINTS.lg;
}
