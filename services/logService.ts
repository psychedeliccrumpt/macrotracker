import { supabase } from './supabase';
import { FoodItem } from '../types';
import { v4 as uuidv4 } from 'uuid';
import { parseTimestamp } from '../utils/dateUtils';

export const logService = {
    /**
     * Get all food logs for a user, optionally filtered by date
     */
    /**
     * Get all food logs for a user, optionally filtered by date
     */
    async getAll(userId: string, date?: Date): Promise<FoodItem[]> {
        let query = supabase
            .from('FoodLog')
            .select('*')
            .eq('userId', userId)
            .order('date', { ascending: false });

        if (date) {
            const startOfDay = new Date(date);
            startOfDay.setHours(0, 0, 0, 0);
            const endOfDay = new Date(date);
            endOfDay.setHours(23, 59, 59, 999);

            query = query
                .gte('date', startOfDay.toISOString())
                .lte('date', endOfDay.toISOString());
        }

        const { data, error } = await query;

        if (error) {
            console.error('Error fetching logs:', error);
            return [];
        }

        return data.map((log: any) => ({
            id: log.id,
            name: log.name,
            calories: log.calories,
            protein: log.protein,
            fat: log.fat,
            carbs: log.carbs,
            quantity: log.quantity,
            unit: log.unit,
            servingSize: log.servingSize,
            servingWeight: log.servingWeight, // Added
            source: log.source || 'manual',
            timestamp: parseTimestamp(log.date),
            brand: log.brand,
        }));
    },

    /**
     * Create a new food log entry
     */
    async create(userId: string, foodItem: Omit<FoodItem, 'id' | 'timestamp'> & { foodId?: string }, date?: Date) {
        const { data, error } = await supabase
            .from('FoodLog')
            .insert({
                id: uuidv4(),
                userId: userId,
                foodId: foodItem.foodId || null,
                name: foodItem.name,
                calories: foodItem.calories,
                protein: foodItem.protein,
                fat: foodItem.fat,
                carbs: foodItem.carbs,
                quantity: foodItem.quantity,
                unit: foodItem.unit,
                servingSize: foodItem.servingSize,
                servingWeight: (foodItem as any).servingWeight, // Added
                brand: foodItem.brand,
                source: foodItem.source || 'manual',
                date: date ? date.toISOString() : new Date().toISOString(),
                mealType: 'snack',
            })
            .select()
            .single();

        if (error) throw error;

        return {
            id: data.id,
            name: data.name,
            calories: data.calories,
            protein: data.protein,
            fat: data.fat,
            carbs: data.carbs,
            quantity: data.quantity,
            unit: data.unit,
            servingSize: data.servingSize,
            servingWeight: data.servingWeight, // Added
            brand: data.brand,
            source: data.source,
            timestamp: parseTimestamp(data.date),
        } as FoodItem;
    },

    /**
     * Update a food log entry
     */
    async update(logId: string, updates: Partial<Omit<FoodItem, 'id' | 'timestamp'>>) {
        const { data, error } = await supabase
            .from('FoodLog')
            .update({
                name: updates.name,
                calories: updates.calories,
                protein: updates.protein,
                fat: updates.fat,
                carbs: updates.carbs,
                quantity: updates.quantity,
                unit: updates.unit,
                servingSize: updates.servingSize,
                servingWeight: updates.servingWeight,
                brand: updates.brand,
            })
            .eq('id', logId)
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    /**
     * Delete a food log entry
     */
    async delete(logId: string) {
        const { error } = await supabase
            .from('FoodLog')
            .delete()
            .eq('id', logId);

        if (error) throw error;
    },
};
