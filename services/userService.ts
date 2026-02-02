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
    async logWeight(userId: string, weight: number) {
        const { error } = await supabase
            .from('WeightLog')
            .insert({
                id: uuidv4(),
                userId,
                weight,
                date: new Date().toISOString()
            });

        if (error) console.error('Error logging weight:', error);

        // Also update current weight in profile
        await this.updateProfile(userId, { weight });
    },

    /**
     * Get weight history for a user
     */
    async getWeightLogs(userId: string) {
        const { data, error } = await supabase
            .from('WeightLog')
            .select('*')
            .eq('userId', userId)
            .order('date', { ascending: false });

        if (error) {
            console.error('Error fetching weight logs:', error);
            return [];
        }
        return data || [];
    }
};
