import * as THREE from 'three';
import { createRubiksCube } from './src/cube';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// Root container of the 3D world (consider this the stage)
const scene = new THREE.Scene();

// Ambient light: a soft, diffuse light that illuminates all objects equally
const ambientLight = new THREE.AmbientLight(0xffffff, 1);
scene.add(ambientLight);

// Directional light: a light that shines in a specific direction
const directionalLight = new THREE.DirectionalLight(0xffffff, 2.5);
directionalLight.position.set(5, 10, 7);
scene.add(directionalLight);

// Camera: the eyes of the viewer
// 75: field of view (vertical angle)
// window.innerWidth / window.innerHeight: aspect ratio
// 0.1: near clipping plane (objects closer than this won't be rendered)
// 1000: far clipping plane (objects farther than this won't be rendered)
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);

// Position the camera 6 units away from the origin (the center of the scene)
camera.position.z = 6;

// Renderer: the object that renders the scene to the screen
// antialias: true: smooth edges
const renderer = new THREE.WebGLRenderer({ antialias: true });

renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
document.body.appendChild(renderer.domElement);

// Camera controls: drag to orbit, scroll to zoom, right-drag to pan.
// Needs the camera (it mutates camera.position) and the canvas
// (it listens for mouse/touch events on it).
const controls = new OrbitControls(camera, renderer.domElement);

// Smooth glide after release — feels less jerky than a hard stop.
// Requires controls.update() inside the animate loop.
controls.enableDamping = true;
controls.dampingFactor = 0.08;

// Raycaster: the object that casts rays from the camera through the scene
const raycaster = new THREE.Raycaster();
const pointerNdc = new THREE.Vector2();

// Map a world-space unit normal to its Rubik's face letter.
// Must be world-space: a cubie's local +Y face can point any direction
// after the cube has been twisted, so we'd otherwise mis-label faces.
const normalToFaceName = (worldNormal) => {
  // round() absorbs tiny floating-point drift (e.g. 0.99998 → 1).
  const x = Math.round(worldNormal.x);
  const y = Math.round(worldNormal.y);
  const z = Math.round(worldNormal.z);

  if (x === 1) return 'R';
  if (x === -1) return 'L';
  if (y === 1) return 'U';
  if (y === -1) return 'D';
  if (z === 1) return 'F';
  if (z === -1) return 'B';

  return null;
};

// Per face: the world-space "drag right" (H) and "drag up" (V) tangents
// (looking at the face from outside), plus axis/axisSign pre-baked from
// cross(faceNormal, tangent) for cw/ccw resolution at runtime.
const FACE_TANGENTS = {
  F: {
    H: { tangent: new THREE.Vector3(1, 0, 0), axis: 'y', axisSign: 1 },
    V: { tangent: new THREE.Vector3(0, 1, 0), axis: 'x', axisSign: -1 },
  },
  B: {
    H: { tangent: new THREE.Vector3(-1, 0, 0), axis: 'y', axisSign: 1 },
    V: { tangent: new THREE.Vector3(0, 1, 0), axis: 'x', axisSign: 1 },
  },
  R: {
    H: { tangent: new THREE.Vector3(0, 0, -1), axis: 'y', axisSign: 1 },
    V: { tangent: new THREE.Vector3(0, 1, 0), axis: 'z', axisSign: 1 },
  },
  L: {
    H: { tangent: new THREE.Vector3(0, 0, 1), axis: 'y', axisSign: 1 },
    V: { tangent: new THREE.Vector3(0, 1, 0), axis: 'z', axisSign: -1 },
  },
  U: {
    H: { tangent: new THREE.Vector3(1, 0, 0), axis: 'z', axisSign: -1 },
    V: { tangent: new THREE.Vector3(0, 0, -1), axis: 'x', axisSign: -1 },
  },
  D: {
    H: { tangent: new THREE.Vector3(1, 0, 0), axis: 'z', axisSign: 1 },
    V: { tangent: new THREE.Vector3(0, 0, 1), axis: 'x', axisSign: -1 },
  },
};

// Inverse of cube.js's SLICES: (axis, slot) → slice letter.
const SLICE_BY_AXIS_SLOT = {
  x: { '-1': 'L', 1: 'R' },
  y: { '-1': 'D', 1: 'U' },
  z: { '-1': 'B', 1: 'F' },
};

// Drag distance (in NDC; canvas spans 2) before locking in a slice. ~5px.
const DRAG_DECISION_THRESHOLD = 0.01;

const snapPosition = (cubie) => ({
  x: Math.round(cubie.position.x),
  y: Math.round(cubie.position.y),
  z: Math.round(cubie.position.z),
});

