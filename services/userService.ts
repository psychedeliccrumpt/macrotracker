import { supabase } from './supabase';
import { UserProfile } from '../types';
import { v4 as uuidv4 } from 'uuid';

export const userService = {
    /**
     * Get or create a user profile
     */
    async getProfile(userId: string): Promise<UserProfile | null> {
        const { data, error } = await supabase
            .from('Profile')
            .select('*')
            .eq('id', userId)
            .single();

        if (error && error.code !== 'PGRST116') { // PGRST116 is "not found"
            console.error('Error fetching profile:', error);
            return null;
        }

        return data;
    },

    /**
     * Update user profile stats (TDEE, weight, etc)
     */
    async updateProfile(userId: string, updates: Partial<UserProfile>) {
        const { data, error } = await supabase
            .from('Profile')
            .upsert({ id: userId, ...updates, updatedAt: new Date().toISOString() })
            .select()
            .single();

        if (error) {
            console.error('Error updating profile:', error);
            throw error;
        }
        return data;
    },

    /**
     * Log a weight entry
     */
    async logWeight(userId: string, weight: number, date?: Date) {
        const logDate = date ? date.toISOString() : new Date().toISOString();

        const { data, error } = await supabase
            .from('WeightLog')
            .insert({
                id: uuidv4(),
                userId,
                weight,
                date: logDate
            })
            .select()
            .single();

        if (error) {
            console.error('Error logging weight:', error);
            throw error;
        }

        // Only update profile current weight if the log is for today (or future)
        const isToday = !date || new Date().toDateString() === date.toDateString();

        if (isToday) {
            // Also update current weight in profile securely (only if profile exists)
            await supabase
                .from('Profile')
                .update({
                    weight,
                    updatedAt: new Date().toISOString()
                })
                .eq('id', userId);
        }

        return data;
    },

    /**
     * Get weight history for a user
     */
    async getWeightLogs(userId: string) {
        const { data, error } = await supabase
            .from('WeightLog')
            .select('*')
            .eq('userId', userId)
            .order('date', { ascending: false })
            .order('createdAt', { ascending: false });

        if (error) {
            console.error('Error fetching weight logs:', error);
            return [];
        }
        return data || [];
    },
    /**
     * Get goal history for a user
     */
    async getGoalHistory(userId: string): Promise<any[]> {
        const { data, error } = await supabase
            .from('GoalLog')
            .select('*')
            .eq('userId', userId)
            .order('createdAt', { ascending: false });

        if (error) {
            console.error('Error fetching goal history:', error);
            return [];
        }
        return data || [];
    },

    /**
     * Create a new goal log entry
     */
    async createGoalLog(userId: string, goalData: any) {
        const { data, error } = await supabase
            .from('GoalLog')
            .insert({
                id: uuidv4(),
                userId,
                ...goalData,
                createdAt: new Date().toISOString()
            })
            .select()
            .single();

        if (error) {
            console.error('Error creating goal log:', error);
            throw error;
        }
        return data;
    },

    /**
     * Delete a goal log entry
     */
    async deleteGoalLog(id: string) {
        const { error } = await supabase
            .from('GoalLog')
            .delete()
            .eq('id', id);

        if (error) {
            console.error('Error deleting goal log:', error);
            throw error;
        }
        return true;
    },

    /**
     * Update an existing goal log entry
     */
    async updateGoalLog(id: string, updates: any) {
        const { data, error } = await supabase
            .from('GoalLog')
            .update(updates)
            .eq('id', id)
            .select()
            .single();

        if (error) {
            console.error('Error updating goal log:', error);
            throw error;
        }
        return data;
    }
};
