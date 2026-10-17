# Verified equipotential zero display

Implemented locally on 18 October 2026. No commit, push or deployment was performed.

## Files changed

| File | Change |
| --- | --- |
| `src/equipotential.js` | Verifies current shared attachments and actual alignment; returns separate display values alongside unchanged raw measurements |
| `src/equipotential-ui.js` | Uses verified display values in the comparison and optional working; updates guided instructions; reports unverified alignment |
| `src/app.js` | Uses the same display result for the Electric Potential live difference, calculation, energy change and field work |
| `tests/equipotential.test.js` | Nine additional numerical regressions, including the 160 kV screenshot residual and failure cases |
| `tests/browser/equipotential.spec.js` | Two additional browser regressions and stronger consistency assertions in existing responsive, sliding and guided-activity tests |
| `docs/VERIFIED_ZERO_VALIDATION.md` | This report |

This follow-up supersedes the residual-display and comparison-tolerance descriptions in the original `EQUIPOTENTIAL_SNAP_VALIDATION.md`. It does not change contour projection or the physics engine.

## Cause and implemented conditions

The solver independently projects A and B onto a potential level using finite-precision coordinates and a bounded stopping tolerance. Subtracting their computed potentials can leave a tiny nonzero difference even when both projections are valid. This residual is retained internally.

Zero display requires all of the following, checked against the current positions on every comparison:

1. Both probes have attachments with exactly the same finite assigned potential level. Successful **B → Same Potential as A** creates these attachments; its historical demonstration flag alone cannot authorize zero.
2. Snapping and contours are enabled, and both attachments belong to the current source/field configuration.
3. Both probe positions remain valid and clear of source singularities.
4. Each actual potential differs from its assigned level by no more than the solver's stopping tolerance, `T(Vc)/8`.
5. The actual finite raw difference satisfies `|VB − VA| ≤ εV`.

Only then does the separate display result contain positive numeric zeros for ΔV, ΔU and W_field. VA and VB themselves retain their computed values. The live results, mathematical substitution, energy/work calculation, comparison and optional movement working all consume these display values. The guided activity explains the same verified zero result.

Detaching either probe immediately removes its proof of shared attachment. The ordinary raw difference is displayed, including tiny signed differences. Moving apart, disabling snapping, hiding contours, changing levels, stale field associations and failed alignment cannot retain a previous zero. Attached but unverified equality displays actual measurements with an alignment status. Existing failed-projection release/status behavior is preserved.

## Tolerance and justification

The unchanged projection algorithm uses:

`T(Vc) = max(10^-7 V, 10^-11 × |Vc|)`

and stops at `T(Vc)/8` per probe. Two independently projected positions therefore have a paired error budget of `T(Vc)/4`. The display threshold is:

`εV = max(2.5 × 10^-8 V, 2.5 × 10^-12 × max(|VA|, |VB|))`.

The absolute floor covers the existing solver's near-zero stopping budget. The relative term covers its large-potential budget. This is eight times stricter than the previous comparison threshold. At 160 kV it is **4 × 10^-7 V**, while each probe must independently align within **2 × 10^-7 V**. The suggested 10^-9 V / 10^-12 relative rule was not adopted because it is stricter than the existing solver's guaranteed paired stopping budget; adopting it universally would reject some valid projections without improving the underlying solution.

The threshold is justified for this solver and guarded attachment context, not a general rule for electrical measurements. It never classifies arbitrary free probes as equipotential.

## Raw physics preservation

`src/physics.js`, constants, potential/field equations, energy functions and projection calculations are unchanged. `potentialComparison` still returns raw `va`, `vb`, `dv`, `du` and `work`; its additional `display` object contains the normalized presentation. Raw diagnostic values remain available in the comparison element's data attributes, without appearing as contradictory student-facing residuals.

The screenshot-equivalent numerical fixture evaluates the actual potential equation at 160 kV and reproduces a raw difference near **2.037268 × 10^-10 V**. It verifies exact display zeros while raw ΔV, `qΔV`, `−qΔV`, coordinates and source state remain unchanged. Tests also cover positive/negative sources and test charges, mixed polarity, three/four sources, full-circle sliding, ±80 kV level changes, either detachment, tiny signed free-probe differences, stale associations and excessive projection errors. A shared off-contour drift with a tiny mutual difference is specifically rejected.

## Validation results

- `npm test`: **78 passed**, including all existing physics, learning and equipotential tests plus nine new regressions.
- `npm run test:browser`: **69 passed**, including all 67 existing browser regressions plus two new cases. Existing tests now assert exact zero consistently across the main readout, energy/work calculation, comparison, optional working and guided setup.
- `npm run build`: passed.
- `git diff --check`: passed.

Responsive coverage: **320×568, 360×640, 390×844, 430×932, 768×1024, 1280×800 and 844×390**, each in light and dark themes. Checks cover no horizontal overflow, unchanged canvas height, 44 px buttons, sticky navigation, mouse/touch dragging, keyboard sliding, independent detach, custom-contour recapture, precise inputs and state persistence across tabs.

Screenshots are generated under `test-results/screenshots/`: 28 viewport/theme attached/detached images, the 160 kV example (`zero-160kv-390.png`), and four optional-working/activity/negative/recapture images. Four supplementary 320 px captures show the comparison and actual-current-position working in both themes (`zero-320-comparison-*.png`, `zero-320-working-*.png`). All 37 images were visually reviewed and confirm compact, legible zero readouts and preserved responsive layout. No controls, CSS, workspace dimensions or hosting configuration were added or changed.

## Remaining limits

This is a display equivalence within a numerical error budget, not exact equality of floating-point coordinates. Severe cancellation, ill-conditioned fields, unavailable contours or residuals above the checks remain unverified and display ordinary measurements. Exact level identity is deliberate; nearly equal but differently assigned levels are not normalized. After detachment, raw zero remains zero if the engine computes it exactly, and any nonzero residual is shown normally.

Browser validation uses headless Chromium with viewport and touch emulation; physical mobile devices and other browser engines were not tested. Existing constraints on singularities, visibility and local contour continuation remain unchanged.
