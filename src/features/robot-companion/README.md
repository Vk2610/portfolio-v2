# Portfolio companion

The homepage mounts one lazily loaded H1. The dev-only `/robot-preview` page stays separate. `companion-scene.js` owns the small transparent canvas, document projection, raycast input and single frame loop. `surface-registry.js` measures painted dividers and existing project and contact row borders. `patrol.js` chooses when to call the original walking, turning and falling controllers. All robot model, animation, emotion and physics modules live in `robot-preview`.

A horizontal edge keeps its exact document X span and Y height in the physics world. Its depth runs perpendicular to the page. Walking requires real sole contact and room for the character above the edge. The patrol can wait on a narrow border after landing, or defer a scroll request until the current and lower edges share a clear corridor.

The current physics API accepts horizontal slabs and replaces their collection in one operation. The companion keeps the collider snapshot through a fall and reconciles measured changes after recovery. Sticky navigation, vertical walls, empty containers and whitespace are outside the surface registry. A fall that misses the last real support can leave the page without an in-page reset.
