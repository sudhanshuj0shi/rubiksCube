import * as THREE from 'three';
import { createRubiksCube } from './src/cube';

// Root container of the 3D world (consider this the stage)
const scene = new THREE.Scene();

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

// Build the 27-cubie Rubik's-cube
const rubiksCube = createRubiksCube();
scene.add(rubiksCube.group);

// Animation loop: Renders the scene and updates the cube's rotation
const animate = () => {
  // Request the next animation frame
  window.requestAnimationFrame(animate);

  // Rotate the cube
  // 0.01: how fast to rotate
  rubiksCube.group.rotation.x += 0.01;
  rubiksCube.group.rotation.y += 0.01;

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
