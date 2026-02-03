
import { supabase } from './supabase';
import { DayNote } from '../types';
import { v4 as uuidv4 } from 'uuid';

export const noteService = {
    /**
     * Get all notes for a user
     */
    async getNotes(userId: string): Promise<DayNote[]> {
        const { data, error } = await supabase
            .from('DayNote')
            .select('*')
            .eq('userId', userId);

        if (error) {
            console.error('Error fetching notes:', error);
            return [];
        }
        return data || [];
    },

    /**
     * Save or update a note for a specific date
     */
    async saveNote(userId: string, date: string, content: string): Promise<DayNote> {
        // Try to find existing note for this day
        const { data: existing } = await supabase
            .from('DayNote')
            .select('*')
            .eq('userId', userId)
            .eq('date', date)
            .single();

        if (existing) {
            // Update
            const { data, error } = await supabase
                .from('DayNote')
                .update({ content })
                .eq('id', existing.id)
                .select()
                .single();

            if (error) throw error;
            return data;
        } else {
            // Insert
            const { data, error } = await supabase
                .from('DayNote')
                .insert({
                    id: uuidv4(),
                    userId,
                    date,
                    content,
                    createdAt: new Date().toISOString()
                })
                .select()
                .single();

            if (error) throw error;
            return data;
        }
    }
};
