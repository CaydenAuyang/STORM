import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { attachAudioToState } from './audio.js';
import { attachPoseToState } from './pose.js';
import {
  fireLightning,
  fireMegaLightning,
  setAutoLightning,
  initLightning,
} from './lightning.js';
import { initLightning3D, updateLightning3D } from './lightning3d.js';
import { createRain, updateRain } from './rain.js';
import { spawnTornado, clearTornadoes, updateTornadoes } from './tornado.js';
import {
  initAudioMix,
  startAudioMix,
  setEnergy as setAudioEnergy,
  playThunder,
  stopAllAudio,
  activateFullMix,
  deactivateAndResetCalm,
  fadeOutCalm,
  startMusicLayer,
} from './audioMix.js';
import { initSoundWave } from './soundwave.js';
import * as oceanEnv from './environments/ocean.js';
import * as mountainsEnv from './environments/mountains.js';
import * as arcticEnv from './environments/arctic.js';

const MIC_SENSITIVITY = 1.5; // bump to 2.0 if venue is quiet, 0.8 if hot mic
const HIGH_ENERGY_TRIGGER_S = 0.6;
const APOCALYPSE_HOLD_S = 7.0;

const STATE_COLORS = {
  CALM: 'rgba(180, 200, 220, 0.7)',
  CHARGED: 'rgba(220, 220, 180, 0.8)',
  TEMPEST: 'rgba(220, 180, 180, 0.9)',
  APOCALYPSE: 'rgba(255, 255, 255, 1.0)',
};

/**
 * Shared mutable state. Future input modules (audio, pose) write into this
 * object; the render loop reads from it every frame.
 */
export const state = {
  current: 'CALM',
  energy: 0,
  soundLevel: 0,
  bodyCount: 0,
  handsUpFraction: 0,
  handsWideFraction: 0,
  apocalypseTriggered: false,
  timeInState: 0,
  timeSinceLightning: 0,
  highEnergyTime: 0,
  apocalypseStartTime: 0,
  activated: false,
};

let climaxFired = false;
let climaxStartTime = 0;
let calmStableTime = 0;
let calmFadedOut = false;

let rehearsalActive = false;
let rehearsalStartTime = 0;
let rehearsalApocalypseTriggered = false;

const keyHold = {
  key: null,
  soundLevel: 0,
  bodyCount: 0,
  apocalypse: false,
};

let preflightVisible = false;
const fpsSamples = [];
let preflightUpdateAcc = 0;

const FOG_COLOR = 0x0a0a18;

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(FOG_COLOR, 0.0015);

const camera = new THREE.PerspectiveCamera(
  55,
  window.innerWidth / window.innerHeight,
  0.5,
  20000,
);
camera.position.set(0, 30, 100);
camera.lookAt(0, 10, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.6;
document.body.appendChild(renderer.domElement);

let currentEnv = oceanEnv;
let envHandle = currentEnv.setup(scene);

const ambientLight = new THREE.AmbientLight(0x223344, 0.4);
scene.add(ambientLight);

const dirLight = new THREE.DirectionalLight(0xaabbcc, 0.6);
dirLight.position.set(0, 100, -200);
scene.add(dirLight);

const composer = new EffectComposer(renderer);
composer.setSize(window.innerWidth, window.innerHeight);
composer.setPixelRatio(window.devicePixelRatio);
composer.addPass(new RenderPass(scene, camera));

const bloomPass = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  1.4,
  0.6,
  0.75,
);
composer.addPass(bloomPass);
composer.addPass(new OutputPass());

const cameraBase = camera.position.clone();
let shakeIntensity = 0;

/**
 * Bump the camera shake intensity. Decays exponentially each frame.
 * @param {number} amount New target intensity. Larger = more violent.
 */
export function shake(amount) {
  shakeIntensity = Math.max(shakeIntensity, amount);
}

/**
 * Trigger the fullscreen white flash overlay. Pops to opacity 1 immediately,
 * then eases back to 0 over 1.2s.
 */
export function flash() {
  const el = document.getElementById('flash');
  if (!el) return;
  el.style.transition = 'none';
  el.style.opacity = '1';
  void el.offsetWidth;
  el.style.transition = 'opacity 1.2s ease-out';
  el.style.opacity = '0';
}