// World tangent → normalized NDC direction at the cubie's screen position.
// Called once per gesture so per-frame moves are just dot products.
const projectTangentToNdc = (worldTangent, originWorldPos, camera) => {
  const start = originWorldPos.clone().project(camera);
  const tip = originWorldPos.clone().add(worldTangent).project(camera);
  return new THREE.Vector2(tip.x - start.x, tip.y - start.y).normalize();
};

// Returns { face, direction } once drag exceeds threshold; null otherwise
// (still below threshold or hit a middle slice — middle slices aren't modeled).
const decideSliceFromDrag = (g, dragNdcDelta) => {
  const dotH = dragNdcDelta.dot(g.screenH);
  const dotV = dragNdcDelta.dot(g.screenV);

  if (Math.max(Math.abs(dotH), Math.abs(dotV)) < DRAG_DECISION_THRESHOLD) {
    return null;
  }

  const useH = Math.abs(dotH) >= Math.abs(dotV);
  const decision = useH ? FACE_TANGENTS[g.faceName].H : FACE_TANGENTS[g.faceName].V;
  const dragSign = Math.sign(useH ? dotH : dotV);

  const slot = Math.round(g.cubie.position[decision.axis]);
  if (slot === 0) return null;

  // Three signs collapse the cross-product geometry into one branch.
  const direction = dragSign * decision.axisSign * slot < 0 ? 'cw' : 'ccw';

  return { face: SLICE_BY_AXIS_SLOT[decision.axis][slot], direction };
};

// Active gesture: null | { phase: 'PICKED' | 'COMMITTED', ... }
let gesture = null;

// Build the 27-cubie Rubik's-cube
const rubiksCube = createRubiksCube();
scene.add(rubiksCube.group);

// Dev-time hook so you can poke the cube from the browser console.
// Try: cube.rotateSlice('U', 'cw'),
//      const s = cube.beginRotation('U'); s.setAngle(Math.PI/3); s.end();
window.cube = rubiksCube;

// Start a gesture if the click hits a cubie; otherwise let orbit handle it.
renderer.domElement.addEventListener('pointerdown', (event) => {
  const rect = renderer.domElement.getBoundingClientRect();
  pointerNdc.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointerNdc.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

  raycaster.setFromCamera(pointerNdc, camera);
  const [hit] = raycaster.intersectObjects(rubiksCube.cubies, false);
  if (!hit) return;

  const cubie = hit.object;
  const worldNormal = hit.face.normal.clone().transformDirection(cubie.matrixWorld);
  const faceName = normalToFaceName(worldNormal);
  if (!faceName) return;

  // Project tangents once; camera is frozen for the gesture (orbit off).
  const cubieWorldPos = cubie.getWorldPosition(new THREE.Vector3());
  const tangents = FACE_TANGENTS[faceName];
  const screenH = projectTangentToNdc(tangents.H.tangent, cubieWorldPos, camera);
  const screenV = projectTangentToNdc(tangents.V.tangent, cubieWorldPos, camera);

  gesture = {
    phase: 'PICKED',
    pointerId: event.pointerId,
    startNdc: pointerNdc.clone(),
    faceName,
    cubie,
    screenH,
    screenV,
  };

  controls.enabled = false;
  // Keep receiving move/up even if the cursor leaves the canvas.
  renderer.domElement.setPointerCapture(event.pointerId);

  console.log('picked', { face: faceName, gridPosition: snapPosition(cubie) });
});

// Decide the slice once drag exceeds threshold; M2c will drive setAngle here.
renderer.domElement.addEventListener('pointermove', (event) => {
  if (!gesture || event.pointerId !== gesture.pointerId) return;

  const rect = renderer.domElement.getBoundingClientRect();
  pointerNdc.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointerNdc.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  const dragDelta = pointerNdc.clone().sub(gesture.startNdc);

  if (gesture.phase !== 'PICKED') return;

  const decision = decideSliceFromDrag(gesture, dragDelta);
  if (!decision) return;

  gesture.phase = 'COMMITTED';
  gesture.decision = decision;
  console.log('decided', decision);
});

renderer.domElement.addEventListener('pointerup', (event) => {
  if (!gesture || event.pointerId !== gesture.pointerId) return;

  console.log('released', { phase: gesture.phase, decision: gesture.decision ?? null });

  controls.enabled = true;
  renderer.domElement.releasePointerCapture(event.pointerId);
  gesture = null;
});

// Animation loop: Renders the scene and updates the cube's rotation
const animate = () => {
  // Request the next animation frame
  window.requestAnimationFrame(animate);

  controls.update();

  // Render the scene: Renders what the camera sees of the scene of the canvas
  renderer.render(scene, camera);
};

animate();

// Resize the canvas when the window is resized
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  // Tell the cube module to update its fat-line resolution
  rubiksCube.onResize(window.innerWidth, window.innerHeight);
});
