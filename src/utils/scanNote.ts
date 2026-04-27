/**
 * Scan a handwritten note image via Claude Vision (claude-proxy).
 * Returns structured track entries when the image contains a tracking table,
 * or plain transcribed text otherwise.
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export interface TrackEntry {
  time:      string;   // e.g. "8:23am"
  condition: string;   // e.g. "migraine"  (may be empty)
  entry:     string;   // symptom / med / supplement name
  notes:     string;   // free text
}

export interface ScanResult {
  /** Pipe-formatted text stored in the Note (human-readable) */
  text:     string;
  /** Structured rows — present when a tracking table was detected */
  entries?: TrackEntry[];
}

// ── Serialisation helpers ─────────────────────────────────────────────────────

const TABLE_MARKER = '__TT__';

/** Serialise entries to the stored pipe format: "__TT__\ntime | cond | entry | notes\n…" */
export function entriesToText(entries: TrackEntry[]): string {
  const rows = entries
    .filter(e => e.time || e.condition || e.entry || e.notes)
    .map(e => `${e.time} | ${e.condition} | ${e.entry} | ${e.notes}`);
  return `${TABLE_MARKER}\n${rows.join('\n')}`;
}

/** Returns true when the note was created from a scanned tracking table. */
export function isTrackTable(text: string): boolean {
  return text.startsWith(TABLE_MARKER);
}

/** Parse the stored pipe lines back into structured entries. */
export function parseTrackTable(text: string): TrackEntry[] {
  const body = text.startsWith(TABLE_MARKER)
    ? text.slice(TABLE_MARKER.length + 1)
    : text;

  return body
    .split('\n')
    .filter(l => l.trim() && (l.match(/\|/g) ?? []).length >= 1)
    .map(l => {
      const [time = '', condition = '', entry = '', ...rest] = l.split('|').map(s => s.trim());
      return { time, condition, entry, notes: rest.join(' | ') };
    })
    .filter(e => e.time || e.condition || e.entry || e.notes);
}

/** Human-readable text for extraction / note preview (strips the marker). */
export function trackTableToPlainText(text: string): string {
  if (!isTrackTable(text)) return text;
  return parseTrackTable(text)
    .map(e => [e.time, e.condition, e.entry, e.notes].filter(Boolean).join(' — '))
    .join('\n');
}

// ── Image compression ─────────────────────────────────────────────────────────

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
      resolve(canvas.toDataURL('image/jpeg', quality).split(',')[1]);
    };
    img.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error('Failed to load image')); };
    img.src = objectUrl;
  });
}

// ── Response parsing helpers ──────────────────────────────────────────────────

/**
 * Extract the first [...] JSON array substring from a string that may contain
 * surrounding prose or markdown code fences.
 */
function extractJsonArray(text: string): string | null {
  const start = text.indexOf('[');
  const end   = text.lastIndexOf(']');
  if (start === -1 || end === -1 || end < start) return null;
  return text.slice(start, end + 1);
}

/** Strip markdown code fences (```json ... ``` or ``` ... ```) from a string. */
function stripFences(text: string): string {
  return text.replace(/^```[\w]*\n?/m, '').replace(/\n?```$/m, '').trim();
}

// ── Claude Vision call ────────────────────────────────────────────────────────

export async function scanHandwrittenNote(file: File): Promise<ScanResult> {
  const base64 = await compressToBase64(file);

  const res = await fetch('/.netlify/functions/claude-proxy', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system: [
        'You read handwritten health tracking forms.',
        'The form has 4 columns: Time | Condition | Symptom/Med/Sup | Notes.',
        '',
        'If the image contains a tracking table, return ONLY a JSON array — no prose, no markdown:',
        '[{"time":"8:23am","condition":"migraine","entry":"dizziness","notes":"lasted an hour"}]',
        'Rules: skip header rows and separator lines. Use empty strings for blank cells.',
        '',
        'If the image is plain handwritten text (not a table), return the text prefixed with TEXT: (no JSON).',
        'If nothing legible: return TEXT:[no text found]',
      ].join('\n'),
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: base64 } },
          { type: 'text', text: 'Please read this handwritten note.' },
        ],
      }],
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => res.statusText);
    throw new Error(`Vision API error: ${detail}`);
  }

  const data = (await res.json()) as { content?: Array<{ type: string; text?: string }> };
  const raw = data.content?.find(b => b.type === 'text')?.text?.trim() ?? '';

  // ── Plain text response ────────────────────────────────────────────────────
  if (raw.startsWith('TEXT:')) {
    const plain = raw.slice(5).trim();
    if (!plain || plain === '[no text found]') throw new Error('No legible text found in the image.');
    return { text: plain };
  }

  // ── JSON table response ────────────────────────────────────────────────────
  // Claude sometimes wraps JSON in prose or markdown fences despite instructions.
  // Extract the first [...] array from anywhere in the response.
  const jsonArray = extractJsonArray(raw);
  if (jsonArray) {
    try {
      const entries = JSON.parse(jsonArray) as TrackEntry[];
      if (Array.isArray(entries) && entries.length > 0) {
        const validEntries = entries.filter(e => e.time || e.condition || e.entry || e.notes);
        if (validEntries.length > 0) {
          return { text: entriesToText(validEntries), entries: validEntries };
        }
      }
    } catch { /* fall through to plain text */ }
  }

  // Final fallback: plain text (strip markdown fences if present)
  const plain = stripFences(raw);
  if (!plain) throw new Error('No legible text found in the image.');
  return { text: plain };
}
