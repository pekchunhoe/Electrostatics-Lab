# Electrostatics Lab navigation refinement

Validated locally on 17 October 2026. No commit, push or deployment was performed.

## Changes

| File | Change |
| --- | --- |
| `index.html` | Header and document title, description, footer and topic-list accessible name |
| `src/app.js` | Exact topic labels, stable numeric tab IDs, persistent tab buttons, accessible selection and horizontal reveal |
| `src/styles.css` | Compact header and headings, horizontally scrollable pill tabs, sticky positioning and scroll clearance |
| `tests/browser/navigation.spec.js` | Ten focused navigation regression tests and screenshot capture |
| `docs/UI_NAVIGATION_VALIDATION.md` | This implementation and validation report |

The application title changed from **SP025 Electrostatics** to **Electrostatics Lab**. No syllabus code remains in the served HTML, metadata, application source, accessible labels or generated production application. Internal package and curriculum references remain unchanged. There is no PWA manifest, social-title override or student export feature in this application.

The main tab names are exactly **Coulomb Force**, **Electric Field**, **Electric Potential** and **Uniform Electric Field**, in their original order. Numeric IDs `tab-0` through `tab-3` and the existing state array retain the curriculum mapping and independent physical arrangements.

## Navigation and layout

The navigation uses a flex row with full, untruncated, nonwrapping 14 px labels and touch targets at least 44 px high. Only the tab strip scrolls horizontally. All four tabs fit together at the tested tablet and desktop widths. The active tab has a coloured outline, tinted background and selected semantics.

The existing body-level navigation remains a direct child of the document body and uses native `position: sticky; top: 0`. Its opaque theme background, bottom border and shadow separate it from scrolling content. Safe-area padding is included. The header scrolls away normally. No scroll listener, animation library or continuous navigation state update was added. Existing desktop workspace columns and its sticky simulation remain intact; its top offset accounts for the safe area.

Tab activation focuses with `preventScroll` and reveals the selected button through horizontal-only `scrollTo`. It also restores the vertical page position after rendering, clamped naturally if the new document is shorter. Resizing reveals the active tab again. Navigation buttons persist through panel rerenders, preserving their focus and horizontal position. Scroll padding keeps targets opened by panel shortcuts below the sticky bar.

The compact subject heading retains scientific context without repeating the exact navigation label. The header remains on one line at 320 px. Help, theme controls and settings remain functional.

## Validation results

Commands completed successfully:

- `npm.cmd test`: **36/36 physics and learning tests passed**, including all existing numerical references.
- `npm.cmd run test:browser`: **26/26 browser tests passed**, including all 16 pre-existing tests and 10 new navigation tests.
- `npm.cmd run build`: **passed**, with the existing static output directory `dist/` and unchanged build configuration.

The physics engine, rendering engine, presets, learning content, numerical reference tests, dependencies and hosting configuration were not changed. Existing tests continue to exercise vector superposition, fields and contours, four motion experiments, collision and exit events, equilibrium, validation, state preservation, dragging, pinch zoom, play/pause/step/reset, investigations and challenges.

| Viewport | Navigation sequence and screenshots |
| --- | --- |
| 320 × 568 | Passed; top, calculations and bottom screenshots inspected |
| 360 × 640 | Passed; top, calculations and bottom screenshots inspected |
| 390 × 844 | Passed; top, calculations and bottom screenshots inspected |
| 430 × 932 | Passed; top, calculations and bottom screenshots inspected |
| 768 × 1024 | Passed; all tabs fit; three screenshots inspected |
| 1280 × 800 | Passed; desktop workspace preserved; three screenshots inspected |
| 844 × 390 | Passed; landscape navigation and three screenshots inspected |
| 1440 × 900 | Passed in the existing all-tab layout regression test |

The sequence checks the title, all exact labels, fourth-topic selection, full selected-tab visibility, sticky navigation at calculations and challenges, switching to Electric Field while scrolled down, and returning to the bar's natural position. Sticky checks use rendered bounding coordinates and pointer hit testing, including after panel expansion and topic changes. No page-wide horizontal overflow or JavaScript/browser console errors occurred in the successful validation run. Targeted panel headings remain below the bar. Screenshot review found no unexpected blank spaces, navigation layout jumps or clipped active labels; partially visible *inactive* tabs indicate available horizontal scrolling.

Mobile checks include native touch swipes on the strip and native touch dragging of the Electric Field probe at all four portrait phone sizes. Additional browser-automation checks verified touch dragging at 768 × 1024 and 844 × 390. Probe dragging leaves both page scroll and tab-strip scroll unchanged. A separate native touch-tap test switches topics while sticky, with the uniform-field simulation actively animating. Existing touch pinch and charge-drag regressions also pass.

Accessibility checks pass for `tablist`, `tab`, `tabpanel`, selected state, panel labelling, one roving tab stop, focus visibility, Arrow Left/Right wrapping, Home/End and Tab into the panel. Keyboard selection reveals the active tab without moving the page. Portrait/landscape resizing, reduced-motion preference, help and dark mode pass. All automatic navigation scrolling is instant, without an animation to suppress under reduced motion.

## Screenshot artifacts and limits

The browser suite generates 21 navigation screenshots at `test-results/screenshots/navigation-{width}-{height}-{top|middle|bottom}.png`, plus `navigation-360-dark.png`. All 22 were visually inspected. It also regenerates the existing simulation screenshots. The screenshot folder is intentionally Git-ignored and can be regenerated with the browser test command.

Representative local artifacts:

- [320 px top](../test-results/screenshots/navigation-320-568-top.png)
- [320 px calculations](../test-results/screenshots/navigation-320-568-middle.png)
- [320 px bottom](../test-results/screenshots/navigation-320-568-bottom.png)
- [Desktop](../test-results/screenshots/navigation-1280-800-top.png)
- [Dark theme](../test-results/screenshots/navigation-360-dark.png)

Validation used headless Playwright Chromium on Windows with emulated viewport sizes and synthetic native touch input. Physical Android/iOS devices, browser toolbar transitions, hardware safe-area insets, screen-reader speech output, Firefox, Safari/WebKit and installed Edge/Chrome were not tested. No remaining issue was observed in the tested configuration.
