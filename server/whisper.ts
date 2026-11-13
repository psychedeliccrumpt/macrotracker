import { HttpError } from './auth.js';

const WHISPER_PROMPT =
  'This is a voice note logging food for a diet tracker. Common terms: calories, macros, protein, carbs, fat, grams, ounces, serving, cup, bowl, breakfast, lunch, dinner, snack. 常见词汇：吃，卡路里，蛋白质，碳水，脂肪，克，份，早饭，午饭，晚饭，零食。';

/** Sends audio to OpenAI Whisper. Server-only key: never prefix with VITE_. */
export const transcribeAudio = async (audioBase64: string, mimeType: string): Promise<string> => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new HttpError(500, 'Server is missing OPENAI_API_KEY.');

  const type = mimeType || 'audio/webm';
  const ext = type.includes('mp4') ? 'mp4' : type.includes('ogg') ? 'ogg' : type.includes('wav') ? 'wav' : 'webm';

  const formData = new FormData();
  formData.append('file', new Blob([Buffer.from(audioBase64, 'base64')], { type }), `recording.${ext}`);
  formData.append('model', 'whisper-1');
  formData.append('prompt', WHISPER_PROMPT);

  const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: formData,
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new HttpError(502, err?.error?.message || `Whisper API error: ${response.status}`);
  }

  const data = await response.json();
  return data.text?.trim() ?? '';
};
