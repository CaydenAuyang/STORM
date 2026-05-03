const FILES = {
  music: 'audio/music.mp3',
  rumble: 'audio/rumble.mp3',
  wind: 'audio/wind.mp3',
  calm: 'audio/calm.mp3',
  thunder: ['audio/thunder1.wav', 'audio/thunder2.wav', 'audio/thunder3.wav'],
};

const CALM_GAIN = 0.4;

let ctx = null;
const layers = {};
const thunderBuffers = [];
let started = false;
let musicStarted = false;
let masterGain = null;

function loadStreamingLayer(name, url) {
  const audio = new Audio();
  audio.src = url;
  audio.loop = true;
  audio.crossOrigin = 'anonymous';
  audio.preload = 'auto';

  const source = ctx.createMediaElementSource(audio);
  const gainNode = ctx.createGain();
  gainNode.gain.value = 0;
  source.connect(gainNode).connect(masterGain);
  layers[name] = { audio, gainNode };
}

async function loadThunderBuffer(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetch ${url} -> ${res.status}`);
  const arr = await res.arrayBuffer();
  return await ctx.decodeAudioData(arr);
}

export async function initAudioMix() {
  ctx = new (window.AudioContext || window.webkitAudioContext)();
  masterGain = ctx.createGain();
  masterGain.gain.value = 1.0;
  masterGain.connect(ctx.destination);

  loadStreamingLayer('music', FILES.music);
  loadStreamingLayer('wind', FILES.wind);
  loadStreamingLayer('rumble', FILES.rumble);
  loadStreamingLayer('calm', FILES.calm);
  if (layers.calm) layers.calm.gainNode.gain.value = CALM_GAIN;

  for (const url of FILES.thunder) {
    try {
      const buf = await loadThunderBuffer(url);
      thunderBuffers.push(buf);
    } catch (err) {
      console.warn('[audioMix] thunder load failed:', url, err);
    }
  }

  console.log(
    '[audioMix] init complete. ctx.state =',
    ctx.state,
    '| layers:',
    Object.keys(layers),
    '| thunder buffers:',
    thunderBuffers.length,
  );
  return ctx;
}

export function startAudioMix() {
  if (!ctx) {
    console.warn('[audioMix] startAudioMix called before init; ignoring');
    return;
  }
  if (started) return;
  started = true;
  console.log('[audioMix] startAudioMix() called. ctx.state =', ctx.state);
  for (const name in layers) {
    layers[name].audio.play()
      .then(() => console.log('[audioMix] playing layer:', name))
      .catch((err) =>
        console.warn('[audioMix] layer play() failed:', name, err),
      );
  }
}

export function setEnergy(energy) {
  if (!started) return;
  const e = Math.max(0, Math.min(1, energy));

  if (layers.music) {
    layers.music.gainNode.gain.value = musicStarted ? 0.08 + e * 0.62 : 0;
  }
  if (layers.wind) {
    layers.wind.gainNode.gain.value = 0.05 + e * 0.55;
  }
  if (layers.rumble) {
    layers.rumble.gainNode.gain.value = Math.max(0, e - 0.25) * 0.95;
  }
}

export function playThunder() {
  if (!ctx || thunderBuffers.length === 0) return;
  const buf = thunderBuffers[Math.floor(Math.random() * thunderBuffers.length)];
  const source = ctx.createBufferSource();
  source.buffer = buf;
  const gain = ctx.createGain();
  gain.gain.value = 0.55 + Math.random() * 0.35;
  source.connect(gain).connect(masterGain);
  source.start(0);
}

function playLayer(name) {
  const layer = layers[name];
  if (!layer) return;
  layer.audio.play().catch((err) =>
    console.warn('[audioMix] play layer failed:', name, err),
  );
}

function stopLayer(name, fadeMs = 300) {
  const layer = layers[name];
  if (!layer || !ctx) return;
  const now = ctx.currentTime;
  try {
    layer.gainNode.gain.cancelScheduledValues(now);
    layer.gainNode.gain.setValueAtTime(layer.gainNode.gain.value, now);
    layer.gainNode.gain.linearRampToValueAtTime(0, now + fadeMs / 1000);
  } catch (e) {}
  setTimeout(() => {
    try {
      layer.audio.pause();
      layer.audio.currentTime = 0;
    } catch (e) {}
  }, fadeMs + 50);
}

export function activateFullMix() {
  if (!ctx) return;
  for (const name of ['wind', 'rumble']) {
    const layer = layers[name];
    if (layer && layer.audio.paused) playLayer(name);
  }
  if (layers.music) {
    layers.music.gainNode.gain.value = 0;
  }
  console.log('[audioMix] activateFullMix() called (music deferred until CHARGED)');
}

export function startMusicLayer() {
  if (!ctx || musicStarted) return;
  const layer = layers.music;
  if (!layer) return;
  musicStarted = true;
  if (layer.audio.paused) playLayer('music');
  console.log('[audioMix] startMusicLayer() called');
}

export function fadeOutCalm(seconds = 3.0) {
  if (!ctx) return;
  const calm = layers.calm;
  if (!calm) return;
  const now = ctx.currentTime;
  try {
    calm.gainNode.gain.cancelScheduledValues(now);
    calm.gainNode.gain.setValueAtTime(calm.gainNode.gain.value, now);
    calm.gainNode.gain.linearRampToValueAtTime(0, now + seconds);
  } catch (e) {}
  setTimeout(() => {
    try {
      calm.audio.pause();
      calm.audio.currentTime = 0;
    } catch (e) {}
  }, seconds * 1000 + 100);
  console.log('[audioMix] fadeOutCalm() called');
}

export function deactivateAndResetCalm() {
  if (!ctx) return;
  musicStarted = false;
  for (const name of ['music', 'wind', 'rumble']) {
    stopLayer(name, 300);
  }
  const calm = layers.calm;
  if (calm) {
    const now = ctx.currentTime;
    try {
      calm.gainNode.gain.cancelScheduledValues(now);
      calm.gainNode.gain.setValueAtTime(0, now);
      calm.gainNode.gain.linearRampToValueAtTime(CALM_GAIN, now + 0.3);
      calm.audio.currentTime = 0;
      calm.audio
        .play()
        .catch((err) =>
          console.warn('[audioMix] calm restart failed:', err),
        );
    } catch (e) {}
  }
  console.log('[audioMix] deactivateAndResetCalm() called');
}

export function stopAllAudio() {
  if (!ctx) return;
  const now = ctx.currentTime;
  for (const name of Object.keys(layers)) {
    const layer = layers[name];
    if (!layer) continue;
    try {
      layer.gainNode.gain.cancelScheduledValues(now);
      layer.gainNode.gain.setValueAtTime(layer.gainNode.gain.value, now);
      layer.gainNode.gain.linearRampToValueAtTime(0, now + 0.3);
    } catch (e) {}
    setTimeout(() => {
      try {
        layer.audio.pause();
        layer.audio.currentTime = 0;
      } catch (e) {}
    }, 350);
  }
  started = false;
  musicStarted = false;
  console.log('[audioMix] stopAllAudio() called');
}

export function getAudioMixContext() {
  return ctx;
}
