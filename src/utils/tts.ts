// Text-to-Speech utility using Web Speech Synthesis API

export function isTTSSupported(): boolean {
  return 'speechSynthesis' in window;
}

export function speak(
  text: string,
  opts?: { onEnd?: () => void; onStart?: () => void },
): void {
  if (!isTTSSupported()) {
    opts?.onEnd?.();
    return;
  }

  // Stop any current speech
  stopSpeaking();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 1.0;
  utterance.pitch = 1.0;
  utterance.volume = 1.0;
  utterance.lang = 'en-US';

  // Try to pick a natural-sounding voice
  const voices = speechSynthesis.getVoices();
  const preferred = voices.find(
    v => v.lang.startsWith('en') && v.name.toLowerCase().includes('natural'),
  ) ?? voices.find(
    v => v.lang.startsWith('en') && !v.name.toLowerCase().includes('compact'),
  ) ?? voices.find(v => v.lang.startsWith('en'));

  if (preferred) utterance.voice = preferred;

  utterance.onstart = () => opts?.onStart?.();
  utterance.onend = () => opts?.onEnd?.();
  utterance.onerror = () => opts?.onEnd?.();

  speechSynthesis.speak(utterance);
}

export function stopSpeaking(): void {
  if (speechSynthesis.speaking || speechSynthesis.pending) {
    speechSynthesis.cancel();
  }
}

export function isSpeaking(): boolean {
  return speechSynthesis.speaking;
}

/** Summarize long text for voice — keep it under ~100 words */
export function summarizeForVoice(text: string): string {
  // Split into sentences
  const sentences = text.match(/[^.!?]+[.!?]+/g) ?? [text];
  let result = '';
  let wordCount = 0;

  for (const s of sentences) {
    const words = s.trim().split(/\s+/).length;
    if (wordCount + words > 100 && result.length > 0) break;
    result += s;
    wordCount += words;
  }

  return result.trim() || text.slice(0, 300);
}
