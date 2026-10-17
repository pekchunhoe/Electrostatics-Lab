# Equipotential snapping, sliding and detachment

Implemented locally on 17 October 2026. No commit, push or deployment was performed.

## Files changed

| File | Change |
| --- | --- |
| `src/equipotential.js` | Shared contour geometry, numerical projection, attachment state, independent release and same-potential placement |
| `src/equipotential-render.js` | Highlighted contour branches, attachment squares and labelled potential badges |
| `src/equipotential-ui.js` | Compact controls, actual comparison/residual readout, optional explanation and guided activity |
| `src/app.js` | Electric Potential integration with mouse, touch, keyboard, precise inputs, source edits and resets |
| `src/render.js` | Reuses shared contour geometry and adds the attachment overlays |
| `src/styles.css` | Scoped control, status and explanation styles |
| `tests/equipotential.test.js` | 25 independent numerical/interaction tests |
| `tests/browser/equipotential.spec.js` | 22 browser tests and screenshot capture |
| `package.json` | Adds the new numerical test file to `npm test`; build scripts and dependencies unchanged |
| `docs/EQUIPOTENTIAL_SNAP_VALIDATION.md` | This report |

The physics engine and constants, presets, existing learning activities/challenges, individual electric-field overlay, other three tabs, title, sticky topic navigation and hosting configuration remain unchanged. The new activity is added inside the existing Electric Potential Guided investigations section.

## Magnetic interaction

**Snap to Equipotential** starts OFF. When enabled, free probes capture a visible contour within **24 CSS pixels**, using the current physical-to-screen conversion, zoom and viewport dimensions. Enabling snapping also makes the contour layer visible. It does not move either probe by itself.

The existing concentric-circle and marching-triangle contours now share geometry with the interaction. This keeps the target levels and visible lines consistent. Geometry supplies nearby candidate seeds; the actual electric-potential equation determines the accepted physical position. Candidates are compared using their refined distances, rather than treating every sampled chord as exact. This supports one to four sources, signed/mixed charges, open/closed contours, multiple components and the existing ideal uniform-field potential example.

Attached probes remain on their assigned level and connected contour branch while sliding. Drag updates use local continuation, with at most 60 CSS pixels of candidate travel per pointer event. An attached probe cannot switch to a neighbouring potential level just because another line becomes closer. Source edits attempt to preserve the assigned potential at a solution within 24 CSS pixels. A local contour-seed fallback handles an old position at a zero-gradient saddle. If no stable nearby solution remains, the probe releases with an explanation instead of jumping to a distant loop.

Selected branches receive a contrasting highlight. Probes have dashed square attachment indicators and A/B potential badges where a clear label position is available. The compact controls always identify attached probe potentials, independently of canvas label placement. No flashing or animation was introduced.

## Projection and accuracy

The solver evaluates the unchanged SI potential engine:

`V(x,y) = Σ kqᵢ/rᵢ`, with `∇V = −E` from its field sampler.

It uses damped Newton correction along the gradient, bounded steps, a local trust region and backtracking that must reduce the actual potential residual. It rejects singular/invalid points, offscreen projections, nonfinite values and failed convergence. A maximum of 40 iterations bounds a solve. Candidate-seed corrections are limited to 8 CSS pixels, with 4 CSS pixel steps. Sampled geometry is never accepted as sufficient proof of the potential value.

The documented per-probe acceptance tolerance is:

`T(Vc) = max(10⁻⁷ V, 10⁻¹¹ × |Vc|)`.

The solver stops at `T(Vc)/8`, providing margin for the two-probe comparison. The absolute floor handles levels near zero; the relative term allows robust floating-point convergence at larger potentials while remaining far below the displayed significant-figure resolution. The comparison tolerance is `T(VA) + T(VB)`. For two 80 kV points this is 1.6 × 10⁻⁶ V.

All displayed potential differences and energy/work values come from actual positions. The ordinary live results and existing Calculations working are not clamped to zero. The new result states **≈ 0** only when the actual difference is within the stated comparison tolerance and explicitly displays the computed residual, energy change and field work. Moving a detached probe to another potential changes the result to **Different Potentials**. The comparison stays live after a demonstration, including one started by manually attaching both probes.

Energy and work remain the existing formulas, `ΔU = q₀ΔV` and `W_field = −ΔU`. No alternate physical model, artificial source softening, potential-label substitution or zero-forcing was introduced.

Independent supplementary measurements at a 400 × 360 CSS-pixel numerical viewport:

| Measurement | Observed maximum |
| --- | --- |
| Absolute VB − VA across six Same Potential examples: positive, negative, equal, opposite, triangle and square | 1.1642 × 10⁻¹⁰ V |
| Corresponding absolute ΔU and W_field at q₀ = 2 nC | 2.3284 × 10⁻¹⁹ J |
| Assigned-level residual over 73 positions around a complete circular contour | 1.7390 × 10⁻⁸ V |

These are measured examples, not a universal error bound. The acceptance and comparison tolerances above govern all configurations. Browser tests also independently reconstruct the two-positive-charge potentials from the full-precision probe coordinates and the analytical inverse-distance expression.

## Independent detachment and free movement

