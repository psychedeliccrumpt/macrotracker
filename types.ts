
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
  source?: 'scan' | 'search' | 'manual' | 'recipe';
  timestamp: number;
}

export interface WeightLog {
  id: string;
  weight: number;
  timestamp: number;
}

export interface Recipe {
  id: string;
  name: string;
  ingredients: FoodItem[];
  totalMacros: Macros;
}

export interface SearchResult {
  name: string;
  macros: Macros;
  servingSize: string;
  sources?: { title: string; uri: string }[];
}

export interface UserProfile {
  gender: 'male' | 'female';
  age: number;
  weight: number; // kg
  height: number; // cm
  activity: number; // multiplier
  targets: Macros;
}

export type AppView = 'dashboard' | 'log' | 'calendar' | 'my' | 'scan' | 'search' | 'recipe';
export type MyTab = 'trends' | 'calculator';
