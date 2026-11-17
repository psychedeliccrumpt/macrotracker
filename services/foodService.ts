import { supabase } from './supabase';
import { searchFoodNutrition } from './geminiService';
import { SearchResult, FoodItem } from '../types';
import { v4 as uuidv4 } from 'uuid';

export const foodService = {
    /**
     * Search the user's database: their own + public foods (by name or brand) and their recipes.
     */
    async searchDatabase(query: string, userId?: string): Promise<SearchResult[]> {
        const results: SearchResult[] = [];

        // Words of the query: "fairlife chocolate milk" -> ["fairlife", "chocolate", "milk"].
        // Commas/parentheses are stripped because PostgREST filters use them as syntax.
        const words = query.toLowerCase().replace(/[,()%*\\]/g, ' ').split(/\s+/).filter(Boolean);
        if (words.length === 0) return results;

        // 1. Foods. Preferred: the search_foods function (update_schema_v6_search.sql),
        //    which matches every word against brand + name in any order and tolerates typos.
        let data: any[] | null = null;
        let error: { message: string } | null = null;
        const rpc = await supabase.rpc('search_foods', { q: words.join(' '), max_results: 10 });
        if (!rpc.error) {
            data = rpc.data as any[];
        } else {
            // Function not installed yet (or failed): every word must appear in the
            // name or the brand, in any order. No typo tolerance in this fallback.
            if (rpc.error.code !== 'PGRST202' && rpc.error.code !== '42883') {
                console.warn('search_foods failed, using basic search:', rpc.error.message);
            }
            let qb = supabase.from('Food').select('*');
            for (const w of words) qb = qb.or(`name.ilike.%${w}%,brand.ilike.%${w}%`);
            // Filter: Public OR Created by Me (chained .or() filters are ANDed)
            qb = userId ? qb.or(`isPublic.eq.true,createdById.eq.${userId}`) : qb.eq('isPublic', true);
            const res = await qb.limit(10);
            data = res.data;
            error = res.error;
        }

        if (error) {
            console.error('Supabase search error:', error);
            throw new Error(`Database search failed: ${error.message}`);
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
            let recipeQuery = supabase
                .from('Recipe')
                .select(`
                    id, name, servings,
                    RecipeItem (
                        quantity,
                        Food ( calories, protein, fat, carbs )
                    )
                `)
                .eq('createdById', userId);
            // Every word must appear in the recipe name, in any order
            for (const w of words) recipeQuery = recipeQuery.ilike('name', `%${w}%`);
            const { data: recipeData, error: recipeError } = await recipeQuery.limit(5);

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

        return results;
    },

    /**
     * Search online (Gemini + Google Search grounding) for one standard serving.
     */
    async searchOnline(query: string): Promise<SearchResult> {
        return searchFoodNutrition(query);
    },

    /**
     * Database first, falling back to AI only if nothing local matches.
     * (Used by the AI logger's "replace item" search.)
     */
    async search(query: string, userId?: string): Promise<SearchResult[]> {
        try {
            const results = await this.searchDatabase(query, userId);
            if (results.length > 0) return results;
        } catch (err) {
            console.error('Database search failed, asking AI:', err);
        }
        console.log('No local results, asking AI...');
        return [await searchFoodNutrition(query)];
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
