export function canPlaySpeech(text: string): boolean {
  return text.trim().length > 0;
}

export function createAudioCacheKey(text: string): string {
  return `tts:${text.trim()}`;
}
