import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Check, X, Link as LinkIcon, Save, Share2 } from 'lucide-react';
import { SearchResult, FoodItem } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { foodService } from '../services/foodService';

interface EditorModalProps {
  initialData: SearchResult | FoodItem;
  onSave: (item: Omit<FoodItem, 'timestamp'>) => void;
  onCancel: () => void;
}

const UNITS = ['g', 'ml', 'oz', 'cup', 'serving', 'piece'];

const extractGrams = (str: string): number | null => {
  if (!str) return null;
  const match = str.match(/(\d+(?:\.\d+)?)\s*(g|ml|oz)/i);
  if (!match) return null;
  let val = parseFloat(match[1]);
  const unit = match[2].toLowerCase();
  if (unit === 'oz') val *= 28.35;
  return val;
};

const EditorModal: React.FC<EditorModalProps> = ({ initialData, onSave, onCancel }) => {
  const { user } = useAuth();

  // 1. Identify Data Source
  const isExistingItem = 'id' in initialData;
  const isSavedInDB = (initialData as any).source === 'personal' || (initialData as any).source === 'community';

  // 2. Extract Base Information (The Canonical "Label" Data)
  const baseInfo = useMemo(() => {
    if (!isExistingItem) {
      const res = initialData as SearchResult;
      return {
        macros: res.macros,
        qty: res.quantity || 1,
        unit: res.unit || 'serving',
        weight: res.servingWeight || extractGrams(res.servingSize) || 0,
        servingSize: res.servingSize
      };
    } else {
      const item = initialData as FoodItem;
      return {
        macros: {
          calories: item.calories,
          protein: item.protein,
          fat: item.fat,
          carbs: item.carbs
        },
        qty: item.quantity || 1,
        unit: item.unit || 'serving',
        weight: item.servingWeight || extractGrams(item.servingSize || '') || 0,
        servingSize: item.servingSize || `${item.quantity} ${item.unit}`
      };
    }
  }, [initialData, isExistingItem]);

  // 3. Conversion Math
  const macrosPerGram = useMemo(() => {
    if (baseInfo.weight > 0) {
      return {
        calories: baseInfo.macros.calories / baseInfo.weight,
        protein: baseInfo.macros.protein / baseInfo.weight,
        fat: baseInfo.macros.fat / baseInfo.weight,
        carbs: baseInfo.macros.carbs / baseInfo.weight,
      };
    }
    return null;
  }, [baseInfo]);

  const macrosPerBaseUnit = useMemo(() => {
    return {
      calories: baseInfo.macros.calories / baseInfo.qty,
      protein: baseInfo.macros.protein / baseInfo.qty,
      fat: baseInfo.macros.fat / baseInfo.qty,
      carbs: baseInfo.macros.carbs / baseInfo.qty,
    };
  }, [baseInfo]);

  const getGramsPerUnit = (u: string) => {
    const lowerU = u.toLowerCase();
    if (lowerU === 'g' || lowerU === 'ml') return 1;
    if (lowerU === 'oz') return 28.35;
    if (lowerU === 'serving' && baseInfo.weight > 0) return baseInfo.weight;
    if (lowerU === baseInfo.unit.toLowerCase() && baseInfo.weight > 0) {
      return baseInfo.weight / baseInfo.qty;
    }
    if ((lowerU === 'piece' || lowerU === 'piece') && baseInfo.weight > 0) {
      return baseInfo.weight / baseInfo.qty;
    }
    return null;
  };

  // 4. Component State
  const [unit, setUnit] = useState<string>(baseInfo.unit);
  const [inputQty, setInputQty] = useState<string>(baseInfo.qty.toString());
  const [isPublic, setIsPublic] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [createdFoodId, setCreatedFoodId] = useState<string | null>(null);
  const [editedName, setEditedName] = useState(initialData.name);
  const [editedBrand, setEditedBrand] = useState((initialData as any).brand || '');

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // 5. Calculate Current Macros
  const currentMacros = useMemo(() => {
    const qty = parseFloat(inputQty) || 0;

    // Exact match for base serving avoids rounding errors
    if ((unit.toLowerCase() === baseInfo.unit.toLowerCase() || unit === 'serving') && qty === baseInfo.qty) {
      return baseInfo.macros;
    }
    if (unit === 'serving' && qty === 1) {
      return baseInfo.macros;
    }

    const gPerUnit = getGramsPerUnit(unit);
    if (gPerUnit && macrosPerGram) {
      const totalGrams = qty * gPerUnit;
      return {
        calories: Math.round(macrosPerGram.calories * totalGrams),
        protein: Math.round(macrosPerGram.protein * totalGrams * 10) / 10,
        fat: Math.round(macrosPerGram.fat * totalGrams * 10) / 10,
        carbs: Math.round(macrosPerGram.carbs * totalGrams * 10) / 10,
      };
    }

    return {
      calories: Math.round(macrosPerBaseUnit.calories * qty),
      protein: Math.round(macrosPerBaseUnit.protein * qty * 10) / 10,
      fat: Math.round(macrosPerBaseUnit.fat * qty * 10) / 10,
      carbs: Math.round(macrosPerBaseUnit.carbs * qty * 10) / 10,
    };
  }, [inputQty, unit, baseInfo, macrosPerGram, macrosPerBaseUnit]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  }, [editedName]);

  const handleUnitChange = (newUnit: string) => {
    const qty = parseFloat(inputQty) || 0;
    let newQty = qty;

    const currentGramsPerUnit = getGramsPerUnit(unit);
    const targetGramsPerUnit = getGramsPerUnit(newUnit);

    if (currentGramsPerUnit && targetGramsPerUnit) {
      const converted = (qty * currentGramsPerUnit) / targetGramsPerUnit;
      // Round smartly to handle floating point noise
      newQty = Math.abs(Math.round(converted) - converted) < 0.0001 ? Math.round(converted) : parseFloat(converted.toFixed(2));
    }

    setUnit(newUnit);
    setInputQty(newQty.toString());
  };

  const handleSaveToDB = async () => {
    if (!user) return;
    setIsSaving(true);
    try {
      // THE DESIGN CHOICE: Always save the CANONICAL label data
      const foodToSave = {
        name: editedName,
        brand: editedBrand,
        calories: baseInfo.macros.calories,
        protein: baseInfo.macros.protein,
        fat: baseInfo.macros.fat,
        carbs: baseInfo.macros.carbs,
        servingSize: baseInfo.servingSize,
        quantity: baseInfo.qty,
        unit: baseInfo.unit,
        servingWeight: baseInfo.weight > 0 ? baseInfo.weight : null
      };

      const newItem = await foodService.createFood(foodToSave, user.id, isPublic);
      if (newItem && newItem.id) {
        setCreatedFoodId(newItem.id);
      }
      setSavedSuccess(true);
    } catch (e: any) {
      alert(`Error saving: ${e.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleLog = () => {
    const effectiveId = isExistingItem ? (initialData as FoodItem).id : (createdFoodId || '');
    onSave({
      id: effectiveId,
      name: editedName,
      brand: editedBrand,
      ...currentMacros,
      quantity: parseFloat(inputQty) || 0,
      unit: unit,
      servingSize: baseInfo.servingSize,
      source: isExistingItem ? (initialData as FoodItem).source : 'manual',
      servingWeight: baseInfo.weight
    } as any);
  };

  const getFontSizeClass = (val: number, suffix = '') => {
    // Measure the actual rendered string, not the rounded integer
    const displayStr = val.toString() + suffix;
    const len = displayStr.length;
    if (len >= 7) return 'text-[clamp(0.5rem,1.8vw,0.65rem)]';
    if (len >= 6) return 'text-[clamp(0.55rem,2.2vw,0.75rem)]';
    if (len >= 5) return 'text-[clamp(0.65rem,2.8vw,0.9rem)]';
    if (len >= 4) return 'text-[clamp(0.8rem,3.5vw,1.1rem)]';
    if (len >= 3) return 'text-[clamp(1rem,4.5vw,1.3rem)]';
    return 'text-[clamp(1.1rem,5.5vw,1.5rem)]';
  };

  return (
    <div className="fixed inset-0 bg-secondary/90 z-50 flex items-end sm:items-center justify-center p-4 backdrop-blur-sm shadow-2xl overflow-y-auto">
      <div className="bg-background w-full max-w-md border-3 border-secondary shadow-neo-lg animate-in slide-in-from-bottom-10 fade-in duration-300 my-auto">
        <div className="p-6">
          <div className="flex justify-between items-start mb-6 border-b-3 border-secondary pb-4">
            <div className="w-full mr-4">
              <input
                type="text"
                value={editedBrand}
                onChange={(e) => setEditedBrand(e.target.value)}
                placeholder="Brand (Optional)"
                className="w-full text-xs font-black uppercase tracking-widest text-secondary/40 bg-transparent outline-none mb-1 placeholder:text-secondary/20"
              />
              <textarea
                ref={textareaRef}
                value={editedName}
                onChange={(e) => setEditedName(e.target.value)}
                rows={1}
                className="w-full text-[clamp(1.5rem,7vw,2.25rem)] font-black text-secondary uppercase leading-tight bg-transparent outline-none resize-none overflow-hidden placeholder:text-secondary/30"
                style={{ minHeight: '1.2em' }}
              />
              {baseInfo.servingSize && (
                <div className="mt-2">
                  <p className="text-secondary font-mono text-[10px] font-black bg-highlight inline-block px-2 py-0.5 border-2 border-secondary uppercase mb-1">
                    Standard Serving: {baseInfo.servingSize}
                  </p>

                  {/* DATA SOURCE LINKS - Only for AI Search, not for scans */}
                  {(!isExistingItem && (initialData as SearchResult).source === 'search') && (
                    <div className="flex flex-wrap items-center gap-2 px-1">
                      <span className="text-[9px] font-black uppercase text-secondary/40 whitespace-nowrap">Source:</span>
                      <div className="flex flex-wrap gap-x-2 gap-y-1">
                        {((initialData as SearchResult).sources?.length || 0) > 0 ? (
                          (initialData as SearchResult).sources?.map((source, i) => (
                            <a
                              key={i}
                              href={source.uri}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 text-[9px] font-black uppercase text-blue-600 hover:text-primary transition-colors border-b border-blue-200"
                            >
                              <LinkIcon size={9} />
                              {source.title.length > 20 ? source.title.substring(0, 20) + '...' : source.title}
                            </a>
                          ))
                        ) : (
                          <a
                            href={`https://www.google.com/search?q=${encodeURIComponent(((initialData as any).brand || '') + ' ' + (initialData as any).name + ' nutrition facts')}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-[9px] font-black uppercase text-secondary/60 hover:text-primary transition-colors border-b border-secondary/20"
                          >
                            <LinkIcon size={9} />
                            Verify on Google Search
                          </a>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
            <button onClick={onCancel} className="p-2 border-3 border-secondary hover:bg-secondary hover:text-white transition-colors bg-white shrink-0 shadow-neo-sm active:translate-x-[2px] active:translate-y-[2px] active:shadow-none">
              <X size={24} strokeWidth={3} />
            </button>
          </div>

          <div className="grid grid-cols-4 gap-2 mb-8">
            <div className="text-center p-1 sm:p-2 border-3 border-secondary bg-white shadow-neo-sm flex flex-col justify-center min-h-[70px] sm:min-h-[80px] overflow-hidden">
              <span className={`block font-black text-secondary font-mono leading-none ${getFontSizeClass(currentMacros.calories)}`}>{currentMacros.calories}</span>
              <span className="text-[8px] sm:text-[10px] font-black uppercase bg-secondary text-white px-2 mt-1 self-center">kcal</span>
            </div>
            <div className="text-center p-1 sm:p-2 border-3 border-secondary bg-primary flex flex-col justify-center min-h-[70px] sm:min-h-[80px] overflow-hidden">
              <span className={`block font-black text-white font-mono leading-none ${getFontSizeClass(currentMacros.protein, 'g')}`}>{currentMacros.protein}g</span>
              <span className="text-[8px] sm:text-[10px] font-black uppercase text-white/90 mt-1">Prot</span>
            </div>
            <div className="text-center p-1 sm:p-2 border-3 border-secondary bg-accent flex flex-col justify-center min-h-[70px] sm:min-h-[80px] overflow-hidden">
              <span className={`block font-black text-secondary font-mono leading-none ${getFontSizeClass(currentMacros.carbs, 'g')}`}>{currentMacros.carbs}g</span>
              <span className="text-[8px] sm:text-[10px] font-black uppercase text-secondary/80 mt-1">Carb</span>
            </div>
            <div className="text-center p-1 sm:p-2 border-3 border-secondary bg-highlight flex flex-col justify-center min-h-[70px] sm:min-h-[80px] overflow-hidden">
              <span className={`block font-black text-secondary font-mono leading-none ${getFontSizeClass(currentMacros.fat, 'g')}`}>{currentMacros.fat}g</span>
              <span className="text-[8px] sm:text-[10px] font-black uppercase text-secondary/80 mt-1">Fat</span>
            </div>
          </div>

          <div className="mb-8 p-4 border-3 border-secondary bg-white shadow-neo-sm">
            <div className="flex justify-between items-center mb-6">
              <label className="block text-xs font-black uppercase text-secondary tracking-wider">Quantity</label>
              <select
                value={unit}
                onChange={(e) => handleUnitChange(e.target.value)}
                className="bg-highlight border-2 border-secondary px-2 py-1 text-xs font-black uppercase outline-none focus:bg-white transition-colors"
                style={{ maxWidth: '140px' }}
              >
                {Array.from(new Set([...UNITS, unit, baseInfo.unit])).filter(Boolean).map(u => (
                  <option key={u} value={u} className="uppercase">{u}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-4">
              <button
                onClick={() => setInputQty(prev => (Math.max(0, (parseFloat(prev) || 0) - (unit === 'g' || unit === 'ml' ? 10 : 0.5))).toString())}
                className="w-10 h-16 border-3 border-secondary bg-surface flex items-center justify-center text-3xl font-black text-secondary hover:bg-secondary hover:text-white transition-colors"
              >-</button>
              <div className="flex-1 flex flex-col items-center justify-end h-16">
                <input
                  type="number"
                  value={inputQty}
                  onChange={(e) => setInputQty(e.target.value)}
                  onFocus={(e) => e.target.select()}
                  className="w-full text-center text-5xl font-black text-secondary bg-transparent outline-none font-mono"
                />
                <div className="w-full h-1 bg-secondary mt-1"></div>
              </div>
              <button
                onClick={() => setInputQty(prev => ((parseFloat(prev) || 0) + (unit === 'g' || unit === 'ml' ? 10 : 0.5)).toString())}
                className="w-10 h-16 border-3 border-secondary bg-surface flex items-center justify-center text-3xl font-black text-secondary hover:bg-secondary hover:text-white transition-colors"
              >+</button>
            </div>
          </div>

          {!isSavedInDB && !savedSuccess && (
            <div className="mb-4 p-4 border-3 border-secondary bg-blue-50">
              <div className="flex items-center justify-between mb-3">
                <span className="font-bold text-sm uppercase text-secondary">Save to My Database?</span>
                <button
                  onClick={() => setIsPublic(!isPublic)}
                  className={`flex items-center gap-2 text-xs font-bold uppercase px-2 py-1 border-2 border-secondary transition-colors ${isPublic ? 'bg-green-100' : 'bg-white'}`}
                >
                  <Share2 size={12} className={isPublic ? 'text-green-600' : 'text-gray-400'} />
                  Share
                </button>
              </div>
              <button
                onClick={handleSaveToDB}
                disabled={isSaving}
                className="w-full py-2 bg-white border-2 border-secondary font-black uppercase text-sm hover:bg-secondary hover:text-white transition-colors flex justify-center items-center gap-2 shadow-neo-sm active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
              >
                <Save size={16} />
                {isSaving ? 'Saving...' : 'SAVE TO MY DATABASE'}
              </button>
            </div>
          )}

          {savedSuccess && (
            <div className="mb-4 p-3 bg-green-100 text-green-800 text-center font-bold uppercase border-2 border-green-200">
              Saved to Database!
            </div>
          )}

          <button
            onClick={handleLog}
            className="w-full py-5 bg-secondary text-white font-black uppercase tracking-widest text-xl border-3 border-secondary hover:bg-primary hover:text-white transition-colors flex items-center justify-center gap-3 shadow-neo active:translate-x-[4px] active:translate-y-[4px] active:shadow-none"
          >
            <Check size={28} strokeWidth={4} />
            {isExistingItem ? 'UPDATE LOG' : 'LOG FOOD'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default EditorModal;