**Detach A** and **Detach B** act independently, immediately clearing only that attachment without changing either probe position. After explicit detachment, recapture of the released contour is inhibited until the probe leaves its **28 CSS pixel** release band. This lets students drag away without being pulled straight back. The inhibition applies to the released contour, rather than every contour in a densely spaced region. A fresh approach can then capture a contour again.

Switching snapping **OFF** clears both attachments, preserves both physical positions and restores ordinary 2D movement inside the existing coordinate limits. No projection is applied while OFF. Turning it back ON permits a fresh capture. Precise coordinate edits release the edited probe so the entered coordinates are respected. The explicit Same Potential action is also available for reattachment.

## Same Potential demonstration and learning

**B → Same Potential as A** reads A's actual potential (or its assigned level when attached), constructs the corresponding contour if it is not a preset level, and finds a distinct visible valid position for B on A's connected component. The point is chosen near B and at least 26 CSS pixels from A. A remains at its existing physical position. On success the action enables snapping/contours, attaches both probes, highlights the common branch and opens Calculations without scrolling away from the diagram.

A custom highlighted contour also becomes a magnetic target for a free probe. A dedicated touch regression verifies detaching B, leaving the capture band and rejoining A's custom contour by dragging. If no distinct point can be found in the visible valid domain, the button explains the limitation and leaves B and the switches unchanged.

The optional **Movement Along an Equipotential** section distinguishes the ideal equal-potential/zero-work equations from the actual current numerical values. It explains perpendicular fields, tangential motion, nonzero field strength on an equipotential, and zero quasistatic external work when ΔU is zero. Its expanded state survives live updates.

The new **Zero Work Along an Equipotential** activity appears inside Guided investigations. It presents a conceptual prediction before a separately revealable explanation, offers a two-positive-charge setup button, and provides the requested workflow: attach, match, slide, observe, detach, move to a different potential and compare work. Existing guides and challenges are retained.

## Validation results

| Check | Result |
| --- | --- |
| `npm.cmd test` | **69/69 passed**: all 44 previous physics/learning/individual-field tests plus 25 new equipotential tests |
| `npm.cmd run test:browser` | **67/67 passed**: all 45 previous browser tests plus 22 new equipotential tests |
| `npm.cmd run build` | **Passed**, using the unchanged `dist/` output |
| `git diff --check` | Passed |

Numerical coverage includes independent positive/negative circular references, equal-radius potential equality, correct distance after snapping, complete curved sliding, both independent releases, OFF/free motion, nonzero work between different contours, mixed-polarity open contours, noncircular two-source contours, three/four-source arrangements, disconnected branches, small source movement, saddle continuation, unavailable levels/points, singularity rejection, viewport/coordinate boundaries, zoom, uniform/constant potentials and unchanged engine results.

Browser coverage includes actual mouse and touch capture/sliding, independent release, departure and recapture, custom-level recapture, full-precision coordinate checks, source dragging and precise edits, source polarity loss, addition/removal, resets, unavailable-point feedback, singular input rejection, keyboard controls/probe movement, source-independent tab state, individual-field feature preservation, optional explanations, guided activity, sticky navigation and both themes. Controls retain approximately 44 px minimum targets and the canvas height is unchanged by the feature. Potential coordinate inputs retain full numerical precision after projection.

## Screenshot inspection and limits

Attached and independently detached states were rendered and inspected in light and dark themes at:

- 320 × 568
- 360 × 640
- 390 × 844
- 430 × 932
- 768 × 1024
- 1280 × 800
- 844 × 390 (landscape)

There are **32 new screenshots**: 28 viewport/theme/attachment combinations plus the mathematical explanation, guided activity, negative-source example and custom-contour recapture. The full suite also regenerates the existing simulation, field-vector and navigation screenshots. No page-wide horizontal overflow or uncaught browser errors were observed in the successful validation run. Labels remain inside the canvas; potential labels that cannot fit beside a crowded probe remain available in the controls. The primary controls remain outside the unchanged canvas and contextual release/results appear only when relevant. Sticky navigation remains functional during page scrolling.

Representative local screenshots:

- [390 px attached](../test-results/screenshots/snap-390-844-light-attached.png)
- [390 px B detached](../test-results/screenshots/snap-390-844-light-detached.png)
- [320 px dark attached](../test-results/screenshots/snap-320-568-dark-attached.png)
- [Desktop attached](../test-results/screenshots/snap-1280-800-light-attached.png)
- [Zero-work explanation](../test-results/screenshots/snap-320-working.png)
- [Guided activity](../test-results/screenshots/snap-320-activity.png)
- [Custom contour reattachment](../test-results/screenshots/snap-390-recaptured.png)

Artifacts live in the Git-ignored `test-results/screenshots/` directory and regenerate with the full browser suite. No screenshot binaries are added to the repository.

Tests used headless Playwright Chromium on Windows with emulated viewports and native touch-event injection. Physical Android/iOS devices, installed Chrome/Edge, Firefox, Safari/WebKit, screen-reader speech, mobile browser-toolbar transitions and hardware safe-area insets were not tested. Contour drawing remains sampled; the numerical attachment is more accurate than the drawn chord. Very small, offscreen or ill-conditioned contours can be unavailable for a distinct touch-separated probe or stable local projection; these cases report a limitation or release gracefully. Existing zoom can move probes outside the canvas until the student adjusts zoom. Detachment uses the explicit controls and switch; an optional pull-away release gesture was not added. No remaining regression was observed in the tested configuration.
