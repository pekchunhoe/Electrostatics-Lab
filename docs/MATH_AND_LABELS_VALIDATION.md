# Mathematical notation and interface cleanup

Local implementation and validation, 20 October 2026 (Asia/Kuala_Lumpur).

The existing application was updated in place. Numerical physics, motion propagation, field geometry, snapping, collisions, timers, routes and deployment configuration were preserved.

## Files changed

Application:

- `src/app.js`: clean shared heading, calculation integration, formatted learning content, incremental updates and recovery after invalid probe positions.
- `src/math.js` (new): safe local MathML rendering, scientific quantities, SI units, accessible spoken equivalents, bounded equation cache and DOM patching.
- `src/educational-math.js` (new): explicit typesetting of authored investigation, challenge and hint equations.
- `src/point-math.js` (new): Coulomb force, electric field and potential worked solutions.
- `src/motion-math.js` (new): force selection, regional equations, substitutions, results and motion explanations.
- `src/motion-ui.js`: connect calculations to the instantaneous particle state; conditional legends; accurate equilibrium labels; preserve disclosure state.
- `src/motion-render.js`: draw real subscripts in force labels without changing arrow vectors.
- `src/potential-model-ui.js`: unnumbered plate calculations and activities; typed potential, energy and work equations.
- `src/equipotential-ui.js`: native math for ideal conditions and actual measured differences.
- `src/learning.js`: replace a gravity question in magnetic mode with a question about the active plate field; require nonzero charge for a unique crossed-field balancing speed.
- `src/presets.js`: descriptive experiment labels; retain preset identifiers and values.
- `src/styles.css`: compact native-math typography, local equation scrolling and readable text fallback.
- `package.json`: include the new equation tests in the existing numerical test command.

Validation:

- `tests/math.test.js` (new): nine mathematical-rendering and independent physics/equation regressions.
- `tests/browser/math.spec.js` (new): seventeen responsive, content, state synchronization and DOM stability tests.
- `tests/browser/math-assertions.js` (new): equation assertions for native MathML.
- `tests/equipotential.test.js`, `tests/browser/equipotential.spec.js`, `tests/browser/potential-models.spec.js`, `tests/browser/lab.spec.js`, `tests/browser/magnetic-motion.spec.js`: retain physical checks while adapting assertions to the new notation and canvas subscripts.
- `scripts/benchmark-math.mjs` (new), [math-performance.json](math-performance.json), this report and [screenshots](screenshots/math-notation/).

No existing tests were deleted. No numerical tolerance was relaxed.

## Academic label audit

| Previous student-facing text | Updated text |
| --- | --- |
| CHAPTER 01 · INTERACTIVE LAB | INTERACTIVE LAB |
| 1 · Given quantities | Given Quantities |
| 2 · Field, forces and net acceleration | Field, Forces and Net Acceleration |
| A / B / C / D experiment prefixes | Initially Stationary / Perpendicular Launch / Parallel Motion / Dynamic Equilibrium |
| Part A · Point Charges | Point Charges |
| Part B · Parallel Plates | Parallel Plates |
| “syllabus calculation” | “system-energy calculation” |

Source and rendered-page audits check SP025, SP015, semester/chapter/subtopic numbers, topic numbers and decorative heading/experiment prefixes. These do not appear in the tested student interface, including expanded controls, calculations, guided content, challenge feedback, hints and help/theme controls. Labels were changed at their rendering sources; CSS does not conceal old text.

Internal curriculum documentation, package name, tab/preset IDs, routes, test selectors and physics parameters remain intact. E₁–E₄, charge identities, component subscripts, source-count limits, actual procedural lists and all scientific values remain meaningful and available.

## Rendering and presentation

The existing native MathML approach was extended. No runtime dependency, CDN, remote font or script was added. Security headers and hosting configuration were not modified.

Worked solutions now use real fractions, subscripts, superscripts, vector arrows, magnitudes, Greek letters, summations, cross/dot products, scientific notation and upright SI units. For example, acceleration uses m s⁻² and field strength uses N C⁻¹. Scalar magnitudes are distinguished from vector quantities. Conventional compact units remain in controls and live badges.

