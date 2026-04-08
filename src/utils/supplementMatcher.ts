/**
 * Fuzzy supplement name matching — handles STT accent/mishearing variants.
 *
 * Strategy (6 passes, in priority order):
 *   1. Exact normalised match
 *   2. Schedule name starts with spoken text
 *   3. Spoken text starts with schedule name
 *   4. Substring — either contains the other
 *   5. Token-subset — all spoken tokens appear (fuzzily) in schedule tokens
 *   6. Majority-token — ≥60% of spoken tokens match (partial identification)
 *
 * "Fuzzy" token comparison uses Levenshtein edit distance with a
 * length-proportional threshold (1 edit per 4 chars, min 1).
 * This handles common accent/STT patterns:
 *   "Miko"   → "Mico-Five"   (k↔c, 1 edit)
 *   "Crayon" → "Creon 25000" (a→e + delete y, 2 edits in 6 chars)
 *   "Thistle Milk" → "Milk Thistle combo" (word-order swap)
 */

/** Normalise: lower-case, hyphens→space, strip non-alphanumeric, collapse spaces. */
export function normSupp(name: string): string {
  return name
    .toLowerCase()
    .replace(/-/g, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Levenshtein edit distance (space-optimised, O(n) memory). */
function editDistance(a: string, b: string): number {
  const m = a.length, n = b.length;
  // Bail out early for clearly different lengths
  if (Math.abs(m - n) > Math.ceil(Math.max(m, n) / 3)) return Math.abs(m - n);
  const dp: number[] = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= n; j++) {
      const tmp = dp[j];
      dp[j] = a[i - 1] === b[j - 1]
        ? prev
        : 1 + Math.min(prev, dp[j], dp[j - 1]);
      prev = tmp;
    }
  }
  return dp[n];
}

/**
 * Are two tokens "similar enough" to count as a match?
 * - Tokens ≤ 2 chars: exact only (prevents "or"/"an" false positives)
 * - Longer: edit distance ≤ ceil(maxLen / 4) — ~1 edit per 4 chars
 *   e.g. 4-char → 1 edit, 5-8 char → 2 edits, 9-12 char → 3 edits
 */
function tokensSimilar(a: string, b: string): boolean {
  if (a === b) return true;
  if (a.length <= 2 || b.length <= 2) return false;
  const threshold = Math.ceil(Math.max(a.length, b.length) / 4);
  return editDistance(a, b) <= threshold;
}

/**
 * Fuzzy-match spoken text against a list of named supplement items.
 * Works with SupplementDatabaseEntry, SupplementSchedule, or any `{ name: string }`.
 */
export function fuzzyMatchSupplementName<T extends { name: string }>(
  spoken: string,
  items: T[],
): T | undefined {
  const s = normSupp(spoken);
  if (s.length < 2) return undefined;

  const spokenTokens = s.split(' ').filter(t => t.length >= 2);
  const n = (name: string) => normSupp(name);
  const schedTokens = (name: string) => n(name).split(' ').filter(t => t.length >= 2);

  // Pass 1: exact normalised
  let r = items.find(e => n(e.name) === s);
  if (r) return r;

  // Pass 2: schedule name starts with spoken
  r = items.find(e => n(e.name).startsWith(s));
  if (r) return r;

  // Pass 3: spoken starts with schedule name
  r = items.find(e => s.startsWith(n(e.name)) && e.name.length >= 3);
  if (r) return r;

  // Pass 4: substring — either contains the other
  r = items.find(e => n(e.name).includes(s) || s.includes(n(e.name)));
  if (r) return r;

  if (spokenTokens.length === 0) return undefined;

  // Pass 5: every spoken token fuzzily matches some schedule token
  r = items.find(e => {
    const st = schedTokens(e.name);
    return st.length > 0 && spokenTokens.every(sp => st.some(sc => tokensSimilar(sp, sc)));
  });
  if (r) return r;

  // Pass 6: ≥60% of spoken tokens match (handles partial/truncated speech)
  if (spokenTokens.length >= 2) {
    r = items.find(e => {
      const st = schedTokens(e.name);
      if (st.length === 0) return false;
      const hits = spokenTokens.filter(sp => st.some(sc => tokensSimilar(sp, sc)));
      return hits.length >= Math.ceil(spokenTokens.length * 0.6);
    });
  }
  return r;
}
