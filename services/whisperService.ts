const openaiApiKey = import.meta.env.VITE_OPENAI_API_KEY;

/**
 * Sends an audio blob to OpenAI Whisper for transcription.
 * No language is specified so Whisper auto-detects and handles
 * multilingual / code-switching input natively.
 */
export const transcribeAudio = async (audioBlob: Blob): Promise<string> => {
  if (!openaiApiKey) {
    throw new Error('Missing VITE_OPENAI_API_KEY. Add it to your .env file.');
  }

  // Derive a sensible file extension from the recorded MIME type
  const mimeType = audioBlob.type || 'audio/webm';
  const ext = mimeType.includes('mp4') ? 'mp4'
    : mimeType.includes('ogg') ? 'ogg'
    : mimeType.includes('wav') ? 'wav'
    : 'webm';

  const formData = new FormData();
  formData.append('file', audioBlob, `recording.${ext}`);
  formData.append('model', 'whisper-1');
  // Intentionally omitting 'language' → Whisper auto-detects every language
  // and handles mixed-language (code-switching) input well.

  const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${openaiApiKey}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Whisper API error: ${response.status}`);
  }

  const data = await response.json();
  return data.text?.trim() ?? '';
};
