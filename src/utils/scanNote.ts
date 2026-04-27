/**
 * Scan a handwritten note image via Claude Vision (claude-proxy).
 * Returns structured track entries when the image contains a tracking table,
 * or plain transcribed text otherwise.
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export interface TrackEntry {
  time:              string;   // e.g. "8:23am"
  condition:         string;   // e.g. "migraine"  (may be empty)
  entry:             string;   // symptom / med / supplement name
  notes:             string;   // free text
  conditionGuessed?: boolean;  // true when condition was inferred from symptom history
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

/** Try multiple strategies to parse entries from a (possibly messy) Claude response. */
function parseEntries(raw: string): TrackEntry[] | null {
  // Strategy 1: direct JSON parse (Claude obeyed the prefill and returned valid continuation)
  for (const candidate of [raw, '[' + raw, raw.trim()]) {
    try {
      const parsed = JSON.parse(candidate);
      if (Array.isArray(parsed) && parsed.length > 0 && typeof parsed[0] === 'object') {
        return parsed as TrackEntry[];
      }
    } catch { /* try next */ }
  }

  // Strategy 2: find the outermost [...] in the string
  const start = raw.indexOf('[');
  const end   = raw.lastIndexOf(']');
  if (start !== -1 && end > start) {
    try {
      const parsed = JSON.parse(raw.slice(start, end + 1));
      if (Array.isArray(parsed) && parsed.length > 0 && typeof parsed[0] === 'object') {
        return parsed as TrackEntry[];
      }
    } catch { /* fall through */ }
  }

  // Strategy 3: Claude omitted the outer [] — wrap and try again
  const stripped = raw.replace(/^```[\w]*\n?/, '').replace(/\n?```$/, '').trim();
  if (stripped.startsWith('{')) {
    try {
      const parsed = JSON.parse('[' + stripped.replace(/,\s*$/, '') + ']');
      if (Array.isArray(parsed)) return parsed as TrackEntry[];
    } catch { /* fall through */ }
  }

  return null;
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
      // System: table → continue JSON array; plain text → special sentinel
      system: [
        'You read handwritten health tracking forms.',
        'The form has 4 columns: Time | Condition | Symptom/Med/Sup | Notes.',
        '',
        'Your response MUST start immediately after the opening "[" that was already output.',
        '',
        'If the image is a tracking table:',
        '  Output each row as a JSON object, ending the array with ]:',
        '  {"time":"8:30","condition":"migraine","entry":"dizziness","notes":"lasted 1h"},',
        '  {"time":"10:00","condition":"","entry":"nausea","notes":""}]',
        '  Skip header rows and separator lines. Empty cells → empty string.',
        '',
        'If the image is plain handwritten text (no table columns):',
        '  Output exactly: "TEXT","the transcribed text here"]',
        '',
        'If nothing is legible:',
        '  Output exactly: "TEXT","[no text found]"]',
      ].join('\n'),
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: base64 } },
            { type: 'text', text: 'Read this image.' },
          ],
        },
        // Assistant prefill — forces Claude to start its response with [
        // so we always get a JSON array structure back.
        {
          role: 'assistant',
          content: '[',
        },
      ],
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => res.statusText);
    throw new Error(`Vision API error: ${detail}`);
  }

  const data = (await res.json()) as { content?: Array<{ type: string; text?: string }> };
  // Claude's response continues from the "[" we prefilled, so prepend it back.
  const raw = '[' + (data.content?.find(b => b.type === 'text')?.text?.trim() ?? '');

  // ── Check for plain-text sentinel ─────────────────────────────────────────
  // Matches: ["TEXT","..."] or ["TEXT:","..."]
  const plainMatch = raw.match(/^\["TEXT:?",\s*"([\s\S]*)"\]$/);
  if (plainMatch) {
    const plain = plainMatch[1].trim();
    if (!plain || plain === '[no text found]') throw new Error('No legible text found in the image.');
    return { text: plain };
  }

  // Also handle legacy TEXT: prefix (no prefill, old format)
  if (raw.startsWith('[TEXT:') || raw === '[') {
    const legacy = raw.replace(/^\[TEXT:\s*/,'').trim();
    if (!legacy || legacy === '[no text found]') throw new Error('No legible text found in the image.');
    return { text: legacy };
  }

  // ── Parse as tracking table entries ───────────────────────────────────────
  const entries = parseEntries(raw);
  if (entries) {
    const valid = entries.filter(e =>
      e && typeof e === 'object' && (e.time || e.condition || e.entry || e.notes)
    );
    if (valid.length > 0) {
      return { text: entriesToText(valid), entries: valid };
    }
  }

  // ── Final fallback: plain text ─────────────────────────────────────────────
  const fallback = raw.replace(/^\[/, '').replace(/^```[\w]*\n?/, '').replace(/\n?```$/, '').trim();
  if (!fallback) throw new Error('No legible text found in the image.');
  return { text: fallback };
}