const stateLabel = document.getElementById('state-label');
const vignetteEl = document.getElementById('vignette');
const preflightEl = document.getElementById('preflight');
const restartOverlayEl = document.getElementById('restart-overlay');
const energyMeterEl = document.getElementById('energy-meter');
const energyFillEl = energyMeterEl
  ? energyMeterEl.querySelector('.energy-fill')
  : null;
const energyReadoutEl = energyMeterEl
  ? energyMeterEl.querySelector('.meter-readout')
  : null;

if (stateLabel) stateLabel.style.color = STATE_COLORS.CALM;

function applyStateLabel(name) {
  if (!stateLabel) return;
  stateLabel.textContent = name;
  const color = STATE_COLORS[name];
  if (color) stateLabel.style.color = color;
}

function resetStormStateToCalm() {
  state.activated = false;
  state.current = 'CALM';
  state.energy = 0;
  state.soundLevel = 0;
  state.bodyCount = 0;
  state.handsUpFraction = 0;
  state.handsWideFraction = 0;
  state.apocalypseTriggered = false;
  state.timeInState = 0;
  state.timeSinceLightning = 0;
  state.highEnergyTime = 0;
  state.apocalypseStartTime = 0;
  climaxFired = false;
  climaxStartTime = 0;
  calmStableTime = 0;
  calmFadedOut = false;
  setAutoLightning(0);
  clearTornadoes(scene);
  applyStateLabel('CALM');
}

function ensureActivateButton() {
  if (document.getElementById('activate-btn')) return;
  const btn = document.createElement('button');
  btn.id = 'activate-btn';
  btn.textContent = 'sit back and relax';
  btn.addEventListener('click', () => {
    btn.classList.add('fading-out');
    setTimeout(() => btn.remove(), 1600);
    activateFullMix();
    state.activated = true;
  });
  document.body.appendChild(btn);
  setTimeout(() => btn.classList.add('visible'), 100);
}

function switchEnvironment(envModule, envName) {
  if (currentEnv && currentEnv.teardown) currentEnv.teardown(scene);
  currentEnv = envModule;
  envHandle = envModule.setup(scene);

  resetStormStateToCalm();

  if (audioMixCtx && audioMixCtx.state === 'suspended') {
    audioMixCtx.resume().catch(() => {});
  }
  deactivateAndResetCalm();

  const restartEl = document.getElementById('restart-overlay');
  if (restartEl) restartEl.classList.remove('visible');

  ensureActivateButton();

  document.querySelectorAll('.env-btn').forEach((b) => {
    b.classList.toggle('active', b.dataset.env === envName.toLowerCase());
  });
  const labelEl = document.getElementById('env-label');
  if (labelEl) labelEl.textContent = envName;
}

function showRestartPrompt() {
  if (!restartOverlayEl) return;
  restartOverlayEl.classList.add('visible');
}

function hideRestartPrompt() {
  if (!restartOverlayEl) return;
  restartOverlayEl.classList.remove('visible');
}

if (restartOverlayEl) {
  restartOverlayEl.addEventListener('click', () => {
    hideRestartPrompt();
    if (audioMixCtx && audioMixCtx.state === 'suspended') {
      audioMixCtx.resume().catch(() => {});
    }

    state.activated = false;
    calmFadedOut = false;
    deactivateAndResetCalm();

    if (!document.getElementById('activate-btn')) {
      const btn = document.createElement('button');
      btn.id = 'activate-btn';
      btn.textContent = 'sit back and relax';
      btn.addEventListener('click', () => {
        btn.classList.add('fading-out');
        setTimeout(() => btn.remove(), 1600);
        activateFullMix();
        state.activated = true;
      });
      document.body.appendChild(btn);
      setTimeout(() => btn.classList.add('visible'), 100);
    }

    climaxFired = false;
    calmStableTime = 0;
    state.soundLevel = 0;
    state.bodyCount = 0;
    state.handsUpFraction = 0;
    state.apocalypseTriggered = false;
    state.highEnergyTime = 0;
  });
}