Panels retain their existing cards, colours, responsive arrangement and disclosures. Governing principles, substitutions, calculated results and interpretations have descriptive headings. Initial motion values, kinematics and equilibrium extensions can be expanded. Long substitutions are split where practical; an unavoidable long equation scrolls within its own line. The existing desktop calculation scrollbar remains available.

Coulomb calculations identify the force on target i due to source j and use displacement from j to i. Field calculations retain the eight-step component method and E₁–E₄ identities. Potential calculations preserve signed superposition and distinguish quasistatic external work from work done by the field. The ideal uniform-potential example now displays its uniform-field equation rather than an unrelated point-source sum.

## Active-force validation

| Configuration | Current governing behavior | Independent reference/check |
| --- | --- | --- |
| Perpendicular Launch, default forces | F⃗net = qE⃗; a⃗ = qE⃗/m; scalar a = \|q\|E/m | 300 / 0.080 = 3750 N C⁻¹; electric force 3.75 × 10⁻⁶ N; acceleration 3.75 m s⁻² |
| Negative charge / reversed polarity | Signed components reverse appropriately | Each reversal independently changes the acceleration sign |
| Gravity balancing | F⃗net = qE⃗ + mg⃗ | Horizontal reference balances upward electric force and weight; vertical reference gives (9.81, −9.81) m s⁻² |
| Magnetic balancing | F⃗net = qE⃗ + q(v⃗ × B⃗) | E = 100 N C⁻¹, B = 0.2 T and correctly directed speed 500 m s⁻¹ balance; instantaneous components also checked |
| B = 0 | Lorentz contribution is zero; finite balancing-speed expression is withheld | Explicit unavailable message; no E/B evaluation as a valid balancing speed |
| Electric-only field exit | E⃗particle = 0; F⃗net = 0; a⃗ = 0 | Engine state and displayed result agree after exit |
| Gravity field exit | F⃗net = mg⃗; a⃗ = g⃗ | Downward acceleration remains −9.81 m s⁻² |
| Magnetic field exit | F⃗net = q(v⃗ × B⃗) | B and curved motion continue outside the electric region; signed force/acceleration components agree |
| Plate impact | Absorbing contact gives zero net acceleration | Contact constraint is explained separately from the flight model |

No obsolete external-force term is shown in Dynamic Equilibrium. Legitimate external-force controls in the other experiments remain functional, with a force term shown only when enabled and nonzero. Optional gravity in those experiments is also conditional.

The general magnetic magnitude uses |q|vB sin θ. The screen-plane simplification is explicitly justified for nonzero speed and magnetic field. Equilibrium speed is conditional on nonzero charge, B > 0 and the required velocity direction. Constant-acceleration equations use each flight segment’s start state and elapsed time; they are not applied across field boundaries or to magnetic trajectories.

Equilibrium status now follows the solver’s actual zero acceleration. A new regression proves that a small real acceleration cannot be called balanced by a wider presentation tolerance. No solver cancellation threshold or physical calculation changed.

## Test results

- `npm test`: **202 passed, 0 failed** — all 193 existing numerical/learning tests and nine new equation tests.
- `npm run test:browser -- --reporter=line`: **190 passed, 0 failed**, in 9.1 minutes with the repository's original single-worker configuration (173 existing cases plus 17 new cases).
- Targeted browser recheck after the final zero-charge challenge guard: **1 passed, 0 failed** (`math.spec.js`, gravity/Lorentz/field-exit synchronization case).
- `npm run build`: **passed**, static application generated in `dist/`.
- `git diff --check`: **passed**.

The browser suite covers all four tabs, preset/experiment selection, E₁–E₄, field lines, equipotential snapping/sliding and verified zero work, both potential models, guided activities and challenges, force arrows, quantitative magnetic trajectories, field exit/re-entry, collisions, Play/Pause/Step/Reset/Replay, physical timer stopping, themes, keyboard navigation and sticky tabs.

New tests check actual MathML structures, readable SI exponents, accessible equation labels, unwanted academic labels, full page/card width, equation line height, live parameter changes, inactive force exclusion, B = 0, field exit, tiny genuine imbalance, restoration after invalid input and retained equation/focused disclosure nodes.

