# Implementation and validation report

Date: 17 October 2026 (Asia/Kuala_Lumpur).

## Implementation

The workspace initially contained no repository, source files, framework, build system or tests. No unrelated code was removed. A small, self-contained ES-module application was created using Canvas 2D and semantic HTML controls. The supplied curriculum page was read and visually checked before curriculum coverage was finalized; see [the complete outcome table](CURRICULUM.md).

All four principal tabs are interactive and use Combined Learning Mode. Calculations follow given values → equation → substitution → calculation → answer and interpretation. Mathematics uses Unicode symbols, superscripts/subscripts and the browser's mathematical font stack; no network font or mathematical rendering dependency is required.

| Tab | Completed features |
| --- | --- |
| 1.1 Coulomb's Law | Signed editable point charges, maximum four, drag/keyboard/exact coordinates, target selection, per-source distances and forces, resultant and angle, component vectors, free-body diagram, five multi-charge arrangements plus single-source examples, add/remove, selected reset and preset reset |
| 1.2 Electric Field | Signed sources, probe A, Eₓ/Eᵧ/magnitude/direction, per-source components, test-charge force, outward/inward RK4 field-line integration, line-arrow and vector-grid toggles, all seven source presets, guided zero-field hunt with stated tolerance |
| 1.3 Electric Potential | Four-source scalar potential, two probes, contours and optional colour map/field overlay, V_A/V_B/ΔV/ΔU, signed work explanation, up-to-three-source pair energy, isolated and uniform examples, zero-E/nonzero-V experiment |
| 1.4 Charge in a Uniform Electric Field | Four motion cases, signed plate voltage/separation, q and positive mass, initial position/velocity components, explicit gravity, electric/weight/velocity arrows, nonzero-velocity equilibrium, analytical trajectories, finite plate edges and absorbing impacts, Play/Pause/Step/Reset, trace, slow playback and clock |

Every tab has three guided investigations, and at least three challenges with predictions, hints and current-state explanations. Source presets and physical tab states are preserved across navigation. View changes do not modify physical coordinates. The help panel explains keyboard operation, normalized arrows, coordinate conventions and theme selection.

## Independent numerical verification

`npm test`: **36 tests passed**. References are checked against the independently specified numbers, not a second implementation sharing the same algorithm.

| Reference | Computed result | Supplied comparison | Result |
| --- | --- | --- | --- |
| A: ±1 μC, 0.10 m | 0.898755179 N, attractive and equal/opposite | 0.898755 N | Pass |
| B: +2 μC, 0.20 m | 449377.5896 N/C, outward | 449378 N/C | Pass |
| C: +1 μC at ±0.10 m, midpoint | E = 0; V = 179751.0358 V | E = 0; V = 179751 V | Pass |
| D: +2/−3 μC, 0.20 m | −0.2696265538 J | −0.269627 J | Pass |
| E: +2 nC, ΔV = −300 V | −6.000000 × 10⁻⁷ J | −6.0 × 10⁻⁷ J | Pass |
| F: 300 V, 0.020 m | 15000 V/m | 1.50 × 10⁴ V/m | Pass |
| G: perpendicular launch, 0.010 s | aᵧ = 15; x = 0.020; y = 0.000750; vᵧ = 0.150 (SI) | 15; 0.020; 0.000750; 0.150 | Pass |

Further independent checks cover signed reversal, doubling separation, non-axis-aligned 3-4-5 components, three/four-source sums, symmetry, negative potential, equipotential differences, three-pair system energy, zero test charge, stopping/reversal, equilibrium, impacts, exit continuity, gravity outside the field, field entry, travel above the plates, impacts from outside the gap, overflow, singularities, invalid values and reset isolation. The dense rendering sampler also has an independent numerical reference and immutable-snapshot check.

