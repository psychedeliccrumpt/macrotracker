import React, { useState } from 'react';
import { X, Check, Scale } from 'lucide-react';

interface WeightLogModalProps {
  onSave: (weight: number) => void;
  onCancel: () => void;
}

const WeightLogModal: React.FC<WeightLogModalProps> = ({ onSave, onCancel }) => {
  const [weight, setWeight] = useState<string>('');

  const handleSave = () => {
    const w = parseFloat(weight);
    if (w > 0) {
      onSave(w);
    }
  };

  return (
    <div className="fixed inset-0 bg-secondary/90 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-background w-full max-w-md border-3 border-secondary shadow-neo-lg relative">
        
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b-3 border-secondary bg-surface">
           <h2 className="text-xl font-black uppercase text-secondary flex items-center gap-2">
             <Scale size={24} className="text-primary" fill="currentColor" /> Log Weight
           </h2>
           <button onClick={onCancel} className="p-2 border-3 border-secondary hover:bg-secondary hover:text-white transition-colors bg-white shadow-neo-sm">
              <X size={20} strokeWidth={3} />
           </button>
        </div>

        <div className="p-8">
          <div className="text-center mb-8">
             <label className="block text-sm font-black uppercase mb-4 tracking-wider text-secondary">Current Weight</label>
             <div className="relative inline-block w-full max-w-[200px]">
               <input 
                 type="number" 
                 placeholder="0.0"
                 value={weight}
                 onChange={(e) => setWeight(e.target.value)}
                 className="w-full p-4 border-3 border-secondary text-5xl font-black text-center outline-none focus:bg-highlight transition-colors shadow-neo-sm font-mono"
                 autoFocus
                 step="0.1"
               />
               <span className="absolute -right-8 bottom-4 text-xl font-black text-secondary">kg</span>
             </div>
          </div>

          <button 
            onClick={handleSave}
            disabled={!weight || parseFloat(weight) <= 0}
            className="w-full py-4 bg-primary text-white font-black uppercase tracking-widest text-lg border-3 border-secondary hover:bg-violet-600 transition-colors flex items-center justify-center gap-3 shadow-neo active:translate-x-[4px] active:translate-y-[4px] active:shadow-none disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Check size={24} strokeWidth={3} />
            Save Log
          </button>
        </div>
      </div>
    </div>
  );
};

export default WeightLogModal;