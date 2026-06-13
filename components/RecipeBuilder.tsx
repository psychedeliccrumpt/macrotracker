import React, { useState, useEffect, useRef } from 'react';
import { Plus, Trash2, ArrowLeft, Utensils, ChefHat, Loader2, Pencil, Search as SearchIcon, ScanLine, Mic, MicOff } from 'lucide-react';
import { FoodItem, Macros, Recipe, SearchResult } from '../types';
import Search from './Search';
import Scanner from './Scanner';
import EditorModal from './EditorModal';
import { recipeService } from '../services/recipeService';
import { useAuth } from '../contexts/AuthContext';
import { transcribeAudio } from '../services/whisperService';
import { analyzeNaturalLanguageMeal } from '../services/geminiService';

const generateId = () => Math.random().toString(36).substring(2, 9);

const NUM_BARS = 9;

interface RecipeBuilderProps {
  // savedRecipes prop is deprecated in favor of internal fetching
  onSaveRecipe?: (recipeName: string, ingredients: FoodItem[], totalMacros: Macros) => void;
  onLogRecipe: (recipe: Recipe) => void;
}

const RecipeBuilder: React.FC<RecipeBuilderProps> = ({ onLogRecipe }) => {
  const { user } = useAuth();
  const [isCreating, setIsCreating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [recipes, setRecipes] = useState<Recipe[]>([]);

  // Builder State
  const [recipeName, setRecipeName] = useState('');
  const [ingredients, setIngredients] = useState<FoodItem[]>([]);
  const [showSearch, setShowSearch] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [tempSearchResult, setTempSearchResult] = useState<SearchResult | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [servings, setServings] = useState(1);

  // Edit State
  const [editingRecipeId, setEditingRecipeId] = useState<string | null>(null);

  // Voice State
  const [isListening, setIsListening] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [barHeights, setBarHeights] = useState<number[]>(Array(NUM_BARS).fill(4));

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const animFrameRef = useRef<number | null>(null);

  // Load Recipes from DB
  useEffect(() => {
    if (user) {
      loadRecipes();
    }
  }, [user]);

  // Cleanup voice on unmount
  useEffect(() => {
    return () => {
      mediaRecorderRef.current?.stop();
      streamRef.current?.getTracks().forEach(t => t.stop());
      stopWaveform();
    };
  }, []);

  const loadRecipes = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const data = await recipeService.getAll(user.id);
      setRecipes(data);
    } catch (e) {
      console.error("Failed to load recipes", e);
    } finally {
      setLoading(false);
    }
  };

  const totalMacros = ingredients.reduce((acc, curr) => ({
    calories: acc.calories + curr.calories,
    protein: acc.protein + curr.protein,
    carbs: acc.carbs + curr.carbs,
    fat: acc.fat + curr.fat,
  }), { calories: 0, protein: 0, carbs: 0, fat: 0 });

  const handleAddIngredient = (data: Omit<FoodItem, 'id' | 'timestamp'>) => {
    const newItem: FoodItem = {
      ...data,
      id: generateId(), // Temporary ID for UI
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

  // ─── Edit recipe ───────────────────────────────────────────
  const handleStartEdit = (recipe: Recipe) => {
    setEditingRecipeId(recipe.id);
    setRecipeName(recipe.name);
    setServings(recipe.servings);
    setIngredients(recipe.ingredients.map(ing => ({
      ...ing,
      timestamp: Date.now(),
    })));
    setIsCreating(true);
  };

  const handleExitEditor = () => {
    setIsCreating(false);
    setEditingRecipeId(null);
    setRecipeName('');
    setIngredients([]);
    setServings(1);
  };

  const handleSave = async () => {
    if (!recipeName.trim() || ingredients.length === 0 || !user) return;
    setIsSaving(true);
    try {
      if (editingRecipeId) {
        await recipeService.update(editingRecipeId, user.id, recipeName, ingredients, servings);
      } else {
        await recipeService.create(user.id, recipeName, ingredients, servings);
      }
      await loadRecipes(); // Reload list
      handleExitEditor();
    } catch (e: any) {
      console.error("Failed to save recipe", e);
      alert(`Failed to save recipe: ${e.message || 'Unknown error'}. Make sure you have updated the database schema.`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteRecipe = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this recipe?')) return;
    try {
      // Optimistic update
      setRecipes(recipes.filter(r => r.id !== id));
      await recipeService.delete(id);
    } catch (e) {
      console.error("Failed to delete", e);
      loadRecipes(); // Revert on error
    }
  };

  // ─── Waveform visualizer ──────────────────────────────────
  const startWaveform = (stream: MediaStream) => {
    try {
      const audioCtx = new AudioContext();
      audioCtxRef.current = audioCtx;
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 64;
      analyser.smoothingTimeConstant = 0.75;
      audioCtx.createMediaStreamSource(stream).connect(analyser);
      analyserRef.current = analyser;

      const data = new Uint8Array(analyser.frequencyBinCount);
      const step = Math.floor(data.length / NUM_BARS);

      const tick = () => {
        analyser.getByteFrequencyData(data);
        const heights = Array.from({ length: NUM_BARS }, (_, i) => {
          const raw = data[i * step] / 255;
          const center = (NUM_BARS - 1) / 2;
          const bias = 1 - (Math.abs(i - center) / center) * 0.25;
          return Math.max(4, Math.round(raw * 36 * bias));
        });
        setBarHeights(heights);
        animFrameRef.current = requestAnimationFrame(tick);
      };
      tick();
    } catch (_) { /* AudioContext not available */ }
  };

  const stopWaveform = () => {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    animFrameRef.current = null;
    audioCtxRef.current?.close().catch(() => {});
    audioCtxRef.current = null;
    analyserRef.current = null;
    setBarHeights(Array(NUM_BARS).fill(4));
  };

  // ─── Voice recording ─────────────────────────────────────
  const toggleVoice = async () => {
    if (isListening) {
      mediaRecorderRef.current?.stop();
      stopWaveform();
      return;
    }
    setVoiceError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 44100,
        }
      });
      streamRef.current = stream;

      let options = {};
      if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
        options = { mimeType: 'audio/webm;codecs=opus' };
      }
      const mediaRecorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];
      mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        setIsListening(false);
        const audioBlob = new Blob(chunksRef.current, { type: mediaRecorder.mimeType });

        // Step 1: Transcribe
        setIsTranscribing(true);
        try {
          const transcript = await transcribeAudio(audioBlob);
          if (!transcript.trim()) {
            setVoiceError('No speech detected. Try again.');
            setIsTranscribing(false);
            return;
          }

          // Step 2: Parse with Gemini
          setIsTranscribing(false);
          setIsParsing(true);
          const parsedResults = await analyzeNaturalLanguageMeal(transcript);

          // Step 3: Add each parsed item as an ingredient
          const newIngredients: FoodItem[] = parsedResults.map((item: any) => ({
            id: generateId(),
            name: item.name,
            calories: item.macros?.calories ?? item.calories ?? 0,
            protein: item.macros?.protein ?? item.protein ?? 0,
            fat: item.macros?.fat ?? item.fat ?? 0,
            carbs: item.macros?.carbs ?? item.carbs ?? 0,
            quantity: item.quantity || 1,
            unit: item.unit || 'serving',
            servingSize: item.servingSize,
            timestamp: Date.now(),
            source: 'recipe' as const,
          }));
          setIngredients(prev => [...prev, ...newIngredients]);
        } catch (err: any) {
          setVoiceError(err.message || 'Voice processing failed.');
        } finally {
          setIsTranscribing(false);
          setIsParsing(false);
        }
      };
      mediaRecorder.start();
      startWaveform(stream);
      setIsListening(true);
    } catch { setVoiceError('Could not access microphone.'); }
  };

  const voiceBusy = isListening || isTranscribing || isParsing;

  // ─── Subview: Search ──────────────────────────────────────
  if (showSearch) {
    return (
      <Search
        onSelect={(result) => {
          setTempSearchResult(result);
          setShowSearch(false);
        }}
        onBack={() => setShowSearch(false)}
      />
    );
  }

  // ─── Subview: Scanner ─────────────────────────────────────
  if (showScanner) {
    return (
      <Scanner
        onScanComplete={(result) => {
          setTempSearchResult(result);
          setShowScanner(false);
        }}
        onClose={() => setShowScanner(false)}
      />
    );
  }

  // ═══════════════════════════════════════════════════════════
  // LIST VIEW
  // ═══════════════════════════════════════════════════════════
  if (!isCreating) {
    return (
      <div className="flex flex-col h-full bg-background relative">
        <div className="p-6 bg-surface border-b-3 border-secondary shadow-neo">
          <h1 className="text-4xl font-black uppercase tracking-tighter text-secondary">Recipes</h1>
          <div className="w-16 h-3 bg-primary mt-2 border-2 border-secondary"></div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 pb-24">
          {loading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="animate-spin text-secondary" size={40} />
            </div>
          ) : recipes.length === 0 ? (
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
              {recipes.map(recipe => (
                <div key={recipe.id} className="bg-surface p-4 border-3 border-secondary shadow-neo flex flex-col gap-4 group">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-black text-secondary text-xl uppercase bg-highlight px-2 border-2 border-secondary inline-block transform -rotate-1">{recipe.name}</h3>
                      <p className="text-xs font-mono font-bold text-gray-500 mt-2">{recipe.ingredients.length} INGREDIENTS</p>
                    </div>
                    <div className="text-right">
                      <span className="block font-black text-2xl text-secondary font-mono">{Math.round(recipe.totalMacros.calories / recipe.servings)}</span>
                      <span className="text-[10px] font-bold uppercase text-white bg-secondary px-1 italic">KCAL / SERV</span>
                    </div>
                  </div>
                  <div className="flex gap-2 border-t-2 border-secondary pt-2">
                    <span className="text-xs font-bold text-primary font-mono bg-primary/10 px-1 border border-secondary">P: {Math.round(recipe.totalMacros.protein / recipe.servings)}g</span>
                    <span className="text-xs font-bold text-accent font-mono bg-accent/10 px-1 border border-secondary">C: {Math.round(recipe.totalMacros.carbs / recipe.servings)}g</span>
                    <span className="text-xs font-bold text-highlight font-mono bg-highlight/10 px-1 border border-secondary">F: {Math.round(recipe.totalMacros.fat / recipe.servings)}g</span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => onLogRecipe(recipe)}
                      className="flex-1 py-3 bg-secondary text-white font-bold border-3 border-secondary hover:bg-primary transition-colors flex items-center justify-center gap-2 text-sm uppercase tracking-wide shadow-neo-sm active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
                    >
                      <Plus size={18} strokeWidth={3} /> Log Meal
                    </button>
                    <button
                      onClick={() => handleStartEdit(recipe)}
                      className="px-4 py-3 bg-white text-secondary font-bold border-3 border-secondary hover:bg-highlight transition-colors shadow-neo-sm active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
                    >
                      <Pencil size={18} strokeWidth={3} />
                    </button>
                    <button
                      onClick={(e) => handleDeleteRecipe(recipe.id, e)}
                      className="px-4 py-3 bg-white text-secondary font-bold border-3 border-secondary hover:bg-red-100 hover:text-red-600 transition-colors shadow-neo-sm active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
                    >
                      <Trash2 size={18} strokeWidth={3} />
                    </button>
                  </div>
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

  // ═══════════════════════════════════════════════════════════
  // CREATE / EDIT VIEW
  // ═══════════════════════════════════════════════════════════
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
          <button onClick={handleExitEditor} className="mr-4 p-2 border-3 border-secondary bg-white hover:bg-secondary hover:text-white transition-colors shadow-neo-sm">
            <ArrowLeft size={24} strokeWidth={3} />
          </button>
          <h1 className="text-2xl font-black uppercase text-secondary">{editingRecipeId ? 'Edit Recipe' : 'New Recipe'}</h1>
        </div>
        <input
          type="text"
          placeholder="RECIPE NAME"
          value={recipeName}
          onChange={(e) => setRecipeName(e.target.value)}
          className="w-full text-2xl font-black p-4 border-3 border-secondary focus:bg-highlight outline-none uppercase placeholder:text-gray-300 shadow-neo-sm"
        />

        <div className="mt-4 flex items-center justify-between bg-white p-3 border-3 border-secondary shadow-neo-sm">
          <span className="font-black uppercase text-xs tracking-widest text-secondary">Number of Servings</span>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setServings(Math.max(1, servings - 1))}
              className="w-10 h-10 border-2 border-secondary bg-gray-100 font-black text-xl hover:bg-secondary hover:text-white transition-colors"
            >-</button>
            <span className="w-12 text-center text-xl font-black text-secondary font-mono">{servings}</span>
            <button
              onClick={() => setServings(servings + 1)}
              className="w-10 h-10 border-2 border-secondary bg-gray-100 font-black text-xl hover:bg-secondary hover:text-white transition-colors"
            >+</button>
          </div>
        </div>
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

        {/* ─── 3-button add row ───────────────────────────── */}
        <div className="grid grid-cols-3 gap-2 mt-8">
          <button
            onClick={() => setShowSearch(true)}
            disabled={voiceBusy}
            className="py-3 border-3 border-dashed border-secondary bg-white text-secondary font-black uppercase text-[10px] tracking-wider hover:bg-secondary hover:text-white hover:border-solid transition-all flex flex-col items-center justify-center gap-1.5 disabled:opacity-40"
          >
            <SearchIcon size={20} strokeWidth={3} />
            Search
          </button>
          <button
            onClick={() => setShowScanner(true)}
            disabled={voiceBusy}
            className="py-3 border-3 border-dashed border-secondary bg-white text-secondary font-black uppercase text-[10px] tracking-wider hover:bg-secondary hover:text-white hover:border-solid transition-all flex flex-col items-center justify-center gap-1.5 disabled:opacity-40"
          >
            <ScanLine size={20} strokeWidth={3} />
            Scan
          </button>
          <button
            onClick={toggleVoice}
            disabled={isTranscribing || isParsing}
            className={`py-3 border-3 font-black uppercase text-[10px] tracking-wider transition-all flex flex-col items-center justify-center gap-1.5 ${
              isListening
                ? 'border-red-500 bg-red-50 text-red-600 animate-pulse'
                : isTranscribing || isParsing
                  ? 'border-secondary bg-yellow-50 text-yellow-700 cursor-wait'
                  : 'border-dashed border-secondary bg-white text-secondary hover:bg-secondary hover:text-white hover:border-solid'
            }`}
          >
            {isTranscribing || isParsing ? (
              <Loader2 size={20} className="animate-spin" />
            ) : isListening ? (
              <MicOff size={20} strokeWidth={3} />
            ) : (
              <Mic size={20} strokeWidth={3} />
            )}
            {isTranscribing ? 'Listening…' : isParsing ? 'Adding…' : isListening ? 'Stop' : 'Voice'}
          </button>
        </div>

        {/* ─── Voice waveform + status ────────────────────── */}
        {isListening && (
          <div className="flex items-center justify-center gap-[4px] h-12 px-4 mt-3 bg-red-50 border-2 border-red-200">
            {barHeights.map((h, i) => (
              <div
                key={i}
                className="w-[4px] rounded-full bg-red-500"
                style={{
                  height: `${h}px`,
                  opacity: 0.5 + (h / 36) * 0.5,
                  transition: 'height 55ms ease-out, opacity 55ms ease-out',
                }}
              />
            ))}
          </div>
        )}

        {(isListening || isTranscribing || isParsing) && (
          <p className={`text-[9px] font-black uppercase tracking-widest text-center mt-2 ${isListening ? 'text-red-500' : 'text-yellow-600'}`}>
            {isListening ? '● Recording — speak your ingredients, then tap stop' : isTranscribing ? '⏳ Transcribing with Whisper…' : '🧠 Parsing ingredients with AI…'}
          </p>
        )}

        {voiceError && (
          <p className="text-[10px] font-bold text-red-600 text-center mt-2 bg-red-50 border border-red-200 p-2">
            {voiceError}
          </p>
        )}
      </div>

      <div className="p-4 bg-surface border-t-3 border-secondary">
        <div className="flex justify-between text-sm font-mono font-bold text-secondary mb-4 px-2 border-b-2 border-secondary pb-2">
          <div className="flex flex-col">
            <span className="text-lg leading-none">{Math.round(totalMacros.calories / servings)} KCAL</span>
            <span className="text-[9px] uppercase opacity-50 italic">Per Serving</span>
          </div>
          <div className="flex flex-wrap gap-2 items-center justify-end">
            <span className="text-primary bg-primary/10 px-1">P:{Math.round(totalMacros.protein / servings)}g</span>
            <span className="text-accent bg-accent/10 px-1">C:{Math.round(totalMacros.carbs / servings)}g</span>
            <span className="text-highlight bg-highlight/10 px-1">F:{Math.round(totalMacros.fat / servings)}g</span>
          </div>
        </div>
        <button
          onClick={handleSave}
          disabled={!recipeName.trim() || ingredients.length === 0 || isSaving || voiceBusy}
          className="w-full py-4 bg-primary text-white font-black uppercase text-xl border-3 border-secondary shadow-neo active:shadow-none active:translate-x-[4px] active:translate-y-[4px] transition-all disabled:opacity-50 disabled:shadow-none disabled:translate-x-0 disabled:cursor-not-allowed flex justify-center gap-2"
        >
          {isSaving ? <Loader2 className="animate-spin" /> : editingRecipeId ? 'Update Recipe' : 'Save Recipe'}
        </button>
      </div>
    </div>
  );
};

export default RecipeBuilder;