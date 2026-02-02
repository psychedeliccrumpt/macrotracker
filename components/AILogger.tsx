import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Send, ArrowLeft, Loader2, Sparkles, CheckCircle2, AlertCircle, Trash2 } from 'lucide-react';
import { analyzeNaturalLanguageMeal } from '../services/geminiService';
import { SearchResult, Macros } from '../types';
import EditorModal from './EditorModal';

interface AILoggerProps {
    onBack: () => void;
    onLogItems: (items: SearchResult[]) => void;
}

const AILogger: React.FC<AILoggerProps> = ({ onBack, onLogItems }) => {
    const [text, setText] = useState('');
    const [isListening, setIsListening] = useState(false);
    const [loading, setLoading] = useState(false);
    const [results, setResults] = useState<any[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [editingIndex, setEditingIndex] = useState<number | null>(null);

    const recognitionRef = useRef<any>(null);

    useEffect(() => {
        // Check for Web Speech API support
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (SpeechRecognition) {
            recognitionRef.current = new SpeechRecognition();
            recognitionRef.current.continuous = false;
            recognitionRef.current.interimResults = false;
            recognitionRef.current.lang = 'en-US';

            recognitionRef.current.onresult = (event: any) => {
                const transcript = event.results[0][0].transcript;
                setText(prev => (prev + ' ' + transcript).trim());
                setIsListening(false);
            };

            recognitionRef.current.onerror = (event: any) => {
                console.error('Speech recognition error:', event.error);
                setIsListening(false);
                setError(`Voice Error: ${event.error}`);
            };

            recognitionRef.current.onend = () => {
                setIsListening(false);
            };
        }

        return () => {
            if (recognitionRef.current) {
                recognitionRef.current.stop();
            }
        };
    }, []);

    const toggleListening = () => {
        if (isListening) {
            recognitionRef.current?.stop();
        } else {
            setError(null);
            try {
                recognitionRef.current?.start();
                setIsListening(true);
            } catch (e) {
                console.error('Recognition start failed', e);
                setError('Could not start microphone. Check permissions.');
            }
        }
    };

    const handleAnalyze = async () => {
        if (!text.trim()) return;
        setLoading(true);
        setError(null);
        try {
            const parsedResults = await analyzeNaturalLanguageMeal(text);
            setResults(parsedResults);
        } catch (err: any) {
            setError(err.message || 'Failed to analyze meal. Try being more specific.');
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateItem = (updatedItem: any) => {
        if (editingIndex === null) return;
        const newResults = [...results];
        newResults[editingIndex] = {
            ...newResults[editingIndex],
            ...updatedItem,
            macros: {
                calories: updatedItem.calories,
                protein: updatedItem.protein,
                fat: updatedItem.fat,
                carbs: updatedItem.carbs
            }
        };
        setResults(newResults);
        setEditingIndex(null);
    };

    const removeResult = (index: number) => {
        setResults(results.filter((_, i) => i !== index));
    };

    const handleLogAll = () => {
        if (results.length === 0) return;
        onLogItems(results);
    };

    return (
        <div className="flex flex-col h-full bg-background p-4 overflow-y-auto pb-24">
            {/* Header */}
            <div className="flex items-center mb-8">
                <button onClick={onBack} className="mr-4 p-2 border-3 border-secondary bg-white hover:bg-secondary hover:text-white transition-colors shadow-neo-sm">
                    <ArrowLeft size={24} strokeWidth={3} />
                </button>
                <h1 className="text-2xl font-black uppercase text-secondary tracking-tight">AI Quick Log</h1>
            </div>

            {/* Input Area */}
            <div className="space-y-4 mb-8">
                <div className="relative group">
                    <textarea
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        placeholder="Describe your meal... (e.g., '2 eggs with cheese and a cup of coffee')"
                        className="w-full h-40 p-6 border-3 border-secondary bg-white text-lg font-bold placeholder:text-gray-300 focus:bg-highlight outline-none shadow-neo transition-all resize-none"
                    />
                    <button
                        onClick={toggleListening}
                        className={`absolute right-4 bottom-4 w-12 h-12 rounded-full border-3 border-secondary flex items-center justify-center transition-all ${isListening ? 'bg-red-500 text-white animate-pulse' : 'bg-white text-secondary hover:bg-highlight'
                            }`}
                    >
                        {isListening ? <MicOff size={24} /> : <Mic size={24} />}
                    </button>
                </div>

                <button
                    onClick={handleAnalyze}
                    disabled={loading || !text.trim()}
                    className="w-full py-4 bg-secondary text-white font-black uppercase text-xl border-3 border-secondary shadow-neo hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none active:translate-x-[4px] active:translate-y-[4px] transition-all disabled:opacity-50 flex items-center justify-center gap-3"
                >
                    {loading ? <Loader2 className="animate-spin" /> : <Sparkles size={24} />}
                    {loading ? 'Analyzing...' : 'Parse Meal'}
                </button>
            </div>

            {/* Errors */}
            {error && (
                <div className="p-4 border-3 border-secondary bg-red-100 text-secondary font-bold uppercase mb-8 flex items-center gap-3">
                    <AlertCircle className="shrink-0" />
                    {error}
                </div>
            )}

            {/* Results */}
            {results.length > 0 && (
                <div className="space-y-6">
                    {editingIndex !== null && (
                        <EditorModal
                            initialData={{
                                ...results[editingIndex],
                                macros: results[editingIndex].macros || {
                                    calories: results[editingIndex].calories,
                                    protein: results[editingIndex].protein,
                                    fat: results[editingIndex].fat,
                                    carbs: results[editingIndex].carbs
                                }
                            } as any}
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
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        removeResult(index);
                                    }}
                                    className="absolute -top-3 -right-3 w-8 h-8 bg-white border-2 border-secondary rounded-full flex items-center justify-center text-secondary hover:bg-red-100 hover:text-red-500 transition-colors shadow-sm opacity-0 group-hover:opacity-100 transition-opacity z-10"
                                >
                                    <Trash2 size={16} />
                                </button>

                                <div className="flex justify-between items-start mb-2">
                                    <h3 className="font-black text-secondary uppercase leading-tight">{item.name}</h3>
                                    <div className="text-right">
                                        <span className="font-mono text-xs font-bold text-gray-500 block">{item.servingSize}</span>
                                        <span className="font-black text-[10px] text-primary uppercase">{item.quantity} {item.unit}</span>
                                    </div>
                                </div>

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
                            </div>
                        ))}
                    </div>

                    <button
                        onClick={handleLogAll}
                        className="w-full py-5 bg-primary text-white font-black uppercase tracking-widest text-xl border-3 border-secondary shadow-neo hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none transition-all flex items-center justify-center gap-3"
                    >
                        <CheckCircle2 size={28} />
                        Log All Items
                    </button>
                </div>
            )}

            {/* Empty State */}
            {!loading && results.length === 0 && !error && (
                <div className="flex flex-col items-center justify-center py-12 opacity-30 text-center">
                    <Sparkles size={64} className="mb-4" strokeWidth={1.5} />
                    <p className="uppercase font-black tracking-widest">AI Intelligence Ready</p>
                    <p className="text-sm font-bold mt-2">Speak or type your meal to get macros</p>
                </div>
            )}
        </div>
    );
};

export default AILogger;
