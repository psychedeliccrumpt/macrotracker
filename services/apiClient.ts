import { supabase } from './supabase';

/**
 * Calls one of the app's own server functions (/api/*).
 * AI API keys live only on the server; the browser just sends the user's
 * Supabase session token so the server knows the request is from a signed-in user.
 */
export const callApi = async <T>(path: string, body: unknown): Promise<T> => {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Please sign in to use this feature.');

  const response = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });

  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 413) throw new Error(result?.error || 'Upload is too large.');
    throw new Error(result?.error || `Request failed (${response.status}).`);
  }
  return result as T;
};

/** Read a Blob as base64 (without the data: URL prefix). */
export const blobToBase64 = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result).split(',')[1] || '');
    reader.onerror = () => reject(new Error('Failed to read data.'));
    reader.readAsDataURL(blob);
  });
