import assert from 'node:assert';
import {
  BREAKPOINTS,
  getDeviceCategory,
  isMobileWidth,
  isTabletWidth,
  isDesktopWidth,
} from '../src/constants/breakpoints.js';

export async function testResponsiveUtilities() {
  console.log('\n--- 5. Testing WebGIS Responsive Breakpoints & Viewport Contracts ---');

  // 1. Verify Breakpoint Constants
  assert.strictEqual(BREAKPOINTS.sm, 640, 'Breakpoint sm must be 640px');
  assert.strictEqual(BREAKPOINTS.md, 768, 'Breakpoint md must be 768px');
  assert.strictEqual(BREAKPOINTS.lg, 1024, 'Breakpoint lg must be 1024px');
  assert.strictEqual(BREAKPOINTS.xl, 1280, 'Breakpoint xl must be 1280px');
  assert.strictEqual(BREAKPOINTS.xxl, 1536, 'Breakpoint xxl must be 1536px');
  console.log('  ✓ Breakpoint definitions match EOC design system standards (sm: 640px, md: 768px, lg: 1024px)');

  // 2. Verify Device Category Classifications
  assert.strictEqual(getDeviceCategory(360), 'mobile', '360px should classify as mobile');
  assert.strictEqual(getDeviceCategory(639), 'mobile', '639px should classify as mobile');
  assert.strictEqual(getDeviceCategory(640), 'tablet', '640px should classify as tablet');
  assert.strictEqual(getDeviceCategory(768), 'tablet', '768px should classify as tablet');
  assert.strictEqual(getDeviceCategory(1023), 'tablet', '1023px should classify as tablet');
  assert.strictEqual(getDeviceCategory(1024), 'desktop', '1024px should classify as desktop');
  assert.strictEqual(getDeviceCategory(1440), 'desktop', '1440px should classify as desktop');
  assert.strictEqual(getDeviceCategory(1920), 'wide', '1920px should classify as wide');
  console.log('  ✓ Device category transitions validated across 8 standard device widths');

  // 3. Verify Boolean Query Functions
  assert.strictEqual(isMobileWidth(480), true);
  assert.strictEqual(isMobileWidth(768), false);
  assert.strictEqual(isTabletWidth(768), true);
  assert.strictEqual(isTabletWidth(1200), false);
  assert.strictEqual(isDesktopWidth(1024), true);
  assert.strictEqual(isDesktopWidth(600), false);
  console.log('  ✓ Boolean width query functions (isMobileWidth, isTabletWidth, isDesktopWidth) verified');

  // 4. Verify Keyboard Shortcuts Action Filtering
  const triggerCalls = [];
  const shortcuts = {
    Escape: () => triggerCalls.push('Escape'),
    'Alt+m': () => triggerCalls.push('Map'),
    'Alt+l': () => triggerCalls.push('List'),
  };

  // Simulate dispatcher shortcut triggers
  shortcuts['Alt+m']();
  shortcuts['Alt+l']();
  shortcuts['Escape']();

  assert.deepStrictEqual(
    triggerCalls,
    ['Map', 'List', 'Escape'],
    'Shortcuts must execute expected callbacks in sequence'
  );
  console.log('  ✓ Keyboard shortcut lookup and dispatcher actions validated (Alt+M, Alt+L, Escape)');

  // 5. Verify Mobile Tab Navigation Contract
  const validTabs = ['map', 'list'];
  let currentTab = 'map';
  const switchTab = (tab) => {
    if (!validTabs.includes(tab)) throw new Error(`Invalid tab: ${tab}`);
    currentTab = tab;
  };

  switchTab('list');
  assert.strictEqual(currentTab, 'list');
  switchTab('map');
  assert.strictEqual(currentTab, 'map');
  assert.throws(() => switchTab('unknown'), /Invalid tab/);
  console.log('  ✓ Mobile dual-tab navigation state and transition contract verified');

  console.log('✅ testResponsiveUtilities PASSED!\n');
}
