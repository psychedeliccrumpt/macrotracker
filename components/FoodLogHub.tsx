
import React from 'react';
import { Search, Zap, CookingPot, Scale, ScanLine, Sparkles, CopyPlus } from 'lucide-react';

interface FoodLogHubProps {
  onQuickAdd: () => void;
  onSearch: () => void;
  onRecipe: () => void;
  onLogWeight: () => void;
  onScan: () => void;
  onAI: () => void;
  onCopyDay: () => void;
}

const FoodLogHub: React.FC<FoodLogHubProps> = ({ onQuickAdd, onSearch, onRecipe, onLogWeight, onScan, onAI, onCopyDay }) => {
  return (
    <div className="h-full bg-background flex flex-col p-6 overflow-y-auto pb-32">
      <div className="mb-8 border-b-3 border-secondary pb-4">
        <h1 className="text-4xl font-black uppercase tracking-tighter text-secondary">Log</h1>
        <p className="text-secondary font-mono font-bold mt-2">CHOOSE AN ACTION</p>
      </div>

      <div className="grid grid-cols-2 gap-4">

        {/* AI Quick Log (New & Shiny) */}
        <button
          onClick={onAI}
          className="col-span-2 group relative bg-surface border-3 border-secondary p-6 shadow-neo hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none transition-all active:bg-gray-50 text-left flex items-center gap-4"
        >
          <div className="bg-secondary p-3 border-3 border-secondary text-white shadow-sm shrink-0">
            <Sparkles size={24} strokeWidth={3} className="text-white" />
          </div>
          <div>
            <h2 className="text-xl font-black uppercase text-secondary tracking-tight">AI Quick Log</h2>
            <p className="text-gray-500 font-bold uppercase text-[10px] tracking-widest mt-1">Voice or Text to AI</p>
          </div>
        </button>

        {/* Scan Button (Prominent) */}
        <button
          onClick={onScan}
          className="col-span-2 group relative bg-surface border-3 border-secondary p-6 shadow-neo hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none transition-all active:bg-gray-50 text-left flex items-center gap-4"
        >
          <div className="bg-secondary p-3 border-3 border-secondary text-white shadow-sm shrink-0">
            <ScanLine size={24} strokeWidth={3} />
          </div>
          <div>
            <h2 className="text-xl font-black uppercase text-secondary">Scan Label</h2>
            <p className="text-gray-500 font-bold uppercase text-[10px] tracking-wide mt-1">AI-Powered Extraction</p>
          </div>
        </button>

        {/* Search Button */}
        <button
          onClick={onSearch}
          className="col-span-2 group relative bg-surface border-3 border-secondary p-6 shadow-neo hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none transition-all active:bg-gray-50 text-left flex items-center gap-4"
        >
          <div className="bg-accent p-3 border-3 border-secondary text-secondary shadow-sm shrink-0">
            <Search size={24} strokeWidth={3} />
          </div>
          <div>
            <h2 className="text-xl font-black uppercase text-secondary">Search Food</h2>
            <p className="text-gray-500 font-bold uppercase text-[10px] tracking-wide mt-1">Database / Web</p>
          </div>
        </button>

        {/* Quick Add Button */}
        <button
          onClick={onQuickAdd}
          className="col-span-2 group relative bg-surface border-3 border-secondary p-6 shadow-neo hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none transition-all active:bg-gray-50 text-left flex items-center gap-4"
        >
          <div className="bg-primary p-3 border-3 border-secondary text-white shadow-sm shrink-0">
            <Zap size={24} strokeWidth={3} />
          </div>
          <div>
            <h2 className="text-xl font-black uppercase text-secondary">Quick Add</h2>
            <p className="text-gray-500 font-bold uppercase text-[10px] tracking-wide mt-1">Manual Entry</p>
          </div>
        </button>

        {/* Copy a past day */}
        <button
          onClick={onCopyDay}
          className="col-span-2 group relative bg-surface border-3 border-secondary p-6 shadow-neo hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none transition-all active:bg-gray-50 text-left flex items-center gap-4"
        >
          <div className="bg-highlight p-3 border-3 border-secondary text-secondary shadow-sm shrink-0">
            <CopyPlus size={24} strokeWidth={3} />
          </div>
          <div>
            <h2 className="text-xl font-black uppercase text-secondary">Copy Past Day</h2>
            <p className="text-gray-500 font-bold uppercase text-[10px] tracking-wide mt-1">Re-log foods from another day</p>
          </div>
        </button>

        {/* Recipe Button */}
        <button
          onClick={onRecipe}
          className="bg-surface border-3 border-secondary p-4 shadow-neo hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none transition-all active:bg-gray-50 text-left flex flex-col justify-between h-32"
        >
          <div className="bg-highlight p-2 w-fit border-3 border-secondary text-secondary shadow-sm">
            <CookingPot size={24} strokeWidth={3} />
          </div>
          <h2 className="text-lg font-black uppercase text-secondary leading-tight">Create<br />Recipe</h2>
        </button>

        {/* Weight Button */}
        <button
          onClick={onLogWeight}
          className="bg-surface border-3 border-secondary p-4 shadow-neo hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none transition-all active:bg-gray-50 text-left flex flex-col justify-between h-32"
        >
          <div className="bg-secondary p-2 w-fit border-3 border-secondary text-white shadow-sm">
            <Scale size={24} strokeWidth={3} />
          </div>
          <h2 className="text-lg font-black uppercase text-secondary leading-tight">Log<br />Weight</h2>
        </button>

      </div>
    </div>
  );
};

export default FoodLogHub;
