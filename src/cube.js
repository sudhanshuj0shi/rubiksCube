/**
 * Builds a Rubik's-cube-shaped assembly of 27 small cubies.
 */

import * as THREE from 'three';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js';
import { getCubieMaterials } from './cubieMaterials';

// Size of each cube
const CUBE_SIZE = 1;
// Visual gap between adjacent cubes
const GAP = 0.05;
// Distance between the centers of two adjacent cubies
const CUBE_DISTANCE = CUBE_SIZE + GAP;
// Grid coordinates on each axis (3 cubies per axis, centered on origin)
const POSITION_SLOTS = [-1, 0, 1];

// 90° expressed in radians — the unit a single Rubik's move snaps to.
const QUARTER_TURN = Math.PI / 2;

// Per-face slice metadata: which axis spins, which slot identifies its 9
// cubies, and the angle that reads as "clockwise from outside the cube".
const SLICES = {
  U: { axis: 'y', slot: 1, cwAngle: -QUARTER_TURN },
  D: { axis: 'y', slot: -1, cwAngle: QUARTER_TURN },
  R: { axis: 'x', slot: 1, cwAngle: -QUARTER_TURN },
  L: { axis: 'x', slot: -1, cwAngle: QUARTER_TURN },
  F: { axis: 'z', slot: 1, cwAngle: -QUARTER_TURN },
  B: { axis: 'z', slot: -1, cwAngle: QUARTER_TURN },
};

// Snap to nearest quarter turn. Below 45° → 0 (the twist reverts);
// past ±45° → ±90° (the twist commits). The threshold that gives a
// real Rubik's cube its "click" feel.
const snapAngle = (radians) => Math.round(radians / QUARTER_TURN) * QUARTER_TURN;

/**
 * Creates a Rubik's cube assembly of 27 cubies.
 *
 * @returns An object with:
 *   - `group`: the `THREE.Group` containing all cubies — add this to the scene
 *   - `cubies`: a stable list of all 27 cubie meshes
 *   - `onResize(width, height)`: call from the window resize handler so the
 *     fat-line edges keep their pixel thickness
 *   - `beginRotation(face)`: starts a stateful rotation session; returns
 *     `{ setAngle(rad), end() }`. Use this for animated and drag-driven
 *     rotations — the angle can be set continuously between begin and end.
 *   - `rotateSlice(face, direction)`: convenience one-shot for console
 *     testing; equivalent to begin → setAngle(±90°) → end.
 */
export function createRubiksCube() {
  // Create a group to hold the cubes
  const group = new THREE.Group();

  // Shared resources reused across all 27 cubies
  const geometry = new THREE.BoxGeometry(CUBE_SIZE, CUBE_SIZE, CUBE_SIZE);

  // Create edges for the cube
  const edges = new THREE.EdgesGeometry(geometry);
  const edgesGeometry = new LineSegmentsGeometry().fromEdgesGeometry(edges);
  const edgesMaterial = new LineMaterial({
    color: 0x000000,
    linewidth: 5,
    resolution: new THREE.Vector2(window.innerWidth, window.innerHeight),
  });

  const createCube = (x, y, z) => {
    const cubeMaterial = getCubieMaterials(x, y, z);
    const cube = new THREE.Mesh(geometry, cubeMaterial);

    cube.position.set(x * CUBE_DISTANCE, y * CUBE_DISTANCE, z * CUBE_DISTANCE);
    cube.add(new LineSegments2(edgesGeometry, edgesMaterial));

    return cube;
  };

  // Stable list of all 27 cubie meshes — handy for raycasting and any
  // other "operate on every cubie" task. Building it during construction
  // is cleaner than walking group.children later (which can also contain
  // transient rotation pivots).
  const cubies = [];

  // Create the cubes in each position slot for each axis
  // x, y, z step through the grid coordinates on each axis
  for (const x of POSITION_SLOTS) {
    for (const y of POSITION_SLOTS) {
      for (const z of POSITION_SLOTS) {
        const cube = createCube(x, y, z);

        group.add(cube);
        cubies.push(cube);
      }
    }
  }

  // At most one rotation may be in flight; null when the cube is idle.
  let activeSession = null;

  /**
   * Start a stateful rotation. The caller drives `setAngle` (any number of
   * times, with any radian value) and finally `end`, which snaps to the
   * nearest quarter turn and bakes the result into the cubies.
   *
   * @param {'U'|'D'|'L'|'R'|'F'|'B'} face
   * @returns {{ setAngle: (radians: number) => void, end: () => void }}
   */
  const beginRotation = (face) => {
    if (activeSession) {
      throw new Error('A Rotation is already in progress');
    }

    const slice = SLICES[face];

    if (!slice) {
      throw new Error(`Invalid face: ${face}`);
    }

    // The 9 cubies currently sitting on this slice.
    const sliceCubies = group.children.filter(
      (cubie) => Math.round(cubie.position[slice.axis] / CUBE_DISTANCE) === slice.slot
    );

    // Mount the slice on a transient pivot at the origin. Rotating the
    // pivot rotates all 9 cubies as one unit.
    const pivot = new THREE.Group();
    group.add(pivot);

    for (const cubie of sliceCubies) {
      pivot.attach(cubie);
    }

    activeSession = {
      setAngle: (radians) => {
        pivot.rotation[slice.axis] = radians;
      },
      end: () => {
        // Snap to the nearest quarter turn (or 0 if the user didn't
        // cross the 45° threshold), then bake into the cubies by moving
        // them back to the main group with their world transforms intact.
        const snapped = snapAngle(pivot.rotation[slice.axis]);
        pivot.rotation[slice.axis] = snapped;
        for (const cubie of sliceCubies) {
          group.attach(cubie);
        }
        group.remove(pivot);
        activeSession = null;
      },
    };

    return activeSession;
  };

  /**
   * Apply one complete 90° move atomically.
   *
   * @param {'U'|'D'|'L'|'R'|'F'|'B'} face
   * @param {'cw'|'ccw'} [direction='cw']
   */
  const rotateSlice = (face, direction = 'cw') => {
    const slice = SLICES[face];

    if (!slice) {
      throw new Error(`Invalid face: ${face}`);
    }

    const session = beginRotation(face);
    session.setAngle(direction === 'cw' ? slice.cwAngle : -slice.cwAngle);
    session.end();
  };

  // Fat lines need to know the canvas size; caller must invoke this on resize
  const onResize = (width, height) => {
    edgesMaterial.resolution.set(width, height);
  };

  return {
    group,
    cubies,
    onResize,
    beginRotation,
    rotateSlice,
  };
}
