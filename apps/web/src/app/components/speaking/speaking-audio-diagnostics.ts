export interface SpeakingAudioDiagnosticEntry {
  timestamp: string;
  event: string;
  details: Record<string, unknown>;
}

export const SPEAKING_AUDIO_DIAGNOSTICS_LIMIT = 1000;

const STORAGE_KEY = 'flashmind:speaking:audio-diagnostics:v1';

export function logSpeakingAudio(event: string, details: Record<string, unknown> = {}): void {
  const entry: SpeakingAudioDiagnosticEntry = {
    timestamp: new Date().toISOString(),
    event,
    details,
  };

  console.debug(`[SpeakingAudio] ${event} ${safeStringify(details)}`);

  if (typeof localStorage === 'undefined') {
    return;
  }

  try {
    const entries = [...getSpeakingAudioDiagnostics(), entry].slice(
      -SPEAKING_AUDIO_DIAGNOSTICS_LIMIT,
    );
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // 診斷記錄不得影響口說流程。
  }
}

export function getSpeakingAudioDiagnostics(): SpeakingAudioDiagnosticEntry[] {
  if (typeof localStorage === 'undefined') {
    return [];
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }

    const entries = JSON.parse(raw) as unknown;
    if (!Array.isArray(entries)) {
      return [];
    }

    return entries.filter(isSpeakingAudioDiagnosticEntry).slice(-SPEAKING_AUDIO_DIAGNOSTICS_LIMIT);
  } catch {
    return [];
  }
}

export function serializeSpeakingAudioDiagnostics(): string {
  return JSON.stringify(
    {
      version: 1,
      exportedAt: new Date().toISOString(),
      entries: getSpeakingAudioDiagnostics(),
    },
    null,
    2,
  );
}

function isSpeakingAudioDiagnosticEntry(value: unknown): value is SpeakingAudioDiagnosticEntry {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const entry = value as Partial<SpeakingAudioDiagnosticEntry>;
  return (
    typeof entry.timestamp === 'string' &&
    typeof entry.event === 'string' &&
    !!entry.details &&
    typeof entry.details === 'object' &&
    !Array.isArray(entry.details)
  );
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return '{"serializationError":true}';
  }
}
