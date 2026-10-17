# Individual electric fields at probe A

Implemented and validated locally on 17 October 2026. No commit, push or deployment was performed.

## Files

| File | Change |
| --- | --- |
| `src/app.js` | Electric Field toggle, accessible vector selector, live expandable breakdown and superposition explanation |
| `src/field-vectors.js` | Presentation data from the existing field engine, common arrow scale, vector styling and collision-aware labels |
| `src/render.js` | Electric Field overlay integration; existing rendering restored when disabled |
| `src/styles.css` | Scoped compact controls, theme colours and responsive numerical entries |
| `tests/physics.test.js` | Eight new independent numerical and geometry regressions; existing tests retained |
| `tests/browser/individual-fields.spec.js` | Nineteen new browser tests, actual canvas inspection and screenshots |
| `docs/INDIVIDUAL_FIELDS_VALIDATION.md` | This report |

The physics engine, presets, learning activities, other tabs, title, topic navigation, dependencies, build configuration, GitHub and hosting configuration are unchanged. No syllabus branding was added.

## Interface and interaction

**Show Individual Fields** is a labelled native checkbox below the existing compact charge control, exclusively in Electric Field. Its enabled state persists when switching topics or changing/resetting presets. Toggling it changes visualization only. Disabling it restores the original canvas exactly, verified by a browser comparison of the canvas image data, and hides the added numerical panel.

Enabled mode provides one source arrow per existing charge plus the resultant. Stable charge IDs determine labels and styles: q1 → E₁ (blue, solid), q2 → E₂ (orange, dashed), q3 → E₃ (purple, short dashes), q4 → E₄ (magenta, dash-dot). The resultant Eᴿ is thicker and teal. Each colour has a light/dark variant. Removing q2 while q3 remains leaves E₃ associated with q3; identities are never renumbered to fill a gap.

One, two, three and four charges therefore produce two, three, four and five vector entries, respectively. Zero-valued fields retain their entries and numerical values but have no arbitrary direction arrow. At the symmetric midpoint of two equal positive charges, E₁ and E₂ remain nonzero and opposing while Eᴿ is explicitly labelled **0 N/C**.

The compact, horizontally scrollable vector selector offers **Show All**, each existing source and **Eᴿ**. Selecting an entry emphasizes and draws that vector last while dimming the other overlays; it does not change physics or numerical results. Labels, line patterns, source identities and numerical entries provide identification beyond colour, including for coincident/collinear arrows. All selector buttons and the checkbox label have targets at least 44 px high. Native keyboard operation and pressed states are preserved.

The **Individual Electric Fields** section is collapsed on first enable. It sits in the existing learning column, outside the canvas. Every entry includes source identity, signed charge, source-to-A distance, magnitude, direction and signed horizontal/vertical components. The resultant includes symbolic component sums, components, magnitude and direction. Values are refreshed after source/probe dragging, magnitude or polarity edits, adding/removing sources, presets, guided investigations and reset. Zoom/resize changes the drawing without changing numerical values.

The existing **FIELD AT A** and **DIRECTION** display stays intact. The Calculations panel retains its existing working and adds an eight-step superposition explanation. It distinguishes source contributions from Cartesian components, adds signed x/y components rather than scalar magnitudes, and shows the current source-only vector sum using native MathML arrow notation in the existing equation styling. Directions use the existing atan2 convention, including equivalent negative angles such as −180° for a leftward vector.

## Physics and drawing

Presentation data comes directly from `fieldAt`, `magnitude` and `direction` in the existing SI engine. No alternative field law, force softening, physical rounding or new physics cutoff was introduced. Every arrow begins at the screen projection of the same physical probe A; screen y is inverted from physical y without changing the vector direction.

All arrows at A use one linear scale:

`length in pixels = magnitude in N/C × common scale`.

The initial maximum length is `min(140 px, 0.30 × min(canvas width, canvas height) × zoom)`. Divide it by the largest magnitude among all source contributions **and the resultant**, then reduce the single scale if necessary to fit arrow tips inside the visible canvas. The reduction applies to every vector, preserving ratios. Arrowheads shrink for very short arrows. Background vector-grid arrows retain their original normalized visualization and are described separately in Calculations.