Tolerances: rounded supplied references use relative **2 × 10⁻⁶**, absolute **10⁻¹²**. Analytical identities use relative **10⁻¹¹**, absolute **10⁻¹²**. Challenge marking accepts **±2% or 10⁻¹⁰**, whichever is larger, and rejects blank/nonfinite input. The zero-field investigation declares a **1000 N/C** target. Source/probe separations below **10⁻⁹ m** are rejected explicitly; this is a singularity rejection threshold, not force softening. For force balance in motion only, cancellation residuals within **4 × Number.EPSILON** of the larger electric/gravity force are treated as zero to remove machine-roundoff drift. A test verifies that genuine small imbalances and tiny unbalanced forces survive. Other values are rounded only for display.

## Browser and responsive verification

`npm run test:browser`: **16 automated Chromium tests passed in 38.5 seconds**, covering all four tabs and every preset and challenge, plus interaction and diagram-layer regressions. The eight responsive tests were repeated after adding safe-area insets. `npm run build` also passed; the eight static application files total **75,877 bytes** uncompressed.

| Viewport | Four tabs / panels | Horizontal page overflow | Rendered screenshots |
| --- | --- | --- | --- |
| 320 × 568 | Pass | None | Captured |
| 360 × 640 | Pass | None | Captured |
| 390 × 844 | Pass | None | Captured |
| 430 × 932 | Pass | None | Captured |
| 768 × 1024 | Pass | None | Captured |
| 1280 × 800 | Pass | None | Captured |
| 1440 × 900 | Pass | None | Captured |
| 844 × 390, landscape | Pass | None | Captured |

The simulation appears immediately after the compact subtopic title. The narrowest phone uses a shorter canvas to fit live results and its primary control; larger phones allocate 44% of dynamic viewport height to the canvas. Tablets expand controls, and desktop uses controls / simulation / learning columns. Navigation remains sticky. A 44 px interaction target surrounds every draggable object, while visible source symbols stay small. Browser/page zoom remains available; pinch within the diagram changes only diagram zoom. Header, side, sticky-navigation and footer safe-area insets are supported; notch behaviour still needs real-device verification.

Checks include mouse dragging, actual Chromium touch events, two-finger pinch, sliders and numeric inputs, keyboard charge motion and tab navigation, expandable-panel shortcuts and closing, theme/help, all presets, all 20 challenge answers, zero-field measurements, source limits, singular probes, no displayed NaN/Infinity, independent tab state, physical-result invariance after resizing, play/pause, step, reset, positive-mass validation and equilibrium feedback. Browser tests collect uncaught errors in layout and preset/challenge loops and require none.

Screenshots are viewport captures, so dynamic-viewport layouts are inspected at the actual requested size. Earlier full-page screenshot attempts were unstable in the installed Chromium environment; viewport capture works consistently. Curated final examples are in `docs/screenshots/`. These tests emulate phones in Chromium; they are not tests on physical Android/iOS hardware.

Reviewed examples: [narrow phone](screenshots/mobile-force.png), [desktop](screenshots/desktop-force.png), [field](screenshots/mobile-field.png), [system potential](screenshots/mobile-potential.png), [isolated equipotentials](screenshots/isolated-potential.png), [uniform equipotentials](screenshots/uniform-potential.png), [force components](screenshots/force-components.png), [moving equilibrium with zero acceleration](screenshots/equilibrium.png), and [dark theme](screenshots/mobile-dark.png). The two detailed diagram/motion tests were also rerun after the safe-area update and passed.

## Performance and resource observations

No runtime packages, server calculations, external fonts, images, network APIs or telemetry are required. Only the browser test runner is a development dependency. The static build contains HTML, CSS and six small JavaScript modules. The renderer caps device pixel ratio at 2, limits field-line/grid/contour sampling, caches the expensive field/contour background while probes move, and schedules draw requests through requestAnimationFrame. Motion animation stops on pause, hidden documents, tab changes and plate impact. Reduced-motion preferences avoid animated scrolling; particle playback requires an explicit Play action.

