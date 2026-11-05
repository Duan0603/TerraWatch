/**
 * TypeScript Definitions for TerraWatch WebGIS Responsive System
 */

export interface BreakpointsMap {
  readonly xs: number;
  readonly sm: number;
  readonly md: number;
  readonly lg: number;
  readonly xl: number;
  readonly xxl: number;
}

export type DeviceCategory = 'mobile' | 'tablet' | 'desktop' | 'wide';

export interface ResponsiveState {
  width: number;
  height: number;
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  isPortrait: boolean;
  isLandscape: boolean;
  deviceCategory: DeviceCategory;
}

export declare const BREAKPOINTS: BreakpointsMap;
export declare function getDeviceCategory(width: number): DeviceCategory;
export declare function isMobileWidth(width: number): boolean;
export declare function isTabletWidth(width: number): boolean;
export declare function isDesktopWidth(width: number): boolean;

export declare function useResponsive(): ResponsiveState;
export default useResponsive;