function updateStateMachine(dt) {
  if (!state.activated) {
    state.energy = 0;
    state.highEnergyTime = 0;
    state.apocalypseTriggered = false;
    if (state.current !== 'CALM') {
      state.current = 'CALM';
      state.timeInState = 0;
      applyStateLabel('CALM');
      setAutoLightning(0);
      clearTornadoes(scene);
    }
    state.timeInState += dt;
    return;
  }

  state.energy =
    state.soundLevel * 0.8 + Math.min(state.bodyCount / 25, 1) * 0.2;

  let next;
  if (state.apocalypseTriggered) {
    next = 'APOCALYPSE';
  } else if (state.energy < 0.18) {
    next = 'CALM';
  } else if (state.energy < 0.50) {
    next = 'CHARGED';
  } else {
    next = 'TEMPEST';
  }

  if (next !== state.current) {
    state.current = next;
    state.timeInState = 0;
    applyStateLabel(next);

    if (next !== 'CALM' && !calmFadedOut) {
      fadeOutCalm(3.0);
      calmFadedOut = true;
    }

    if (next === 'CALM') {
      setAutoLightning(0);
      clearTornadoes(scene);
    } else if (next === 'CHARGED') {
      setAutoLightning(0);
      startMusicLayer();
    } else if (next === 'TEMPEST') {
      setAutoLightning(0.5);
      startMusicLayer();
      spawnTornado(scene, -60, -100);
      spawnTornado(scene, 80, -130);
    } else if (next === 'APOCALYPSE') {
      setAutoLightning(6.0);
      startMusicLayer();
      spawnTornado(scene, -120, -90);
      spawnTornado(scene, 0, -160);
      spawnTornado(scene, 130, -110);
      spawnTornado(scene, -40, -200);
      fireMegaLightning();
      setTimeout(() => fireMegaLightning(), 1500);
      setTimeout(() => fireMegaLightning(), 3000);
      setTimeout(() => fireMegaLightning(), 4500);
      setTimeout(() => fireMegaLightning(), 6000);
    }
  } else {
    state.timeInState += dt;
  }

  state.timeSinceLightning += dt;
}

function applyClimaxLockoutAndRamp(nowMs) {
  if (!climaxFired) return;
  const elapsed = nowMs - climaxStartTime;
  if (elapsed < 2000) {
    state.soundLevel = 0;
    state.bodyCount = 0;
    state.handsUpFraction = 0;
  } else if (elapsed < 8000) {
    const t = (elapsed - 2000) / 6000;
    state.soundLevel *= t;
    state.bodyCount = Math.floor(state.bodyCount * t);
    state.handsUpFraction *= t;
  }
}

function updateClimaxState(dt, nowMs) {
  if (state.energy > 0.80) {
    state.highEnergyTime += dt;
  } else {
    state.highEnergyTime = 0;
  }

  if (
    state.highEnergyTime > HIGH_ENERGY_TRIGGER_S &&
    !state.apocalypseTriggered &&
    !climaxFired
  ) {
    state.apocalypseTriggered = true;
    state.apocalypseStartTime = nowMs;
  }

  if (
    state.current === 'APOCALYPSE' &&
    state.timeInState > APOCALYPSE_HOLD_S &&
    !climaxFired &&
    keyHold.key !== '4'
  ) {
    climaxFired = true;
    climaxStartTime = nowMs;
    flash();
    state.soundLevel = 0;
    state.bodyCount = 0;
    state.handsUpFraction = 0;
    state.apocalypseTriggered = false;
    setAutoLightning(0);

    setTimeout(() => {
      stopAllAudio();
      showRestartPrompt();
    }, 8000);
  }

  if (climaxFired && state.current === 'CALM') {
    calmStableTime += dt;
    if (calmStableTime > 3.0) {
      climaxFired = false;
      calmStableTime = 0;
    }
  } else {
    calmStableTime = 0;
  }
}

function updateLightningTriggers() {
  if (
    state.handsUpFraction > 0.4 &&
    state.current !== 'CALM' &&
    state.timeSinceLightning > 0.4
  ) {
    fireLightning();
    state.timeSinceLightning = 0;
    shake(2);
  }
}

function applyStateShake() {
  if (state.current === 'TEMPEST') {
    shake(0.6 * state.energy);
  } else if (state.current === 'APOCALYPSE') {
    shake(7.5);
  }
}

function applyMicSensitivity() {
  state.soundLevel = Math.min(
    1,
    Math.max(0, state.soundLevel * MIC_SENSITIVITY),
  );
}

function applyKeyHoldOverride() {
  if (!keyHold.key) return false;
  state.soundLevel = keyHold.soundLevel;
  state.bodyCount = keyHold.bodyCount;
  state.handsUpFraction = 0;
  state.handsWideFraction = 0;
  if (keyHold.apocalypse) {
    state.apocalypseTriggered = true;
    state.highEnergyTime = 0;
  } else {
    state.apocalypseTriggered = false;
    state.highEnergyTime = 0;
  }
  return true;
}