`docs/performance.json` contains a reproducible synthetic desktop-Chromium benchmark at a 390 × 844 viewport and DPR 2. It separates cached/probe redraws from changed-source redraws. Cached redraw medians were 0.1–0.3 ms; changed-source medians were 0.2 ms for force, 12.9 ms for field, 12.6 ms for potential and 0.3 ms for motion. The potential rebuild's 95th percentile was 50.7 ms. Ten thousand four-source field evaluations took 25.8 ms. Source motion invalidates the layers and costs more than probe motion. Occasional expensive contour/field rebuilds mean a sustained 60 FPS guarantee is not established, particularly on slower phones. No physical Android CPU, memory or battery profiling has been performed.

## Limitations and scope

- No production deployment or production-readiness certification. This is a locally validated application.
- Chromium automation and screenshot inspection were performed. Safari, Firefox, real screen readers, physical mobile devices and very large OS text scaling remain untested.
- System/uniform contours and field-line paths are numerical visual approximations; live values use the unsmoothed analytical point-charge equations. Isolated-source contours are exact circles with radius k|Q|/|V|; other contours use 12 px cells. Field-line density is illustrative, not a calibrated representation of charge magnitude. Arrows are scaled for visibility and their physical values are supplied separately.
- The model uses ideal point sources, ideal finite parallel-plate regions, no fringing, and absorbing plate collisions. Equilibrium applies while the particle is inside the field; gravity remains after exit.
- States last for the current page session; no account, durable save, export or service-worker offline reload is included. The loaded application continues computing without connectivity.
- The user-facing in-app browser is unavailable in this environment, so the local preview could not be opened beside the chat. The application was served and tested at the local URL using Playwright.

## Full file inventory

All of the following are new files; there were no existing project files to modify.

| Files | Purpose |
| --- | --- |
| `index.html` | App entry, semantic shell, metadata and local module/style imports |
| `package.json`, `package-lock.json`, `.gitignore` | Reproducible development dependency, commands and generated-file exclusions |
| `src/physics.js` | Shared SI calculations, validation, field sampler and analytical event motion |
| `src/presets.js` | Independent tab defaults, source arrangements and four motion experiments |
| `src/learning.js` | Twelve guided investigations, twenty live challenges, numeric marking |
| `src/render.js` | Canvas diagrams, field lines, contours, arrows, traces and cached layers |
| `src/app.js` | Accessible controls, pointer/pinch/keyboard interaction, live working and playback |
| `src/styles.css` | Compact responsive layout, desktop columns, typography and light/dark themes |
| `scripts/server.mjs`, `scripts/build.mjs` | Local static server and dependency-free static build |
| `scripts/benchmark.mjs` | Repeatable renderer and field-calculation benchmark |
| `playwright.config.js`, `tests/browser/lab.spec.js` | Responsive browser and interaction regression suite |
| `tests/physics.test.js`, `tests/learning.test.js` | Independent numerical references, edge cases and learning-state regression |
| `README.md`, `docs/CURRICULUM.md`, `docs/VALIDATION.md` | Run instructions, full learning-outcome mapping and this report |
| `docs/performance.json` | Measured benchmark results |
| `docs/screenshots/mobile-force.png`, `mobile-field.png`, `mobile-potential.png`, `mobile-motion.png`, `desktop-force.png`, `mobile-dark.png` | Curated final viewport screenshots |
| `docs/screenshots/equilibrium.png`, `isolated-potential.png`, `uniform-potential.png`, `force-components.png` | Detailed reviewed diagrams and zero-acceleration equilibrium |

Generated, untracked material: `dist/` static build, `node_modules/`, `test-results/` screenshots/traces, and `.tools/`/`tmp/` used for local PDF extraction/rendering. These are excluded from the runtime application and are not unrelated source modifications.

## Exact local commands

```powershell
cd 'D:\Physics Simulation Sem 2\Electrostatic Lab'
npm install
npm run dev
```

Open `http://127.0.0.1:5173`. For validation, run `npm test`, `npx playwright install chromium`, `npm run test:browser`, then `npm run build`. Stop the server with Ctrl+C.
