import { useState, useEffect, useCallback } from 'react';
import { BREAKPOINTS, getDeviceCategory } from '../constants/breakpoints.js';

/**
 * Custom React hook for responsive viewport tracking and breakpoint queries.
 * Provides SSR-safe and resize-debounced viewport state.
 * 
 * @returns {{
 *   width: number,
 *   height: number,
 *   isMobile: boolean,
 *   isTablet: boolean,
 *   isDesktop: boolean,
 *   isPortrait: boolean,
 *   isLandscape: boolean,
 *   deviceCategory: 'mobile' | 'tablet' | 'desktop' | 'wide'
 * }}
 */
export function useResponsive() {
  const getSnapshot = useCallback(() => {
    if (typeof window === 'undefined') {
      return {
        width: 1280,
        height: 800,
        isMobile: false,
        isTablet: false,
        isDesktop: true,
        isPortrait: false,
        isLandscape: true,
        deviceCategory: 'desktop',
      };
    }

    const width = window.innerWidth || document.documentElement.clientWidth || 1280;
    const height = window.innerHeight || document.documentElement.clientHeight || 800;
    const isMobile = width < BREAKPOINTS.sm;
    const isTablet = width >= BREAKPOINTS.sm && width < BREAKPOINTS.lg;
    const isDesktop = width >= BREAKPOINTS.lg;
    const isPortrait = height > width;

    return {
      width,
      height,
      isMobile,
      isTablet,
      isDesktop,
      isPortrait,
      isLandscape: !isPortrait,
      deviceCategory: getDeviceCategory(width),
    };
  }, []);

  const [state, setState] = useState(getSnapshot);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    let timeoutId = null;

    const handleResize = () => {
      // Debounce window resize to avoid excessive re-renders during drag
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        setState(getSnapshot());
      }, 100);
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, [getSnapshot]);

  return state;
}

export default useResponsive;
