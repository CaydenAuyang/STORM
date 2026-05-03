import * as THREE from 'three';

const PARTICLE_COUNT = 9000;
const BOX_HALF = 100;
const BOX_TOP = 200;
const VISIBILITY_THRESHOLD = 0.15;
const MAX_OPACITY = 0.6;

let points = null;
let geometry = null;
let material = null;

/**
 * Create the rain particle system and add it to the scene. Particles are
 * scattered in a 200x200x200 box centered horizontally on the camera target,
 * with y in [0, 200].
 *
 * @param {THREE.Scene} scene
 * @returns {THREE.Points}
 */
export function createRain(scene) {
  const positions = new Float32Array(PARTICLE_COUNT * 3);
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    positions[i * 3 + 0] = (Math.random() - 0.5) * 2 * BOX_HALF;
    positions[i * 3 + 1] = Math.random() * BOX_TOP;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 2 * BOX_HALF;
  }

  geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

  material = new THREE.PointsMaterial({
    size: 2.4,
    color: 0xc8ddff,
    transparent: true,
    opacity: MAX_OPACITY,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  scene.add(points);
  return points;
}

/**
 * Advance rain particles. Wind tilts the fall vector from straight down at
 * energy 0 to 30° tilt at energy 1; fall speed scales 60..140 units/sec.
 * Material opacity tracks energy and the points object is hidden entirely
 * when energy < 0.15 to avoid wasted shading.
 *
 * @param {number} dt Seconds since last frame.
 * @param {number} energy 0..1 storm energy.
 */
export function updateRain(dt, energy, phase = '') {
  if (!points || !geometry) return;

  if (energy < VISIBILITY_THRESHOLD) {
    points.visible = false;
    return;
  }
  points.visible = true;

  const apoc = phase === 'APOCALYPSE';
  material.opacity = Math.min(0.95, energy * (apoc ? 1.28 : 1.1) + (apoc ? 0.06 : 0));
  material.size = apoc ? 3.1 : 2.4;

  const angle = THREE.MathUtils.degToRad((apoc ? 38 : 30) * Math.min(1, energy));
  const dirX = Math.sin(angle);
  const dirY = -Math.cos(angle);
  const fallSpeed = 60 + energy * 80 + (apoc ? 42 : 0);
  const dx = dirX * fallSpeed * dt;
  const dy = dirY * fallSpeed * dt;

  const pos = geometry.attributes.position.array;
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const idx = i * 3;
    pos[idx + 0] += dx;
    pos[idx + 1] += dy;

    if (
      pos[idx + 1] < 0 ||
      pos[idx + 0] > BOX_HALF ||
      pos[idx + 0] < -BOX_HALF
    ) {
      pos[idx + 0] = (Math.random() - 0.5) * 2 * BOX_HALF;
      pos[idx + 1] = BOX_TOP;
      pos[idx + 2] = (Math.random() - 0.5) * 2 * BOX_HALF;
    }
  }

  geometry.attributes.position.needsUpdate = true;
}
