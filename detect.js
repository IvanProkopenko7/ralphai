/* ─── In-browser label detection (YOLO ONNX) ─────────────────────────── *
 * Model: models/detection-n-480-90deg.onnx (single class, imgsz 480).  *
 * Output: (1, 300, 6) rows of [x1, y1, x2, y2, score, class] in        *
 * letterboxed-480 coords (top-left paste, fill 114, /255 only).        *
 * Returns the best box in SOURCE-pixel coords, or null.                *
 * ───────────────────────────────────────────────────────────────────── */
(function () {
  const MODEL_URL = 'models/detection-n-480-90deg.onnx';
  const INPUT_SIZE = 480;
  const SCORE_MIN = 0.25;
  const IOU_THRESH = 0.5;

  let sessionPromise = null;

  function ensureOrt() {
    if (window.ort) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.20.0/dist/ort.min.js';
      s.onload = resolve;
      s.onerror = () => reject(new Error('Failed to load detection runtime'));
      document.head.appendChild(s);
    });
  }

  async function getSession() {
    if (!sessionPromise) {
      sessionPromise = (async () => {
        await ensureOrt();
        return await window.ort.InferenceSession.create(MODEL_URL, {
          executionProviders: ['wasm'],
        });
      })().catch((e) => {
        sessionPromise = null;
        throw e;
      });
    }
    return sessionPromise;
  }

  function iou(a, b) {
    const x1 = Math.max(a.x, b.x);
    const y1 = Math.max(a.y, b.y);
    const x2 = Math.min(a.x + a.w, b.x + b.w);
    const y2 = Math.min(a.y + a.h, b.y + b.h);
    const inter = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
    if (inter <= 0) return 0;
    return inter / (a.w * a.h + b.w * b.h - inter);
  }

  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Image decode failed'));
      img.src = src;
    });
  }

  async function detectFromSrc(objectUrl) {
    const img = await loadImage(objectUrl);
    const srcW = img.naturalWidth;
    const srcH = img.naturalHeight;
    if (!srcW || !srcH) return null;

    const session = await getSession();

    const scale = INPUT_SIZE / Math.max(srcW, srcH);
    const nw = Math.round(srcW * scale);
    const nh = Math.round(srcH * scale);

    const canvas = document.createElement('canvas');
    canvas.width = INPUT_SIZE;
    canvas.height = INPUT_SIZE;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.fillStyle = 'rgb(114,114,114)';
    ctx.fillRect(0, 0, INPUT_SIZE, INPUT_SIZE);
    ctx.drawImage(img, 0, 0, nw, nh);

    const pixels = ctx.getImageData(0, 0, INPUT_SIZE, INPUT_SIZE).data;
    const input = new Float32Array(1 * 3 * INPUT_SIZE * INPUT_SIZE);
    for (let i = 0; i < INPUT_SIZE * INPUT_SIZE; i++) {
      input[i] = pixels[i * 4] / 255;
      input[INPUT_SIZE * INPUT_SIZE + i] = pixels[i * 4 + 1] / 255;
      input[2 * INPUT_SIZE * INPUT_SIZE + i] = pixels[i * 4 + 2] / 255;
    }

    const tensor = new window.ort.Tensor('float32', input, [1, 3, INPUT_SIZE, INPUT_SIZE]);
    const out = await session.run({ images: tensor });
    const key = Object.keys(out)[0];
    const data = out[key].data; // 300*6

    const boxes = [];
    for (let i = 0; i < 300; i++) {
      const x1 = data[i * 6];
      const y1 = data[i * 6 + 1];
      const x2 = data[i * 6 + 2];
      const y2 = data[i * 6 + 3];
      const score = data[i * 6 + 4];
      if (score < SCORE_MIN) continue;
      boxes.push({
        x: x1 / scale,
        y: y1 / scale,
        w: (x2 - x1) / scale,
        h: (y2 - y1) / scale,
        score,
      });
    }
    if (!boxes.length) return null;

    boxes.sort((a, b) => b.score - a.score);
    const kept = [];
    for (const b of boxes) {
      if (kept.every((k) => iou(k, b) < IOU_THRESH)) kept.push(b);
      if (kept.length >= 10) break;
    }

    const best = kept[0];
    // Clamp to source bounds
    const x = Math.max(0, Math.min(best.x, srcW - 1));
    const y = Math.max(0, Math.min(best.y, srcH - 1));
    const w = Math.max(1, Math.min(best.w, srcW - x));
    const h = Math.max(1, Math.min(best.h, srcH - y));
    return { x, y, width: w, height: h, score: best.score };
  }

  // Non-blocking: never reject — null means "fall back to manual crop".
  async function detectLabelBox(objectUrl) {
    try {
      return await detectFromSrc(objectUrl);
    } catch (_) {
      return null;
    }
  }

  window.RalphAIDetect = { detectLabelBox };
})();
