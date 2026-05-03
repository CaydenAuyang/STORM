import * as THREE from 'three';

function lerp(a, b, t) { return a + (b - a) * t; }

const tornadoes = [];

function createTornado(x, z) {
  const group = new THREE.Group();
  const segments = 24;

  const positions = new Float32Array(segments * 60 * 3);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const material = new THREE.PointsMaterial({
    color: 0x223344, size: 2.5, transparent: true, opacity: 0.55,
    depthWrite: false, blending: THREE.NormalBlending,
  });
  const points = new THREE.Points(geometry, material);
  group.add(points);

  const reflPositions = new Float32Array(segments * 60 * 3);
  const reflGeometry = new THREE.BufferGeometry();
  reflGeometry.setAttribute('position', new THREE.BufferAttribute(reflPositions, 3));
  const reflMaterial = new THREE.PointsMaterial({
    color: 0x223344, size: 2.0, transparent: true, opacity: 0.18,
    depthWrite: false, blending: THREE.NormalBlending,
  });
  const reflPoints = new THREE.Points(reflGeometry, reflMaterial);
  group.add(reflPoints);

  group.position.set(x, 0, z);
  group.userData = {
    phase: Math.random() * Math.PI * 2,
    scale: 0.6 + Math.random() * 0.6,
    segments,
  };
  return { group, points, geometry, reflPoints, reflGeometry };
}

export function spawnTornado(scene, x = null, z = null) {
  const px = x ?? (Math.random() - 0.5) * 200;
  const pz = z ?? -80 - Math.random() * 120;
  const t = createTornado(px, pz);
  scene.add(t.group);
  tornadoes.push(t);
  return t;
}

export function clearTornadoes(scene) {
  for (const t of tornadoes) scene.remove(t.group);
  tornadoes.length = 0;
}

export function updateTornadoes(dt, energy, phase = '') {
  const apoc = phase === 'APOCALYPSE';
  const spinMul = apoc ? 1.55 : 1.0;
  const sizeMul = apoc ? 1.22 : 1.0;
  const hMul = apoc ? 1.18 : 1.0;

  for (const t of tornadoes) {
    t.group.userData.phase += dt * (2 + energy * 4) * spinMul;
    const pos = t.geometry.attributes.position.array;
    const refl = t.reflGeometry.attributes.position.array;
    const segs = t.group.userData.segments;
    const s = t.group.userData.scale;

    for (let i = 0; i < segs; i++) {
      const h = i / segs;
      const radius = (2 + Math.pow(h, 1.5) * 38) * s * (0.8 + energy * 1.2) * sizeMul;
      const height = h * 220 * s * (0.7 + energy * 0.6) * hMul;

      for (let j = 0; j < 60; j++) {
        const a = (j / 60) * Math.PI * 2 + t.group.userData.phase + h * 3;
        const idx = (i * 60 + j) * 3;
        const px = Math.cos(a) * radius + (Math.random() - 0.5) * 2;
        const py = height + (Math.random() - 0.5) * 4;
        const pz = Math.sin(a) * radius + (Math.random() - 0.5) * 2;

        pos[idx]     = px;
        pos[idx + 1] = py;
        pos[idx + 2] = pz;

        refl[idx]     = px;
        refl[idx + 1] = -py;
        refl[idx + 2] = pz;
      }
    }
    t.geometry.attributes.position.needsUpdate = true;
    t.reflGeometry.attributes.position.needsUpdate = true;

    t.points.material.opacity = 0.55 + energy * 0.40;
    t.reflPoints.material.opacity = 0.18 + energy * 0.20;

    const c = energy < 0.85
      ? lerp(0.22, 0.38, energy / 0.85)
      : lerp(0.38, 0.62, (energy - 0.85) / 0.15);
    t.points.material.color.setRGB(c * 0.85, c * 0.95, c * 1.15);
    t.reflPoints.material.color.setRGB(c * 0.65, c * 0.72, c * 0.88);
  }
}
