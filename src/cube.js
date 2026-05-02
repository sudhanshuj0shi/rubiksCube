/**
 * Builds a Rubik's-cube-shaped assembly of 27 small cubies.
 */

import * as THREE from 'three';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js';

// Size of each cube
const CUBE_SIZE = 1;
// Visual gap between adjacent cubes
const GAP = 0.05;
// Distance between the centers of two adjacent cubies
const CUBE_DISTANCE = CUBE_SIZE + GAP;
// Grid coordinates on each axis (3 cubies per axis, centered on origin)
const POSITION_SLOTS = [-1, 0, 1];

/**
 * Creates a Rubik's cube assembly of 27 cubies.
 *
 * @returns An object with:
 *   - `group`: the `THREE.Group` containing all cubies — add this to the scene
 *   - `onResize(width, height)`: call from the window resize handler so the
 *     fat-line edges keep their pixel thickness
 */
export function createRubiksCube() {
  // Create a group to hold the cubes
  const group = new THREE.Group();

  // Shared resources reused across all 27 cubies
  const geometry = new THREE.BoxGeometry(CUBE_SIZE, CUBE_SIZE, CUBE_SIZE);
  const material = new THREE.MeshBasicMaterial({ color: 0xffffff });

  // Create edges for the cube
  const edges = new THREE.EdgesGeometry(geometry);
  const edgesGeometry = new LineSegmentsGeometry().fromEdgesGeometry(edges);
  const edgesMaterial = new LineMaterial({
    color: 0x000000,
    linewidth: 5,
    resolution: new THREE.Vector2(window.innerWidth, window.innerHeight),
  });

  const createCube = (x, y, z) => {
    const cube = new THREE.Mesh(geometry, material);

    cube.position.set(x * CUBE_DISTANCE, y * CUBE_DISTANCE, z * CUBE_DISTANCE);
    cube.add(new LineSegments2(edgesGeometry, edgesMaterial));

    return cube;
  };

  // Create the cubes in each position slot for each axis
  // x, y, z step through the grid coordinates on each axis
  for (const x of POSITION_SLOTS) {
    for (const y of POSITION_SLOTS) {
      for (const z of POSITION_SLOTS) {
        const cube = createCube(x, y, z);

        group.add(cube);
      }
    }
  }

  // Fat lines need to know the canvas size; caller must invoke this on resize
  const onResize = (width, height) => {
    edgesMaterial.resolution.set(width, height);
  };

  return {
    group,
    onResize,
  };
}
