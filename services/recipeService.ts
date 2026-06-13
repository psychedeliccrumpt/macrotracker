import { supabase } from './supabase';
import { Recipe, FoodItem } from '../types';
import { v4 as uuidv4 } from 'uuid';

export const recipeService = {
    /**
     * Get all private recipes for a user
     */
    async getAll(userId: string): Promise<Recipe[]> {
        const { data, error } = await supabase
            .from('Recipe')
            .select(`
        id,
        name,
        description,
        servings,
        RecipeItem (
            id,
            quantity,
            Food (
                id,
                name,
                calories,
                protein,
                fat,
                carbs,
                servingSize
            )
        )
      `)
            .eq('createdById', userId);

        if (error) {
            console.error('Error fetching recipes:', error);
            return [];
        }

        // Map DB structure to App structure
        return data.map((r: any) => {
            // Calculate total macros on the fly
            const ingredients = r.RecipeItem.map((ri: any) => ({
                id: ri.Food.id,
                name: ri.Food.name,
                quantity: ri.quantity, // This works if 'quantity' in RecipeItem is a multiplier of the base serving.
                // But wait, our App expects 'quantity' to be the number of servings or units. 
                // In the DB, RecipeItem.quantity is the amount of the Food used.
                // Food.servingSize is a string label.
                // We need to verify if Food.calories is per serving or per 100g.
                // In createFood, we saved the BASE macros. 
                // So if Food has 100kcal base, and RecipeItem has quantity 2, it means 200kcal.

                unit: 'serving', // Defaulting for now
                calories: ri.Food.calories * ri.quantity,
                protein: ri.Food.protein * ri.quantity,
                fat: ri.Food.fat * ri.quantity,
                carbs: ri.Food.carbs * ri.quantity,
            }));

            const totalMacros = ingredients.reduce((acc: any, curr: any) => ({
                calories: acc.calories + curr.calories,
                protein: acc.protein + curr.protein,
                fat: acc.fat + curr.fat,
                carbs: acc.carbs + curr.carbs,
            }), { calories: 0, protein: 0, fat: 0, carbs: 0 });

            return {
                id: r.id,
                name: r.name,
                servings: r.servings || 1,
                ingredients: ingredients,
                totalMacros: totalMacros
            };
        });
    },

    /**
     * Create a new recipe
     */
    async create(userId: string, name: string, ingredients: FoodItem[], servings: number = 1) {
        // 1. Create Recipe Header
        const { data: recipeData, error: recipeError } = await supabase
            .from('Recipe')
            .insert({
                id: uuidv4(),
                name,
                servings,
                createdById: userId
            })
            .select()
            .single();

        if (recipeError) throw recipeError;

        // 2. Create Recipe Items
        // Warning: Ingredient Foods must exist in the 'Food' table first. 
        // If they are "Manual" or from "AI" but not saved, we might have an issue.
        // For now, let's assume we only add "Saved Foods" or we auto-save them.
        // simpler strategy: If ingredient has no ID, we skip it or error?
        // Correct strategy: The User *selects* foods from the Search (which pulls from DB/AI).
        // If it's from AI, it might not be in the DB yet.
        // We should probably ensure all ingredients are saved to DB first.

        const itemsToInsert = [];
        for (const ing of ingredients) {
            let foodId = ing.id;

            // If ID looks like auto-generated (from local state) and not UUID, 
            // OR if we just want to be safe, we should check if it exists in DB.
            // Actually, if it came from "Unified Search", it has a real ID if it was from DB.
            // If it was from AI, we need to save it to DB first (as a hidden/private food?) 
            // OR we just create a "Food" entry for it right now.

            // Let's try to treat 'id' as the truth. If it fails foreign key, we have a problem.
            // For robustness: We will create a new 'Food' entry for every ingredient if it's not a valid UUID 
            // or just assume the UI handles "adding to DB" before adding to recipe.
            // Let's implemented the "Auto-Save Ingredient" logic here for robustness.

            if (!foodId || foodId.length < 10) { // simple check for non-UUID
                // Create Food entry on the fly
                const { data: newFood, error: foodError } = await supabase
                    .from('Food')
                    .insert({
                        id: uuidv4(),
                        name: ing.name,
                        calories: ing.calories / ing.quantity, // Base values
                        protein: ing.protein / ing.quantity,
                        fat: ing.fat / ing.quantity,
                        carbs: ing.carbs / ing.quantity,
                        servingSize: ing.unit,
                        createdById: userId,
                        isPublic: false
                    })
                    .select()
                    .single();

                if (foodError) {
                    console.error("Failed to auto-save ingredient:", ing.name, foodError);
                    continue;
                }
                foodId = newFood.id;
            }

            itemsToInsert.push({
                id: uuidv4(),
                recipeId: recipeData.id,
                foodId: foodId,
                quantity: ing.quantity
            });
        }

        const { error: itemsError } = await supabase
            .from('RecipeItem')
            .insert(itemsToInsert);

        if (itemsError) throw itemsError;

        return recipeData;
    },

    /**
     * Update an existing recipe (header + ingredients)
     */
    async update(recipeId: string, userId: string, name: string, ingredients: FoodItem[], servings: number = 1) {
        // 1. Update Recipe Header
        const { error: headerError } = await supabase
            .from('Recipe')
            .update({ name, servings })
            .eq('id', recipeId);

        if (headerError) throw headerError;

        // 2. Delete all existing RecipeItems
        await supabase.from('RecipeItem').delete().eq('recipeId', recipeId);

        // 3. Re-insert ingredients (same auto-save logic as create)
        const itemsToInsert = [];
        for (const ing of ingredients) {
            let foodId = ing.id;

            if (!foodId || foodId.length < 10) {
                const { data: newFood, error: foodError } = await supabase
                    .from('Food')
                    .insert({
                        id: uuidv4(),
                        name: ing.name,
                        calories: ing.calories / ing.quantity,
                        protein: ing.protein / ing.quantity,
                        fat: ing.fat / ing.quantity,
                        carbs: ing.carbs / ing.quantity,
                        servingSize: ing.unit,
                        createdById: userId,
                        isPublic: false
                    })
                    .select()
                    .single();

                if (foodError) {
                    console.error("Failed to auto-save ingredient:", ing.name, foodError);
                    continue;
                }
                foodId = newFood.id;
            }

            itemsToInsert.push({
                id: uuidv4(),
                recipeId: recipeId,
                foodId: foodId,
                quantity: ing.quantity
            });
        }

        if (itemsToInsert.length > 0) {
            const { error: itemsError } = await supabase
                .from('RecipeItem')
                .insert(itemsToInsert);

            if (itemsError) throw itemsError;
        }

        return { id: recipeId, name, servings };
    },

    /**
     * Delete a recipe
     */
    async delete(recipeId: string) {
        // Cascade delete is handled by DB usually, but let's be safe
        // Prisma relations might not auto-cascade in Supabase unless defined in SQL.
        // We manually delete items first.
        await supabase.from('RecipeItem').delete().eq('recipeId', recipeId);
        const { error } = await supabase.from('Recipe').delete().eq('id', recipeId);
        if (error) throw error;
    }
};
