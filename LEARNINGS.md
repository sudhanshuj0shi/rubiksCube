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

---

### 2026-05-02 — Painting the cube: stickers from a wardrobe rack

> Goal: give each face of the cube its real Rubik's color, but only on the _outside_.

- **Act 1 — one mesh, six costumes**
  - So far we'd been handing each cubie a single material — one paint can for the whole box. Turns out `THREE.Mesh` _also_ accepts an **array of 6 materials** when the geometry is a `BoxGeometry`: three.js has already split the box into 6 face groups internally, one per side.
  - Mental model: one actor, but the costume designer hands them a different shirt for each side they turn toward the audience.
- **Act 2 — the face-order contract (memorize this)**
  - The array order is **fixed**: `[+X, -X, +Y, -Y, +Z, -Z]` → right, left, top, bottom, front, back.
  - Counterintuitive (most people guess "top first"), so it lives in the JSDoc on `getCubieMaterials`. Swap two entries and you get red on top — debugging that visually is its own special hell.
- **Act 3 — the grid pays off again**
  - Each cubie's position `(x, y, z)` with `{-1, 0, 1}` slots already encodes which sides it faces outward. `x === 1` means "this cubie sits on the right column of the cube" → its `+X` face shows red; everything else stays interior black.
  - Falls out for free: corners get 3 colors, edges 2, centers 1, hidden core 0. No special cases, no bookkeeping.
- **Act 4 — the wardrobe rack: 7 materials, not 162**
  - Naive instinct: build `27 × 6 = 162` materials. Actual need: **7** (one per direction + one interior black).
  - In `src/cubieMaterials.js`, `MATERIALS` is built once at **module-scope** — JS modules execute their top level exactly once on first import. Every `getCubieMaterials()` call afterwards just hands out references from the rack. Materials in three.js are pure paint; many cubies can wear the same red simultaneously without conflict.
- **Act 5 — a new module, a new boundary**
  - Color knowledge lives entirely inside `src/cubieMaterials.js`. `src/cube.js` gained **one import line**; `script.js` didn't change at all.
  - Future palette experiments (color-blind mode, win-state flash, accessibility tweaks) touch one file. The troupe handles its own makeup; the venue and director stay blissfully unaware.

---

### 2026-05-02 — Handing the camera to the audience

> Goal: let the user spin the cube themselves instead of watching it spin on autopilot.

- **Act 1 — `OrbitControls` is a phone-on-a-rubber-band rig**
  - The addon takes the camera and ties it (invisibly) to a target point in space — by default the origin, which is exactly where our cube sits. Drag = swing the rig around the pin; scroll = pull the rubber band shorter or longer; right-drag = move the pin itself (pan).
  - Lives in `three/addons/controls/OrbitControls.js`. Same addon import shape as the fat-line trio.
- **Act 2 — controls need a camera and a DOM element**
  - Camera, because they mutate the audience's seat each frame. The canvas (`renderer.domElement`), because that's where mouse/touch events fire — listening on the canvas (not `window`) keeps unrelated UI from accidentally rotating the cube later.
  - Note: `controls` never gets added to the scene. There's nothing to render — it's a behavior bolted onto an existing camera.
- **Act 3 — damping = inertia, but only if you crank the projector**
  - `enableDamping = true` gives the camera a satisfying glide after you release the mouse, instead of a hard stop. `dampingFactor` is taste — `0.05` floaty, `0.08` snappy, `0.2` almost no glide.
  - The price: `controls.update()` **must** run every frame in the animate loop, _before_ `renderer.render(...)`. Skip it and the glide never gets computed — input feels jerky and stuck.
- **Act 4 — two rotations is one too many**
  - Auto-rotating the cube while the user can also orbit the camera is dizzying — both happen at once and it's hard to tell which is which. Pulled out the `rubiksCube.group.rotation += 0.01` lines so the cube stays still and the user owns the viewpoint.
- _Aha:_ `OrbitControls` rotates the **camera around the cube**, not the cube itself. Same visual effect from the audience's seat, but mechanically very different — and it's why the cube module didn't have to change a single line.

---

### 2026-05-02 — Turning the stage lights on

> Goal: stop the cube from looking like a cardboard cutout. Give it real plastic shading.

- **Act 1 — `MeshBasicMaterial` → `MeshStandardMaterial`**
  - Until now, every cubie wore a flat costume that was its own light source — the painted cardboard look. `MeshStandardMaterial` swaps that for a real actor: physically-based shading that reacts to whatever light hits it. The stickers now have lit and shadowed sides as you orbit.
  - The trade: the actor is invisible until you turn the lights on. Switch the material without adding lights and the cube goes pitch black — only the fat-line edges remain. Both changes belong in the same commit for that reason.
- **Act 2 — Two lights, two jobs**
  - `AmbientLight` = the house lights. Uniform, directionless, hits every face equally. Without it, surfaces facing away from the sun would render as pure black. With it, you set a baseline brightness for the whole scene.
  - `DirectionalLight` = the sun. Parallel rays from infinity, all traveling in the same direction. This is what gives the cube its lit / shadowed gradient and makes orbiting feel rewarding.
- **Act 3 — DirectionalLight's `position` is a direction, not a location**
  - For a directional light, `light.position` doesn't mean "the sun is over here at (5, 10, 7)". It means "the rays travel **from** (5, 10, 7) **toward** the target" (default origin). The light is conceptually infinitely far away — moving it twice as far doesn't change brightness.
  - Mental model: holding up a finger to the sun. The finger's direction relative to the sun is what casts the shadow, not how close you stand.
