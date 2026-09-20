/* ─── Cloudflare Worker — Hugging Face proxy ────────────────────────────────── *
 * Stores the Hugging Face API key as a Cloudflare secret (RALPH_Ai_TOKEN).    *
 * The key is never sent to the browser.                                        *
 *                                                                               *
 * Deploy:                                                                       *
 *   cd worker                                                                   *
 *   npx wrangler deploy                                                         *
 *   npx wrangler secret put RALPH_Ai_TOKEN     ← paste key when prompted       *
 * ─────────────────────────────────────────────────────────────────────────── */

const SPACE_ID = 'IvankoMAN/ralphai';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

/* ── Space host cache ──────────────────────────────────────────────── *
 * The HF Hub /host endpoint is rate-limited (1000 req / 5 min), but   *
 * the Space address rarely changes, so resolve it at most once per    *
 * HOST_TTL_MS per isolate and re-resolve on Gradio-level failures.    *
 * ─────────────────────────────────────────────────────────────────── */
const HOST_TTL_MS = 10 * 60 * 1000;
let cachedHost = null;
let cachedHostAt = 0;

async function fetchSpaceHost(apiKey) {
  const hostRes = await fetch(`https://huggingface.co/api/spaces/${SPACE_ID}/host`, {
    headers: { 'Authorization': `Bearer ${apiKey}` }
  });
  if (!hostRes.ok) {
    const details = await hostRes.text();
    throw new Error(`host failed (${hostRes.status}): ${details}`);
  }
  const hostInfo = await hostRes.json();
  if (!hostInfo.host) throw new Error('host failed: empty host in response');
  return hostInfo.host;
}

function forgetSpaceHost() {
  cachedHost = null;
  cachedHostAt = 0;
}

async function resolveSpaceHost(apiKey, forceRefresh = false) {
  if (!forceRefresh && cachedHost && (Date.now() - cachedHostAt) < HOST_TTL_MS) {
    return cachedHost;
  }
  try {
    const host = await fetchSpaceHost(apiKey);
    cachedHost = host;
    cachedHostAt = Date.now();
    return host;
  } catch (e) {
    // Serve stale on transient Hub failures; throw only with no cache at all.
    if (cachedHost) return cachedHost;
    throw e;
  }
}

/* Thrown for pre-inference transport failures (stale host candidates). */
function retryableError(message) {
  const e = new Error(message);
  e.retryable = true;
  return e;
}

/* ─── Fail harvest → R2 (cost-capped) ───────────────────────────────── *
 * - 5% hash sampling: even if an attacker maxes the Worker's 100k      *
 *   req/day free quota on /collect, writes stay ≤ ~300k Class A / mo   *
 *   (limit: 1M) and 7-day lifecycle expiry caps storage (limit: 10 GB).*
 *   Egress on R2 is always $0. Only original full-scene images are     *
 *   stored (miss + low-confidence), capped per request below.          *
 * - Per-request image cap 12 MB; bucket is private (no public reads).  *
 * ──────────────────────────────────────────────────────────────────── */
const COLLECT_SAMPLE_PCT = 5;
const COLLECT_MAX_IMAGE_BYTES = 12 * 1024 * 1024;
const COLLECT_ALLOWED_MIME = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