function startRehearsal(nowMs) {
  rehearsalActive = true;
  rehearsalStartTime = nowMs;
  rehearsalApocalypseTriggered = false;
  state.apocalypseTriggered = false;
  state.highEnergyTime = 0;
  climaxFired = false;
  calmStableTime = 0;
}

function updateRehearsalInputs(nowMs) {
  if (!rehearsalActive) return false;
  const elapsed = (nowMs - rehearsalStartTime) / 1000;
  if (elapsed >= 90) {
    rehearsalActive = false;
    return false;
  }
  if (elapsed < 60) {
    state.soundLevel = elapsed / 60;
  } else {
    state.soundLevel = 0;
    if (!rehearsalApocalypseTriggered) {
      state.apocalypseTriggered = true;
      rehearsalApocalypseTriggered = true;
    }
  }
  return true;
}

function updateEnergyMeter() {
  if (!energyFillEl) return;
  const e = THREE.MathUtils.clamp(state.energy, 0, 1);
  energyFillEl.style.height = (e * 100).toFixed(1) + '%';
  if (energyReadoutEl) energyReadoutEl.textContent = e.toFixed(2);
}

function updateVignette() {
  if (!vignetteEl) return;
  const t = THREE.MathUtils.clamp(state.energy, 0, 1);
  let vignetteOp;
  if (t < 0.85) vignetteOp = THREE.MathUtils.lerp(0.45, 0.92, t / 0.85);
  else vignetteOp = THREE.MathUtils.lerp(0.92, 1.0, (t - 0.85) / 0.15);
  vignetteEl.style.opacity = String(vignetteOp);
}

function updatePreflight(dt, audioCtxRef) {
  if (dt > 0) {
    fpsSamples.push(1 / dt);
    if (fpsSamples.length > 60) fpsSamples.shift();
  }

  if (!preflightVisible || !preflightEl) return;

  preflightUpdateAcc += dt;
  if (preflightUpdateAcc < 0.2) return;
  preflightUpdateAcc = 0;

  const avgFps =
    fpsSamples.length > 0
      ? Math.round(
          fpsSamples.reduce((a, b) => a + b, 0) / fpsSamples.length,
        )
      : 0;
  const ctxState = audioCtxRef ? audioCtxRef.state : 'uninit';
  const video = document.getElementById('webcam');
  const camActive = !!(video && video.srcObject && video.videoWidth > 0);

  preflightEl.textContent = [
    `FPS         ${avgFps}`,
    `AUDIO CTX   ${ctxState}`,
    `MIC         ${ctxState === 'running' ? 'active' : 'inactive'}`,
    `WEBCAM      ${camActive ? 'active' : 'inactive'}`,
    `SENSITIVITY ${MIC_SENSITIVITY.toFixed(2)}`,
  ].join('\n');
}

