import { requireUser, json, errorResponse, HttpError } from '../server/auth.js';
import { coachReply, CoachTurn } from '../server/coach.js';

const MAX_MESSAGE = 4000;
const MAX_CONTEXT = 24000;
const MAX_HISTORY_TURNS = 30;
const MAX_TURN = 8000;

export async function POST(request: Request) {
  try {
    await requireUser(request);
    const body: any = await request.json().catch(() => ({}));

    const message = String(body.message || '').trim();
    if (!message) throw new HttpError(400, 'No message provided.');
    if (message.length > MAX_MESSAGE) throw new HttpError(413, 'Message is too long.');

    const context = String(body.context || '').slice(0, MAX_CONTEXT);

    const history: CoachTurn[] = (Array.isArray(body.history) ? body.history : [])
      .filter((t: any) => t && (t.role === 'user' || t.role === 'assistant') && typeof t.content === 'string')
      .slice(-MAX_HISTORY_TURNS)
      .map((t: any) => ({ role: t.role, content: t.content.slice(0, MAX_TURN) }));

    return json(await coachReply(context, history, message));
  } catch (err) {
    return errorResponse(err);
  }
}