function collectJson(status, obj) {
  return new Response(JSON.stringify(obj), {
    status, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

async function handleCollect(request, env) {
  if (!env.FAILS_BUCKET) {
    return collectJson(500, { saved: false, reason: 'storage not configured' });
  }
  // Cheap abuse gate: only accept calls coming from the site itself.
  // (Spoofable — real cost safety comes from sampling + caps below.)
  const ref = request.headers.get('Referer') || request.headers.get('Origin') || '';
  if (!/(^|\.)ralphai\.tech$/.test(new URL(ref || 'https://invalid/', 'https://x').hostname) &&
      !/^(localhost|127\.0\.0\.1)/.test(new URL(ref || 'https://invalid/', 'https://x').hostname)) {
    return collectJson(403, { saved: false, reason: 'forbidden' });
  }

  let payload;
  try {
    payload = await request.json();
  } catch {
    return collectJson(400, { saved: false, reason: 'bad json' });
  }
  const { kind, image, meta } = payload || {};
  if (kind !== 'miss' && kind !== 'lowconf') {
    return collectJson(400, { saved: false, reason: 'bad kind' });
  }
  if (typeof image !== 'string') {
    return collectJson(400, { saved: false, reason: 'bad image' });
  }
  const imgMatch = /^data:(image\/(?:jpeg|png|webp));base64,/.exec(image);
  if (!imgMatch) {
    return collectJson(400, { saved: false, reason: 'bad image' });
  }
  const imgExt = COLLECT_ALLOWED_MIME[imgMatch[1]];

  // Stateless 5% sampling — uniform via uuid randomness (checked after uuid below).
  const id = crypto.randomUUID();
  const sampleByte = parseInt(id.slice(0, 2), 16); // 0..255 uniform
  if (sampleByte >= Math.round((COLLECT_SAMPLE_PCT / 100) * 256)) {
    return collectJson(200, { saved: false, reason: 'sampled_out' });
  }

  let bytes;
  try {
    const b64 = image.split(',', 2)[1] || '';
    const bin = atob(b64);
    if (bin.length === 0 || bin.length > COLLECT_MAX_IMAGE_BYTES) {
      return collectJson(400, { saved: false, reason: 'bad size' });
    }
    bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  } catch {
    return collectJson(400, { saved: false, reason: 'bad encoding' });
  }

  const day = new Date().toISOString().slice(0, 10);
  const base = `fails/${kind}/${day}/${id}`;
  const sidecar = JSON.stringify({
    kind, id, day,
    meta: meta && typeof meta === 'object' ? meta : {},
    collectedAt: new Date().toISOString(),
  });
  try {
    await Promise.all([
      env.FAILS_BUCKET.put(`${base}.${imgExt}`, bytes, { httpMetadata: { contentType: imgMatch[1] } }),
      env.FAILS_BUCKET.put(`${base}.json`, sidecar, { httpMetadata: { contentType: 'application/json' } }),
    ]);
  } catch (e) {
    return collectJson(500, { saved: false, reason: 'store failed' });
  }
  return collectJson(200, { saved: true, key: base });
}

/* ─── Label detection → HF Space (server-side only) ─────────────────── *
 * Client uploads a ~480px downscaled image; Space runs                  *
 * detection-n-480-90deg.pt and returns boxes in upload-pixel coords.    *
 * Any failure (timeout/cold/error) → non-200, client falls back to      *
 * manual crop. 9s per-attempt cap keeps us inside the client's 10s      *
 * budget; one stale-host retry may catch a freshly-woken Space.         *
 * Free-tier safe: tiny uploads, short timeouts, no extra services.      *
 * ──────────────────────────────────────────────────────────────────── */
const DETECT_TIMEOUT_MS = 9000;
const DETECT_MAX_IMAGE_BYTES = 600 * 1024;

function detectJson(status, obj) {
  return new Response(JSON.stringify(obj), {
    status, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

async function handleDetect(request, env) {
  const apiKey = env.RALPH_Ai_TOKEN;
  if (!apiKey) {
    return detectJson(500, { error: 'RALPH_Ai_TOKEN secret is not set on this Worker.' });
  }

  let base64Body;
  try {
    base64Body = await request.text();
  } catch {
    return detectJson(400, { error: 'unreadable body' });
  }
  if (!base64Body || base64Body === 'ping') {
    return detectJson(400, { error: 'empty body' });
  }

  let base64Chunk = base64Body;
  let mimeType = 'image/jpeg';
  if (base64Chunk.startsWith('data:')) {
    const parts = base64Chunk.split(',');
    if (parts.length < 2) return detectJson(400, { error: 'bad data url' });
    mimeType = (parts[0].split(':')[1] || '').split(';')[0] || 'image/jpeg';
    if (!mimeType.startsWith('image/')) return detectJson(400, { error: 'not an image' });
    base64Chunk = parts[1];
  }

  let host;
  try {
    host = await resolveSpaceHost(apiKey);
  } catch (e) {
    return detectJson(500, { error: 'Could not resolve HF Space host', details: e.message });
  }

  const boundary = '----WebKitFormBoundaryWorker' + Math.random().toString(36).substring(2);
  let bytes;
  try {
    const binaryString = atob(base64Chunk);
    if (binaryString.length === 0 || binaryString.length > DETECT_MAX_IMAGE_BYTES) {
      return detectJson(400, { error: 'bad size' });
    }
    bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
  } catch {
    return detectJson(400, { error: 'bad encoding' });
  }
  const fileHeader = `--${boundary}\r\nContent-Disposition: form-data; name="files"; filename="detect.jpg"\r\nContent-Type: ${mimeType}\r\n\r\n`;
  const fileFooter = `\r\n--${boundary}--\r\n`;
  const fileHeaderBytes = new TextEncoder().encode(fileHeader);
  const fileFooterBytes = new TextEncoder().encode(fileFooter);
  const multipartBody = new Uint8Array(fileHeaderBytes.length + bytes.length + fileFooterBytes.length);
  multipartBody.set(fileHeaderBytes, 0);
  multipartBody.set(bytes, fileHeaderBytes.length);
  multipartBody.set(fileFooterBytes, fileHeaderBytes.length + bytes.length);

  async function fetchCapped(url, options) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), DETECT_TIMEOUT_MS);
    try {
      return await fetch(url, { ...options, signal: ctrl.signal });
    } catch (e) {
      throw retryableError(`detect fetch aborted/failed: ${e.message || e}`);
    } finally {
      clearTimeout(timer);
    }
  }

  async function attemptDetect(currentHost) {
    const uploadRes = await fetchCapped(`${currentHost}/gradio_api/upload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
      },
      body: multipartBody,
    });
    if (!uploadRes.ok) {
      throw retryableError(`detect upload failed (${uploadRes.status})`);
    }
    const uploadPaths = await uploadRes.json();
    const pathValue = Array.isArray(uploadPaths) ? uploadPaths[0] : uploadPaths;

    const postUrl = `${currentHost}/gradio_api/call/detect`;
    const postRes = await fetchCapped(postUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({ data: [{ path: pathValue, meta: { _type: 'gradio.FileData' } }] }),
    });
    if (!postRes.ok) {
      throw retryableError(`detect queue join failed (${postRes.status})`);
    }
    const { event_id } = await postRes.json();

    const streamRes = await fetchCapped(`${postUrl}/${event_id}`, {
      headers: { 'Authorization': `Bearer ${apiKey}` },
    });
    if (!streamRes.ok) {
      throw retryableError(`detect result stream failed (${streamRes.status})`);
    }
    const text = await streamRes.text();
    if (text.includes('event: error')) {
      const detail = (text.split('event: error\ndata: ')[1] || '').slice(0, 300);
      return detectJson(500, { error: 'Gradio Inference Error', detail });
    }
    if (!text.includes('event: complete')) {
      return detectJson(500, { error: 'Invalid SSE response from Gradio' });
    }
    let hfData;
    try {
      hfData = JSON.parse(text.split('event: complete\ndata: ')[1].split('\n')[0]);
    } catch {
      return detectJson(500, { error: 'Unparseable Gradio response' });
    }
    const payload = Array.isArray(hfData) ? hfData[0] : hfData;
    if (!payload || !Array.isArray(payload.boxes)) {
      return detectJson(500, { error: 'Bad detect payload' });
    }
    const boxes = payload.boxes
      .filter((b) => b && isFinite(b.x1) && isFinite(b.y1) && isFinite(b.x2) && isFinite(b.y2) && isFinite(b.confidence))
      .map((b) => ({ x1: +b.x1, y1: +b.y1, x2: +b.x2, y2: +b.y2, confidence: +b.confidence }))
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 10);
    return detectJson(200, {
      boxes,
      width: +payload.width || 0,
      height: +payload.height || 0,
    });
  }

  try {
    return await attemptDetect(host);
  } catch (e) {
    if (!e.retryable) {
      return detectJson(500, { error: e.message });
    }
    forgetSpaceHost();
    let freshHost;
    try {
      freshHost = await resolveSpaceHost(apiKey, true);
    } catch (re) {
      return detectJson(500, { error: 'Could not resolve HF Space host', details: re.message });
    }
    try {
      return await attemptDetect(freshHost);
    } catch (e2) {
      return detectJson(500, { error: e2.retryable ? e2.message.replace(/^detect /, '') : e2.message });
    }
  }
}

/* ─── Per-IP rate limiting (abuse brake, free-tier safe) ───────────── *
 * In-memory sliding window, per isolate: generous to humans (a legit    *
 * session makes a handful of calls), expensive to floods. Limits:       *
 * inference routes 30/min/IP, /collect 120/min/IP; warmup pings exempt. *
 * Honest limitation: each isolate holds its own buckets, so a botnet    *
 * spread across many isolates gets N×limit — pair with a Cloudflare     *
 * dashboard rate-limiting rule for hard per-IP enforcement. Sampling,   *
 * size caps, and timeouts remain the primary cost defenses.             *
 * ──────────────────────────────────────────────────────────────────── */
const RATE_LIMITS = {
  inference: { max: 30, windowMs: 60 * 1000 },
  collect: { max: 120, windowMs: 60 * 1000 },
};
const rateBuckets = new Map();

function clientIp(request) {
  return (
    request.headers.get('CF-Connecting-IP') ||
    (request.headers.get('X-Forwarded-For') || '').split(',')[0].trim() ||
    ''
  );
}

function rateLimited(request, kind) {
  const ip = clientIp(request);
  if (!ip) return null; // cannot attribute — allow (Cloudflare always sets IP in practice)
  const cfg = RATE_LIMITS[kind];
  const now = Date.now();
  const key = kind + ':' + ip;
  let bucket = rateBuckets.get(key);
  if (!bucket || now >= bucket.reset) {
    bucket = { count: 0, reset: now + cfg.windowMs };
    rateBuckets.set(key, bucket);
  }
  bucket.count += 1;
  if (rateBuckets.size > 2000) {
    for (const [k, v] of rateBuckets) {
      if (now >= v.reset) rateBuckets.delete(k);
      if (rateBuckets.size <= 1000) break;
    }
  }
  if (bucket.count > cfg.max) {
    return new Response(JSON.stringify({ error: 'rate limited, try again shortly' }), {
      status: 429,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json', 'Retry-After': '60' },
    });
  }
  return null;
}

/* ─── Space keep-warm (cron + client ping share this) ─────────────── *
 * Hits the Gradio /info endpoint so the free-tier Space never idles    *
 * into its 48h sleep. Failures are silent by design (next tick retries).*
 * ──────────────────────────────────────────────────────────────────── */
async function warmSpace(env) {
  const apiKey = env.RALPH_Ai_TOKEN;
  if (!apiKey) return;
  try {
    const host = await resolveSpaceHost(apiKey);
    await fetch(`${host}/gradio_api/info`, {
      headers: { 'Authorization': `Bearer ${apiKey}` },
    });
  } catch (_) {
    // Silent — next cron tick or client ping retries.
  }
}

export default {
  async scheduled(event, env, ctx) {
    ctx.waitUntil(warmSpace(env));
  },
  async fetch(request, env) {
    /* ── CORS preflight ── */
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    /* ── Only allow POST ── */
    if (request.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405, headers: CORS_HEADERS });
    }

    const pathname = new URL(request.url).pathname;

    /* ── Fail-harvest endpoint (miss / low-confidence cases → R2) ── */
    if (pathname === '/collect') {
      const limited = rateLimited(request, 'collect');
      if (limited) return limited;
      return handleCollect(request, env);
    }

    /* ── Label detection endpoint (480px image → boxes) ── */
    if (pathname === '/detect') {
      const limited = rateLimited(request, 'inference');
      if (limited) return limited;
      return handleDetect(request, env);
    }

    /* ── Read body explicitly ── */
    const base64Body = await request.text();

    /* ── Empty body or ping — return 200 after trying to wake space ── */
    if (!base64Body || base64Body === 'ping') {
      try {
        const apiKey = env.RALPH_Ai_TOKEN;
        if (apiKey) {
           let host;
           try {
             host = await resolveSpaceHost(apiKey);
           } catch (e) {
             return new Response(JSON.stringify({ error: 'host failed', body: e.message }), {
               status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
             });
           }
           {
              const infoRes = await fetch(`${host}/gradio_api/info`, {
                 headers: { 'Authorization': `Bearer ${apiKey}` }
              });
             if (infoRes.ok) {
               const infoData = await infoRes.json();
               return new Response(JSON.stringify({ warmup: true, api_info: infoData }), {
                 status: 200,
                 headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
               });
              } else {
                const d = await infoRes.text();
                return new Response(JSON.stringify({ error: 'info failed', status: infoRes.status, body: d }), {
                  status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
                });
              }
            }
         }
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), {
          status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
        });
      }
      return new Response(JSON.stringify({ warmup: true }), {
        status: 200,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    /* ── Forward to Hugging Face with secret key ── */
    const limitedClassify = rateLimited(request, 'inference');
    if (limitedClassify) return limitedClassify;
    const apiKey = env.RALPH_Ai_TOKEN;
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'RALPH_Ai_TOKEN secret is not set on this Worker.' }),
        { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
      );
    }

    // 1. Resolve the Space host (cached; handles private spaces automatically).
    // Pre-build the multipart payload once so a stale-host retry reuses it.
    let host;
    try {
      host = await resolveSpaceHost(apiKey);
    } catch (e) {
       return new Response(JSON.stringify({ error: "Could not resolve HF Space host", details: e.message }), {
          status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
       });
    }

    // 2. We need to upload the image to the Gradio space first
      // Convert base64 to Blob, then POST as multipart/form-data
      let base64Chunk = base64Body;
      let mimeType = 'image/jpeg';
      if (base64Chunk.startsWith('data:')) {
        const parts = base64Chunk.split(',');
        mimeType = parts[0].split(':')[1].split(';')[0];
        base64Chunk = parts[1];
      }

      // We need to construct a multipart payload manually for fetch
      const boundary = '----WebKitFormBoundaryWorker' + Math.random().toString(36).substring(2);
      const binaryString = atob(base64Chunk);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      
      const fileHeader = `--${boundary}\r\nContent-Disposition: form-data; name="files"; filename="image.jpg"\r\nContent-Type: ${mimeType}\r\n\r\n`;
      const fileFooter = `\r\n--${boundary}--\r\n`;

      const fileHeaderBytes = new TextEncoder().encode(fileHeader);
      const fileFooterBytes = new TextEncoder().encode(fileFooter);

      const multipartBody = new Uint8Array(fileHeaderBytes.length + bytes.length + fileFooterBytes.length);
      multipartBody.set(fileHeaderBytes, 0);
      multipartBody.set(bytes, fileHeaderBytes.length);
      multipartBody.set(fileFooterBytes, fileHeaderBytes.length + bytes.length);

      // Runs upload → queue → SSE against one host. Throws retryableError()
      // on pre-inference transport failures (stale-host candidates); all
      // terminal outcomes (including model errors) are returned directly.
      async function attempt(currentHost) {
      const uploadUrl = `${currentHost}/gradio_api/upload`;
      const uploadRes = await fetch(uploadUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': `multipart/form-data; boundary=${boundary}`
        },
        body: multipartBody
      });

      if (!uploadRes.ok) {
        const uploadErr = await uploadRes.text();
        throw retryableError(`Failed to upload to Gradio (${uploadRes.status}): ${uploadErr}`);
      }

      const uploadPaths = await uploadRes.json();
      
      // 3. Submit inference task using the uploaded file path
      const pathValue = Array.isArray(uploadPaths) ? uploadPaths[0] : uploadPaths;
      
      const hfPayload = {
        data: [
          {
            path: pathValue,
            meta: { _type: "gradio.FileData" }
          }
        ]
      };

      // 3. Submit inference task to Gradio 4.0 Queue via POST
      const postUrl = `${currentHost}/gradio_api/call/predict`;
      const postAuth = { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      };

      const postRes = await fetch(postUrl, {
        method:  'POST',
        headers: postAuth,
        body: JSON.stringify(hfPayload),
      });

      if (!postRes.ok) {
         const errText = await postRes.text();
         throw retryableError(`Failed to join Gradio inference queue (${postRes.status}): ${errText}`);
      }

      const { event_id } = await postRes.json();

      // 4. Poll / Consume the Server-Sent Events (SSE) inference results
      let streamRes;
      try {
        streamRes = await fetch(`${postUrl}/${event_id}`, {
           headers: { 'Authorization': `Bearer ${apiKey}` }
        });
      } catch (e) {
        throw retryableError(`Failed to read Gradio result stream: ${e.message}`);
      }
      if (!streamRes.ok) {
        throw retryableError(`Gradio result stream failed (${streamRes.status})`);
      }

      // The HTTP fetch blocks until the SSE stream completes or errors out!
      const getParamsText = await streamRes.text();

      // 5. Parse the prediction result from the SSE chunks
      let hfData = null;
      let topLabel = 'unknown';
      let confidence = 0.0;

      if (getParamsText.includes('event: error')) {
         const errorMatch = getParamsText.split('event: error\ndata: ')[1];
         return new Response(JSON.stringify({ error: "Gradio Inference Error", detail: errorMatch }), {
           status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
         });
      }

      if (getParamsText.includes('event: complete')) {
         const dataStr = getParamsText.split('event: complete\ndata: ')[1].split('\n')[0];
         hfData = JSON.parse(dataStr);
      } else {
         return new Response(JSON.stringify({ error: "Invalid SSE response from Gradio", text: getParamsText }), {
           status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
         });
      }

      // 6. Map Gradio response to fake/real only: { top: 'fake'|'real', confidence: 0.99 }
      // Space returns fine-grained classes fake-class-0..3 / real-class-0..3; never leak those.
      if (hfData && hfData.length > 0) {
        const prediction = hfData[0];

        let rawLabel = 'unknown';
        // Handle various Gradio return formats
        if (typeof prediction === 'string') {
          rawLabel = prediction;
          confidence = 1.0;
        } else if (prediction && typeof prediction === 'object') {
          if (prediction.label) {
            rawLabel = prediction.label;
          }
          if (prediction.confidences && prediction.confidences.length > 0) {
            // Arrays are usually sorted by highest confidence
            confidence = prediction.confidences[0].confidence;
          } else {
            confidence = 1.0;
          }
        }

        const lowered = String(rawLabel).toLowerCase();
        if (lowered.startsWith('fake')) {
          topLabel = 'fake';
        } else if (lowered.startsWith('real')) {
          topLabel = 'real';
        } else {
          topLabel = 'unknown';
        }
      }

      const responseData = JSON.stringify({
        top: topLabel,
        confidence: confidence,
        raw: hfData
      });

      return new Response(responseData, {
        status: 200,
        headers: {
          ...CORS_HEADERS,
          'Content-Type': 'application/json',
        },
      });
      } // end attempt()

      try {
        return await attempt(host);
      } catch (e) {
        if (!e.retryable) {
          return new Response(JSON.stringify({ error: e.message }), {
            status: 500,
            headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
          });
        }
        // Possibly stale host (migration/restart): forget, re-resolve, retry once.
        forgetSpaceHost();
        let freshHost;
        try {
          freshHost = await resolveSpaceHost(apiKey, true);
        } catch (re) {
          return new Response(JSON.stringify({ error: "Could not resolve HF Space host", details: re.message }), {
            status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
          });
        }
        try {
          return await attempt(freshHost);
        } catch (e2) {
          return new Response(JSON.stringify({ error: e2.message }), {
            status: 500,
            headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
          });
        }
      }
  },
};
