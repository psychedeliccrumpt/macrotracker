
import React, { useState, useEffect } from 'react';
import { X, Check, Flame } from 'lucide-react';
import { FoodItem } from '../types';

interface QuickAddModalProps {
  onSave: (item: Omit<FoodItem, 'id' | 'timestamp'>) => void;
  onCancel: () => void;
}

const QuickAddModal: React.FC<QuickAddModalProps> = ({ onSave, onCancel }) => {
  const [name, setName] = useState('');
  const [protein, setProtein] = useState<string>('');
  const [carbs, setCarbs] = useState<string>('');
  const [fat, setFat] = useState<string>('');
  const [calories, setCalories] = useState<string>('');
  const [isManualCalorie, setIsManualCalorie] = useState(false);

  // Auto-calculate calories whenever macros change, UNLESS user has manually edited calories
  useEffect(() => {
    if (isManualCalorie) return;

    const p = parseFloat(protein) || 0;
    const c = parseFloat(carbs) || 0;
    const f = parseFloat(fat) || 0;
    // Standard conversion: P=4, C=4, F=9
    if (p || c || f) {
      setCalories(Math.round(p * 4 + c * 4 + f * 9).toString());
    }
  }, [protein, carbs, fat, isManualCalorie]);

  const handleCalorieChange = (val: string) => {
    setCalories(val);
    setIsManualCalorie(true);
  };

  const handleSave = () => {
    if (!name.trim()) return;
    const p = parseFloat(protein) || 0;
    const c = parseFloat(carbs) || 0;
    const f = parseFloat(fat) || 0;
    const cal = parseFloat(calories) || 0;

    onSave({
      name: name,
      calories: cal,
      protein: p,
      carbs: c,
      fat: f,
      quantity: 1,
      unit: 'serving',
      source: 'manual'
    });
  };

  return (
    <div className="fixed inset-0 bg-secondary/90 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-background w-full max-w-md border-3 border-secondary shadow-neo-lg relative">
        
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b-3 border-secondary bg-surface">
           <h2 className="text-xl font-black uppercase text-secondary flex items-center gap-2">
             <Flame size={24} className="text-accent" fill="currentColor" /> Quick Add
           </h2>
           <button onClick={onCancel} className="p-2 border-3 border-secondary hover:bg-secondary hover:text-white transition-colors bg-white shadow-neo-sm">
              <X size={20} strokeWidth={3} />
           </button>
        </div>

        <div className="p-6">
          {/* Name Input */}
          <div className="mb-6">
            <label className="block text-xs font-black uppercase mb-2 tracking-wider text-secondary">Food Name</label>
            <input 
              type="text" 
              placeholder="e.g. My Snack"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full p-4 border-3 border-secondary text-xl font-black uppercase placeholder:text-gray-300 outline-none focus:bg-highlight transition-colors shadow-neo-sm"
              autoFocus
            />
          </div>

          {/* Macros Grid */}
          <div className="grid grid-cols-3 gap-4 mb-8">
            {/* Protein */}
            <div>
              <label className="block text-xs font-black uppercase mb-2 tracking-wider text-primary">Protein (g)</label>
              <input 
                type="number" 
                placeholder="0"
                value={protein}
                onChange={(e) => {
                  setProtein(e.target.value);
                  setIsManualCalorie(false); // Reset manual flag
                }}
                className="w-full p-2 border-3 border-secondary text-center text-lg font-mono font-bold outline-none focus:bg-primary focus:text-white transition-colors"
              />
            </div>
            {/* Carbs */}
            <div>
              <label className="block text-xs font-black uppercase mb-2 tracking-wider text-accent">Carbs (g)</label>
              <input 
                type="number" 
                placeholder="0"
                value={carbs}
                onChange={(e) => {
                  setCarbs(e.target.value);
                  setIsManualCalorie(false);
                }}
                className="w-full p-2 border-3 border-secondary text-center text-lg font-mono font-bold outline-none focus:bg-accent focus:text-secondary transition-colors"
              />
            </div>
            {/* Fat */}
            <div>
              <label className="block text-xs font-black uppercase mb-2 tracking-wider text-highlight">Fat (g)</label>
              <input 
                type="number" 
                placeholder="0"
                value={fat}
                onChange={(e) => {
                  setFat(e.target.value);
                  setIsManualCalorie(false);
                }}
                className="w-full p-2 border-3 border-secondary text-center text-lg font-mono font-bold outline-none focus:bg-highlight focus:text-secondary transition-colors"
              />
            </div>
          </div>

          {/* Calories Display/Input */}
          <div className="mb-8 p-4 bg-secondary border-3 border-secondary text-center relative group">
             <span className="block text-xs font-bold uppercase text-white/70 mb-1">Total Calories</span>
             <input
               type="number"
               value={calories}
               onChange={(e) => handleCalorieChange(e.target.value)}
               placeholder="0"
               className="w-full bg-transparent text-center text-4xl font-black text-white font-mono outline-none placeholder:text-gray-600"
             />
             <span className="text-sm font-black uppercase text-accent ml-2">KCAL</span>
             <p className="text-[10px] text-gray-400 mt-2 uppercase tracking-wide">
               {isManualCalorie ? 'Manual Override' : 'Auto-Calculated'}
             </p>
          </div>

          {/* Save Button */}
          <button 
            onClick={handleSave}
            disabled={!name.trim()}
            className="w-full py-4 bg-white text-secondary font-black uppercase tracking-widest text-lg border-3 border-secondary hover:bg-primary hover:text-white transition-colors flex items-center justify-center gap-3 shadow-neo active:translate-x-[4px] active:translate-y-[4px] active:shadow-none disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Check size={24} strokeWidth={3} />
            Add to Log
          </button>
        </div>
      </div>
    </div>
  );
};

export default QuickAddModal;
