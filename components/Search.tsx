import React, { useRef, useState } from 'react';
import { Search as SearchIcon, Loader2, ArrowLeft, ArrowRight, User, Globe, Sparkles, CookingPot, Database } from 'lucide-react';
import { foodService } from '../services/foodService';
import { SearchResult } from '../types';
import { useAuth } from '../contexts/AuthContext';

interface SearchProps {
  onSelect: (data: SearchResult) => void;
  onBack: () => void;
}

type SearchMode = 'database' | 'online' | 'both';

const MODES: { value: SearchMode; label: string; icon: React.ReactNode }[] = [
  { value: 'database', label: 'Database', icon: <Database size={14} strokeWidth={3} /> },
  { value: 'online', label: 'Online', icon: <Sparkles size={14} strokeWidth={3} /> },
  { value: 'both', label: 'Both', icon: <Globe size={14} strokeWidth={3} /> },
];

const MODE_STORAGE_KEY = 'macrotracker.searchMode';

const loadMode = (): SearchMode => {
  try {
    const saved = localStorage.getItem(MODE_STORAGE_KEY);
    if (saved === 'database' || saved === 'online' || saved === 'both') return saved;
  } catch {
    // storage unavailable: fall through to default
  }
  return 'both';
};

const MODE_HINT: Record<SearchMode, string> = {
  database: 'Your foods, public foods & recipes',
  online: 'AI web search for nutrition facts',
  both: 'Your database + AI web search',
};

