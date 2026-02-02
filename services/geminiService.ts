import { GoogleGenAI, Type } from "@google/genai";
import { SearchResult, Macros } from "../types";

// Initialize Gemini Client
const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
if (!apiKey) {
  console.warn('Gemini API key not found. AI food search will not work.');
}
const ai = new GoogleGenAI({ apiKey: apiKey || 'dummy-key-for-dev' });

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
            
            5. CRITICAL: If the serving size is a COUNT of items (e.g., "11 crackers", "3 cookies"), YOU MUST:
               - Set 'servingSize' to "1 unit" (e.g. "1 cracker").
               - Calculate macros for ONE SINGLE UNIT (divide the serving totals by the count).
               - If the label only gives per 100g, estimate the weight of a single unit.
            6. If the serving size is NOT a count (e.g. "1 cup", "28g"), set 'servingSize' to that string (e.g. "28g").
            
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
            calories: { type: Type.NUMBER, description: "Energy in kcal for ONE SERVING UNIT (e.g. 1 cracker)" },
            protein: { type: Type.NUMBER, description: "Protein in grams for ONE SERVING UNIT" },
            fat: { type: Type.NUMBER, description: "Total Fat in grams for ONE SERVING UNIT" },
            carbs: { type: Type.NUMBER, description: "Total Carbohydrates in grams for ONE SERVING UNIT" },
            servingSize: { type: Type.STRING, description: "The base unit, e.g. '1 cracker' or '28g'" },
            quantity: { type: Type.NUMBER, description: "The count of items in a standard serving, e.g. 11" },
            unit: { type: Type.STRING, description: "The unit name, e.g. 'crackers', 'cookies', 'pieces'" }
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
        quantity: data.quantity || 1,
        unit: data.unit || 'serving',
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
      
      CRITICAL INSTRUCTIONS:
      1. PRIORITIZE RESULTS FROM USDA (FoodData Central) or official brand websites.
      2. If multiple results exist, use the one that matches the USDA data format.
      3. I need an estimate for Calories (kcal), Protein (g), Fat (g), and Carbs (g) for a standard serving.
      
      Output a JSON object inside a markdown code block (\`\`\`json ... \`\`\`) with the following structure:
      {
        "name": "Standardized Name of Food (e.g. 'Sweet Potato, cooked')",
        "brand": "Brand Name or 'Generic'",
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
/**
 * Analyzes a natural language description of a meal (e.g. "2 eggs and a coffee").
 * Returns an array of SearchResult objects.
 */
export const analyzeNaturalLanguageMeal = async (text: string): Promise<SearchResult[]> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `I just ate: "${text}".
      
      CRITICAL INSTRUCTIONS:
      1. Break down the input into individual food items.
      2. For each item, prioritize USDA data or official brand information.
      3. For each item, provide: Name, Calories (kcal), Protein (g), Fat (g), and Carbs (g).
      4. Use a standard serving size for each item unless the user specified an amount (e.g. "2 eggs" vs "eggs").
      5. CRITICAL: If the item is typically counted (e.g. "11 crackers", "5 shrimp"), break it down:
         - Set 'quantity' to the count (e.g. 11).
         - Set 'unit' to the item name (e.g. "crackers").
         - Set macros for ONE SINGLE UNIT (divide total by quantity).
         - Set 'servingSize' to "1 [unit]" (e.g. "1 cracker").
      
      Output a valid JSON array of objects inside a markdown code block (\`\`\`json ... \`\`\`) with this structure:
      [
        {
          "name": "Standardized Name",
          "calories": number,
          "protein": number,
          "fat": number,
          "carbs": number,
          "quantity": number (e.g. 10),
          "unit": "string (e.g. pieces, shrimp, cups)",
          "servingSize": "Descriptive serving of the BASE unit (e.g. 1 large shrimp)",
          "brand": "Brand or 'Generic'"
        }
      ]
      
      After the code block, list the source URLs you used for all items.`,
      config: {
        tools: [{ googleSearch: {} }],
      },
    });

    const outputText = response.text || "";
    const jsonMatch = outputText.match(/```json\n([\s\S]*?)\n```/);

    if (jsonMatch && jsonMatch[1]) {
      const data = JSON.parse(jsonMatch[1]);

      // Extract Sources for context
      const sources = response.candidates?.[0]?.groundingMetadata?.groundingChunks
        ?.map((chunk: any) => chunk.web ? { title: chunk.web.title, uri: chunk.web.uri } : null)
        .filter((s: any) => s !== null) || [];

      return data.map((item: any) => ({
        name: item.name,
        macros: {
          calories: item.calories,
          protein: item.protein,
          fat: item.fat,
          carbs: item.carbs,
        },
        quantity: item.quantity || 1,
        unit: item.unit || 'serving',
        servingSize: item.servingSize,
        sources: sources,
      }));
    }

    throw new Error("Could not parse meal data from AI response.");
  } catch (error) {
    console.error("Meal analysis failed:", error);
    throw error;
  }
};
