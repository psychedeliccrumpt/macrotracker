import React, { useState } from 'react';
import { Plus, Trash2, ArrowLeft, Utensils, ChefHat } from 'lucide-react';
import { FoodItem, Macros, Recipe, SearchResult } from '../types';
import Search from './Search';
import EditorModal from './EditorModal';

const generateId = () => Math.random().toString(36).substring(2, 9);

interface RecipeBuilderProps {
  savedRecipes: Recipe[];
  onSaveRecipe: (recipeName: string, ingredients: FoodItem[], totalMacros: Macros) => void;
  onLogRecipe: (recipe: Recipe) => void;
}

const RecipeBuilder: React.FC<RecipeBuilderProps> = ({ savedRecipes, onSaveRecipe, onLogRecipe }) => {
  const [isCreating, setIsCreating] = useState(false);
  
  // Builder State
  const [recipeName, setRecipeName] = useState('');
  const [ingredients, setIngredients] = useState<FoodItem[]>([]);
  const [showSearch, setShowSearch] = useState(false);
  const [tempSearchResult, setTempSearchResult] = useState<SearchResult | null>(null);

  const totalMacros = ingredients.reduce((acc, curr) => ({
    calories: acc.calories + curr.calories,
    protein: acc.protein + curr.protein,
    carbs: acc.carbs + curr.carbs,
    fat: acc.fat + curr.fat,
  }), { calories: 0, protein: 0, carbs: 0, fat: 0 });

  const handleAddIngredient = (data: Omit<FoodItem, 'id' | 'timestamp'>) => {
    const newItem: FoodItem = {
      ...data,
      id: generateId(),
      timestamp: Date.now(),
      source: 'recipe'
    };
    setIngredients([...ingredients, newItem]);
    setTempSearchResult(null);
    setShowSearch(false);
  };

  const removeIngredient = (id: string) => {
    setIngredients(ingredients.filter(i => i.id !== id));
  };

  const handleSave = () => {
    if (!recipeName.trim() || ingredients.length === 0) return;
    onSaveRecipe(recipeName, ingredients, totalMacros);
    // Reset and go back to list
    setRecipeName('');
    setIngredients([]);
    setIsCreating(false);
  };

  if (showSearch) {
    return (
      <Search 
        onSelect={(result) => setTempSearchResult(result)} 
        onBack={() => setShowSearch(false)} 
      />
    );
  }

  // LIST VIEW
  if (!isCreating) {
    return (
      <div className="flex flex-col h-full bg-background relative">
        <div className="p-6 bg-surface border-b-3 border-secondary shadow-neo">
           <h1 className="text-4xl font-black uppercase tracking-tighter text-secondary">Recipes</h1>
           <div className="w-16 h-3 bg-primary mt-2 border-2 border-secondary"></div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 pb-24">
          {savedRecipes.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-gray-400 text-center border-3 border-secondary bg-white shadow-neo p-8">
              <ChefHat size={48} className="mb-4 text-secondary" strokeWidth={1.5} />
              <p className="font-bold uppercase tracking-widest text-secondary">No recipes yet</p>
              <button 
                onClick={() => setIsCreating(true)}
                className="mt-6 px-6 py-3 bg-highlight border-3 border-secondary font-black text-secondary shadow-neo-sm hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none transition-all uppercase tracking-wider"
              >
                Create New
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              {savedRecipes.map(recipe => (
                <div key={recipe.id} className="bg-surface p-4 border-3 border-secondary shadow-neo flex flex-col gap-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-black text-secondary text-xl uppercase bg-highlight px-2 border-2 border-secondary inline-block transform -rotate-1">{recipe.name}</h3>
                      <p className="text-xs font-mono font-bold text-gray-500 mt-2">{recipe.ingredients.length} INGREDIENTS</p>
                    </div>
                    <div className="text-right">
                       <span className="block font-black text-2xl text-secondary font-mono">{Math.round(recipe.totalMacros.calories)}</span>
                       <span className="text-[10px] font-bold uppercase text-white bg-secondary px-1">KCAL</span>
                    </div>
                  </div>
                  <div className="flex gap-2 border-t-2 border-secondary pt-2">
                    <span className="text-xs font-bold text-primary font-mono bg-primary/10 px-1 border border-secondary">P: {Math.round(recipe.totalMacros.protein)}</span>
                    <span className="text-xs font-bold text-accent font-mono bg-accent/10 px-1 border border-secondary">C: {Math.round(recipe.totalMacros.carbs)}</span>
                    <span className="text-xs font-bold text-highlight font-mono bg-highlight/10 px-1 border border-secondary">F: {Math.round(recipe.totalMacros.fat)}</span>
                  </div>
                  <button 
                    onClick={() => onLogRecipe(recipe)}
                    className="w-full py-3 bg-secondary text-white font-bold border-3 border-secondary hover:bg-primary transition-colors flex items-center justify-center gap-2 text-sm uppercase tracking-wide shadow-neo-sm active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
                  >
                    <Plus size={18} strokeWidth={3} /> Log Meal
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <button 
          onClick={() => setIsCreating(true)}
          className="absolute bottom-6 right-6 w-16 h-16 bg-accent border-3 border-secondary text-secondary shadow-neo flex items-center justify-center hover:bg-white transition-all z-10 hover:-translate-y-1"
        >
          <Plus size={32} strokeWidth={3} />
        </button>
      </div>
    );
  }

  // CREATE VIEW
  return (
    <div className="flex flex-col h-full bg-background">
      {tempSearchResult && (
        <EditorModal 
          initialData={tempSearchResult} 
          onSave={handleAddIngredient} 
          onCancel={() => setTempSearchResult(null)} 
        />
      )}

      <div className="p-4 border-b-3 border-secondary bg-surface">
        <div className="flex items-center mb-6">
          <button onClick={() => setIsCreating(false)} className="mr-4 p-2 border-3 border-secondary bg-white hover:bg-secondary hover:text-white transition-colors shadow-neo-sm">
            <ArrowLeft size={24} strokeWidth={3} />
          </button>
          <h1 className="text-2xl font-black uppercase text-secondary">New Recipe</h1>
        </div>
        <input 
          type="text" 
          placeholder="RECIPE NAME"
          value={recipeName}
          onChange={(e) => setRecipeName(e.target.value)}
          className="w-full text-2xl font-black p-4 border-3 border-secondary focus:bg-highlight outline-none uppercase placeholder:text-gray-300 shadow-neo-sm"
        />
      </div>

      <div className="flex-1 overflow-y-auto p-4 pb-24">
        {ingredients.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <Utensils size={64} className="mx-auto mb-4 opacity-20 text-secondary" strokeWidth={1} />
            <p className="uppercase font-bold text-sm tracking-widest text-secondary/50">Add ingredients to start</p>
          </div>
        ) : (
          <div className="space-y-4">
            {ingredients.map(ing => (
              <div key={ing.id} className="bg-white p-4 border-3 border-secondary shadow-neo-sm flex justify-between items-center group">
                <div>
                  <h4 className="font-black text-secondary uppercase text-lg">{ing.name}</h4>
                  <div className="text-xs font-mono text-gray-600 mt-1">
                    {ing.quantity} {ing.unit} • <span className="font-bold bg-highlight/30 px-1">{Math.round(ing.calories)} kcal</span>
                  </div>
                </div>
                <button onClick={() => removeIngredient(ing.id)} className="text-secondary hover:text-accent p-2 border-2 border-transparent hover:border-accent hover:bg-accent/10 transition-all">
                  <Trash2 size={24} strokeWidth={2} />
                </button>
              </div>
            ))}
          </div>
        )}
        
        <button 
          onClick={() => setShowSearch(true)}
          className="w-full mt-8 py-4 border-3 border-dashed border-secondary bg-white text-secondary font-black uppercase tracking-wider hover:bg-secondary hover:text-white hover:border-solid transition-all flex items-center justify-center gap-2"
        >
          <Plus size={24} strokeWidth={3} /> Add Ingredient
        </button>
      </div>

      <div className="p-4 bg-surface border-t-3 border-secondary">
        <div className="flex justify-between text-sm font-mono font-bold text-secondary mb-4 px-2 border-b-2 border-secondary pb-2">
          <span className="text-lg">{Math.round(totalMacros.calories)} KCAL</span>
          <span className="text-primary bg-primary/10 px-1">P:{Math.round(totalMacros.protein)}</span>
          <span className="text-accent bg-accent/10 px-1">C:{Math.round(totalMacros.carbs)}</span>
          <span className="text-highlight bg-highlight/10 px-1">F:{Math.round(totalMacros.fat)}</span>
        </div>
        <button 
          onClick={handleSave}
          disabled={!recipeName.trim() || ingredients.length === 0}
          className="w-full py-4 bg-primary text-white font-black uppercase text-xl border-3 border-secondary shadow-neo active:shadow-none active:translate-x-[4px] active:translate-y-[4px] transition-all disabled:opacity-50 disabled:shadow-none disabled:translate-x-0 disabled:cursor-not-allowed"
        >
           Save Recipe
        </button>
      </div>
    </div>
  );
};

export default RecipeBuilder;