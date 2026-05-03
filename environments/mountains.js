import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';

let sky = null;
let ground = null;
let skyUniforms = null;
let sunVec = null;

export function setup(scene) {
  sky = new Sky();
  sky.scale.setScalar(10000);
  scene.add(sky);

  skyUniforms = sky.material.uniforms;
  skyUniforms['turbidity'].value = 4;
  skyUniforms['rayleigh'].value = 1.5;
  skyUniforms['mieCoefficient'].value = 0.003;
  skyUniforms['mieDirectionalG'].value = 0.85;

  sunVec = new THREE.Vector3();
  applySun(8, 180);

  const geo = new THREE.PlaneGeometry(8000, 4000, 200, 100);
  const pos = geo.attributes.position.array;
  for (let i = 0; i < pos.length; i += 3) {
    const x = pos[i];
    const y = pos[i + 1];
    const h1 = Math.sin(x * 0.0008) * 400 + Math.cos(y * 0.0006) * 300;
    const h2 = Math.sin(x * 0.003 + y * 0.002) * 150;
    const h3 = Math.sin(x * 0.01) * 40;
    pos[i + 2] = Math.max(0, h1 + h2 + h3);
  }
  geo.computeVertexNormals();

  const mat = new THREE.MeshStandardMaterial({
    color: 0x1a1a22,
    roughness: 0.95,
    metalness: 0.05,
    flatShading: true,
  });
  ground = new THREE.Mesh(geo, mat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -50;
  scene.add(ground);

  return { sky, ground };
}

export function teardown(scene) {
  if (sky) scene.remove(sky);
  if (ground) {
    scene.remove(ground);
    ground.geometry.dispose();
    ground.material.dispose();
  }
  sky = null;
  ground = null;
  skyUniforms = null;
  sunVec = null;
}

export function applySun(elevation, azimuth) {
  if (!skyUniforms || !sunVec) return;
  const phi = THREE.MathUtils.degToRad(90 - elevation);
  const theta = THREE.MathUtils.degToRad(azimuth);
  sunVec.setFromSphericalCoords(1, phi, theta);
  skyUniforms['sunPosition'].value.copy(sunVec);
}

export function applySkyAtmosphere(turbidity, rayleigh, mieCoefficient, mieG) {
  if (!skyUniforms) return;
  skyUniforms['turbidity'].value = turbidity;
  skyUniforms['rayleigh'].value = rayleigh;
  skyUniforms['mieCoefficient'].value = mieCoefficient;
  skyUniforms['mieDirectionalG'].value = mieG;
}

export function update(_dt, _energy, _phase) {
  // Mountains are static. Lightning, rain, fog, tornadoes still apply scene-wide.
}

export function getWater() {
  return null;
}