const Search: React.FC<SearchProps> = ({ onSelect, onBack }) => {
  const { user } = useAuth();
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState<SearchMode>(loadMode);

  // Database and online searches load independently, so local results show instantly
  const [dbResults, setDbResults] = useState<SearchResult[]>([]);
  const [onlineResults, setOnlineResults] = useState<SearchResult[]>([]);
  const [dbLoading, setDbLoading] = useState(false);
  const [onlineLoading, setOnlineLoading] = useState(false);
  const [dbError, setDbError] = useState<string | null>(null);
  const [onlineError, setOnlineError] = useState<string | null>(null);
  const [searchedQuery, setSearchedQuery] = useState<string | null>(null);
  const [searchedMode, setSearchedMode] = useState<SearchMode | null>(null);

  // Ignore responses from an older search if the user searched again
  const requestId = useRef(0);

  const changeMode = (m: SearchMode) => {
    setMode(m);
    try {
      localStorage.setItem(MODE_STORAGE_KEY, m);
    } catch {
      // ignore
    }
  };

  const runDatabase = async (q: string, id: number) => {
    setDbLoading(true);
    try {
      const data = await foodService.searchDatabase(q, user?.id);
      if (id === requestId.current) setDbResults(data);
    } catch (err: any) {
      if (id === requestId.current) setDbError(err?.message || 'Database search failed.');
    } finally {
      if (id === requestId.current) setDbLoading(false);
    }
  };

  const runOnline = async (q: string, id: number) => {
    setOnlineLoading(true);
    try {
      const data = await foodService.searchOnline(q);
      if (id === requestId.current) setOnlineResults([data]);
    } catch (err: any) {
      if (id === requestId.current) setOnlineError(err?.message || 'Online search failed.');
    } finally {
      if (id === requestId.current) setOnlineLoading(false);
    }
  };

  const search = (searchMode: SearchMode) => {
    const q = query.trim();
    if (!q) return;
    const id = ++requestId.current;

    setDbResults([]);
    setOnlineResults([]);
    setDbError(null);
    setOnlineError(null);
    setDbLoading(false);
    setOnlineLoading(false);
    setSearchedQuery(q);
    setSearchedMode(searchMode);

    if (searchMode !== 'online') runDatabase(q, id);
    if (searchMode !== 'database') runOnline(q, id);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    search(mode);
  };

  // From an empty database result: run the online search for the same query
  const searchOnlineToo = () => {
    const q = searchedQuery;
    if (!q) return;
    const id = requestId.current;
    setSearchedMode('both');
    setOnlineError(null);
    runOnline(q, id);
  };

  const loading = dbLoading || onlineLoading;

  const getSourceIcon = (source?: string) => {
    switch (source) {
      case 'personal': return <User size={16} className="text-blue-500" />;
      case 'community': return <Globe size={16} className="text-green-500" />;
      case 'recipe': return <CookingPot size={16} className="text-orange-500" />;
      default: return <Sparkles size={16} className="text-secondary" />;
    }
  };

  const renderCard = (item: SearchResult, key: string) => (
    <button
      key={key}
      onClick={() => onSelect(item)}
      className="w-full bg-white border-3 border-secondary shadow-neo-sm p-4 hover:translate-x-1 hover:-translate-y-1 hover:shadow-neo transition-all text-left group"
    >
      <div className="flex justify-between items-start mb-2 gap-2">
        <div className="min-w-0">
          {item.brand && item.brand !== 'Generic' && (
            <p className="text-[10px] font-black uppercase tracking-widest text-secondary/40">{item.brand}</p>
          )}
          <h3 className="font-black text-lg text-secondary uppercase group-hover:text-blue-600 transition-colors">
            {item.name}
          </h3>
        </div>
        <div className="flex items-center bg-gray-100 px-2 py-1 rounded text-xs font-bold uppercase border-2 border-gray-200 shrink-0">
          {getSourceIcon(item.source)}
          <span className="ml-1 text-gray-600">{item.source === 'search' ? 'AI' : item.source || 'AI'}</span>
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
  );

  const SectionHeader = ({ icon, title }: { icon: React.ReactNode; title: string }) => (
    <div className="flex items-center gap-2 mb-3 text-secondary">
      {icon}
      <h2 className="text-xs font-black uppercase tracking-widest">{title}</h2>
      <div className="flex-1 h-[3px] bg-secondary/20" />
    </div>
  );

  const ErrorBox = ({ message }: { message: string }) => (
    <div className="bg-accent text-secondary p-4 border-3 border-secondary shadow-neo-sm font-bold uppercase flex items-start gap-2 text-sm">
      <span className="text-2xl leading-none">!</span> <span>{message}</span>
    </div>
  );

  const Spinner = ({ label }: { label: string }) => (
    <div className="flex items-center gap-3 p-4 border-3 border-dashed border-secondary/30 bg-white/50">
      <Loader2 className="animate-spin text-secondary" size={20} />
      <span className="text-secondary font-black uppercase tracking-widest text-xs animate-pulse">{label}</span>
    </div>
  );

  const showDb = searchedMode === 'database' || searchedMode === 'both';
  const showOnline = searchedMode === 'online' || searchedMode === 'both';

  return (
    <div className="flex flex-col h-full bg-background p-4">
      <div className="flex items-center mb-8">
        <button onClick={onBack} className="mr-4 p-2 border-3 border-secondary bg-white hover:bg-secondary hover:text-white transition-colors shadow-neo-sm">
          <ArrowLeft size={24} strokeWidth={3} />
        </button>
        <h1 className="text-2xl font-black uppercase text-secondary tracking-tight">Search Food</h1>
      </div>

      <form onSubmit={handleSubmit} className="relative mb-4 group">
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

      {/* Where to search */}
      <div className="mb-8">
        <div role="radiogroup" aria-label="Where to search" className="grid grid-cols-3 border-3 border-secondary shadow-neo-sm bg-white">
          {MODES.map((m, i) => {
            const active = mode === m.value;
            return (
              <button
                key={m.value}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => changeMode(m.value)}
                className={`flex items-center justify-center gap-1.5 py-2.5 text-xs font-black uppercase tracking-wider transition-colors ${
                  i > 0 ? 'border-l-3 border-secondary' : ''
                } ${active ? 'bg-secondary text-white' : 'bg-white text-secondary hover:bg-highlight'}`}
              >
                {m.icon}
                {m.label}
              </button>
            );
          })}
        </div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-secondary/50 mt-2 text-center">
          {MODE_HINT[mode]}
        </p>
      </div>

      <div className="flex-1 overflow-y-auto space-y-8">
        {!searchedMode && (
          <div className="flex flex-col items-center justify-center h-full text-center opacity-40">
            <SearchIcon size={80} className="mb-6 mx-auto text-secondary" strokeWidth={1.5} />
            <p className="uppercase font-black tracking-widest text-secondary text-xl">Type to search</p>
            <p className="text-sm font-bold text-gray-500 mt-2">{MODE_HINT[mode]}</p>
          </div>
        )}

        {showDb && (
          <section>
            {searchedMode === 'both' && <SectionHeader icon={<Database size={14} strokeWidth={3} />} title="Your database" />}
            {dbLoading && <Spinner label="Checking your database..." />}
            {dbError && <ErrorBox message={dbError} />}
            {!dbLoading && !dbError && dbResults.length > 0 && (
              <div className="space-y-4">{dbResults.map((item, i) => renderCard(item, `db-${i}`))}</div>
            )}
            {!dbLoading && !dbError && dbResults.length === 0 && (
              <div className="p-4 border-3 border-dashed border-secondary/30 bg-white/50 text-center">
                <p className="text-secondary font-black uppercase text-sm">No matches for "{searchedQuery}"</p>
                <p className="text-xs font-bold text-gray-500 mt-1">Searched food names, brands & your recipes</p>
                {searchedMode === 'database' && (
                  <button
                    type="button"
                    onClick={searchOnlineToo}
                    className="mt-3 inline-flex items-center gap-2 px-4 py-2 bg-highlight border-2 border-secondary font-black uppercase text-xs text-secondary shadow-neo-sm hover:bg-secondary hover:text-white transition-colors"
                  >
                    <Sparkles size={14} strokeWidth={3} /> Search online instead
                  </button>
                )}
              </div>
            )}
          </section>
        )}

        {showOnline && (
          <section>
            {searchedMode === 'both' && <SectionHeader icon={<Sparkles size={14} strokeWidth={3} />} title="Online (AI)" />}
            {onlineLoading && <Spinner label="Scouring the globe..." />}
            {onlineError && <ErrorBox message={onlineError} />}
            {!onlineLoading && !onlineError && onlineResults.length > 0 && (
              <div className="space-y-4">{onlineResults.map((item, i) => renderCard(item, `online-${i}`))}</div>
            )}
          </section>
        )}
      </div>
    </div>
  );
};

export default Search;
