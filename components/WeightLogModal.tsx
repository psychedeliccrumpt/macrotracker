import React, { useState } from 'react';
import { X, Check, Scale, Trash2 } from 'lucide-react';

interface WeightLogModalProps {
  onSave: (weight: number) => void;
  onCancel: () => void;
  onDelete?: () => void;
  initialWeight?: number;
  isEditing?: boolean;
}

const WeightLogModal: React.FC<WeightLogModalProps> = ({ onSave, onCancel, onDelete, initialWeight, isEditing }) => {
  const [weight, setWeight] = useState<string>(initialWeight ? String(initialWeight) : '');

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
            <Scale size={24} className="text-primary" fill="currentColor" /> {isEditing ? 'Edit Weight' : 'Log Weight'}
          </h2>
          <button onClick={onCancel} className="p-2 border-3 border-secondary hover:bg-secondary hover:text-white transition-colors bg-white shadow-neo-sm">
            <X size={20} strokeWidth={3} />
          </button>
        </div>

        <div className="p-8">
          <div className="text-center mb-8">
            <label className="block text-sm font-black uppercase mb-4 tracking-wider text-secondary">{isEditing ? 'Update Weight' : 'Current Weight'}</label>
            <div className="relative inline-block w-full max-w-[200px]">
              <input
                type="number"
                placeholder="0.0"
                value={weight}
                onFocus={(e) => e.target.select()}
                onChange={(e) => {
                  let val = e.target.value;
                  if (val.length > 1 && val.startsWith('0') && val[1] !== '.') {
                    val = val.substring(1);
                  }
                  setWeight(val);
                }}
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
            {isEditing ? 'Update' : 'Save Log'}
          </button>

          {isEditing && onDelete && (
            <button
              onClick={onDelete}
              className="w-full mt-3 py-3 bg-white text-red-600 font-black uppercase tracking-widest text-sm border-3 border-secondary hover:bg-red-50 transition-colors flex items-center justify-center gap-2 shadow-neo-sm active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
            >
              <Trash2 size={18} strokeWidth={3} />
              Delete Entry
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default WeightLogModal;