
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
  timestamp: number;
  brand?: string;
}

export interface WeightLog {
  id: string;
  weight: number;
  timestamp: number;
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

  // Goal Tracking
  goalWeight?: number;
  goalDate?: string | Date;
  startWeight?: number;
  startDate?: string | Date;
  goalType?: 'lose' | 'gain' | 'maintain';

  targets?: Macros;
  updatedAt?: string;
}

export type AppView = 'dashboard' | 'log' | 'calendar' | 'my' | 'scan' | 'search' | 'recipe' | 'ai-log';
export type MyTab = 'trends' | 'calculator' | 'goals';
