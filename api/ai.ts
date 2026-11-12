import { requireUser, json, errorResponse, HttpError } from '../server/auth';
import { analyzeFoodLabel, searchFoodNutrition, analyzeNaturalLanguageMeal } from '../server/gemini';

const MAX_TEXT = 2000;
const MAX_IMAGE_BASE64 = 4_000_000; // stays under Vercel's 4.5 MB request limit

export async function POST(request: Request) {
  try {
    await requireUser(request);
    const body = await request.json().catch(() => ({}));
    const { task } = body as { task?: string };

    if (task === 'label') {
      const image = String(body.image || '');
      if (!image) throw new HttpError(400, 'No image provided.');
      if (image.length > MAX_IMAGE_BASE64) throw new HttpError(413, 'Image is too large. Try a smaller photo.');
      return json(await analyzeFoodLabel(image, body.mimeType || 'image/jpeg'));
    }

    const text = String(body.text || '').trim();
    if (!text) throw new HttpError(400, 'No text provided.');
    if (text.length > MAX_TEXT) throw new HttpError(413, 'Text is too long.');

    if (task === 'search') return json(await searchFoodNutrition(text));
    if (task === 'meal') return json(await analyzeNaturalLanguageMeal(text));

    throw new HttpError(400, 'Unknown task.');
  } catch (err) {
    return errorResponse(err);
  }
}