An earlier complete run passed 189 of 190 cases; one Chromium full-page screenshot capture timed out after the mathematical and overflow assertions passed. The capture was changed to an actual viewport around the equation. An exploratory two-worker run also exceeded an existing fake-clock test's time budget under concurrent load. The final complete run used the original single-worker configuration and passed every case. Assertions, numerical tolerances and existing time limits were retained.

## Responsive screenshot review

All four tabs are audited at each size below in both themes. The maintained evidence directory contains 36 screenshots, including heading/workspace views, calculation views and gravity/magnetic examples. The final browser run also records per-tab equation screenshots under `test-results/screenshots/math/`.

| Viewport | Light calculation view | Dark calculation view |
| --- | --- | --- |
| 320 × 568 | [Light](screenshots/math-notation/320-568-light-calculations.png) | [Dark](screenshots/math-notation/320-568-dark-calculations.png) |
| 360 × 640 | [Light](screenshots/math-notation/360-640-light-calculations.png) | [Dark](screenshots/math-notation/360-640-dark-calculations.png) |
| 390 × 844 | [Light](screenshots/math-notation/390-844-light-calculations.png) | [Dark](screenshots/math-notation/390-844-dark-calculations.png) |
| 430 × 932 | [Light](screenshots/math-notation/430-932-light-calculations.png) | [Dark](screenshots/math-notation/430-932-dark-calculations.png) |
| 768 × 1024 | [Light](screenshots/math-notation/768-1024-light-calculations.png) | [Dark](screenshots/math-notation/768-1024-dark-calculations.png) |
| 1280 × 800 | [Light](screenshots/math-notation/1280-800-light-calculations.png) | [Dark](screenshots/math-notation/1280-800-dark-calculations.png) |
| 844 × 390 | [Light](screenshots/math-notation/844-390-light-calculations.png) | [Dark](screenshots/math-notation/844-390-dark-calculations.png) |

The [desktop reference screenshot](screenshots/math-notation/1280-800-light-calculations.png) shows both reported issues resolved together: the heading is INTERACTIVE LAB, the descriptive main title remains, and Perpendicular Launch shows the electric-only vector acceleration. The live strip reads 3.75 m/s². [Gravity](screenshots/math-notation/390-light-gravity.png) and [magnetic](screenshots/math-notation/390-dark-magnetic.png) screenshots demonstrate the alternative active-force equations.

Actual screenshots were inspected for equation layout, fraction/subscript readability, contrast and preserved navigation. Overflow assertions check the full document and calculation card; long expressions remain locally scrollable. A screenshot’s bottom edge is the normal viewport boundary, not a clipped calculation card.

## Accessibility and performance

Native MathML includes accessible spoken labels and authored formula annotations. A text fallback is available for browsers without native math-style support. Disclosures keep native keyboard behavior, and a browser regression verifies that focus and stable governing equations survive live updates. Direction is explained in words and signed components, without relying on colour alone.

Equation templates use a bounded cache and numeric changes patch existing DOM nodes. The full-page application is not rebuilt per animation frame. In each benchmark case, governing-equation identity survived all 119 subsequent frames after its initial creation.

The [benchmark](math-performance.json) measures physics, equation generation, incremental DOM updates, canvas drawing and synchronous layout: 20 warmup plus 100 measured frames per case, at 390- and 1280-pixel widths. Median cost was 1.6–3.8 ms; 95th-percentile cost was 2.1–6.3 ms on desktop Chromium. This is a local measurement without CPU throttling, not a guarantee for every phone.

## Limits and release status

- Browser validation uses installed Chromium and emulated viewport sizes; separate Safari/Firefox and physical-device runs were not performed.
- Screen-reader labels and keyboard behavior were checked structurally/in-browser; a human assistive-technology session was not available.
- The authored notation renderer intentionally supports the expressions used here, rather than arbitrary full TeX input.
- The supplied attachment contained the implementation prompt, without the two original image files. Their described issues were traced to source and checked using fresh screenshots.
- Existing numerical engines, constants and parameters remain unchanged. Useful internal academic metadata remains internal.
- **No commit, push or deployment was performed.**
