import { GoogleGenAI, Type } from "@google/genai";
import { SearchResult, Macros } from "../types";

const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
const ai = new GoogleGenAI({ apiKey: apiKey || '' });

const extractJson = (text: string): any => {
  try {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    return JSON.parse(match[0]);
  } catch (e) {
    return null;
  }
};

/**
 * Image Label Analysis
 */
export const analyzeFoodLabel = async (base64Image: string): Promise<SearchResult> => {
  try {
    // Strip data URL prefix if present (e.g., data:image/jpeg;base64,...)
    const cleanBase64 = base64Image.includes('base64,')
      ? base64Image.split('base64,')[1]
      : base64Image;

    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: [
        {
          role: "user",
          parts: [
            { inlineData: { mimeType: "image/jpeg", data: cleanBase64 } },
            {
              text: `Identify the nutritional information from this food label. 
              
              Return a JSON object with exactly these fields:
              - name: (string) name of the product
              - brand: (string) brand of the product
              - calories: (number) total calories per serving
              - protein: (number) grams of protein per serving
              - fat: (number) grams of total fat per serving
              - carbs: (number) grams of total carbohydrates per serving
              - servingSize: (string) the listed serving size (e.g. "1 cup", "28g", "15 chips")
              - quantity: (number) the numeric quantity of the serving size
              - unit: (string) the unit of the serving size
              - servingWeight: (number) the weight in grams if listed`
            }
          ]
        }
      ],
      config: {
        responseMimeType: "application/json"
      }
    });

    const responseText = response.text || "";
    // Robust parsing: use extractJson fallback to handle markdown wrappers or metadata
    const data = extractJson(responseText) || (responseText.includes('{') ? JSON.parse(responseText) : null);

    if (!data) {
      console.error("Gemini failed to return valid JSON. Raw response:", responseText);
      throw new Error("Could not parse nutrition data from image.");
    }

    console.log("Scan Data Parsed:", data);

    return {
      name: data.name || "Unknown Product",
      macros: {
        calories: Number(data.calories) || 0,
        protein: Number(data.protein) || 0,
        fat: Number(data.fat) || 0,
        carbs: Number(data.carbs) || 0,
      },
      servingSize: data.servingSize || "1 serving",
      brand: data.brand || "Generic",
      quantity: Number(data.quantity) || 1,
      unit: data.unit || 'serving',
      servingWeight: Number(data.servingWeight) || null,
      source: 'scan'
    };
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
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: [
        {
          role: "user",
          parts: [{
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
          }` }]
        }
      ],
      config: {
        tools: [{ googleSearch: {} }] as any
      }
    });

    const text = response.text || "";
    const data = extractJson(text);
    if (!data) throw new Error("Could not find nutrition data.");

    const sources = response.candidates?.[0]?.groundingMetadata?.groundingChunks
      ?.map((chunk: any) => chunk.web ? { title: chunk.web.title, uri: chunk.web.uri } : null)
      .filter((s: any) => s !== null) || [];

    return {
      name: data.name || query,
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
      sources: sources,
      source: 'search'
    };
  } catch (error) {
    console.error("AI Search failed:", error);
    throw error;
  }
};

export const analyzeNaturalLanguageMeal = async (text: string): Promise<SearchResult[]> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: [{ role: "user", parts: [{ text: `Meal breakdown: ${text}. Return JSON array.` }] }]
    });

    const result = extractJson(response.text || '[]');
    const items = Array.isArray(result) ? result : [result];

    return items.map((item: any) => ({
      name: item.name,
      macros: {
        calories: Number(item.calories) || 0,
        protein: Number(item.protein) || 0,
        fat: Number(item.fat) || 0,
        carbs: Number(item.carbs) || 0,
      },
      quantity: Number(item.quantity) || 1,
      unit: item.unit || 'serving',
      servingWeight: Number(item.servingWeight) || null,
      servingSize: item.servingSize || `${item.quantity || 1} ${item.unit || 'serving'}`,
      brand: item.brand || 'Generic',
    }));
  } catch (error) {
    console.error("Meal analysis failed:", error);
    throw error;
  }
};