Canvas labels avoid source/probe symbols, charge labels, canvas edges and each other. Preferred positions are near arrow tips; crowded cases use the nearest clear fallback location. Only text positions move. Arrow origins, directions and relative lengths do not move to separate overlapping vectors. Existing field-line/grid rendering and its background cache remain in use. Overlay updates use the existing coalesced animation-frame redraw, without new scroll listeners or dependencies.

## Validation

| Check | Result |
| --- | --- |
| `npm.cmd test` | **44/44 passed**: all 36 existing physics/learning tests plus eight new feature tests |
| `npm.cmd run test:browser` | **45/45 passed**: all 26 existing browser tests plus nineteen new feature tests |
| `npm.cmd run build` | **Passed**, using the unchanged `dist/` output |
| `git diff --check` | Passed |

Independent references cover E₁–E₄, positive/negative direction, vector component sums, resultant magnitude/direction, off-axis 3–4–5 geometry, polarity reversals, probe movement, source counts, nonsequential IDs, zero resultant and zero source contributions. A separate geometry test verifies that every arrow shares A and exactly the same linear scale, including after zoom and near canvas boundaries. Input mutation and changes to the existing engine result are rejected by tests.

Browser checks inspect actual canvas strokes and text, rather than relying only on CSS or the new model. They verify common origins against the rendered probe, expected endpoint directions, relative lengths, line patterns, resultant prominence, all expected labels and suppression of the zero-resultant arrow. Canvas floating-point coordinates are compared separately from CSS-rounded object button coordinates.

Other browser checks cover source addition/removal, stable source mapping, guided presets, reset, source/probe touch dragging, polarity/magnitude inputs, visualization-only toggling, exact baseline restoration, zoom, orientation/resize, tab-specific state, keyboard selection, sticky navigation, both themes, and absence of page-wide horizontal overflow or uncaught browser/console errors. Existing regression coverage for the other three tabs remains passing.

## Screenshots and limitations

Rendered workspace and expanded-breakdown screenshots were inspected at each viewport, in **both light and dark themes**:

- 320 × 568
- 360 × 640
- 390 × 844
- 430 × 932
- 768 × 1024
- 1280 × 800
- 844 × 390 (landscape)

There are **31 new screenshots**: 28 viewport/theme/workspace-or-detail combinations plus 320 px symmetry, four-source emphasis and four-source resultant examples. The canvas height is unchanged by toggling. Numerical panels stay outside the workspace, equations remain readable at 320 px, source/probe dragging remains unobstructed, and sticky topic navigation remains usable above the expanded detail. The vector selector scrolls within its own row when all entries cannot fit.

Representative local artifacts:

- [390 px light workspace](../test-results/screenshots/fields-390-844-light-top.png)
- [390 px dark workspace](../test-results/screenshots/fields-390-844-dark-top.png)
- [320 px numerical breakdown](../test-results/screenshots/fields-320-568-light-details.png)
- [Opposing fields with zero resultant](../test-results/screenshots/fields-320-symmetry.png)
- [Four sources with E₃ emphasized](../test-results/screenshots/fields-320-four-selected.png)
- [Four-source vector equation and resultant](../test-results/screenshots/fields-320-four-resultant.png)
- [Desktop](../test-results/screenshots/fields-1280-800-light-top.png)

Artifacts are in the Git-ignored `test-results/screenshots/` folder and regenerate with the full browser suite. No screenshot binaries are added to the source repository.

Validation used headless Playwright Chromium on Windows, with emulated viewport sizes and native touch event injection. Physical Android/iOS devices, installed browser applications, Firefox, Safari/WebKit, screen-reader speech, browser toolbar transitions and hardware safe-area insets were not tested. Very small contributions can be subpixel when the common scale must accommodate a much larger vector; their numerical values and selectable entries remain available. At zoom levels that move A outside the canvas, the overlay is clipped with the existing workspace; zoom out to bring A back into view. No remaining regression was observed in the tested configuration.
