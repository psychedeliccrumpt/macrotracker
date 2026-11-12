import { SearchResult } from "../types";
import { callApi } from "./apiClient";

// All Gemini calls now run on the server (api/ai.ts) so the API key is never shipped to the browser.

const MAX_IMAGE_SIDE = 1600;

/**
 * Shrink large photos before upload: server functions accept at most ~4.5 MB,
 * and a label stays readable well below phone-camera resolution.
 */
const downscaleImage = (base64: string): Promise<string> =>
  new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, MAX_IMAGE_SIDE / Math.max(img.width, img.height));
      if (scale === 1 && base64.length < 3_000_000) return resolve(base64);
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext('2d');
      if (!ctx) return resolve(base64);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', 0.85).split(',')[1]);
    };
    img.onerror = () => resolve(base64);
    img.src = `data:image/jpeg;base64,${base64}`;
  });

/**
 * Image Label Analysis
 */
export const analyzeFoodLabel = async (base64Image: string): Promise<SearchResult> => {
  try {
    const cleanBase64 = base64Image.includes('base64,') ? base64Image.split('base64,')[1] : base64Image;
    const image = await downscaleImage(cleanBase64);
    return await callApi<SearchResult>('/api/ai', { task: 'label', image, mimeType: 'image/jpeg' });
  } catch (error) {
    console.error("Label analysis failed:", error);
    throw error;
  }
};

/**
 * Web Search Grounding
 */
export const searchFoodNutrition = async (query: string): Promise<SearchResult> => {
  try {
    return await callApi<SearchResult>('/api/ai', { task: 'search', text: query });
  } catch (error) {
    console.error("AI Search failed:", error);
    throw error;
  }
};

export const analyzeNaturalLanguageMeal = async (text: string): Promise<SearchResult[]> => {
  try {
    return await callApi<SearchResult[]>('/api/ai', { task: 'meal', text });
  } catch (error) {
    console.error("Meal analysis failed:", error);
    throw error;
  }
};
