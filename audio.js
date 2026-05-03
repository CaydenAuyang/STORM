/**
 * Initialize the microphone and Web Audio analyser.
 *
 * The returned function reads the latest time-domain buffer, computes RMS,
 * and applies a soft compression curve so quiet sounds get a small but
 * audible response without saturating early on loud ones.
 *
 * The underlying AudioContext is exposed as `getLevel.context` so that the
 * caller can resume it on a user gesture (browser autoplay policy).
 *
 * @returns {Promise<Function>} `getLevel()` returning a 0..1 normalized RMS.
 */
let _analyser = null;

export function getAnalyser() {
  return _analyser;
}

export async function initAudio() {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: true,
    video: false,
  });

  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  const audioContext = new AudioCtx();
  const source = audioContext.createMediaStreamSource(stream);
  const analyser = audioContext.createAnalyser();
  analyser.fftSize = 1024;
  analyser.smoothingTimeConstant = 0.3;
  source.connect(analyser);
  _analyser = analyser;

  const buffer = new Uint8Array(analyser.fftSize);

  function getLevel() {
    analyser.getByteTimeDomainData(buffer);
    let sumSq = 0;
    for (let i = 0; i < buffer.length; i++) {
      const v = (buffer[i] - 128) / 128;
      sumSq += v * v;
    }
    const rms = Math.sqrt(sumSq / buffer.length);
    return Math.pow(rms, 0.7);
  }

  getLevel.context = audioContext;
  return getLevel;
}

/**
 * Connect microphone input to the shared state object. Smoothed mic RMS is
 * written to `state.soundLevel` every animation frame.
 *
 * On any failure (permission denial, no device, etc.) a warning is logged and
 * the function resolves to null, leaving `state.soundLevel` at 0.
 *
 * @param {object} state Shared mutable scene state.
 * @returns {Promise<AudioContext|null>}
 */
export async function attachAudioToState(state) {
  let getLevel;
  try {
    getLevel = await initAudio();
  } catch (err) {
    console.warn('STORM audio init failed:', err);
    return null;
  }

  let smoothed = 0;
  function loop() {
    requestAnimationFrame(loop);
    const raw = getLevel();
    smoothed = smoothed * 0.85 + raw * 0.15;
    state.soundLevel = smoothed;
  }
  requestAnimationFrame(loop);

  return getLevel.context;
}
