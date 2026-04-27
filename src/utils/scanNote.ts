/**
 * Scan a handwritten note image via Claude Vision (routed through the
 * existing claude-proxy Netlify function). Returns the transcribed text.
 */

// ── Image compression ─────────────────────────────────────────────────────────

/**
 * Shrink an image to fit within `maxPx` on the longest side, encode as JPEG,
 * and return the raw base64 string (no data-URL prefix).
 */
function compressToBase64(file: File, maxPx = 1200, quality = 0.85): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      const scale = Math.min(1, maxPx / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width  = Math.round(img.width  * scale);
      canvas.height = Math.round(img.height * scale);

      const ctx = canvas.getContext('2d');
      if (!ctx) { reject(new Error('Canvas not available')); return; }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      // Always output JPEG for consistent size/quality
      const dataUrl = canvas.toDataURL('image/jpeg', quality);
      resolve(dataUrl.split(',')[1]); // strip "data:image/jpeg;base64," prefix
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Failed to load image'));
    };

    img.src = objectUrl;
  });
}

// ── Claude Vision call ────────────────────────────────────────────────────────

/**
 * Send the image to Claude Vision (via claude-proxy) and return the
 * transcribed handwritten text. Throws on network or API error.
 */
export async function scanHandwrittenNote(file: File): Promise<string> {
  const base64 = await compressToBase64(file);

  const res = await fetch('/.netlify/functions/claude-proxy', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system:
        'You transcribe handwritten text from photos. ' +
        'Return ONLY the transcribed text, preserving line breaks. ' +
        'If no legible text is found, reply with exactly: [no text found]',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: 'image/jpeg',
                data: base64,
              },
            },
            {
              type: 'text',
              text: 'Please transcribe all handwritten text from this image.',
            },
          ],
        },
      ],
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => res.statusText);
    throw new Error(`Vision API error: ${detail}`);
  }

  const data = (await res.json()) as { content?: Array<{ type: string; text?: string }> };
  const text = data.content?.find(b => b.type === 'text')?.text?.trim() ?? '';

  if (!text || text === '[no text found]') {
    throw new Error('No legible text found in the image.');
  }

  return text;
}