- **Act 4 — `roughness` is the matte/glossy knob**
  - PBR's two main appearance dials are `roughness` (1 = chalk, 0 = mirror) and `metalness` (1 = polished metal, 0 = plastic). For Rubik's stickers, `roughness: 0.4` gives real-plastic gloss without looking wet.
  - Interior faces stay at `roughness: 1` — fully matte. They're hidden inside the cube anyway, so spending compute on highlights nobody sees would be silly.
- _Aha:_ face **normals** do all the work silently. Every face on a `BoxGeometry` ships with a built-in arrow pointing outward; the renderer compares each normal to the light direction to decide brightness. Wrote zero normal code, got per-face shading for free — that's the gift PBR materials give you on top of vanilla geometry.

---

### 2026-05-03 — Spinning a slice: the turntable trick

> Goal: rotate one face of the cube without moving the other two-thirds — in a way that drag interaction can later drive frame-by-frame.

- **Act 1 — Why a pivot at all**
  - Naïve approach: rotate each of the 9 cubies individually. But `cubie.rotation.y += π/2` only spins each cubie _in place_ around its own center — they never move to new grid positions. To translate 9 cubies along a 90° arc you'd hand-compute every new `(x, y, z)` and orientation. Painful.
  - Real trick: build an invisible `THREE.Group` at the origin, parent the 9 cubies under it, then rotate the group. three.js does all the position + orientation math automatically because that's what parent–child transforms are _for_.
  - Mental model: an invisible turntable. Glue 9 actors to it, spin it 90°, peel them off again — each actor lands in their new spot, properly oriented.
- **Act 2 — `attach()` is `add()` with a memory**
  - Both methods change a child's parent. The difference is whether the world transform survives the move.
  - `parent.add(child)` keeps the local transform. World position can jump if parents differ.
  - `parent.attach(child)` recomputes the local transform so the world position **stays put**. Nothing visually budges.
  - Why it matters: after spinning the pivot, re-parenting cubies back to the cube group with `attach()` is what **bakes** the rotation into each cubie's permanent local position + quaternion. Use `add()` instead and the cubies snap back to their pre-rotation spots, undoing all the work.
- **Act 3 — Designing for drag from day one**
  - Two API shapes were on the table: a one-shot `rotateSlice(face, dir)`, or a lifecycle `beginRotation(face)` → `setAngle` → `end` that the caller drives. Picked the lifecycle as the foundation, with `rotateSlice` as a 5-line wrapper on top.
  - Why: drag is inherently continuous — pointer movement updates the angle frame by frame. A one-shot can't express partial state. Building the lifecycle now means animation, drag, and atomic moves all drop in later as different drivers of the **same engine**, no rewrite needed.
- **Act 4 — `snapAngle` and the 45° "click"**
  - `Math.round(radians / (π/2)) * (π/2)` — five operations of arithmetic that define the entire feel of a real Rubik's cube. Below 45°, the twist reverts to 0. Past 45°, it commits to ±90°.
  - That hard threshold is what makes a physical cube feel **decisive** instead of wobbly. Without it, half-finished twists would stick at whatever weird angle you let go at.
- _Aha:_ in the `SLICES` table, `slot` and `cwAngle` always carry **opposite signs** — slot `+1` pairs with `−π/2`, slot `−1` pairs with `+π/2`. That's "clockwise from outside" mirroring itself across each axis pair (right-hand rule under the hood). The table bakes the right sign per face so callers never have to think about it.

---

### 2026-05-03 — Picking actors out of the crowd

> Goal: figure out which cubie and which face the user just clicked on screen.

- **Act 1 — the screen as a porthole**
  - Every pixel is a tiny window from the audience into the stage. `THREE.Raycaster` shoots an invisible laser from the camera through one of those windows and asks each actor: "did this beam pass through you?"
  - Hits come back **sorted nearest-first**, so the visible face is always `[0]`. Anything farther was occluded — already invisible to the audience, no reason to consider it.
- **Act 2 — NDC, the universal stage coordinate**
  - three.js doesn't speak in pixels; it speaks in **N**ormalized **D**evice **C**oords (`-1` … `+1` on both axes, origin at canvas center). Two-line linear remap from `event.clientX/Y`.
  - **Y is flipped:** browsers count Y down from the top, NDC counts Y up from center. Forget the negation and clicking the top registers at the bottom. One-character bug, twenty-minute hunt.
- **Act 3 — local vs world normals**
  - Every triangle face on a `BoxGeometry` ships with an outward-pointing arrow (its **normal**). After a few twists, a cubie's local `+Y` arrow might point world-right — calling that face "U" would be a lie.
  - `face.normal.clone().transformDirection(cubie.matrixWorld)` re-aims the arrow to its current world direction — the only one that maps cleanly to a Rubik's letter. Always **clone** before transforming: `face.normal` is a shared geometry reference, mutating it silently breaks every future pick.
- **Act 4 — allocate once, reuse forever**
  - Pointer events fire many times per second during a drag. `new THREE.Raycaster()` and `new THREE.Vector2()` per event = garbage soup, frame-rate hiccups.
  - Hoist both to module scope; set their fields each event instead of newing up replacements. A canonical three.js perf footgun, called out in the docs.
- _Aha:_ the cube module already had `group.children`, but during a rotation that list temporarily holds the transient pivot too — wrong shape for picking. Exposed a separate flat `cubies` array of mesh references so the raycaster always sees exactly 27 things, regardless of what the scene graph is doing mid-twist.
