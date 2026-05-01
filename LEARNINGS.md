# three.js Learnings

A running log of concepts I'm picking up while playing with three.js.
Add new entries at the bottom of each section. Keep notes short — link to docs when needed.

---

## Mental model

Think of three.js as a film production:

- **Scene** = the stage. It holds everything you can see (objects, lights).
- **Camera** = where the audience sits. Defines viewpoint and perspective.
- **Renderer** = the film crew. Each frame, it photographs the scene from the camera's angle and paints the result onto a `<canvas>`.
- **Mesh** = an actor on stage. It has a _shape_ (geometry) and a _costume_ (material).
- **Animation loop** = the projector running 60 frames per second — re-render, re-render, re-render.

---

### 2026-05-02 — Rotating cube, end to end

- **PerspectiveCamera(fov, aspect, near, far)** — the director picking a lens. FOV is how wide the shot is (75° feels natural, 30° is telephoto, 110° is fisheye), aspect must match the canvas or the actors look stretched, and near/far define the "in-focus" depth slab — the **frustum**. Anything outside that slab gets clipped; the actor literally vanishes.

- **Step back from the origin** — by default the camera sits at `(0, 0, 0)`, which is exactly where the cube spawns. You'd be _inside_ the actor's costume, seeing black. `camera.position.z = 3` is just buying a seat in row 3.

- **MeshBasicMaterial** — a flat-color costume that's its own light source: no shadows, no shading, just paint. The simplest costume on the rack — perfect for "is anything rendering?" sanity checks. Swap to `MeshStandardMaterial` later when the actor needs to react to real stage lights.

- **The render loop pattern** — the projector only advances if you ask it to. Inside `animate`, call `requestAnimationFrame(animate)` _first_ (so the loop perpetuates even if the body throws), then update state, then `renderer.render(scene, camera)`. Forget the render call and the projector spins but no film passes through — silent black screen.

- **Resize gotcha** — three.js caches the camera's lens math, so after changing `camera.aspect` on window resize you must call `camera.updateProjectionMatrix()`. Skip it and the audience keeps watching through the old lens — everything stretched. One of the most common "why does it look weird after I resize" bugs.
