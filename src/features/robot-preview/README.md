# H1 Classic development preview

Run `npm run dev` from the portfolio root and open `/robot-preview` on the development server. Drag to orbit. Use the numbered turntable steps, camera buttons, or rotate controls to inspect the model. Scroll, pinch, or use the zoom buttons to zoom. Reset restores the three-quarter view and the 100% head, 60% body, and 100% overall scales.

`RobotPreview.tsx` supplies the controls and mounts the Three.js viewer in `preview.js`. `robot.js` defines the static parts and group pivots. `geometry.js` supplies the shared spline and loft surfaces. The model uses +Y up and +Z forward.
