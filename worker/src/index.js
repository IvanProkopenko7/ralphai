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

    /* ── Read body explicitly ── */
    const base64Body = await request.text();

    /* ── Empty body or ping — return 200 after trying to wake space ── */
    if (!base64Body || base64Body === 'ping') {
      try {
        const apiKey = env.RALPH_Ai_TOKEN;
        if (apiKey) {
           const hostRes = await fetch(`https://huggingface.co/api/spaces/${SPACE_ID}/host`, {
              headers: { 'Authorization': `Bearer ${apiKey}` }
           });
           if (hostRes.ok) {
             const hostInfo = await hostRes.json();
             const infoRes = await fetch(`${hostInfo.host}/gradio_api/info`, {
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
           } else {
             const d = await hostRes.text();
             return new Response(JSON.stringify({ error: 'host failed', status: hostRes.status, body: d }), {
               status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
             });
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

    try {
      // 1. Get the actual host URL for the space (handles private spaces automatically)
      const hostRes = await fetch(`https://huggingface.co/api/spaces/${SPACE_ID}/host`, {
        headers: { 'Authorization': `Bearer ${apiKey}` }
      });
      
      if (!hostRes.ok) {
         const errText = await hostRes.text();
         return new Response(JSON.stringify({ error: "Could not resolve HF Space host", details: errText, status: hostRes.status }), {
            status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
         });
      }
      
      const hostInfo = await hostRes.json();
      
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

      const uploadUrl = `${hostInfo.host}/gradio_api/upload`;
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
        return new Response(JSON.stringify({ error: "Failed to upload to Gradio", status: uploadRes.status, details: uploadErr }), {
           status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
        });
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
      const postUrl = `${hostInfo.host}/gradio_api/call/predict`;
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
         return new Response(JSON.stringify({ error: "Failed to join Gradio inference queue", status: postRes.status, debug: errText }), {
            status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
         });
      }

      const { event_id } = await postRes.json();

      // 4. Poll / Consume the Server-Sent Events (SSE) inference results
      const streamRes = await fetch(`${postUrl}/${event_id}`, {
         headers: { 'Authorization': `Bearer ${apiKey}` }
      });

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

      // 6. Map Gradio response to what your frontend needs: { top: 'class', confidence: 0.99 }
      if (hfData && hfData.length > 0) {
        const prediction = hfData[0];
        
        // Handle various Gradio return formats
        if (typeof prediction === 'string') {
          topLabel = prediction;
          confidence = 1.0;
        } else if (prediction && typeof prediction === 'object') {
          if (prediction.label) {
            topLabel = prediction.label;
          }
          if (prediction.confidences && prediction.confidences.length > 0) {
            // Arrays are usually sorted by highest confidence
            confidence = prediction.confidences[0].confidence;
          } else {
            confidence = 1.0;
          }
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
    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), {
        status: 500,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }
  },
};
