import * as THREE from 'three';
import { Water } from 'three/addons/objects/Water.js';
import { Sky } from 'three/addons/objects/Sky.js';

let water = null;
let sky = null;
let skyUniforms = null;
let sunVec = null;

export function setup(scene) {
  const waterGeometry = new THREE.PlaneGeometry(10000, 10000, 256, 256);
  water = new Water(waterGeometry, {
    textureWidth: 1024,
    textureHeight: 1024,
    waterNormals: new THREE.TextureLoader().load(
      'https://cdn.jsdelivr.net/gh/mrdoob/three.js@r170/examples/textures/waternormals.jpg',
      (texture) => {
        texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
      },
    ),
    sunDirection: new THREE.Vector3(),
    sunColor: 0xffffff,
    waterColor: 0x001218,
    distortionScale: 4.0,
    fog: true,
  });
  water.rotation.x = -Math.PI / 2;
  scene.add(water);

  sky = new Sky();
  sky.scale.setScalar(10000);
  scene.add(sky);

  skyUniforms = sky.material.uniforms;
  skyUniforms['turbidity'].value = 10;
  skyUniforms['rayleigh'].value = 2.5;
  skyUniforms['mieCoefficient'].value = 0.005;
  skyUniforms['mieDirectionalG'].value = 0.8;

  sunVec = new THREE.Vector3();
  applySun(2, 180);

  return { water, sky };
}

export function teardown(scene) {
  if (water) {
    scene.remove(water);
    water.geometry.dispose();
    water.material.dispose();
  }
  if (sky) {
    scene.remove(sky);
  }
  water = null;
  sky = null;
  skyUniforms = null;
  sunVec = null;
}

export function applySun(elevation, azimuth) {
  if (!skyUniforms || !water || !sunVec) return;
  const phi = THREE.MathUtils.degToRad(90 - elevation);
  const theta = THREE.MathUtils.degToRad(azimuth);
  sunVec.setFromSphericalCoords(1, phi, theta);
  skyUniforms['sunPosition'].value.copy(sunVec);
  water.material.uniforms['sunDirection'].value.copy(sunVec).normalize();
}

export function applySkyAtmosphere(turbidity, rayleigh, mieCoefficient, mieG) {
  if (!skyUniforms) return;
  skyUniforms['turbidity'].value = turbidity;
  skyUniforms['rayleigh'].value = rayleigh;
  skyUniforms['mieCoefficient'].value = mieCoefficient;
  skyUniforms['mieDirectionalG'].value = mieG;
}

export function update(dt, energy, phase = '') {
  if (!water) return;
  const t = THREE.MathUtils.clamp(energy, 0, 1);
  const apoc = phase === 'APOCALYPSE';

  const distort = THREE.MathUtils.lerp(2.5, 9.0, t) * (apoc ? 1.42 : 1.0);
  water.material.uniforms['distortionScale'].value = distort;

  const waterTimeRate = (0.5 + energy * 1.5) * (apoc ? 1.65 : 1.0);
  water.material.uniforms['time'].value += dt * waterTimeRate;

  const pos = water.geometry.attributes.position.array;
  const tScale = apoc ? 1.28 : 1.0;
  const tNow = performance.now() * 0.0006 * tScale;
  const freq = apoc ? 1.18 : 1.0;
  const ampBase = 1.5 + energy * 18;
  const amp = apoc ? ampBase * 2.05 + 16 : ampBase;
  for (let i = 0; i < pos.length; i += 3) {
    const x = pos[i];
    const y = pos[i + 1];
    const wave1 = Math.sin(x * 0.012 * freq + tNow * 1.35) * amp;
    const wave2 = Math.cos(y * 0.018 * freq + tNow * 0.92) * amp * 0.72;
    const wave3 = Math.sin((x + y) * 0.008 * freq + tNow * 1.75) * amp * 0.52;
    if (apoc) {
      const w4 = Math.sin(x * 0.026 + tNow * 2.5) * amp * 0.26;
      const w5 = Math.cos(y * 0.031 + tNow * 2.15) * amp * 0.2;
      const w6 = Math.sin((x * 0.5 - y) * 0.014 + tNow * 1.9) * amp * 0.16;
      pos[i + 2] = wave1 + wave2 + wave3 + w4 + w5 + w6;
    } else {
      pos[i + 2] = wave1 + wave2 + wave3;
    }
  }
  water.geometry.attributes.position.needsUpdate = true;
  water.geometry.computeVertexNormals();

  let waterR;
  let waterG;
  let waterB;
  if (t < 0.5) {
    const k = t / 0.5;
    waterR = THREE.MathUtils.lerp(0.02, 0.10, k);
    waterG = THREE.MathUtils.lerp(0.05, 0.06, k);
    waterB = THREE.MathUtils.lerp(0.08, 0.04, k);
  } else if (t < 0.85) {
    const k = (t - 0.5) / 0.35;
    waterR = THREE.MathUtils.lerp(0.10, 0.14, k);
    waterG = THREE.MathUtils.lerp(0.06, 0.02, k);
    waterB = THREE.MathUtils.lerp(0.04, 0.015, k);
  } else {
    const k = (t - 0.85) / 0.15;
    waterR = THREE.MathUtils.lerp(0.14, 0.02, k);
    waterG = THREE.MathUtils.lerp(0.02, 0.01, k);
    waterB = THREE.MathUtils.lerp(0.015, 0.01, k);
  }
  water.material.uniforms['waterColor'].value.setRGB(waterR, waterG, waterB);

  const sunR = 1.0;
  const sunG = THREE.MathUtils.lerp(0.85, 0.25, Math.min(t * 1.3, 1));
  const sunB = THREE.MathUtils.lerp(0.65, 0.08, Math.min(t * 1.5, 1));
  water.material.uniforms['sunColor'].value.setRGB(sunR, sunG, sunB);
}

export function getWater() {
  return water;
}
