import * as THREE from 'three';
import { Water } from 'three/addons/objects/Water.js';
import { Sky } from 'three/addons/objects/Sky.js';

let water = null;
let sky = null;
let skyUniforms = null;
let sunVec = null;
let icebergs = [];

export function setup(scene) {
  sky = new Sky();
  sky.scale.setScalar(10000);
  scene.add(sky);

  skyUniforms = sky.material.uniforms;
  skyUniforms['turbidity'].value = 6;
  skyUniforms['rayleigh'].value = 1.0;
  skyUniforms['mieCoefficient'].value = 0.005;
  skyUniforms['mieDirectionalG'].value = 0.85;

  sunVec = new THREE.Vector3();
  applySun(5, 180);

  const waterGeometry = new THREE.PlaneGeometry(10000, 10000, 256, 256);
  water = new Water(waterGeometry, {
    textureWidth: 1024,
    textureHeight: 1024,
    waterNormals: new THREE.TextureLoader().load(
      'https://cdn.jsdelivr.net/gh/mrdoob/three.js@r170/examples/textures/waternormals.jpg',
      (tex) => {
        tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      },
    ),
    sunDirection: new THREE.Vector3(),
    sunColor: 0xddeeff,
    waterColor: 0x0a2030,
    distortionScale: 4.0,
    fog: true,
  });
  water.rotation.x = -Math.PI / 2;
  scene.add(water);

  const ibMat = new THREE.MeshStandardMaterial({
    color: 0xb0c8d8,
    roughness: 0.4,
    flatShading: true,
  });
  for (let i = 0; i < 8; i++) {
    const geo = new THREE.ConeGeometry(
      15 + Math.random() * 25,
      25 + Math.random() * 35,
      6,
    );
    const ib = new THREE.Mesh(geo, ibMat);
    ib.position.set(
      (Math.random() - 0.5) * 600,
      2,
      -50 - Math.random() * 400,
    );
    ib.rotation.y = Math.random() * Math.PI * 2;
    scene.add(ib);
    icebergs.push(ib);
  }

  return { water, sky };
}

export function teardown(scene) {
  if (water) {
    scene.remove(water);
    water.geometry.dispose();
    water.material.dispose();
  }
  if (sky) scene.remove(sky);
  for (const ib of icebergs) {
    scene.remove(ib);
    ib.geometry.dispose();
  }
  icebergs = [];
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
  const apoc = phase === 'APOCALYPSE';
  const rate = (0.5 + energy * 1.5) * (apoc ? 2.15 : 1.0);
  water.material.uniforms['time'].value += dt * rate;
}

export function getWater() {
  return water;
}