function updateSceneParams() {
  const t = THREE.MathUtils.clamp(state.energy, 0, 1);

  if (state.current === 'APOCALYPSE') {
    bloomPass.strength = 5.5 + Math.sin(performance.now() * 0.012) * 2.5;
  } else {
    bloomPass.strength = THREE.MathUtils.lerp(0.7, 3.2, t);
  }

  let fogDens;
  if (t < 0.85) fogDens = THREE.MathUtils.lerp(0.0008, 0.005, t / 0.85);
  else fogDens = THREE.MathUtils.lerp(0.005, 0.010, (t - 0.85) / 0.15);
  scene.fog.density = fogDens;

  scene.fog.color.setRGB(
    THREE.MathUtils.lerp(0.04, 0.05, t),
    THREE.MathUtils.lerp(0.04, 0.05, t),
    THREE.MathUtils.lerp(0.09, 0.10, t),
  );

  let exposure;
  if (state.current === 'APOCALYPSE') {
    exposure = 0.18;
  } else if (t < 0.85) {
    exposure = THREE.MathUtils.lerp(0.55, 0.28, t / 0.85);
  } else {
    exposure = THREE.MathUtils.lerp(0.28, 0.20, (t - 0.85) / 0.15);
  }
  renderer.toneMappingExposure = exposure;

  let sunElevation;
  if (state.current === 'APOCALYPSE') {
    sunElevation = -3.0;
  } else if (t < 0.85) {
    sunElevation = THREE.MathUtils.lerp(2.0, -2.0, t / 0.85);
  } else {
    sunElevation = THREE.MathUtils.lerp(-2.0, -3.0, (t - 0.85) / 0.15);
  }
  const sunAzimuth = 180 + Math.sin(performance.now() * 0.0001) * 4;
  if (currentEnv.applySun) currentEnv.applySun(sunElevation, sunAzimuth);

  let turbidity;
  if (t < 0.6) {
    turbidity = THREE.MathUtils.lerp(10, 18, t / 0.6);
  } else {
    turbidity = THREE.MathUtils.lerp(18, 4, (t - 0.6) / 0.4);
  }
  const rayleigh = THREE.MathUtils.lerp(2.5, 0.05, t);
  const mieCoefficient = THREE.MathUtils.lerp(0.005, 0.04, t);
  const mieG = THREE.MathUtils.lerp(0.8, 0.999, t);
  if (currentEnv.applySkyAtmosphere) {
    currentEnv.applySkyAtmosphere(turbidity, rayleigh, mieCoefficient, mieG);
  }

  if (state.current === 'APOCALYPSE') {
    ambientLight.intensity = 0.35;
    dirLight.intensity = 0.45;
  } else if (t < 0.85) {
    ambientLight.intensity = THREE.MathUtils.lerp(0.4, 0.28, t / 0.85);
    dirLight.intensity = THREE.MathUtils.lerp(0.6, 0.38, t / 0.85);
  } else {
    const k = (t - 0.85) / 0.15;
    ambientLight.intensity = THREE.MathUtils.lerp(0.28, 0.25, k);
    dirLight.intensity = THREE.MathUtils.lerp(0.38, 0.32, k);
  }
}

function updateShake() {
  if (shakeIntensity > 0.001) {
    const ix = (Math.random() - 0.5) * 2 * shakeIntensity;
    const iy = (Math.random() - 0.5) * 2 * shakeIntensity * 0.5;
    const iz = (Math.random() - 0.5) * 2 * shakeIntensity;
    camera.position.set(
      cameraBase.x + ix,
      cameraBase.y + iy,
      cameraBase.z + iz,
    );
    shakeIntensity *= 0.92;
  } else {
    camera.position.copy(cameraBase);
    shakeIntensity = 0;
  }
}

const hudSound = document.getElementById('hud-sound');
const hudBodies = document.getElementById('hud-bodies');
const hudHands = document.getElementById('hud-hands');
const hudEnergy = document.getElementById('hud-energy');

function updateHud() {
  if (hudSound) hudSound.textContent = `SOUND  (${state.soundLevel.toFixed(2)})`;
  if (hudBodies) hudBodies.textContent = `BODIES (${state.bodyCount})`;
  if (hudHands) hudHands.textContent = `HANDS  (${state.handsUpFraction.toFixed(2)})`;
  if (hudEnergy) hudEnergy.textContent = `ENERGY (${state.energy.toFixed(2)})`;
}

createRain(scene);
initLightning();
initLightning3D(scene);
initSoundWave();

let prev = performance.now();
function tick(now) {
  requestAnimationFrame(tick);
  let dt = (now - prev) / 1000;
  prev = now;
  if (dt > 0.1) dt = 0.1;

  try {
    const inRehearsal = updateRehearsalInputs(now);
    if (!inRehearsal) {
      applyMicSensitivity();
    }
    applyKeyHoldOverride();
    applyClimaxLockoutAndRamp(now);
    updateStateMachine(dt);
    updateClimaxState(dt, now);
    updateLightningTriggers();
    applyStateShake();
    updateSceneParams();
    updateShake();

    if (currentEnv.update) currentEnv.update(dt, state.energy, state.current);

    updateRain(dt, state.energy, state.current);
    updateTornadoes(dt, state.energy, state.current);
    updateLightning3D();
    if (state.activated) setAudioEnergy(state.energy);
    updateVignette();
    updateEnergyMeter();

    composer.render();
    updateHud();
    updatePreflight(dt, audioCtx);
  } catch (err) {
    console.error('STORM tick error:', err);
  }
}
requestAnimationFrame(tick);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
});

