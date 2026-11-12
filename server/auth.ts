import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/** Only signed-in users of the app may use the AI endpoints (and spend API credits). */
export const requireUser = async (request: Request) => {
  const header = request.headers.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) throw new HttpError(401, 'Please sign in to use this feature.');
  if (!supabaseUrl || !supabaseAnonKey) throw new HttpError(500, 'Server is missing Supabase settings.');

  const supabase = createClient(supabaseUrl, supabaseAnonKey, { auth: { persistSession: false } });
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) throw new HttpError(401, 'Your session has expired. Please sign in again.');
  return data.user;
};

export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

export const errorResponse = (err: unknown) => {
  if (err instanceof HttpError) return json({ error: err.message }, err.status);
  console.error(err);
  return json({ error: err instanceof Error ? err.message : 'Unexpected server error.' }, 500);
};
