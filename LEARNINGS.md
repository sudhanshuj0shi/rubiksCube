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

---

### 2026-05-02 — Outlining the cube: a fat-line story

> Goal: make the white cube look crisp with bold black edges.

- **Act 1 — ask for the silhouette: `EdgesGeometry`**
  - Like marking only the seams an audience can see — every cube face is secretly two triangles glued along a diagonal, but that hidden stitch isn't a "real" edge of the cube.
  - Outputs the **12 actual edges** (corners where two faces bend sharply), filtering out the in-face diagonals via an angle threshold (default 1°).
  - Hand it to `LineSegments` + `LineBasicMaterial` → crisp 1px black outline. ✓
- **Act 2 — wanting it bolder: `linewidth` is a lie**
  - Set `linewidth: 5` → nothing changes.
  - WebGL spec quirk: most graphics drivers (Mac/Windows Chrome) **silently ignore line widths > 1px**.
  - The prop survives in the API but does nothing. Plot twist!
- **Act 3 — the "fat lines" addon trio**
  - three.js fakes thick lines by drawing tiny **ribbons** (triangle strips) in screen space.
  - Three classes under `three/addons/lines/...`, named like the originals with a **2** appended:
    - `LineSegmentsGeometry` (populate via `new LineSegmentsGeometry().fromEdgesGeometry(edges)`)
    - `LineMaterial`
    - `LineSegments2`
  - Mental model: instead of a single thread, sew a **ribbon** along each edge.
- **Act 4 — the resolution requirement**
  - Fat lines measure thickness in **pixels**, so `LineMaterial` needs to know the canvas size.
  - Pass `resolution: new Vector2(width, height)` at construction.
  - **Also** update `edgesMaterial.resolution.set(...)` inside the resize handler — else the ribbon warps after the window resizes.
