import { supabase } from './supabase';
import { callApi } from './apiClient';
import { CoachMessage, CoachPlan, CoachProfile } from '../types';
import { v4 as uuidv4 } from 'uuid';

export interface CoachPlanDraft {
  title: string;
  type: 'workout' | 'meal' | 'other';
  content: string;
  update_plan_id: string | null;
}

/** Thrown when the coach tables have not been created in Supabase yet. */
export class CoachSetupError extends Error {
  constructor() {
    super('Coach tables are missing. Run update_schema_v5_coach.sql in the Supabase SQL Editor.');
  }
}

const check = (error: any) => {
  if (!error) return;
  // 42P01: undefined table (Postgres). PGRST205: table not in PostgREST schema cache.
  if (error.code === '42P01' || error.code === 'PGRST205') throw new CoachSetupError();
  throw new Error(error.message || 'Database error');
};

const HISTORY_FOR_AI = 20;

export const coachService = {
  // ---- Profile ----
  async getProfile(userId: string): Promise<CoachProfile | null> {
    const { data, error } = await supabase.from('CoachProfile').select('*').eq('userId', userId).maybeSingle();
    check(error);
    return data;
  },

  async saveProfile(userId: string, profile: Partial<CoachProfile>): Promise<CoachProfile> {
    const { data, error } = await supabase
      .from('CoachProfile')
      .upsert({ ...profile, userId, updatedAt: new Date().toISOString() })
      .select()
      .single();
    check(error);
    return data;
  },

  // ---- Messages ----
  async getMessages(userId: string): Promise<CoachMessage[]> {
    const { data, error } = await supabase
      .from('CoachMessage')
      .select('id, role, content, createdAt')
      .eq('userId', userId)
      .order('createdAt', { ascending: false })
      .limit(200);
    check(error);
    return (data || []).reverse();
  },

  async addMessage(userId: string, role: 'user' | 'assistant', content: string): Promise<CoachMessage> {
    const { data, error } = await supabase
      .from('CoachMessage')
      .insert({ id: uuidv4(), userId, role, content, createdAt: new Date().toISOString() })
      .select('id, role, content, createdAt')
      .single();
    check(error);
    return data;
  },

  async clearMessages(userId: string) {
    const { error } = await supabase.from('CoachMessage').delete().eq('userId', userId);
    check(error);
  },

  // ---- Plans ----
  async getPlans(userId: string): Promise<CoachPlan[]> {
    const { data, error } = await supabase
      .from('CoachPlan')
      .select('id, title, type, content, status, createdAt, updatedAt')
      .eq('userId', userId)
      .order('updatedAt', { ascending: false });
    check(error);
    return data || [];
  },

  /** Save a plan drafted by the coach: update the plan it names if that plan is the user's, else create a new one. */
  async savePlanDraft(userId: string, draft: CoachPlanDraft, existing: CoachPlan[]): Promise<CoachPlan> {
    const now = new Date().toISOString();
    const target = draft.update_plan_id ? existing.find(p => p.id === draft.update_plan_id) : undefined;
    if (target) {
      const { data, error } = await supabase
        .from('CoachPlan')
        .update({ title: draft.title, type: draft.type, content: draft.content, status: 'active', updatedAt: now })
        .eq('id', target.id)
        .eq('userId', userId)
        .select('id, title, type, content, status, createdAt, updatedAt')
        .single();
      check(error);
      return data;
    }
    const { data, error } = await supabase
      .from('CoachPlan')
      .insert({ id: uuidv4(), userId, title: draft.title, type: draft.type, content: draft.content, status: 'active', createdAt: now, updatedAt: now })
      .select('id, title, type, content, status, createdAt, updatedAt')
      .single();
    check(error);
    return data;
  },

  async setPlanStatus(userId: string, planId: string, status: 'active' | 'archived') {
    const { error } = await supabase
      .from('CoachPlan')
      .update({ status, updatedAt: new Date().toISOString() })
      .eq('id', planId)
      .eq('userId', userId);
    check(error);
  },

  async deletePlan(userId: string, planId: string) {
    const { error } = await supabase.from('CoachPlan').delete().eq('id', planId).eq('userId', userId);
    check(error);
  },

  // ---- AI ----
  async ask(message: string, context: string, history: CoachMessage[]) {
    return callApi<{ reply: string; plans: CoachPlanDraft[]; model: string }>('/api/coach', {
      message,
      context,
      history: history.slice(-HISTORY_FOR_AI).map(m => ({ role: m.role, content: m.content })),
    });
  },
};
