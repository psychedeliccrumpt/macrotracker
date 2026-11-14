
export interface Macros {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface FoodItem extends Macros {
  id: string;
  name: string;
  quantity: number; // usually in grams or servings
  unit: string; // 'g', 'ml', 'serving', 'oz'
  servingSize?: string; // Original descriptive string
  servingWeight?: number; // Weight in grams
  source?: 'scan' | 'search' | 'manual' | 'recipe';
  brand?: string;
  createdAt?: string;
  timestamp: number;
}

export interface WeightLog {
  id: string;
  weight: number;
  timestamp: number;
  createdAt?: string;
}

export interface DayNote {
  id: string;
  userId: string;
  content: string;
  date: string; // YYYY-MM-DD
  createdAt: string;
}

export interface GoalLog {
  id: string;
  userId: string;
  type: 'lose' | 'gain' | 'maintain';
  startWeight: number;
  goalWeight: number;
  targetDate: string;
  status: 'active' | 'completed' | 'abandoned';
  createdAt: string;
}

export interface Recipe {
  id: string;
  name: string;
  ingredients: FoodItem[];
  servings: number;
  totalMacros: Macros;
}

export interface SearchResult {
  name: string;
  macros: Macros;
  servingSize: string;
  sources?: { title: string; uri: string }[];
  quantity?: number;
  unit?: string;
  servingWeight?: number; // in grams
  brand?: string;
  source?: string;
}

export interface UserProfile {
  id: string;
  email: string;
  gender?: 'male' | 'female';
  age?: number;
  weight?: number; // kg
  height?: number; // cm
  activity?: number; // multiplier
  dynamicTDEE?: number;
  tdeeSource?: 'formula' | 'dynamic';
  tdeeAtGoalStart?: number;

  // Goal Tracking — nullable so Supabase upsert can explicitly clear columns
  goalWeight?: number | null;
  goalDate?: string | Date | null;
  startWeight?: number | null;
  startDate?: string | Date | null;
  goalType?: 'lose' | 'gain' | 'maintain' | null;

  targets?: Macros;
  updatedAt?: string;
}

export type AppView = 'dashboard' | 'log' | 'coach' | 'calendar' | 'my' | 'scan' | 'search' | 'recipe' | 'ai-log';
export type MyTab = 'trends' | 'calculator' | 'goals';

// ---- AI Coach ----
export type TrainingPhase = 'cut' | 'bulk' | 'maintenance' | 'deload';

export interface CoachProfile {
  userId: string;
  goals?: string | null;
  trainingSchedule?: string | null;
  experience?: string | null;
  injuries?: string | null;
  foodPreferences?: string | null;
  notes?: string | null;
  trainingPhase?: TrainingPhase | null;
  phaseStart?: string | null; // YYYY-MM-DD
  phaseEnd?: string | null; // YYYY-MM-DD
  trackCycle?: boolean;
  lastPeriodStart?: string | null; // YYYY-MM-DD
  cycleLength?: number | null;
  updatedAt?: string;
}

export interface CoachMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
}

export interface CoachPlan {
  id: string;
  title: string;
  type: 'workout' | 'meal' | 'other';
  content: string;
  status: 'active' | 'archived';
  createdAt: string;
  updatedAt: string;
}
