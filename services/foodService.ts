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
            // 1. Search in Supabase (Food table)
            let queryBuilder = supabase
                .from('Food')
                .select('*')
                .ilike('name', `%${query}%`)
                .limit(10);

            // Filter: Public OR Created by Me
            if (userId) {
                queryBuilder = queryBuilder.or(`isPublic.eq.true,createdById.eq.${userId}`);
            } else {
                queryBuilder = queryBuilder.eq('isPublic', true);
            }

            const { data, error } = await queryBuilder;

            if (error) {
                console.error('Supabase search error:', error);
            }

            // If we found results, map them
            if (data && data.length > 0) {
                return data.map(item => ({
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
                    source: item.createdById === userId ? 'personal' : 'community'
                }));
            }

            // 2. Fallback to Gemini AI
            console.log('No local results, asking AI...');
            const aiResult = await searchFoodNutrition(query);
            // AI returns a single result, wrap in array
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
                createdById: userId,
                isPublic: isPublic
            })
            .select()
            .single();

        if (error) throw error;
        return data;
    }
};
