import { supabase } from './supabase';
import { Recipe, FoodItem } from '../types';
import { v4 as uuidv4 } from 'uuid';

/*
 * RecipeItem.quantity is ALWAYS a multiplier of the linked Food row's macros:
 *   ingredient macros = Food macros x RecipeItem.quantity
 * (foodService.search relies on the same rule for recipe results.)
 *
 * Food rows saved from the editor store macros for ONE labeled serving
 * (e.g. "15 chips"), while ingredients can be entered in any unit (g, oz, chips...).
 * So RecipeItem.quantity must be "number of Food servings", not the raw amount typed.
 */

const MASS_UNITS = ['g', 'ml', 'oz'];
const GRAMS_PER_UNIT: Record<string, number> = { g: 1, ml: 1, oz: 28.35 };

type FoodMacros = { id: string; calories: number; protein: number; fat: number; carbs: number };

/**
 * How many Food servings an ingredient represents, derived from its macros.
 * Ingredient macros come from the Food's macros scaled by the amount, so the ratio
 * recovers the multiplier regardless of the unit the user picked.
 * Calories are preferred so the recipe keeps exactly the calories the user saw.
 */
const servingsOfFood = (ing: FoodItem, food: FoodMacros): number | null => {
    const fields: (keyof Omit<FoodMacros, 'id'>)[] = ['calories', 'protein', 'carbs', 'fat'];
    for (const f of fields) {
        if (food[f] > 0) return (ing[f] || 0) / food[f];
    }
    return null; // Food has no macros at all; can't derive a multiplier
};

/** Save an ingredient that has no Food row yet as a per-1-unit Food. */
const autoSaveIngredient = async (ing: FoodItem, userId: string): Promise<string | null> => {
    const unit = (ing.unit || 'serving').toLowerCase();
    const { data, error } = await supabase
        .from('Food')
        .insert({
            id: uuidv4(),
            name: ing.name,
            calories: ing.calories / ing.quantity, // per 1 unit
            protein: ing.protein / ing.quantity,
            fat: ing.fat / ing.quantity,
            carbs: ing.carbs / ing.quantity,
            servingSize: `1 ${unit}`,
            quantity: 1,
            unit,
            servingWeight: MASS_UNITS.includes(unit) ? GRAMS_PER_UNIT[unit] : (ing.servingWeight || null),
            brand: ing.brand,
            createdById: userId,
            isPublic: false
        })
        .select()
        .single();

    if (error) {
        console.error('Failed to auto-save ingredient:', ing.name, error);
        return null;
    }
    return data.id;
};

/** Turn the builder's ingredient list into RecipeItem rows with correct multipliers. */
const buildRecipeItems = async (recipeId: string, userId: string, ingredients: FoodItem[]) => {
    // Look up macros for ingredients that already point at a Food row
    const existingIds = ingredients.map(i => i.id).filter(id => id && id.length >= 10);
    const foodsById = new Map<string, FoodMacros>();
    if (existingIds.length > 0) {
        const { data, error } = await supabase
            .from('Food')
            .select('id, calories, protein, fat, carbs')
            .in('id', existingIds);
        if (error) throw error;
        (data || []).forEach((f: FoodMacros) => foodsById.set(f.id, f));
    }

    const items = [];
    for (const ing of ingredients) {
        if (!(ing.quantity > 0)) continue; // zero amount contributes nothing

        let foodId: string | null = null;
        let multiplier: number | null = null;

        const food = ing.id ? foodsById.get(ing.id) : undefined;
        if (food) {
            foodId = food.id;
            // A Food with no macros (e.g. water) contributes 0 at any multiplier
            multiplier = servingsOfFood(ing, food) ?? ing.quantity;
        }

        if (foodId === null || multiplier === null) {
            // New ingredient with no Food row yet: store it per 1 unit
            foodId = await autoSaveIngredient(ing, userId);
            multiplier = ing.quantity;
        }
        if (!foodId) continue;

        items.push({ id: uuidv4(), recipeId, foodId, quantity: multiplier });
    }
    return items;
};

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
                servingSize,
                quantity,
                unit
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
            const ingredients = r.RecipeItem.map((ri: any) => {
                const f = ri.Food;
                // Show the amount in the Food's own unit (e.g. "30 chips", "100 g").
                // Older auto-saved Foods only stored the unit in servingSize (e.g. "g").
                const legacyUnit = f.servingSize && /^[a-zA-Z]+$/.test(f.servingSize.trim()) ? f.servingSize.trim() : null;
                const unit = f.unit || legacyUnit || 'serving';
                const perServingQty = f.unit ? (f.quantity || 1) : 1;
                return {
                    id: f.id,
                    name: f.name,
                    quantity: Math.round(ri.quantity * perServingQty * 100) / 100,
                    unit,
                    servingSize: f.servingSize,
                    calories: f.calories * ri.quantity,
                    protein: f.protein * ri.quantity,
                    fat: f.fat * ri.quantity,
                    carbs: f.carbs * ri.quantity,
                };
            });

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
        const itemsToInsert = await buildRecipeItems(recipeData.id, userId, ingredients);

        if (itemsToInsert.length > 0) {
            const { error: itemsError } = await supabase
                .from('RecipeItem')
                .insert(itemsToInsert);

            if (itemsError) throw itemsError;
        }

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

        // 3. Re-insert ingredients
        const itemsToInsert = await buildRecipeItems(recipeId, userId, ingredients);

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
