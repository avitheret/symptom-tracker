// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySpeechRecognition = any;

/** Cross-browser SpeechRecognition constructor, or null if unsupported. */
export function getSpeechRecognition(): AnySpeechRecognition | null {
  if (typeof window === 'undefined') return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const w = window as any;
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}
