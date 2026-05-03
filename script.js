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

// Build the 27-cubie Rubik's-cube
const rubiksCube = createRubiksCube();
scene.add(rubiksCube.group);

// Dev-time hook so you can poke the cube from the browser console.
// Try: cube.rotateSlice('U', 'cw'),
//      const s = cube.beginRotation('U'); s.setAngle(Math.PI/3); s.end();
window.cube = rubiksCube;

// Pick the cubie + face under the pointer when the user clicks the canvas.
renderer.domElement.addEventListener('pointerdown', (event) => {
  // Convert the click's pixel position into NDC, accounting for the
  // canvas's actual on-page rect (handles non-fullscreen layouts cleanly).
  const rect = renderer.domElement.getBoundingClientRect();
  pointerNdc.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointerNdc.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

  // Build the ray for this pixel through the current camera, then ask
  // every cubie if it intersects. `false` = don't recurse into the
  // wireframe LineSegments2 children parented to each cubie.
  raycaster.setFromCamera(pointerNdc, camera);
  const [hit] = raycaster.intersectObjects(rubiksCube.cubies, false);
  if (!hit) return;

  // hit.face.normal is in the cubie's *local* space. Transforming by
  // matrixWorld gives the direction the face is actually pointing in
  // the scene right now — the only normal that maps to a Rubik's letter.
  const cubie = hit.object;
  const worldNormal = hit.face.normal.clone().transformDirection(cubie.matrixWorld);
  const face = normalToFaceName(worldNormal);

  // Grid coords use Math.round on position because slot 0/±1 maps to
  // world coords 0/±CUBE_DISTANCE (1.05). Rounding tolerates GAP cleanly.
  const gridPosition = {
    x: Math.round(cubie.position.x),
    y: Math.round(cubie.position.y),
    z: Math.round(cubie.position.z),
  };

  console.log('clicked', { face, gridPosition, point: hit.point });
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
