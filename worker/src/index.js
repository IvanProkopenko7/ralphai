/* ─── Cloudflare Worker — Roboflow proxy ──────────────────────────────────── *
 * Stores the Roboflow API key as a Cloudflare secret (ROBOFLOW_API_KEY).      *
 * The key is never sent to the browser.                                        *
 *                                                                               *
 * Deploy:                                                                       *
 *   cd worker                                                                   *
 *   npx wrangler deploy                                                         *
 *   npx wrangler secret put ROBOFLOW_API_KEY   ← paste key when prompted       *
 * ─────────────────────────────────────────────────────────────────────────── */

const MODEL_ID = 'ralphai-5ryt3';
const VERSION  = '2';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

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

    /* ── Warmup ping — empty body, just return 200 without hitting Roboflow ── */
    const contentLength = request.headers.get('Content-Length');
    if (contentLength === '0' || contentLength === null) {
      const body = await request.text();
      if (!body) {
        return new Response(JSON.stringify({ warmup: true }), {
          status: 200,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        });
      }
    }

    /* ── Forward to Roboflow with secret key ── */
    const apiKey = env.ROBOFLOW_API_KEY;
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'ROBOFLOW_API_KEY secret is not set on this Worker.' }),
        { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
      );
    }

    const roboflowUrl = `https://classify.roboflow.com/${MODEL_ID}/${VERSION}?api_key=${apiKey}`;

    /* Stream the raw request body directly to Roboflow */
    const upstream = await fetch(roboflowUrl, {
      method:  'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body:    request.body,
    });

    const data = await upstream.text();

    return new Response(data, {
      status:  upstream.status,
      headers: {
        ...CORS_HEADERS,
        'Content-Type': upstream.headers.get('Content-Type') || 'application/json',
      },
    });
  },
};
