# TerraWatch WebGIS Responsive & Adaptive Operations Guide

## 1. Executive Summary

The **TerraWatch Emergency Operations Center (EOC) WebGIS Dashboard** is designed to provide high-reliability geospatial awareness across diverse operator devices, ranging from multi-monitor mission control command centers to field-deployed tablets and smartphones during active disaster incidents.

This document formalizes the responsive breakpoint system, adaptive layout behaviors, operator keyboard shortcuts, and accessibility compliance rules implemented in `feature/webgis-responsive`.

---

## 2. Breakpoint Grid Specification

Breakpoints are defined in `apps/webgis/src/constants/breakpoints.js` and reflected in CSS media queries in `apps/webgis/src/index.css`:

| Category | Viewport Width | Typical Hardware | Primary Layout Behavior |
| :--- | :--- | :--- | :--- |
| **Mobile (`sm`)** | `< 640px` | iPhone, Android phones | Single view with bottom tab bar (`Danh sách` / `Bản đồ`), full-width modals |
| **Tablet (`md` - `lg`)** | `640px` – `1023px` | iPad, Galaxy Tab, Surface | Dual column compact view, floating overlay controls |
| **Desktop (`xl`)** | `1024px` – `1439px` | Laptops, Standard Monitors | Full split view (Queue sidebar 400px + Map 3D + Detail Drawer) |
| **Wide (`xxl`)** | `≥ 1440px` | 4K Command Center Walls | Expanded sidebar, persistent rainfall matrix, high-detail terrain |

---

## 3. Responsive Layout Architecture

### 3.1 Mobile Viewport Management (`< 640px`)
- **Dual Tab Mode**: Operators toggle between `Danh sách sự cố` (VerificationQueue) and `Bản đồ 3D` (DetailPanel / MapViewer) via the fixed bottom navigation bar.
- **Touch Targets**: All interactive elements (map controls, alert action buttons, incident cards) enforce a minimum touch target of `44x44px` according to WCAG 2.1 Level AA guidelines.
- **Overlay Modals**: Emergency Broadcast (`BroadcastModal`) and History (`BroadcastHistoryModal`) open as full-screen modal sheets with top-right dismiss actions.

### 3.2 Desktop Command Center Mode (`≥ 1024px`)
- **Simultaneous Observation**: Operators can verify incoming crowd reports and monitor real-time MapLibre 3D terrain elevation and rainfall risk layers simultaneously without switching contexts.
- **High-Density Data**: Queue item cards display confidence badges, rainfall thresholds, and GIS coordinates inline.

---

## 4. Operator Keyboard Navigation

To accelerate rapid emergency response, WebGIS includes dedicated keyboard shortcuts managed by `useKeyboardShortcuts.js`. All shortcuts automatically disable when an operator is actively typing into an `input`, `textarea`, or `select` element.

| Key Combination | Action | Operational Purpose |
| :--- | :--- | :--- |
| `Escape` | Dismiss active modal or panel | Quickly close alert prompt, broadcast modal, or selection |
| `Alt + M` | Switch to Map View | Jump directly to MapLibre 3D spatial view on mobile/tablet |
| `Alt + L` | Switch to Queue List | Jump directly to verification queue list on mobile/tablet |

---

## 5. Automated Verification & Testing

The responsive system is validated via automated unit and integration tests located in:
- `apps/webgis/tests/test-responsive-utilities.mjs`
- Test runner: `apps/webgis/tests/run-all-tests.mjs`

To run all WebGIS verification suites:
```bash
cd apps/webgis
npm test
npm run build
```
