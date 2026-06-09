import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, ArrowLeft, ArrowRight, Loader2, Sparkles, CheckCircle2, AlertCircle, Trash2, Search as SearchIcon, Check, X } from 'lucide-react';
import { analyzeNaturalLanguageMeal } from '../services/geminiService';
import { transcribeAudio } from '../services/whisperService';
import { foodService } from '../services/foodService';
import { SearchResult } from '../types';
import EditorModal from './EditorModal';
import { useAuth } from '../contexts/AuthContext';

interface AILoggerProps {
    onBack: () => void;
    onLogItems: (items: SearchResult[]) => void;
}

const AILogger: React.FC<AILoggerProps> = ({ onBack, onLogItems }) => {
    const { user } = useAuth();

    // --- Voice state ---
    const [text, setText] = useState('');
    const [isListening, setIsListening] = useState(false);
    const [isTranscribing, setIsTranscribing] = useState(false);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<Blob[]>([]);
    const streamRef = useRef<MediaStream | null>(null);

    // --- Parse state ---
    const [loading, setLoading] = useState(false);
    const [results, setResults] = useState<any[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [editingIndex, setEditingIndex] = useState<number | null>(null);

    // --- Confirmation state ---
    const [confirmedItems, setConfirmedItems] = useState<Set<number>>(new Set());

    // --- Replace / search overlay state ---
    const [replacingIndex, setReplacingIndex] = useState<number | null>(null);
    const [replaceQuery, setReplaceQuery] = useState('');
    const [replaceResults, setReplaceResults] = useState<SearchResult[]>([]);
    const [isReplaceSearching, setIsReplaceSearching] = useState(false);
    const [replaceError, setReplaceError] = useState<string | null>(null);

    useEffect(() => {
        return () => {
            mediaRecorderRef.current?.stop();
            streamRef.current?.getTracks().forEach(t => t.stop());
        };
    }, []);

    // Reset confirmation state when results change
    useEffect(() => {
        setConfirmedItems(new Set());
    }, [results.length]);

    // ─── Voice ───────────────────────────────────────────────
    const toggleListening = async () => {
        if (isListening) { mediaRecorderRef.current?.stop(); return; }
        setError(null);
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            streamRef.current = stream;
            const mediaRecorder = new MediaRecorder(stream);
            mediaRecorderRef.current = mediaRecorder;
            chunksRef.current = [];
            mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
            mediaRecorder.onstop = async () => {
                stream.getTracks().forEach(t => t.stop());
                setIsListening(false);
                const audioBlob = new Blob(chunksRef.current, { type: mediaRecorder.mimeType });
                setIsTranscribing(true);
                try {
                    const transcript = await transcribeAudio(audioBlob);
                    setText(prev => (prev ? `${prev} ${transcript}` : transcript).trim());
                } catch (err: any) {
                    setError(err.message || 'Transcription failed.');
                } finally { setIsTranscribing(false); }
            };
            mediaRecorder.start();
            setIsListening(true);
        } catch { setError('Could not access microphone. Check permissions.'); }
    };

    // ─── Parse ────────────────────────────────────────────────
    const handleAnalyze = async () => {
        if (!text.trim()) return;
        setLoading(true); setError(null);
        try {
            const parsedResults = await analyzeNaturalLanguageMeal(text);
            setResults(parsedResults);
        } catch (err: any) {
            setError(err.message || 'Failed to analyze meal.');
        } finally { setLoading(false); }
    };

    // ─── Item management ─────────────────────────────────────
    const handleUpdateItem = (updatedItem: any) => {
        if (editingIndex === null) return;
        const newResults = [...results];
        newResults[editingIndex] = { ...newResults[editingIndex], ...updatedItem, macros: { calories: updatedItem.calories, protein: updatedItem.protein, fat: updatedItem.fat, carbs: updatedItem.carbs } };
        setResults(newResults);
        setEditingIndex(null);
    };
    const removeResult = (index: number) => setResults(results.filter((_, i) => i !== index));
    const handleLogAll = () => { if (results.length > 0) onLogItems(results); };

    // ─── Confirmation ────────────────────────────────────────
    const handleConfirm = (index: number) => {
        setConfirmedItems(prev => new Set([...prev, index]));
    };

    // ─── Replace search ──────────────────────────────────────
    const handleStartReplace = (e: React.MouseEvent, index: number, itemName: string) => {
        e.stopPropagation();
        setReplacingIndex(index);
        setReplaceQuery(itemName);
        setReplaceResults([]);
        setReplaceError(null);
    };

    const handleReplaceSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!replaceQuery.trim()) return;
        setIsReplaceSearching(true); setReplaceError(null);
        try {
            const data = await foodService.search(replaceQuery, user?.id);
            setReplaceResults(data);
        } catch { setReplaceError('Could not find food. Try a different search.'); }
        finally { setIsReplaceSearching(false); }
    };

    const handleReplaceSelect = (result: SearchResult) => {
        if (replacingIndex === null) return;
        const newResults = [...results];
        newResults[replacingIndex] = { name: result.name, macros: result.macros, servingSize: result.servingSize, brand: result.brand || 'Generic', quantity: result.quantity || 1, unit: result.unit || 'serving', servingWeight: result.servingWeight || null };
        setResults(newResults);
        setConfirmedItems(prev => new Set([...prev, replacingIndex]));
        setReplacingIndex(null);
    };

    const micBusy = isListening || isTranscribing;

    return (
        <div className="flex flex-col h-full bg-background relative overflow-hidden">
            {/* ─── Main scrollable content ─── */}
            <div className="flex-1 overflow-y-auto p-4 pb-24">
                {/* Header */}
                <div className="flex items-center mb-8">
                    <button onClick={onBack} className="mr-4 p-2 border-3 border-secondary bg-white hover:bg-secondary hover:text-white transition-colors shadow-neo-sm">
                        <ArrowLeft size={24} strokeWidth={3} />
                    </button>
                    <h1 className="text-2xl font-black uppercase text-secondary tracking-tight">AI Quick Log</h1>
                </div>

                {/* Input */}
                <div className="space-y-4 mb-8">
                    <div className="relative group">
                        <textarea
                            value={text}
                            onChange={(e) => setText(e.target.value)}
                            placeholder="Describe your meal… (e.g., '2 eggs with cheese and a cup of coffee')"
                            className="w-full h-40 p-6 border-3 border-secondary bg-white text-lg font-bold placeholder:text-gray-300 focus:bg-highlight outline-none shadow-neo transition-all resize-none"
                        />
                        <button
                            onClick={toggleListening}
                            disabled={isTranscribing}
                            className={`absolute right-4 bottom-4 w-12 h-12 rounded-full border-3 border-secondary flex items-center justify-center transition-all ${isListening ? 'bg-red-500 text-white animate-pulse' : isTranscribing ? 'bg-yellow-400 text-secondary cursor-wait' : 'bg-white text-secondary hover:bg-highlight'}`}
                        >
                            {isTranscribing ? <Loader2 size={22} className="animate-spin" /> : isListening ? <MicOff size={24} /> : <Mic size={24} />}
                        </button>
                    </div>

                    {(isListening || isTranscribing) && (
                        <p className={`text-xs font-bold uppercase tracking-widest text-center ${isListening ? 'text-red-500' : 'text-yellow-600'}`}>
                            {isListening ? '● Recording — tap mic to stop' : '⏳ Transcribing with Whisper…'}
                        </p>
                    )}

                    <button
                        onClick={handleAnalyze}
                        disabled={loading || !text.trim() || micBusy}
                        className="w-full py-4 bg-secondary text-white font-black uppercase text-xl border-3 border-secondary shadow-neo hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none active:translate-x-[4px] active:translate-y-[4px] transition-all disabled:opacity-50 flex items-center justify-center gap-3"
                    >
                        {loading ? <Loader2 className="animate-spin" /> : <Sparkles size={24} />}
                        {loading ? 'Analyzing...' : 'Parse Meal'}
                    </button>
                </div>

                {/* Error */}
                {error && (
                    <div className="p-4 border-3 border-secondary bg-red-100 text-secondary font-bold uppercase mb-8 flex items-center gap-3">
                        <AlertCircle className="shrink-0" />{error}
                    </div>
                )}

                {/* Results */}
                {results.length > 0 && (
                    <div className="space-y-6">
                        {editingIndex !== null && (
                            <EditorModal
                                initialData={{ ...results[editingIndex], macros: results[editingIndex].macros || { calories: results[editingIndex].calories, protein: results[editingIndex].protein, fat: results[editingIndex].fat, carbs: results[editingIndex].carbs } } as any}
                                onSave={handleUpdateItem}
                                onCancel={() => setEditingIndex(null)}
                            />
                        )}

                        <div className="flex items-center justify-between border-b-2 border-secondary pb-2">
                            <h2 className="font-black uppercase text-secondary tracking-widest text-sm">Detected Items</h2>
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] font-bold text-gray-400 uppercase italic">Tap to edit</span>
                                <span className="bg-secondary text-white px-2 py-0.5 text-xs font-black">{results.length}</span>
                            </div>
                        </div>

                        <div className="space-y-4">
                            {results.map((item, index) => (
                                <div
                                    key={index}
                                    onClick={() => setEditingIndex(index)}
                                    className="bg-white border-3 border-secondary shadow-neo-sm p-4 relative group cursor-pointer hover:bg-highlight/20 transition-colors"
                                >
                                    {/* Delete button */}
                                    <button
                                        onClick={(e) => { e.stopPropagation(); removeResult(index); }}
                                        className="absolute -top-3 -right-3 w-8 h-8 bg-white border-2 border-secondary rounded-full flex items-center justify-center text-secondary hover:bg-red-100 hover:text-red-500 transition-colors shadow-sm opacity-0 group-hover:opacity-100 z-10"
                                    >
                                        <Trash2 size={16} />
                                    </button>

                                    {/* Item header */}
                                    <div className="flex justify-between items-start mb-2">
                                        <h3 className="font-black text-secondary uppercase leading-tight">{item.name}</h3>
                                        <div className="text-right">
                                            <span className="font-mono text-xs font-bold text-gray-500 block">{item.servingSize}</span>
                                            <span className="font-black text-[10px] text-primary uppercase">{item.quantity} {item.unit}</span>
                                        </div>
                                    </div>

                                    {/* Macro boxes */}
                                    <div className="flex gap-4">
                                        <div className="text-center bg-gray-50 border-2 border-secondary/10 px-2 py-1 flex-1">
                                            <p className="text-[10px] uppercase font-bold text-gray-400">kcal</p>
                                            <p className="font-black text-secondary">{Math.round(item.macros?.calories || item.calories)}</p>
                                        </div>
                                        <div className="text-center bg-primary/10 border-2 border-primary/20 px-2 py-1 flex-1">
                                            <p className="text-[10px] uppercase font-bold text-primary">p</p>
                                            <p className="font-black text-secondary">{Math.round(item.macros?.protein || item.protein)}g</p>
                                        </div>
                                        <div className="text-center bg-accent/10 border-2 border-accent/20 px-2 py-1 flex-1">
                                            <p className="text-[10px] uppercase font-bold text-accent">c</p>
                                            <p className="font-black text-secondary">{Math.round(item.macros?.carbs || item.carbs)}g</p>
                                        </div>
                                        <div className="text-center bg-highlight/10 border-2 border-highlight/20 px-2 py-1 flex-1">
                                            <p className="text-[10px] uppercase font-bold text-highlight">f</p>
                                            <p className="font-black text-secondary">{Math.round(item.macros?.fat || item.fat)}g</p>
                                        </div>
                                    </div>

                                    {/* ── Confirm / Replace row ── */}
                                    {confirmedItems.has(index) ? (
                                        <div className="mt-3 pt-2 border-t-2 border-green-200 flex items-center gap-1.5">
                                            <CheckCircle2 size={13} className="text-green-500" />
                                            <span className="text-[10px] font-black uppercase tracking-widest text-green-600">Confirmed</span>
                                        </div>
                                    ) : (
                                        <div className="mt-3 pt-3 border-t-2 border-secondary/10 flex gap-2" onClick={e => e.stopPropagation()}>
                                            <button
                                                onClick={() => handleConfirm(index)}
                                                className="flex-1 py-1.5 text-[10px] font-black uppercase tracking-wider bg-green-50 text-green-700 border-2 border-green-300 hover:bg-green-100 transition-colors flex items-center justify-center gap-1"
                                            >
                                                <Check size={11} /> Correct
                                            </button>
                                            <button
                                                onClick={(e) => handleStartReplace(e, index, item.name)}
                                                className="flex-1 py-1.5 text-[10px] font-black uppercase tracking-wider bg-secondary/5 text-secondary border-2 border-secondary/25 hover:bg-highlight transition-colors flex items-center justify-center gap-1"
                                            >
                                                <SearchIcon size={11} /> Wrong? Find it
                                            </button>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>

                        <button
                            onClick={handleLogAll}
                            className="w-full py-5 bg-primary text-white font-black uppercase tracking-widest text-xl border-3 border-secondary shadow-neo hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none transition-all flex items-center justify-center gap-3"
                        >
                            <CheckCircle2 size={28} /> Log All Items
                        </button>
                    </div>
                )}

                {/* Empty state */}
                {!loading && results.length === 0 && !error && (
                    <div className="flex flex-col items-center justify-center py-12 opacity-30 text-center">
                        <Sparkles size={64} className="mb-4" strokeWidth={1.5} />
                        <p className="uppercase font-black tracking-widest">AI Intelligence Ready</p>
                        <p className="text-sm font-bold mt-2">Speak or type your meal to get macros</p>
                    </div>
                )}
            </div>

            {/* ─── Replace Search Overlay ─── */}
            {replacingIndex !== null && (
                <div className="absolute inset-0 bg-background z-30 flex flex-col animate-in slide-in-from-bottom-5 duration-200">
                    {/* Overlay header */}
                    <div className="flex items-center p-4 border-b-3 border-secondary bg-surface">
                        <button
                            onClick={() => setReplacingIndex(null)}
                            className="mr-3 p-2 border-3 border-secondary bg-white hover:bg-secondary hover:text-white transition-colors shadow-neo-sm"
                        >
                            <X size={20} strokeWidth={3} />
                        </button>
                        <div>
                            <h2 className="text-base font-black uppercase text-secondary leading-none">Replace Item</h2>
                            <p className="text-[10px] text-secondary/50 font-bold uppercase mt-0.5 truncate max-w-[220px]">
                                Currently: {results[replacingIndex]?.name}
                            </p>
                        </div>
                    </div>

                    {/* Search bar */}
                    <form onSubmit={handleReplaceSearch} className="relative p-4 border-b-2 border-secondary/10">
                        <input
                            type="text"
                            value={replaceQuery}
                            onChange={(e) => setReplaceQuery(e.target.value)}
                            autoFocus
                            placeholder="Search food..."
                            className="w-full pl-10 pr-14 py-3 border-3 border-secondary bg-white font-bold placeholder:text-gray-300 focus:bg-highlight outline-none shadow-neo text-sm"
                        />
                        <SearchIcon className="absolute left-7 top-1/2 -translate-y-1/2 text-secondary" size={17} />
                        <button
                            type="submit"
                            disabled={isReplaceSearching || !replaceQuery.trim()}
                            className="absolute right-7 top-7 bottom-7 bg-secondary text-white px-3 font-bold disabled:opacity-50 hover:bg-primary transition-colors flex items-center"
                        >
                            {isReplaceSearching ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}
                        </button>
                        <p className="text-[9px] text-secondary/40 font-bold uppercase mt-1 pl-1">Searches your database & web</p>
                    </form>

                    {/* Results */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-3">
                        {isReplaceSearching && (
                            <div className="text-center py-10 opacity-50">
                                <Loader2 size={36} className="animate-spin mx-auto mb-2 text-secondary" />
                                <p className="text-xs font-black uppercase tracking-widest">Searching…</p>
                            </div>
                        )}

                        {replaceError && (
                            <div className="p-3 bg-red-100 text-red-700 border-2 border-red-200 font-bold text-sm uppercase">
                                {replaceError}
                            </div>
                        )}

                        {replaceResults.map((r, i) => (
                            <button
                                key={i}
                                onClick={() => handleReplaceSelect(r)}
                                className="w-full text-left bg-white border-3 border-secondary p-4 shadow-neo-sm hover:bg-highlight hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none transition-all"
                            >
                                <div className="flex justify-between items-start mb-2">
                                    <h3 className="font-black text-secondary uppercase text-sm leading-tight">{r.name}</h3>
                                    <span className="text-[9px] font-black uppercase text-secondary/40 bg-secondary/5 px-1.5 py-0.5 border border-secondary/10 shrink-0 ml-2">{r.source || 'AI'}</span>
                                </div>
                                <div className="flex gap-2">
                                    {[
                                        { label: 'kcal', val: Math.round(r.macros.calories), cls: 'text-gray-400' },
                                        { label: 'p', val: `${Math.round(r.macros.protein)}g`, cls: 'text-primary' },
                                        { label: 'c', val: `${Math.round(r.macros.carbs)}g`, cls: 'text-accent' },
                                        { label: 'f', val: `${Math.round(r.macros.fat)}g`, cls: 'text-highlight' },
                                    ].map(({ label, val, cls }) => (
                                        <div key={label} className="flex-1 text-center bg-secondary/5 border border-secondary/10 py-1">
                                            <p className={`text-[8px] font-bold uppercase ${cls}`}>{label}</p>
                                            <p className="font-black text-secondary text-xs">{val}</p>
                                        </div>
                                    ))}
                                </div>
                                {r.servingSize && <p className="text-[9px] text-gray-400 font-bold mt-1.5">{r.servingSize}</p>}
                            </button>
                        ))}

                        {!isReplaceSearching && replaceResults.length === 0 && !replaceError && (
                            <div className="text-center py-12 opacity-30">
                                <SearchIcon size={48} className="mx-auto mb-3" strokeWidth={1.5} />
                                <p className="text-xs font-black uppercase tracking-widest">Search to replace</p>
                                <p className="text-[10px] font-bold mt-1">Tap the arrow or press Enter</p>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default AILogger;
