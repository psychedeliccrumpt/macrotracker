import React, { useState } from 'react';
import { Search as SearchIcon, Loader2, ArrowLeft, ArrowRight } from 'lucide-react';
import { searchFoodNutrition } from '../services/geminiService';
import { SearchResult } from '../types';

interface SearchProps {
  onSelect: (data: SearchResult) => void;
  onBack: () => void;
}

const Search: React.FC<SearchProps> = ({ onSelect, onBack }) => {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const result = await searchFoodNutrition(query);
      onSelect(result);
    } catch (err) {
      setError("Could not find food information. Please try a different query.");
    } finally {
      setLoading(false);
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

      <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
        {!loading && !error && (
          <div className="text-center opacity-40">
            <SearchIcon size={100} className="mb-6 mx-auto text-secondary" strokeWidth={1.5} />
            <p className="uppercase font-black tracking-widest text-secondary text-xl">Type to search</p>
          </div>
        )}
        
        {loading && (
          <div className="text-center">
            <div className="inline-block w-16 h-16 border-4 border-secondary border-t-primary rounded-full animate-spin mb-6"></div>
            <p className="text-secondary font-black uppercase tracking-widest animate-pulse text-xl">Analyzing...</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Search;