/**
 * 3D in-scene lightning only — multiple visual styles, thickness via
 * multi-strand geometry, PointLights for scene illumination.
 */
import * as THREE from 'three';

const POOL_SIZE = 20;
const MAX_VERTS = 2800;

const STYLES = [
  'needle',
  'forked',
  'crawler',
  'jagged',
  'ribbon',
  'sheet',
];

let scene = null;
const pool = [];

function pickStyle(mega) {
  if (mega && Math.random() < 0.45) {
    return Math.random() < 0.5 ? 'sheet' : 'ribbon';
  }
  return STYLES[Math.floor(Math.random() * STYLES.length)];
}

function buildNeedle(mega) {
  const segs = (mega ? 26 : 16) + Math.floor(Math.random() * 8);
  const points = [];
  let x = 0;
  let y = 300 + Math.random() * 100;
  let z = 0;
  const jx = mega ? 10 : 6;
  const jz = mega ? 8 : 5;
  points.push(new THREE.Vector3(x, y, z));
  for (let i = 1; i <= segs; i++) {
    const t = i / segs;
    y = (300 + Math.random() * 60) * (1 - t);
    x += (Math.random() - 0.5) * jx;
    z += (Math.random() - 0.5) * jz;
    points.push(new THREE.Vector3(x, y, z));
  }
  return { main: points, branches: [], thickness: mega ? 1.2 : 0.6 };
}

function buildForked(mega) {
  const segs = (mega ? 22 : 14) + Math.floor(Math.random() * 6);
  const points = [];
  let x = 0;
  let y = 280 + Math.random() * 90;
  let z = 0;
  points.push(new THREE.Vector3(x, y, z));
  for (let i = 1; i <= segs; i++) {
    const t = i / segs;
    y = (280 + Math.random() * 80) * (1 - t);
    x += (Math.random() - 0.5) * (mega ? 32 : 22);
    z += (Math.random() - 0.5) * (mega ? 26 : 18);
    points.push(new THREE.Vector3(x, y, z));
  }
  const branches = [];
  const nBranch = (mega ? 7 : 4) + Math.floor(Math.random() * 4);
  for (let b = 0; b < nBranch; b++) {
    const startIdx = 2 + Math.floor(Math.random() * Math.max(2, segs - 4));
    const seed = points[startIdx];
    const branch = [seed.clone()];
    let bx = seed.x;
    let by = seed.y;
    let bz = seed.z;
    const blen = 3 + Math.floor(Math.random() * (mega ? 8 : 5));
    for (let j = 0; j < blen; j++) {
      bx += (Math.random() - 0.5) * (mega ? 40 : 28);
      by -= 6 + Math.random() * (mega ? 32 : 22);
      bz += (Math.random() - 0.5) * (mega ? 32 : 22);
      branch.push(new THREE.Vector3(bx, by, bz));
    }
    branches.push(branch);
  }
  return { main: points, branches, thickness: mega ? 3.5 : 2.2 };
}

function buildCrawler(mega) {
  const segs = (mega ? 34 : 22) + Math.floor(Math.random() * 10);
  const points = [];
  let x = (Math.random() - 0.5) * 40;
  let y = 260 + Math.random() * 80;
  let z = (Math.random() - 0.5) * 40;
  const jx = mega ? 55 : 38;
  const jz = mega ? 48 : 32;
  points.push(new THREE.Vector3(x, y, z));
  for (let i = 1; i <= segs; i++) {
    const t = i / segs;
    y = (260 + Math.random() * 70) * (1 - t * 0.92);
    x += (Math.random() - 0.5) * jx;
    z += (Math.random() - 0.5) * jz;
    points.push(new THREE.Vector3(x, y, z));
  }
  const branches = [];
  if (Math.random() < 0.55) {
    const seed = points[Math.floor(segs * 0.35)];
    const branch = [seed.clone()];
    let bx = seed.x;
    let by = seed.y;
    let bz = seed.z;
    for (let j = 0; j < 5; j++) {
      bx += (Math.random() - 0.5) * 50;
      by -= 10 + Math.random() * 20;
      bz += (Math.random() - 0.5) * 40;
      branch.push(new THREE.Vector3(bx, by, bz));
    }
    branches.push(branch);
  }
  return { main: points, branches, thickness: mega ? 2.8 : 1.8 };
}

