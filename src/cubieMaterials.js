/**
 * Builds and shares the materials used to paint each cubie's faces.
 */

import * as THREE from 'three';

// Standard Rubik's cube colors, keyed by face direction.
// Hex values picked to feel close to a real cube
const COLORS = {
  right: 0xff3b30, // +X
  left: 0xff9500, // -X
  top: 0xffffff, // +Y
  bottom: 0xffd60a, // -Y
  front: 0x34c759, // +Z
  back: 0x0a84ff, // -Z
  interior: 0x111111,
};

// One MeshStandardMaterial per unique color, built once and reused across
// all 27 cubies — 7 materials total instead of 27 * 6 = 162.
const MATERIALS = {
  right: new THREE.MeshStandardMaterial({ color: COLORS.right, roughness: 0.4 }),
  left: new THREE.MeshStandardMaterial({ color: COLORS.left, roughness: 0.4 }),
  top: new THREE.MeshStandardMaterial({ color: COLORS.top, roughness: 0.4 }),
  bottom: new THREE.MeshStandardMaterial({ color: COLORS.bottom, roughness: 0.4 }),
  front: new THREE.MeshStandardMaterial({ color: COLORS.front, roughness: 0.4 }),
  back: new THREE.MeshStandardMaterial({ color: COLORS.back, roughness: 0.4 }),
  interior: new THREE.MeshStandardMaterial({ color: COLORS.interior, roughness: 1 }),
};

/**
 * Returns the 6-material array for a cubie at grid position (x, y, z),
 * where each coordinate is one of -1, 0, 1.
 *
 * BoxGeometry face order is fixed by three.js:
 *   [ +X, -X, +Y, -Y, +Z, -Z ]
 *   (right, left, top, bottom, front, back)
 *
 * A face is colored only when the cubie sits on that side of the cube;
 * inward-facing faces stay black so the cube looks solid from any angle.
 */
export function getCubieMaterials(x, y, z) {
  return [
    x === 1 ? MATERIALS.right : MATERIALS.interior,
    x === -1 ? MATERIALS.left : MATERIALS.interior,
    y === 1 ? MATERIALS.top : MATERIALS.interior,
    y === -1 ? MATERIALS.bottom : MATERIALS.interior,
    z === 1 ? MATERIALS.front : MATERIALS.interior,
    z === -1 ? MATERIALS.back : MATERIALS.interior,
  ];
}
