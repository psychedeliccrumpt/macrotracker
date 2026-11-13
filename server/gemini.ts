import { GoogleGenAI } from '@google/genai';
import { HttpError } from './auth.js';

// Server-only key: never prefix with VITE_, or Vite will ship it to the browser.
const getClient = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new HttpError(500, 'Server is missing GEMINI_API_KEY.');
  return new GoogleGenAI({ apiKey });
};

const MODEL = 'gemini-2.5-flash';

const extractJson = (text: string): any => {
  try {
    // Try array first (e.g. meal breakdown), then object (e.g. label scan)
    const arrayMatch = text.match(/\[[\s\S]*\]/);
    if (arrayMatch) return JSON.parse(arrayMatch[0]);
    const objectMatch = text.match(/\{[\s\S]*\}/);
    if (objectMatch) return JSON.parse(objectMatch[0]);
    return null;
  } catch (e) {
    return null;
  }
};

const toResult = (data: any, fallbackName: string, source?: string) => ({
  name: data.name || fallbackName,
  macros: {
    calories: Number(data.calories) || 0,
    protein: Number(data.protein) || 0,
    fat: Number(data.fat) || 0,
    carbs: Number(data.carbs) || 0,
  },
  servingSize: data.servingSize || `${data.quantity || 1} ${data.unit || 'serving'}`,
  brand: data.brand || 'Generic',
  quantity: Number(data.quantity) || 1,
  unit: data.unit || 'serving',
  servingWeight: Number(data.servingWeight) || null,
  ...(source ? { source } : {}),
});

/** Image Label Analysis */
export const analyzeFoodLabel = async (base64Image: string, mimeType = 'image/jpeg') => {
  const cleanBase64 = base64Image.includes('base64,') ? base64Image.split('base64,')[1] : base64Image;

  const response = await getClient().models.generateContent({
    model: MODEL,
    contents: [
      {
        role: 'user',
        parts: [
          { inlineData: { mimeType, data: cleanBase64 } },
          {
            text: `Identify and analyze the nutrition label in this image. 
              
              INSTRUCTIONS:
              1. This might be a Chinese nutrition label (营养成分表). Translate relevant terms to English.
              2. If the energy is listed in kJ (千焦), you MUST convert it to kcal (1 kcal = 4.184 kJ).
              3. Macros (Protein, Fat, Carbs) are usually listed per 100g or per serving. Return the values per serving.
               
              Return a JSON object with exactly these fields:
              - name: (string) name of the product
              - brand: (string) brand of the product
              - calories: (number) total calories (kcal) per serving
              - protein: (number) grams of protein per serving
              - fat: (number) grams of total fat per serving
              - carbs: (number) grams of total carbohydrates per serving
              - servingSize: (string) the listed serving size (e.g. "1 cup", "28g", "15 chips")
              - quantity: (number) the numeric quantity of the serving size
              - unit: (string) the unit of the serving size
              - servingWeight: (number) the weight in grams if listed`,
          },
        ],
      },
    ],
    config: { responseMimeType: 'application/json' },
  });

  const data = extractJson(response.text || '');
  if (!data) throw new HttpError(502, 'Could not parse nutrition data from image.');

  return {
    ...toResult(data, 'Unknown Product', 'scan'),
    servingSize: data.servingSize || '1 serving',
  };
};

/** Web Search Grounding */
export const searchFoodNutrition = async (query: string) => {
  const response = await getClient().models.generateContent({
    model: MODEL,
    contents: [
      {
        role: 'user',
        parts: [
          {
            text: `Search for nutrition: "${query}". 
          
          TASK:
          1. Find calories, protein, fat, carbs for 1 standard serving.
          2. Briefly state your source website.
          3. Return JSON object at the end.
          
          CRITICAL:
          - If there are calories, you MUST include the carbohydrates or fats.
          - Total serving values only.
          
          JSON:
          {
            "name": "string",
            "brand": "string",
            "calories": number,
            "protein": number,
            "fat": number,
            "carbs": number,
            "servingSize": "string",
            "quantity": number,
            "unit": "string",
            "servingWeight": number
          }`,
          },
        ],
      },
    ],
    config: { tools: [{ googleSearch: {} }] as any },
  });

  const data = extractJson(response.text || '');
  if (!data) throw new HttpError(502, 'Could not find nutrition data.');

  const sources =
    response.candidates?.[0]?.groundingMetadata?.groundingChunks
      ?.map((chunk: any) => (chunk.web ? { title: chunk.web.title, uri: chunk.web.uri } : null))
      .filter((s: any) => s !== null) || [];

  return { ...toResult(data, query, 'search'), sources };
};

/** Natural-language meal breakdown */
export const analyzeNaturalLanguageMeal = async (text: string) => {
  const response = await getClient().models.generateContent({
    model: MODEL,
    contents: [
      {
        role: 'user',
        parts: [
          {
            text: `Break down this meal into individual food items: "${text}"

Return a JSON array where each element has:
- name: string
- calories: number (kcal)
- protein: number (grams)
- fat: number (grams)
- carbs: number (grams)
- servingSize: string (e.g. "1 cup", "2 eggs")
- quantity: number
- unit: string
- servingWeight: number (grams)

Return ONLY the JSON array, no explanation.`,
          },
        ],
      },
    ],
  });

  const result = extractJson(response.text || '[]');
  const items = (Array.isArray(result) ? result : result ? [result] : []).filter(Boolean);
  if (items.length === 0) throw new HttpError(422, 'Could not parse meal items. Try being more specific.');

  return items.map((item: any) => toResult(item, item.name || 'Food'));
};
