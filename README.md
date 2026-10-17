# SP025 Electrostatics Laboratory

A local, mobile-first interactive laboratory for Chapter 1 of Malaysian Matriculation Physics 2. The four tabs combine draggable diagrams, live SI calculations, guided investigations and predictions with worked explanations.

## Run locally

Install Node.js 24 or later, then run in this directory:

```powershell
npm install
npm run dev
```

Open **http://127.0.0.1:5173**. Stop the server with Ctrl+C. The application has no runtime dependencies, backend numerical calculations, AI APIs, paid services or remote assets. Installation is needed for development tests; the server itself also runs with `node scripts/server.mjs` without installing packages.

## Checks and static build

```powershell
npm test
npx playwright install chromium
npm run test:browser
npm run build
```

The static build is written to `dist/`. Serve that directory at the root of a static HTTP host; opening HTML directly through `file://` is unsupported because the application uses JavaScript modules. Deployment has not been performed.

For a repeatable synthetic rendering benchmark, start the local server, then run `node scripts/benchmark.mjs`. Results are written to `docs/performance.json`.

## Using the laboratory

- Drag a source or probe, or focus its invisible 44 px object button and use the arrow keys. Each key moves 0.005 m; Shift moves 0.001 m. Precise coordinate and charge inputs are in **Settings & precise values**.
- On phones the charge slider, or particle Play/Step controls, sits directly below the live results. Pinch the workspace or use Zoom. Gestures inside the workspace do not scroll the page.
- Choose ready-made arrangements or load one of three guided investigations in each tab. Change a prediction, run the simulation, then check the current answer in **Challenge**.
- Tab 1.1: select a force target; show individual/resultant forces, components and a free-body diagram.
- Tab 1.2: move A to measure E and test-charge force. Explore field lines and the vector grid. Load the zero-field investigation to seek the midpoint.
- Tab 1.3: compare A and B, change the test charge, inspect work signs and pair energy, or switch to ideal uniform-field equipotentials.
- Tab 1.4: use experiments A–D, adjust voltage, separation, charge, mass and velocity components. Step, play, pause or change playback speed. Parameter edits restart the clock.

The question mark opens concise help and a light/dark theme control. Tab-specific physical arrangements persist while switching tabs, for the lifetime of the page.

## Technical notes

The application uses ES modules and Canvas 2D, with accessible HTML controls. `src/physics.js` is independent of the DOM. Coordinates and numerical values use SI units with double-precision calculations and separate display formatting. Force cancellation uses a documented machine-precision tolerance to remove roundoff drift. Source charges use ordinary 3D inverse-square electrostatics sampled in an x-y plane. Coincident sources and singular probes are rejected without softening. A maximum of four sources is enforced; system-energy calculations are restricted to three.

Motion uses analytical constant-acceleration segments, stable quadratic roots and explicit events at finite plate edges and absorbing plate surfaces. The signed voltage is **Vbottom − Vtop**, so **Eᵧ = (Vbottom − Vtop)/d**. Gravity, when enabled, is downward. Electric force acts only in the rectangular region between the plates; fringing is neglected. Playback speed changes the clock, not the equations.

See [curriculum coverage](docs/CURRICULUM.md) and the [implementation and validation report](docs/VALIDATION.md) for the audit, complete file list, numerical references, test results and limitations.
