import { getAnalyser } from './audio.js';

let canvas, ctx, timeData;

export function initSoundWave() {
  canvas = document.getElementById('soundwave-canvas');
  ctx = canvas.getContext('2d');

  function render() {
    requestAnimationFrame(render);
    const analyser = getAnalyser();
    if (!analyser) return;

    if (!timeData) timeData = new Uint8Array(analyser.fftSize);
    analyser.getByteTimeDomainData(timeData);

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    let sumSq = 0;
    for (let i = 0; i < timeData.length; i++) {
      const v = (timeData[i] - 128) / 128;
      sumSq += v * v;
    }
    const rms = Math.sqrt(sumSq / timeData.length);
    const intensity = Math.min(1, rms * 3);

    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.fillRect(0, h / 2, w, 1);

    ctx.lineWidth = 1.2;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    const r = Math.floor(220 + intensity * 35);
    const g = Math.floor(230 - intensity * 100);
    const b = Math.floor(255 - intensity * 200);
    ctx.strokeStyle = `rgba(${r},${g},${b},${0.5 + intensity * 0.45})`;

    ctx.shadowColor = ctx.strokeStyle;
    ctx.shadowBlur = 4 + intensity * 8;

    const samples = 96;
    const step = Math.floor(timeData.length / samples);

    ctx.beginPath();
    for (let i = 0; i < samples; i++) {
      const v = (timeData[i * step] - 128) / 128;
      const x = (i / (samples - 1)) * w;
      const y = h / 2 + v * (h / 2 - 4) * (0.6 + intensity * 0.4);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.shadowBlur = 0;

    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.font = '8px "JetBrains Mono", "Courier New", monospace';
    ctx.fillText('SIGNAL', 4, 9);
  }
  render();
}
