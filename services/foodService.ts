import { supabase } from './supabase';
import { searchFoodNutrition } from './geminiService';
import { SearchResult, FoodItem } from '../types';
import { v4 as uuidv4 } from 'uuid';

export const foodService = {
    /**
     * Search for food in the database (Private + Public)
     * Falls back to Gemini AI if no local results found
     */
    async search(query: string, userId?: string): Promise<SearchResult[]> {
        try {
            const results: SearchResult[] = [];

            // 1. Search in Supabase (Food table), matching the name OR the brand
            //    (e.g. "nurri" should find Nurri's "Vanilla Milk Shake").
            //    Two simple queries merged, so the visibility filter below applies to both.
            const searchBy = (column: 'name' | 'brand') => {
                let qb = supabase
                    .from('Food')
                    .select('*')
                    .ilike(column, `%${query}%`)
                    .limit(10);

                // Filter: Public OR Created by Me
                if (userId) {
                    qb = qb.or(`isPublic.eq.true,createdById.eq.${userId}`);
                } else {
                    qb = qb.eq('isPublic', true);
                }
                return qb;
            };

            const [byName, byBrand] = await Promise.all([searchBy('name'), searchBy('brand')]);
            const error = byName.error || byBrand.error;
            const seen = new Set<string>();
            const data = [...(byName.data || []), ...(byBrand.data || [])]
                .filter((item: any) => (seen.has(item.id) ? false : (seen.add(item.id), true)))
                .slice(0, 10);

            if (error) {
                console.error('Supabase search error:', error);
            }

            // Map food results
            if (data && data.length > 0) {
                results.push(...data.map(item => ({
                    name: item.name,
                    macros: {
                        calories: item.calories,
                        protein: item.protein,
                        fat: item.fat,
                        carbs: item.carbs,
                    },
                    servingSize: item.servingSize || "1 serving",
                    quantity: item.quantity || 1,
                    unit: item.unit || 'serving',
                    servingWeight: item.servingWeight,
                    brand: item.brand,
                    source: item.createdById === userId ? 'personal' : 'community'
                })));
            }

            // 2. Search in Recipes (user's saved recipes)
            if (userId) {
                const { data: recipeData, error: recipeError } = await supabase
                    .from('Recipe')
                    .select(`
                        id, name, servings,
                        RecipeItem (
                            quantity,
                            Food ( calories, protein, fat, carbs )
                        )
                    `)
                    .eq('createdById', userId)
                    .ilike('name', `%${query}%`)
                    .limit(5);

                if (!recipeError && recipeData && recipeData.length > 0) {
                    const recipeResults: SearchResult[] = recipeData.map((r: any) => {
                        const servings = r.servings || 1;
                        const totalMacros = (r.RecipeItem || []).reduce((acc: any, ri: any) => ({
                            calories: acc.calories + (ri.Food?.calories || 0) * ri.quantity,
                            protein: acc.protein + (ri.Food?.protein || 0) * ri.quantity,
                            fat: acc.fat + (ri.Food?.fat || 0) * ri.quantity,
                            carbs: acc.carbs + (ri.Food?.carbs || 0) * ri.quantity,
                        }), { calories: 0, protein: 0, fat: 0, carbs: 0 });

                        return {
                            name: r.name,
                            macros: {
                                calories: totalMacros.calories / servings,
                                protein: totalMacros.protein / servings,
                                fat: totalMacros.fat / servings,
                                carbs: totalMacros.carbs / servings,
                            },
                            servingSize: `1 serving (of ${servings})`,
                            quantity: 1,
                            unit: 'serving',
                            brand: 'My Recipe',
                            source: 'recipe'
                        };
                    });
                    results.push(...recipeResults);
                }
            }

            // If we found any local results, return them
            if (results.length > 0) {
                return results;
            }

            // 3. Fallback to Gemini AI
            console.log('No local results, asking AI...');
            const aiResult = await searchFoodNutrition(query);
            return [aiResult];

        } catch (err) {
            console.error('Unexpected error in searchFood:', err);
            // Fallback
            const aiFallback = await searchFoodNutrition(query);
            return [aiFallback];
        }
    },

    /**
     * Create a new food item in the database
     */
    async createFood(food: any, userId: string, isPublic: boolean = false) {
        const { data, error } = await supabase
            .from('Food')
            .insert({
                id: uuidv4(),
                name: food.name,
                calories: food.calories,
                protein: food.protein,
                fat: food.fat,
                carbs: food.carbs,
                servingSize: food.servingSize, // Descriptive text
                quantity: food.quantity,
                unit: food.unit,
                servingWeight: food.servingWeight, // Optional gram weight
                brand: food.brand,
                createdById: userId,
                isPublic: isPublic
            })
            .select()
            .single();

        if (error) throw error;
        return data;
    }
};
