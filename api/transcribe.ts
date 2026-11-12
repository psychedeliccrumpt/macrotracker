import { requireUser, json, errorResponse, HttpError } from '../server/auth';
import { transcribeAudio } from '../server/whisper';

const MAX_AUDIO_BASE64 = 4_000_000; // stays under Vercel's 4.5 MB request limit (~3 min of voice)

export async function POST(request: Request) {
  try {
    await requireUser(request);
    const { audio, mimeType } = (await request.json().catch(() => ({}))) as { audio?: string; mimeType?: string };
    if (!audio) throw new HttpError(400, 'No audio provided.');
    if (audio.length > MAX_AUDIO_BASE64) throw new HttpError(413, 'Recording is too long. Try a shorter one.');
    return json({ text: await transcribeAudio(audio, mimeType || 'audio/webm') });
  } catch (err) {
    return errorResponse(err);
  }
}
