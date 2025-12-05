import { GoogleGenAI, Type } from "@google/genai";
import { SearchResult, Macros } from "../types";

// Initialize Gemini Client
// CRITICAL: process.env.API_KEY is guaranteed to be available.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

/**
 * Analyzes a food label image (US or Chinese).
 * Converts kJ to kcal if necessary.
 * Returns structured JSON.
 */
export const analyzeFoodLabel = async (base64Image: string): Promise<SearchResult> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: "image/jpeg",
              data: base64Image,
            },
          },
          {
            text: `Analyze this food label. Extract the product name (if visible, otherwise "Unknown Food") and nutritional information per serving or per 100g/ml (whichever is standard on the label).
            
            CRITICAL INSTRUCTIONS:
            1. If energy is listed in Kilojoules (kJ) (common on Chinese labels), YOU MUST CONVERT IT TO KCAL (1 kcal = 4.184 kJ). Return only the kcal value.
            2. Extract Protein, Fat, and Carbohydrates in grams.
            3. Identify the serving size or reference amount (e.g., "100g", "1 package").
            
            Return the data in this exact JSON schema.`,
          },
        ],
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING },
            calories: { type: Type.NUMBER, description: "Energy in kcal" },
            protein: { type: Type.NUMBER, description: "Protein in grams" },
            fat: { type: Type.NUMBER, description: "Total Fat in grams" },
            carbs: { type: Type.NUMBER, description: "Total Carbohydrates in grams" },
            servingSize: { type: Type.STRING, description: "e.g. 100g, 1 bottle" },
          },
          required: ["name", "calories", "protein", "fat", "carbs", "servingSize"],
        },
      },
    });

    if (response.text) {
      const data = JSON.parse(response.text);
      return {
        name: data.name,
        macros: {
          calories: data.calories,
          protein: data.protein,
          fat: data.fat,
          carbs: data.carbs,
        },
        servingSize: data.servingSize,
      };
    }
    throw new Error("No data returned from model");
  } catch (error) {
    console.error("Label analysis failed:", error);
    throw error;
  }
};

/**
 * Searches for food nutrition using Google Search Grounding.
 * Parses the result to find estimated macros.
 */
export const searchFoodNutrition = async (query: string): Promise<SearchResult> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Search for the nutritional information for "${query}".
      I need an estimate for Calories (kcal), Protein (g), Fat (g), and Carbs (g) for a standard serving.
      
      Output a JSON object inside a markdown code block (\`\`\`json ... \`\`\`) with the following structure:
      {
        "name": "Standardized Name of Food",
        "calories": number,
        "protein": number,
        "fat": number,
        "carbs": number,
        "servingSize": "e.g. 1 medium banana (118g)"
      }
      
      After the code block, list the source URLs you used.`,
      config: {
        tools: [{ googleSearch: {} }],
        // responseMimeType: "application/json" is NOT allowed with googleSearch
      },
    });

    const text = response.text || "";
    
    // Extract Sources
    const sources = response.candidates?.[0]?.groundingMetadata?.groundingChunks
      ?.map((chunk: any) => chunk.web ? { title: chunk.web.title, uri: chunk.web.uri } : null)
      .filter((s: any) => s !== null) || [];

    // Extract JSON block
    const jsonMatch = text.match(/```json\n([\s\S]*?)\n```/);
    
    if (jsonMatch && jsonMatch[1]) {
      const data = JSON.parse(jsonMatch[1]);
      return {
        name: data.name,
        macros: {
          calories: data.calories,
          protein: data.protein,
          fat: data.fat,
          carbs: data.carbs,
        },
        servingSize: data.servingSize,
        sources: sources,
      };
    }

    // Fallback if no code block found (simple parsing attempt or error)
    throw new Error("Could not parse nutrition data from search results.");

  } catch (error) {
    console.error("Food search failed:", error);
    throw error;
  }
};
