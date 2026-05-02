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

---

### 2026-05-02 — From a lone cube to a Rubik's troupe

> Goal: turn one actor into an ensemble of 27, and give them their own dressing room.

- **Act 1 — `THREE.Group` is a stage trolley**
  - One cube was easy; 27 cubes flying around the stage independently would be a nightmare to choreograph.
  - A `Group` is just a wheeled platform: park 27 cubies on it, and from then on the scene only sees _one_ actor. Rotate the trolley → everyone rotates together. Later, when we want to spin only the top slice, we'll build a smaller trolley and re-parent 9 cubies onto it.
- **Act 2 — the 3×3×3 grid, centered on the origin**
  - Coordinates `[-1, 0, 1]` for each axis = 27 slots, naturally symmetric around `(0, 0, 0)`. No off-by-one math, no manual centering.
  - Spacing = `CUBE_SIZE + GAP`. The gap is purely cosmetic — without it, neighboring faces fight over the same pixel (z-fighting) and you get an ugly shimmer.
- **Act 3 — share the costume, share the props**
  - One `BoxGeometry`, one `MeshBasicMaterial`, one fat-line `edgesGeometry`/`edgesMaterial` — passed to all 27 meshes.
  - Like 27 actors wearing the same uniform from the same wardrobe rack: the GPU only uploads the data once. Cloning per-cubie would multiply memory and draw setup for zero visual gain.
- **Act 4 — `src/cube.js` becomes a self-contained troupe**
  - `script.js` was getting crowded with stage hands. Extract to a module that exports `createRubiksCube()` and returns `{ group, onResize }`.
  - `group` is what the scene cares about. `onResize` is the **callback escape hatch** — the module owns its `LineMaterial` and knows it needs pixel dimensions, but it doesn't know about `window` events. The caller wires DOM → callback. Clean separation: the troupe handles its own makeup, the director handles the venue.
- _Gotcha:_ the Rubik's cube is ~3× wider than a single cubie, so the camera at `z = 3` was now sitting **inside** the assembly. Bumped to `z = 6` to step back into the audience seats again.
