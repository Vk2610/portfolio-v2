# H1 Classic development preview

Run `npm run dev` from the portfolio root and open `/robot-preview` on the development server. Drag to orbit. Use the numbered turntable steps, camera buttons, or rotate controls to inspect the model. Scroll, pinch, or use the zoom buttons to zoom. Reset restores the three-quarter view and the 100% head, 60% body, and 100% overall scales.

`RobotPreview.tsx` supplies the controls and mounts the Three.js viewer in `preview.js`. `robot.js` defines the static parts and group pivots. `geometry.js` supplies the shared spline and loft surfaces. The model uses +Y up and +Z forward.

Click or tap the robot to trigger a reaction. Use **Simulate impact** to test dizziness. The Emotions panel also previews each state directly and lets you adjust timing. `emotions.js` manages reaction priority and exposes `triggerDizzy()` for a future impact event. Reduced motion disables blinking and orbit movement while showing the selected expression.

Use **Movement** to try breathing, walking in either direction, turns, a happy jump, and folded arms. Open **Fall and collision tests** for directional falls, a raised platform, the drop test and collider outlines. To test loss of support, stage the robot on the platform and walk right off the edge. The motion panel reports the physical state and resting orientation. The preview reset clears the simulation and settings as well as the camera and proportions.

**Head tracking** controls the independent head pivot. Defaults are ±45° yaw, ±25° pitch, zero tracking roll, and 1.8 seconds before returning to neutral. A valid touch briefly supplies a look target. Tracking is limited while walking or reacting, and disabled during falls, dizziness and recovery. Reduced motion suppresses passive breathing and tracking while allowing explicitly triggered movement tests.

`rig.js` adapts the existing meshes to articulated groups and limb targeting. `movement.js` controls authored poses and grounded movement. `fall-physics.js` uses an articulated compound collider in Rapier at a fixed 120 Hz timestep and returns the actual settled transform to the recovery controller. The preview uses a single frame callback for movement, tracking and expressions.
