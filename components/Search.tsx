import React, { useState } from 'react';
import { Search as SearchIcon, Loader2, ArrowLeft, ArrowRight, User, Globe, Sparkles, CookingPot } from 'lucide-react';
import { foodService } from '../services/foodService';
import { SearchResult } from '../types';
import { useAuth } from '../contexts/AuthContext';

interface SearchProps {
  onSelect: (data: SearchResult) => void;
  onBack: () => void;
}

const Search: React.FC<SearchProps> = ({ onSelect, onBack }) => {
  const { user } = useAuth();
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setError(null);
    setResults([]);

    try {
      // Pass user ID to search for private foods too
      const data = await foodService.search(query, user?.id);
      setResults(data);

      // If only one result (e.g. from AI fallback), we could auto-select? 
      // Better to let user see it first.
    } catch (err) {
      setError("Could not find food information. Please try a different query.");
    } finally {
      setLoading(false);
    }
  };

  const getSourceIcon = (source?: string) => {
    switch (source) {
      case 'personal': return <User size={16} className="text-blue-500" />;
      case 'community': return <Globe size={16} className="text-green-500" />;
      case 'recipe': return <CookingPot size={16} className="text-orange-500" />;
      default: return <Sparkles size={16} className="text-secondary" />;
    }
  };

  return (
    <div className="flex flex-col h-full bg-background p-4">
      <div className="flex items-center mb-8">
        <button onClick={onBack} className="mr-4 p-2 border-3 border-secondary bg-white hover:bg-secondary hover:text-white transition-colors shadow-neo-sm">
          <ArrowLeft size={24} strokeWidth={3} />
        </button>
        <h1 className="text-2xl font-black uppercase text-secondary tracking-tight">Search Food</h1>
      </div>

      <form onSubmit={handleSearch} className="relative mb-8 group">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="SEARCH FOOD..."
          className="w-full pl-12 pr-16 py-5 border-3 border-secondary bg-white text-xl font-bold placeholder:text-gray-300 focus:bg-highlight focus:placeholder:text-secondary/50 outline-none shadow-neo transition-colors"
        />
        <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-secondary" size={24} strokeWidth={3} />
        <button
          type="submit"
          disabled={loading || !query.trim()}
          className="absolute right-3 top-3 bottom-3 bg-secondary border-2 border-secondary text-white px-4 font-bold uppercase disabled:opacity-50 hover:bg-primary transition-colors hover:scale-105 active:scale-95"
        >
          {loading ? <Loader2 className="animate-spin" size={24} /> : <ArrowRight size={24} strokeWidth={3} />}
        </button>
      </form>

      {error && (
        <div className="bg-accent text-secondary p-4 border-3 border-secondary shadow-neo mb-6 font-bold uppercase flex items-center gap-2">
          <span className="text-2xl">!</span> {error}
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {results.length > 0 ? (
          <div className="space-y-4">
            {results.map((item, index) => (
              <button
                key={index}
                onClick={() => onSelect(item)}
                className="w-full bg-white border-3 border-secondary shadow-neo-sm p-4 hover:translate-x-1 hover:-translate-y-1 hover:shadow-neo transition-all text-left group"
              >
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-black text-lg text-secondary uppercase group-hover:text-blue-600 transition-colors">
                    {item.name}
                  </h3>
                  <div className="flex items-center bg-gray-100 px-2 py-1 rounded text-xs font-bold uppercase border-2 border-gray-200">
                    {getSourceIcon(item.source)}
                    <span className="ml-1 text-gray-600">{item.source || 'AI'}</span>
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-1 sm:gap-2 text-center">
                  <div className="bg-red-50 p-1 sm:p-2 border-2 border-red-100 rounded">
                    <p className="text-[8px] sm:text-xs text-red-400 font-bold uppercase">Kcal</p>
                    <p className="font-black text-secondary text-sm sm:text-base">{Math.round(item.macros.calories)}</p>
                  </div>
                  <div className="bg-blue-50 p-1 sm:p-2 border-2 border-blue-100 rounded">
                    <p className="text-[8px] sm:text-xs text-blue-400 font-bold uppercase">Pro</p>
                    <p className="font-black text-secondary text-sm sm:text-base">{Math.round(item.macros.protein)}g</p>
                  </div>
                  <div className="bg-yellow-50 p-1 sm:p-2 border-2 border-yellow-100 rounded">
                    <p className="text-[8px] sm:text-xs text-yellow-600 font-bold uppercase">Fat</p>
                    <p className="font-black text-secondary text-sm sm:text-base">{Math.round(item.macros.fat)}g</p>
                  </div>
                  <div className="bg-green-50 p-1 sm:p-2 border-2 border-green-100 rounded">
                    <p className="text-[8px] sm:text-xs text-green-600 font-bold uppercase">Carb</p>
                    <p className="font-black text-secondary text-sm sm:text-base">{Math.round(item.macros.carbs)}g</p>
                  </div>
                </div>
                <p className="text-xs text-gray-400 font-bold mt-2 text-right">
                  Running on {item.servingSize}
                </p>
              </button>
            ))}
          </div>
        ) : (
          !loading && !error && (
            <div className="flex flex-col items-center justify-center h-full text-center opacity-40">
              <SearchIcon size={80} className="mb-6 mx-auto text-secondary" strokeWidth={1.5} />
              <p className="uppercase font-black tracking-widest text-secondary text-xl">Type to search</p>
              <p className="text-sm font-bold text-gray-500 mt-2">Search Private, Public, & AI Database</p>
            </div>
          )
        )}

        {loading && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="inline-block w-16 h-16 border-4 border-secondary border-t-primary rounded-full animate-spin mb-6"></div>
            <p className="text-secondary font-black uppercase tracking-widest animate-pulse text-xl">Scouring The Globe...</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Search;