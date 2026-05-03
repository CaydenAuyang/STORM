import { fireBolt3D } from './lightning3d.js';

let autoLightningRate = 0;
let nextAutoFire = -1;

function scheduleNextAutoFire() {
  const baseInterval = 1000 / autoLightningRate;
  const jitter = baseInterval * 0.3 * (Math.random() * 2 - 1);
  nextAutoFire = performance.now() + baseInterval + jitter;

  if (autoLightningRate >= 2.0) {
    const extras = 2 + Math.floor(Math.random() * 3);
    for (let k = 0; k < extras; k++) {
      setTimeout(() => fireLightning(), 40 + k * 60 + Math.random() * 80);
    }
  }
}

function tick() {
  requestAnimationFrame(tick);
  const now = performance.now();
  if (autoLightningRate > 0 && now > nextAutoFire) {
    fireLightning();
    scheduleNextAutoFire();
  }
}

/**
 * Fire one or more 3D bolts (random styles / positions).
 * @param {number|null} _targetX unused (kept for API compatibility)
 */
export function fireLightning(_targetX = null) {
  fireBolt3D({ mega: false });
  if (autoLightningRate >= 1.2 && Math.random() < 0.4) {
    fireBolt3D({ mega: false });
  }
  if (typeof window !== 'undefined' && window.STORM && window.STORM.playThunder) {
    window.STORM.playThunder();
  }
}

export function fireMegaLightning() {
  const n = 10 + Math.floor(Math.random() * 4);
  for (let i = 0; i < n; i++) {
    fireBolt3D({
      mega: true,
      x: -260 + (i / Math.max(1, n - 1)) * 520 + (Math.random() - 0.5) * 70,
      z: -70 - Math.random() * 260,
    });
  }
  for (let j = 0; j < 3; j++) {
    fireBolt3D({
      mega: true,
      style: 'sheet',
      x: (Math.random() - 0.5) * 180,
      z: -120 - Math.random() * 180,
    });
  }
  if (typeof window !== 'undefined' && window.STORM && window.STORM.playThunder) {
    window.STORM.playThunder();
  }
}

/**
 * Set the auto-fire rate for ambient lightning. 0 disables auto-fire.
 * @param {number} rate Frequency in Hz.
 */
export function setAutoLightning(rate) {
  autoLightningRate = rate;
  if (rate > 0) {
    scheduleNextAutoFire();
  } else {
    nextAutoFire = -1;
  }
}

/**
 * Start the auto-lightning scheduler (3D bolts only; no canvas overlay).
 */
export function initLightning() {
  requestAnimationFrame(tick);
}