function buildJagged(mega) {
  const segs = (mega ? 38 : 26) + Math.floor(Math.random() * 10);
  const points = [];
  let x = 0;
  let y = 290 + Math.random() * 70;
  let z = 0;
  points.push(new THREE.Vector3(x, y, z));
  const amp = mega ? 42 : 28;
  for (let i = 1; i <= segs; i++) {
    const t = i / segs;
    y = (290 + Math.random() * 50) * (1 - t);
    x += (Math.random() < 0.5 ? -1 : 1) * (0.4 + Math.random()) * amp;
    z += (Math.random() < 0.5 ? -1 : 1) * (0.4 + Math.random()) * amp * 0.85;
    points.push(new THREE.Vector3(x, y, z));
  }
  const branches = [];
  const nb = mega ? 4 : 2;
  for (let b = 0; b < nb; b++) {
    const startIdx = 4 + Math.floor(Math.random() * Math.max(2, segs - 6));
    const seed = points[startIdx];
    const branch = [seed.clone()];
    let bx = seed.x;
    let by = seed.y;
    let bz = seed.z;
    for (let j = 0; j < 4 + Math.floor(Math.random() * 4); j++) {
      bx += (Math.random() < 0.5 ? -1 : 1) * 20;
      by -= 12 + Math.random() * 18;
      bz += (Math.random() < 0.5 ? -1 : 1) * 18;
      branch.push(new THREE.Vector3(bx, by, bz));
    }
    branches.push(branch);
  }
  return { main: points, branches, thickness: mega ? 2.4 : 1.4 };
}

function buildRibbon(mega) {
  const base = buildNeedle(mega);
  base.thickness = mega ? 8 : 5;
  return base;
}

function buildSheet(mega) {
  const drops = (mega ? 7 : 5) + Math.floor(Math.random() * 2);
  const paths = [];
  const spread = mega ? 200 : 130;
  for (let d = 0; d < drops; d++) {
    const u = drops <= 1 ? 0 : d / (drops - 1);
    const ox = (u - 0.5) * spread + (Math.random() - 0.5) * 22;
    const oz = (Math.random() - 0.5) * (mega ? 70 : 45);
    const h0 = 220 + Math.random() * 100;
    const segs = 4 + Math.floor(Math.random() * 5);
    const strip = [];
    for (let i = 0; i <= segs; i++) {
      const t = i / segs;
      strip.push(new THREE.Vector3(
        ox + (Math.random() - 0.5) * 12,
        h0 * (1 - t * 0.85),
        oz + (Math.random() - 0.5) * 10,
      ));
    }
    paths.push(strip);
  }
  return { sheetPaths: paths, thickness: mega ? 4 : 2.5 };
}

function generateGeometryData(style, mega) {
  switch (style) {
    case 'needle':
      return buildNeedle(mega);
    case 'forked':
      return buildForked(mega);
    case 'crawler':
      return buildCrawler(mega);
    case 'jagged':
      return buildJagged(mega);
    case 'ribbon':
      return buildRibbon(mega);
    case 'sheet':
      return buildSheet(mega);
    default:
      return buildForked(mega);
  }
}

function appendSegmentPair(ax, ay, az, bx, by, bz, target, countRef) {
  const i = countRef.i;
  if (i + 6 > target.length) return false;
  target[i] = ax; target[i + 1] = ay; target[i + 2] = az;
  target[i + 3] = bx; target[i + 4] = by; target[i + 5] = bz;
  countRef.i += 6;
  return true;
}

function pathToVerts(path, ox, oz, target, countRef) {
  for (let k = 0; k < path.length - 1; k++) {
    const ok = appendSegmentPair(
      path[k].x + ox,
      path[k].y,
      path[k].z + oz,
      path[k + 1].x + ox,
      path[k + 1].y,
      path[k + 1].z + oz,
      target,
      countRef,
    );
    if (!ok) return;
  }
}

function dataToFloatArray(data, target) {
  const countRef = { i: 0 };
  const thickness = data.thickness ?? 2;
  const strands = thickness < 1.5 ? 1 : thickness < 3.5 ? 2 : thickness < 6 ? 3 : 4;
  const angStep = (Math.PI * 2) / strands;

  if (data.sheetPaths) {
    for (const strip of data.sheetPaths) {
      pathToVerts(strip, 0, 0, target, countRef);
      for (let s = 1; s < strands; s++) {
        const ox = Math.cos(angStep * s + 0.7) * thickness * 0.35;
        const oz = Math.sin(angStep * s + 0.7) * thickness * 0.35;
        pathToVerts(strip, ox, oz, target, countRef);
      }
    }
  } else {
    const main = data.main;
    const branches = data.branches || [];
    for (let s = 0; s < strands; s++) {
      const ox = Math.cos(angStep * s) * thickness * 0.45;
      const oz = Math.sin(angStep * s) * thickness * 0.45;
      pathToVerts(main, ox, oz, target, countRef);
      for (const br of branches) {
        pathToVerts(br, ox, oz, target, countRef);
      }
    }
  }
  return countRef.i / 3;
}

