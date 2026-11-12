import { callApi, blobToBase64 } from './apiClient';

/**
 * Sends an audio blob to OpenAI Whisper for transcription, via the app's
 * server function (api/transcribe.ts) so the OpenAI key stays on the server.
 * No language is specified so Whisper auto-detects and handles
 * multilingual / code-switching input natively.
 */
export const transcribeAudio = async (audioBlob: Blob): Promise<string> => {
  const audio = await blobToBase64(audioBlob);
  const { text } = await callApi<{ text: string }>('/api/transcribe', {
    audio,
    mimeType: audioBlob.type || 'audio/webm',
  });
  return text ?? '';
};
