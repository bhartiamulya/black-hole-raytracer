# Black Hole Ray Tracer

CPU-only Schwarzschild ray tracer that runs in the browser (Vite + React). Photons are traced by numerically integrating the null geodesic ODEs in Schwarzschild spacetime using an RK4 integrator running inside Web Workers. The UI exposes the main physical parameters (mass, camera pose, disk geometry, integration settings) and offers presets for quick previews vs. higher quality renders.

## Features
- Full Schwarzschild metric in geometric units (`G = c = 1`) with analytic Christoffel symbols and null-geodesic ODEs (`src/core/geodesic.js`).
- Fourth-order Runge–Kutta integrator with adaptive pass cadence to balance speed and accuracy (`src/core/integrator.js`, `src/render/renderer.js`).
- Photon termination logic for horizon capture, escape, and Novikov–Thorne-style thin disk intersections, including gravitational redshift and Doppler boosting (`src/core/physics.js`).
- Tile-based progressive renderer that runs entirely on CPU inside Web Workers, with optional scientific overlays (hit classification + heatmap) and debug ray path capture (`src/render`).
- React UI with live stats (rays, progress, shadow radius measurement) and presets for "Quick Look", "Reset", and "High Quality" modes (`src/ui`). The stats panel explicitly states that disk colours come from a single temperature-to-RGB gradient with Doppler amplification—no artificial multi-band palette claims.
- Dedicated diagnostics canvas that plots theoretical vs. measured shadow radius plus sampled geodesic traces, updated in real time and exported alongside the main render (`src/ui/DiagnosticsPanel.jsx`).
- Offline rendering script (`npm run render:example`) for producing PNG+JSON outputs without the browser.

## Project Structure
```
src/
  core/          # Metric, geodesic system, integrator, physics helpers
  render/        # Renderer controller, worker, ray tracer, color mapping
  ui/            # React components, styles, parameter controls
tests/           # Vitest specs (RK4 integrator test today)
scripts/         # Offline rendering CLI
```