export function initLightning3D(theScene) {
  scene = theScene;
  for (let i = 0; i < POOL_SIZE; i++) {
    const positions = new Float32Array(MAX_VERTS * 3);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setDrawRange(0, 0);
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 120, 0), 800);

    const mat = new THREE.LineBasicMaterial({
      color: 0xe8f4ff,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      fog: false,
    });
    const line = new THREE.LineSegments(geo, mat);
    line.frustumCulled = false;
    line.visible = false;
    line.renderOrder = 5;
    scene.add(line);

    const light = new THREE.PointLight(0xc8e8ff, 0, 1100, 1.35);
    light.visible = false;
    scene.add(light);

    const fill = new THREE.PointLight(0xaab8ff, 0, 600, 1.6);
    fill.visible = false;
    scene.add(fill);

    pool.push({
      line,
      light,
      fill,
      active: false,
      startTime: 0,
      peakMs: 60,
      fadeMs: 180,
      peakIntensity: 16,
      fillPeak: 5,
    });
  }
}

export function fireBolt3D(opts = {}) {
  if (!scene || pool.length === 0) return;
  let slot = pool.find((p) => !p.active);
  if (!slot) {
    slot = pool[Math.floor(Math.random() * pool.length)];
  }

  const mega = !!opts.mega;
  const style = opts.style || pickStyle(mega);
  const data = generateGeometryData(style, mega);

  const positions = slot.line.geometry.attributes.position.array;
  const vertCount = dataToFloatArray(data, positions);
  slot.line.geometry.attributes.position.needsUpdate = true;
  slot.line.geometry.setDrawRange(0, vertCount);

  const hueRoll = Math.random();
  if (hueRoll < 0.12) {
    slot.line.material.color.setRGB(1, 0.92, 0.78);
    slot.light.color.setRGB(1, 0.94, 0.82);
    slot.fill.color.setRGB(0.95, 0.85, 0.7);
  } else if (hueRoll < 0.22) {
    slot.line.material.color.setRGB(0.75, 0.88, 1);
    slot.light.color.setRGB(0.7, 0.85, 1);
    slot.fill.color.setRGB(0.55, 0.7, 1);
  } else {
    slot.line.material.color.setRGB(0.92, 0.96, 1);
    slot.light.color.setRGB(0.78, 0.9, 1);
    slot.fill.color.setRGB(0.55, 0.65, 0.95);
  }

  const targetX = opts.x != null
    ? opts.x
    : (Math.random() - 0.5) * 380;
  const targetZ = opts.z != null
    ? opts.z
    : -50 - Math.random() * 280;

  slot.line.position.set(targetX, 0, targetZ);
  slot.line.visible = true;
  slot.line.material.opacity = 1.0;

  const lift = style === 'sheet' ? 40 : 0;
  slot.light.position.set(targetX, 95 + lift, targetZ);
  slot.light.distance = mega ? 1600 : (style === 'sheet' ? 1400 : 1000);
  slot.fill.position.set(targetX + (Math.random() - 0.5) * 40, 45 + lift, targetZ + (Math.random() - 0.5) * 40);
  slot.fill.distance = mega ? 900 : 520;

  const long = style === 'crawler' || style === 'jagged';
  slot.peakMs = mega ? 180 + Math.floor(Math.random() * 80) : (long ? 55 + Math.floor(Math.random() * 40) : 40 + Math.floor(Math.random() * 35));
  slot.fadeMs = mega ? 320 + Math.floor(Math.random() * 120) : (long ? 220 : 160);
  slot.peakIntensity = mega ? (28 + Math.random() * 28) : (8 + Math.random() * 14);
  if (style === 'sheet') slot.peakIntensity *= 1.15;
  slot.fillPeak = slot.peakIntensity * (0.22 + Math.random() * 0.18);

  slot.light.visible = true;
  slot.fill.visible = true;

  slot.active = true;
  slot.startTime = performance.now();
}

export function updateLightning3D() {
  const now = performance.now();
  for (const slot of pool) {
    if (!slot.active) continue;
    const elapsed = now - slot.startTime;
    const total = slot.peakMs + slot.fadeMs;
    if (elapsed >= total) {
      slot.active = false;
      slot.line.visible = false;
      slot.line.material.opacity = 0;
      slot.light.visible = false;
      slot.light.intensity = 0;
      slot.fill.visible = false;
      slot.fill.intensity = 0;
      continue;
    }
    let alpha;
    if (elapsed < slot.peakMs) {
      alpha = 0.7 + Math.random() * 0.3;
    } else {
      const k = (elapsed - slot.peakMs) / slot.fadeMs;
      alpha = Math.max(0, 1 - k);
      alpha *= alpha;
    }
    slot.line.material.opacity = alpha;
    slot.light.intensity = slot.peakIntensity * alpha;
    slot.fill.intensity = slot.fillPeak * alpha;
  }
}
