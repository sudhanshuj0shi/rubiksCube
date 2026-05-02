import * as THREE from 'three';
// For faking a fat line
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js';

// Root container of the 3D world (consider this the stage)
const scene = new THREE.Scene();

// Camera: the eyes of the viewer
// 75: field of view (vertical angle)
// window.innerWidth / window.innerHeight: aspect ratio
// 0.1: near clipping plane (objects closer than this won't be rendered)
// 1000: far clipping plane (objects farther than this won't be rendered)
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);

// Position the camera 3 units away from the origin (the center of the scene)
camera.position.z = 3;

// Renderer: the object that renders the scene to the screen
// antialias: true: smooth edges
const renderer = new THREE.WebGLRenderer({ antialias: true });

// Set the size of the renderer to the window size
renderer.setSize(window.innerWidth, window.innerHeight);

// Set the pixel ratio to the device pixel ratio
renderer.setPixelRatio(window.devicePixelRatio);

// Add the renderer to the document body
document.body.appendChild(renderer.domElement);

// Create a box geometry: the shape of the object
// 1, 1, 1: width, height, depth
const geometry = new THREE.BoxGeometry(1, 1, 1);

// Create a material: how the surface of the object looks
const material = new THREE.MeshBasicMaterial({ color: 0xffffff });

// Create a mesh (geometry and material): a 3D object in the scene
const cube = new THREE.Mesh(geometry, material);

// Add the cube to the scene
scene.add(cube);

// Add edges to the cube
const edges = new THREE.EdgesGeometry(geometry);
const edgesGeometry = new LineSegmentsGeometry().fromEdgesGeometry(edges);
const edgesMaterial = new LineMaterial({
    color: 0x000000,
    linewidth: 5,
    resolution: new THREE.Vector2(window.innerWidth, window.innerHeight),
  });
const edgesMesh = new LineSegments2(edgesGeometry, edgesMaterial);
cube.add(edgesMesh);

// Animation loop: Renders the scene and updates the cube's rotation
const animate = () => {
  // Request the next animation frame
  window.requestAnimationFrame(animate);

  // Rotate the cube
  // 0.01: how fast to rotate
  cube.rotation.x += 0.01;
  cube.rotation.y += 0.01;

  // Render the scene: Renders what the camera sees of the scene of the canvas
  renderer.render(scene, camera);
};

animate();

// Resize the canvas when the window is resized
window.addEventListener('resize', () => {
  // Update the camera's aspect ratio
  camera.aspect = window.innerWidth / window.innerHeight;
  // Update the camera's projection matrix
  camera.updateProjectionMatrix();
  // Update the renderer's size
  renderer.setSize(window.innerWidth, window.innerHeight);
  // Update the edges material's resolution
  edgesMaterial.resolution.set(window.innerWidth, window.innerHeight);
});