window.addEventListener('keydown', (ev) => {
  if (!state.activated && ['1', '2', '3', '4'].includes(ev.key)) return;

  if (ev.ctrlKey && ev.shiftKey && (ev.key === 'r' || ev.key === 'R')) {
    ev.preventDefault();
    location.reload();
    return;
  }

  if (ev.ctrlKey || ev.metaKey || ev.altKey) return;

  switch (ev.key) {
    case '1':
      keyHold.key = '1';
      keyHold.soundLevel = 0.05;
      keyHold.bodyCount = 1;
      keyHold.apocalypse = false;
      state.apocalypseTriggered = false;
      break;
    case '2':
      keyHold.key = '2';
      keyHold.soundLevel = 0.30;
      keyHold.bodyCount = 12;
      keyHold.apocalypse = false;
      state.apocalypseTriggered = false;
      break;
    case '3':
      keyHold.key = '3';
      keyHold.soundLevel = 0.65;
      keyHold.bodyCount = 30;
      keyHold.apocalypse = false;
      state.apocalypseTriggered = false;
      break;
    case '4':
      keyHold.key = '4';
      keyHold.soundLevel = 1.0;
      keyHold.bodyCount = 50;
      keyHold.apocalypse = true;
      state.apocalypseTriggered = true;
      shake(8);
      break;
    case ' ':
      shake(3);
      ev.preventDefault();
      break;
    case 'f':
    case 'F':
      flash();
      break;
    case 'r':
    case 'R':
      if (rehearsalActive) {
        rehearsalActive = false;
      } else {
        startRehearsal(performance.now());
      }
      break;
    case 'p':
    case 'P':
      preflightVisible = !preflightVisible;
      if (preflightEl) {
        preflightEl.style.display = preflightVisible ? 'block' : 'none';
      }
      break;
  }
});

window.addEventListener('keyup', (ev) => {
  if (['1', '2', '3', '4'].includes(ev.key) && keyHold.key === ev.key) {
    keyHold.key = null;
    keyHold.apocalypse = false;
    if (ev.key === '4') {
      state.apocalypseTriggered = false;
    }
  }
});

let audioCtx = null;
let audioMixCtx = null;
attachAudioToState(state)
  .then((ctx) => {
    audioCtx = ctx;
  })
  .catch((err) => console.warn('Audio init failed:', err));
attachPoseToState(state).catch((err) => console.warn('Pose init failed:', err));
initAudioMix()
  .then((ctx) => {
    audioMixCtx = ctx;
  })
  .catch((err) => console.warn('AudioMix init failed:', err));

let activateButtonScheduled = false;

function resumeAudioOnGesture() {
  let bothReady = true;
  if (audioCtx) {
    if (audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {});
    }
  } else {
    bothReady = false;
  }
  if (audioMixCtx) {
    if (audioMixCtx.state === 'suspended') {
      audioMixCtx.resume().catch(() => {});
    }
    startAudioMix();
    if (!activateButtonScheduled) {
      activateButtonScheduled = true;
      setTimeout(() => {
        const btn = document.getElementById('activate-btn');
        if (btn) btn.classList.add('visible');
      }, 1200);
    }
  } else {
    bothReady = false;
  }
  if (!bothReady) return;
  window.removeEventListener('click', resumeAudioOnGesture);
  window.removeEventListener('keydown', resumeAudioOnGesture);
}
window.addEventListener('click', resumeAudioOnGesture);
window.addEventListener('keydown', resumeAudioOnGesture);

window.STORM = {
  state,
  shake,
  flash,
  scene,
  camera,
  bloomPass,
  fireLightning,
  setAutoLightning,
  playThunder,
  get water() {
    return currentEnv.getWater ? currentEnv.getWater() : null;
  },
  get currentEnv() {
    return currentEnv;
  },
};

const initialActivateBtn = document.getElementById('activate-btn');
if (initialActivateBtn) {
  initialActivateBtn.addEventListener('click', () => {
    initialActivateBtn.classList.add('fading-out');
    setTimeout(() => initialActivateBtn.remove(), 1600);
    activateFullMix();
    state.activated = true;
  });
}

document.querySelectorAll('.env-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    const env = btn.dataset.env;
    if (env === 'ocean') switchEnvironment(oceanEnv, 'OCEAN');
    else if (env === 'mountains') switchEnvironment(mountainsEnv, 'MOUNTAINS');
    else if (env === 'arctic') switchEnvironment(arcticEnv, 'ARCTIC');
  });
});
