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
 *   (limit: 1M) and 7-day lifecycle expiry caps storage at ~4-5 GB     *
 *   (limit: 10 GB). Egress on R2 is always $0.                         *
 * - Per-request image cap 400 KB; bucket is private (no public reads). *
 * ──────────────────────────────────────────────────────────────────── */
const COLLECT_SAMPLE_PCT = 5;
const COLLECT_MAX_IMAGE_BYTES = 400 * 1024;

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
  if (typeof image !== 'string' || !image.startsWith('data:image/jpeg;base64,')) {
    return collectJson(400, { saved: false, reason: 'bad image' });
  }

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
      env.FAILS_BUCKET.put(`${base}.jpg`, bytes, { httpMetadata: { contentType: 'image/jpeg' } }),
      env.FAILS_BUCKET.put(`${base}.json`, sidecar, { httpMetadata: { contentType: 'application/json' } }),
    ]);
  } catch (e) {
    return collectJson(500, { saved: false, reason: 'store failed' });
  }
  return collectJson(200, { saved: true, key: base });
}

export default {
  async fetch(request, env) {
    /* ── CORS preflight ── */
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    /* ── Only allow POST ── */
    if (request.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405, headers: CORS_HEADERS });
    }

    /* ── Fail-harvest endpoint (miss / low-confidence cases → R2) ── */
    if (new URL(request.url).pathname === '/collect') {
      return handleCollect(request, env);
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
