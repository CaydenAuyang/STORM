const VISION_BUNDLE =
  'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/vision_bundle.mjs';
const WASM_BASE =
  'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm';
const POSE_MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task';
const OBJECT_MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/object_detector/efficientdet_lite0/float16/1/efficientdet_lite0.tflite';

/**
 * Initialize MediaPipe PoseLandmarker and bind the user's webcam stream to
 * the existing `<video id="webcam">` element. Resolves once the video has
 * data ready for inference.
 *
 * @returns {Promise<object>} The PoseLandmarker instance.
 */
export async function initPose() {
  const { FilesetResolver, PoseLandmarker, ObjectDetector } =
    await import(VISION_BUNDLE);

  const fileset = await FilesetResolver.forVisionTasks(WASM_BASE);

  const landmarker = await PoseLandmarker.createFromOptions(fileset, {
    baseOptions: {
      modelAssetPath: POSE_MODEL_URL,
      delegate: 'GPU',
    },
    runningMode: 'VIDEO',
    numPoses: 4,
    minPoseDetectionConfidence: 0.5,
    minPosePresenceConfidence: 0.5,
    minTrackingConfidence: 0.5,
  });

  const personDetector = await ObjectDetector.createFromOptions(fileset, {
    baseOptions: {
      modelAssetPath: OBJECT_MODEL_URL,
      delegate: 'GPU',
    },
    runningMode: 'VIDEO',
    scoreThreshold: 0.4,
    categoryAllowlist: ['person'],
    maxResults: 25,
  });

  const stream = await navigator.mediaDevices.getUserMedia({
    video: { width: 640, height: 480 },
    audio: false,
  });

  const video = document.getElementById('webcam');
  if (!video) {
    throw new Error('STORM pose: <video id="webcam"> not found in DOM');
  }
  video.srcObject = stream;

  await new Promise((resolve) => {
    if (video.readyState >= 2) {
      resolve();
    } else {
      video.addEventListener('loadeddata', resolve, { once: true });
    }
  });

  return { landmarker, personDetector };
}

/**
 * Wire the pose detector to the shared state object. Each frame, when the
 * webcam has produced new pixel data, run inference and update bodyCount,
 * handsUpFraction, and handsWideFraction on `state`. Hands fractions are
 * exponentially smoothed; bodyCount is written raw.
 *
 * On failure (no camera, permission denied, model load error) a warning is
 * logged and state values stay at 0.
 *
 * @param {object} state Shared mutable scene state.
 */
export async function attachPoseToState(state) {
  let landmarker;
  let personDetector;
  let video;
  try {
    const inits = await initPose();
    landmarker = inits.landmarker;
    personDetector = inits.personDetector;
    video = document.getElementById('webcam');
  } catch (err) {
    console.warn('STORM pose init failed:', err);
    return;
  }

  let lastVideoTime = -1;
  let smoothedHandsUp = 0;
  let smoothedHandsWide = 0;
  let smoothedBodyCount = 0;

  function loop() {
    requestAnimationFrame(loop);

    if (!video || video.readyState < 2) return;
    if (video.currentTime === lastVideoTime) return;
    lastVideoTime = video.currentTime;

    const tNow = performance.now();

    let poseResult;
    try {
      poseResult = landmarker.detectForVideo(video, tNow);
    } catch (_err) {
      poseResult = null;
    }

    let detResult;
    try {
      detResult = personDetector.detectForVideo(video, tNow);
    } catch (_err) {
      detResult = null;
    }

    const poses = (poseResult && poseResult.landmarks) || [];
    const detections = (detResult && detResult.detections) || [];
    const personCount = detections.length;

    smoothedBodyCount = smoothedBodyCount * 0.6 + personCount * 0.4;

    let handsUpCount = 0;
    let handsWideCount = 0;

    for (const lm of poses) {
      if (!lm || lm.length < 17) continue;
      const lw = lm[15];
      const rw = lm[16];
      const ls = lm[11];
      const rs = lm[12];
      if (!lw || !rw || !ls || !rs) continue;

      if (lw.y < ls.y && rw.y < rs.y) {
        handsUpCount++;
      }

      const lWide =
        Math.abs(lw.x - ls.x) > 0.15 && Math.abs(lw.y - ls.y) < 0.1;
      const rWide =
        Math.abs(rw.x - rs.x) > 0.15 && Math.abs(rw.y - rs.y) < 0.1;
      if (lWide && rWide) {
        handsWideCount++;
      }
    }

    const handsRef = poses.length;
    const handsUpFrac = handsRef > 0 ? handsUpCount / handsRef : 0;
    const handsWideFrac = handsRef > 0 ? handsWideCount / handsRef : 0;

    smoothedHandsUp = smoothedHandsUp * 0.8 + handsUpFrac * 0.2;
    smoothedHandsWide = smoothedHandsWide * 0.8 + handsWideFrac * 0.2;

    state.bodyCount = Math.round(smoothedBodyCount);
    state.handsUpFraction = smoothedHandsUp;
    state.handsWideFraction = smoothedHandsWide;
  }
  requestAnimationFrame(loop);
}
