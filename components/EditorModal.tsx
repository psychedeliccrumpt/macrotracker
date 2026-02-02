import React, { useState, useEffect } from 'react';
import { Check, X, Link as LinkIcon, Save, Share2 } from 'lucide-react';
import { SearchResult, FoodItem } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { foodService } from '../services/foodService';

interface EditorModalProps {
  initialData: SearchResult | FoodItem;
  onSave: (item: Omit<FoodItem, 'id' | 'timestamp'>) => void;
  onCancel: () => void;
}

const UNITS = ['g', 'ml', 'oz', 'cup', 'serving', 'piece'];

const extractGrams = (str: string): number | null => {
  if (!str) return null;
  // Match patterns like "110g", "110 g", "100ml", "1.5oz"
  const match = str.match(/(\d+(?:\.\d+)?)\s*(g|ml|oz)/i);
  if (!match) return null;
  let val = parseFloat(match[1]);
  const unit = match[2].toLowerCase();
  if (unit === 'oz') val *= 28.35;
  return val;
};

const EditorModal: React.FC<EditorModalProps> = ({ initialData, onSave, onCancel }) => {
  const { user } = useAuth();
  // Normalize initial data
  const isExistingItem = 'id' in initialData;
  const isSavedInDB = (initialData as any).source === 'personal' || (initialData as any).source === 'community';

  // Default values
  const defaultQuantity = isExistingItem ? (initialData as FoodItem).quantity : 1;
  const defaultUnit = isExistingItem ? (initialData as FoodItem).unit : 'serving';

  // Try to detect if it's per 100g from search result string if it's new
  const servingStr = !isExistingItem ? (initialData as SearchResult).servingSize.toLowerCase() : '';
  const isPer100g = !isExistingItem && (servingStr.includes('100g') || servingStr.includes('100ml'));

  // Prioritize explicit quantity/unit from AI analysis if available
  const detectedQty = !isExistingItem ? (initialData as SearchResult).quantity : undefined;
  const detectedUnit = !isExistingItem ? (initialData as SearchResult).unit : undefined;

  const initialQty = isExistingItem ? defaultQuantity : (detectedQty ?? (isPer100g ? 100 : 1));
  const initialUnit = isExistingItem ? defaultUnit : (detectedUnit ?? (isPer100g ? 'g' : 'serving'));

  // We use a string state for the input to handle decimals and leading zeros gracefully
  const [inputQty, setInputQty] = useState<string>(initialQty.toString());
  const [quantity, setQuantity] = useState<number>(initialQty);
  const [unit, setUnit] = useState<string>(initialUnit);
  const [isPublic, setIsPublic] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const [gramsPerServing] = useState(() => {
    // If we have an explicit servingWeight from AI, use it
    if (!isExistingItem && (initialData as SearchResult).servingWeight) {
      return (initialData as SearchResult).servingWeight;
    }
    const servingSize = !isExistingItem
      ? (initialData as SearchResult).servingSize
      : (initialData as FoodItem).servingSize || '';
    return extractGrams(servingSize);
  });

  const [currentMacros, setCurrentMacros] = useState(isExistingItem ? initialData as FoodItem : (initialData as SearchResult).macros);

  // Helper to get gram equivalent of a quantity in a specific unit
  const getGramsPerUnit = (u: string) => {
    if (u === 'g' || u === 'ml') return 1;
    if (u === 'oz') return 28.35;

    // If we have a weight for the serving (gramsPerServing), we can pivot off it
    if (gramsPerServing) {
      if (u === 'serving') return gramsPerServing;

      // If the unit is the "countable" base unit (e.g. "cracker") and we know the count
      const resultUnit = !isExistingItem ? (initialData as SearchResult).unit : (initialData as FoodItem).unit;
      const resultQty = !isExistingItem ? (initialData as SearchResult).quantity : (initialData as FoodItem).quantity;

      if (u === resultUnit && resultQty) {
        // e.g. 30g serving / 11 crackers = 2.72g per cracker
        return gramsPerServing / resultQty;
      }

      // Also handle "piece" as a generic fallback if unit matches
      if (u === 'piece' && resultUnit && resultQty) {
        return gramsPerServing / resultQty;
      }
    }
    return null;
  };

  // Base macros for ONE GRAM (internal reference)
  const [macrosPerGram] = useState(() => {
    let grams = 0;
    if (isPer100g) {
      grams = 100;
    } else if (gramsPerServing) {
      grams = gramsPerServing;
    } else {
      // If no weight available, we can't do gram-based macros reliably
      return null;
    }

    const m = !isExistingItem ? (initialData as SearchResult).macros : (initialData as FoodItem);
    const q = isExistingItem ? (initialData as FoodItem).quantity : (isPer100g ? 100 : 1);

    // If user is editing a gram-based log, use that
    const currentUnit = isExistingItem ? (initialData as FoodItem).unit : initialUnit;
    const initialGrams = getGramsPerUnit(currentUnit) * q;

    if (!initialGrams) return null;

    return {
      calories: m.calories / initialGrams,
      protein: m.protein / initialGrams,
      fat: m.fat / initialGrams,
      carbs: m.carbs / initialGrams,
    };
  });

  // Base macros for ONE UNIT of the CURRENT unit
  const [baseMacros, setBaseMacros] = useState(() => {
    if (isExistingItem) {
      const item = initialData as FoodItem;
      return {
        calories: item.calories / item.quantity,
        protein: item.protein / item.quantity,
        carbs: item.carbs / item.quantity,
        fat: item.fat / item.quantity,
      };
    }
    const res = initialData as SearchResult;
    return {
      calories: res.macros.calories / (isPer100g ? 100 : 1),
      protein: res.macros.protein / (isPer100g ? 100 : 1),
      carbs: res.macros.carbs / (isPer100g ? 100 : 1),
      fat: res.macros.fat / (isPer100g ? 100 : 1),
    };
  });

  // Update baseMacros when unit changes
  useEffect(() => {
    if (macrosPerGram) {
      const gPerUnit = getGramsPerUnit(unit);
      if (gPerUnit) {
        setBaseMacros({
          calories: macrosPerGram.calories * gPerUnit,
          protein: macrosPerGram.protein * gPerUnit,
          fat: macrosPerGram.fat * gPerUnit,
          carbs: macrosPerGram.carbs * gPerUnit,
        });
      }
    }
    // If no macrosPerGram, we keep the original baseMacros (serving-based) 
  }, [unit, macrosPerGram]);

  // Sync string input to numeric quantity for calculations
  useEffect(() => {
    const parsed = parseFloat(inputQty);
    if (!isNaN(parsed)) {
      setQuantity(parsed);
    } else {
      setQuantity(0);
    }
  }, [inputQty]);

  // Update macros when numeric quantity changes
  useEffect(() => {
    setCurrentMacros({
      calories: Math.round(baseMacros.calories * quantity),
      protein: Math.round(baseMacros.protein * quantity * 10) / 10,
      fat: Math.round(baseMacros.fat * quantity * 10) / 10,
      carbs: Math.round(baseMacros.carbs * quantity * 10) / 10,
    });
  }, [quantity, baseMacros]);

  const handleUnitChange = (newUnit: string) => {
    let newQty = quantity;

    // Helper to get gram equivalent of a quantity in a specific unit
    const getGrams = (qty: number, u: string) => {
      const gPerUnit = getGramsPerUnit(u);
      return gPerUnit ? qty * gPerUnit : null;
    };

    const currentGrams = getGrams(quantity, unit);
    const targetGramsPerUnit = getGrams(1, newUnit);

    if (currentGrams !== null && targetGramsPerUnit !== null) {
      newQty = parseFloat((currentGrams / targetGramsPerUnit).toFixed(2));
    } else {
      // Fallback to basic volume conversions if no gramsPerServing found
      if (unit === 'g' && newUnit === 'oz') {
        newQty = parseFloat((quantity / 28.35).toFixed(2));
      } else if (unit === 'oz' && newUnit === 'g') {
        newQty = Math.round(quantity * 28.35);
      } else if (unit === 'ml' && newUnit === 'oz') {
        newQty = parseFloat((quantity / 29.57).toFixed(2));
      } else if (unit === 'oz' && newUnit === 'ml') {
        newQty = Math.round(quantity * 29.57);
      }
    }

    setUnit(newUnit);
    setInputQty(newQty.toString());
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value;

    // Auto-delete leading zero if the number is greater than 0 (e.g. "05" -> "5")
    if (val.length > 1 && val.startsWith('0') && val[1] !== '.') {
      val = val.substring(1);
    }

    setInputQty(val);
  };

  const adjustQuantity = (delta: number) => {
    const newQty = Math.max(0, parseFloat((quantity + delta).toFixed(1)));
    setInputQty(newQty.toString());
  };

  const handleSave = () => {
    onSave({
      name: initialData.name,
      ...currentMacros,
      quantity: quantity,
      unit: unit,
      servingSize: !isExistingItem ? (initialData as SearchResult).servingSize : (initialData as FoodItem).servingSize,
      source: isExistingItem ? (initialData as FoodItem).source : 'manual'
    });
  };

  const handleSaveToDB = async () => {
    if (!user) return;
    setIsSaving(true);
    try {
      // If we have a natural serving size (from gramsPerServing), 
      // we should save macros relative to that to keep "1 serving" meaningful.
      let finalMacros = baseMacros;
      let finalServingSize = unit;

      if (gramsPerServing && macrosPerGram) {
        // We found a weight (e.g. 114g) in the original string.
        // Let's save the macros for THAT weight.
        finalMacros = {
          calories: macrosPerGram.calories * gramsPerServing,
          protein: macrosPerGram.protein * gramsPerServing,
          fat: macrosPerGram.fat * gramsPerServing,
          carbs: macrosPerGram.carbs * gramsPerServing,
        };
        // Use the original descriptive string
        finalServingSize = !isExistingItem ? (initialData as SearchResult).servingSize : unit;
      }

      const foodToSave: any = {
        name: initialData.name,
        calories: finalMacros.calories,
        protein: finalMacros.protein,
        fat: finalMacros.fat,
        carbs: finalMacros.carbs,
        servingSize: finalServingSize
      };

      await foodService.createFood(foodToSave as any, user.id, isPublic);
      setSavedSuccess(true);
    } catch (e: any) {
      console.error(e);
      alert(`Failed to save to database: ${e.message || 'Unknown error'}`);
    } finally {
      setIsSaving(false);
    }
  };

  // Helper for dynamic font size on macro numbers - now with fluid sizing
  const getFontSizeClass = (val: number) => {
    const len = Math.round(val).toString().length;
    // Base size on length, but use fluid clamp to prevent overflow
    if (len >= 6) return 'text-[clamp(0.7rem,3vw,0.9rem)]';
    if (len >= 5) return 'text-[clamp(0.8rem,4vw,1.1rem)]';
    if (len >= 4) return 'text-[clamp(0.9rem,5vw,1.25rem)]';
    return 'text-[clamp(1rem,6vw,1.5rem)]';
  };

  const displayName = initialData.name;
  const displaySource = !isExistingItem && (initialData as SearchResult).sources ? (initialData as SearchResult).sources : [];

  return (
    <div className="fixed inset-0 bg-secondary/90 z-50 flex items-end sm:items-center justify-center p-4 backdrop-blur-sm shadow-2xl">
      <div className="bg-background w-full max-w-md border-3 border-secondary shadow-neo-lg animate-in slide-in-from-bottom-10 fade-in duration-300">
        <div className="p-6">
          <div className="flex justify-between items-start mb-6 border-b-3 border-secondary pb-4">
            <div>
              <h2 className="text-[clamp(1.5rem,7vw,2.25rem)] font-black text-secondary uppercase leading-tight mb-2 break-words">{displayName}</h2>
              {!isExistingItem && (initialData as SearchResult).servingSize && (
                <p className="text-secondary font-mono text-xs font-bold bg-highlight inline-block px-2 py-0.5 border border-secondary">
                  BASE: {(initialData as SearchResult).servingSize}
                </p>
              )}
            </div>
            <button onClick={onCancel} className="p-2 border-3 border-secondary hover:bg-secondary hover:text-white transition-colors bg-white">
              <X size={24} strokeWidth={3} />
            </button>
          </div>

          {displaySource && displaySource.length > 0 && (
            <div className="mb-6">
              <p className="text-xs font-black text-secondary mb-2 uppercase tracking-wider">Source</p>
              <div className="flex flex-wrap gap-2">
                {displaySource.map((src, i) => (
                  <a key={i} href={src!.uri} target="_blank" rel="noreferrer" className="flex items-center text-xs font-bold text-secondary border-2 border-secondary px-2 py-1 hover:bg-highlight hover:underline bg-white">
                    <LinkIcon size={10} className="mr-1" /> {src!.title.length > 20 ? src!.title.substring(0, 20) + '...' : src!.title}
                  </a>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-4 gap-2 mb-8">
            <div className="text-center p-1 sm:p-2 border-3 border-secondary bg-white shadow-neo-sm flex flex-col justify-center min-h-[70px] sm:min-h-[80px]">
              <span className={`block font-black text-secondary font-mono leading-none ${getFontSizeClass(currentMacros.calories)}`}>{currentMacros.calories}</span>
              <span className="text-[8px] sm:text-[10px] font-bold uppercase bg-secondary text-white px-1 mt-1 self-center">kcal</span>
            </div>
            <div className="text-center p-1 sm:p-2 border-3 border-secondary bg-primary flex flex-col justify-center min-h-[70px] sm:min-h-[80px]">
              <span className={`block font-black text-white font-mono leading-none ${getFontSizeClass(currentMacros.protein)}`}>{currentMacros.protein}g</span>
              <span className="text-[8px] sm:text-[10px] font-bold uppercase text-white/90 mt-1">Prot</span>
            </div>
            <div className="text-center p-1 sm:p-2 border-3 border-secondary bg-accent flex flex-col justify-center min-h-[70px] sm:min-h-[80px]">
              <span className={`block font-black text-secondary font-mono leading-none ${getFontSizeClass(currentMacros.carbs)}`}>{currentMacros.carbs}g</span>
              <span className="text-[8px] sm:text-[10px] font-bold uppercase text-secondary/80 mt-1">Carb</span>
            </div>
            <div className="text-center p-1 sm:p-2 border-3 border-secondary bg-highlight flex flex-col justify-center min-h-[70px] sm:min-h-[80px]">
              <span className={`block font-black text-secondary font-mono leading-none ${getFontSizeClass(currentMacros.fat)}`}>{currentMacros.fat}g</span>
              <span className="text-[8px] sm:text-[10px] font-bold uppercase text-secondary/80 mt-1">Fat</span>
            </div>
          </div>

          <div className="mb-8 p-4 border-3 border-secondary bg-white shadow-neo-sm">
            <div className="flex justify-between items-center mb-6">
              <label className="block text-xs font-black uppercase text-secondary tracking-wider">Quantity</label>
              <select
                value={unit}
                onChange={(e) => handleUnitChange(e.target.value)}
                className="bg-highlight border-2 border-secondary px-2 py-1 text-xs font-black uppercase outline-none focus:bg-white transition-colors"
              >
                {/* Dynamic Unit Options */}
                {Array.from(new Set([...UNITS, unit, 'g', 'ml', 'oz', 'cup', 'serving', 'piece'])).map(u => (
                  <option key={u} value={u} className="uppercase">{u}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-4">
              <button
                onClick={() => adjustQuantity(unit === 'g' || unit === 'ml' ? -10 : -0.5)}
                className="w-10 h-16 border-3 border-secondary bg-surface flex items-center justify-center text-3xl font-black text-secondary hover:bg-secondary hover:text-white transition-colors"
              >-</button>

              <div className="flex-1 flex flex-col items-center justify-end h-16">
                <input
                  type="number"
                  value={inputQty}
                  onChange={handleInputChange}
                  onFocus={(e) => e.target.select()} // Auto-select text on click to make replacing 0 easy
                  className="w-full text-center text-5xl font-black text-secondary bg-transparent outline-none font-mono"
                />
                <div className="w-full h-1 bg-secondary mt-1"></div>
              </div>

              <button
                onClick={() => adjustQuantity(unit === 'g' || unit === 'ml' ? 10 : 0.5)}
                className="w-10 h-16 border-3 border-secondary bg-surface flex items-center justify-center text-3xl font-black text-secondary hover:bg-secondary hover:text-white transition-colors"
              >+</button>
            </div>
          </div>

          {/* Save to DB functionality for AI results */}
          {!isSavedInDB && !savedSuccess && (
            <div className="mb-4 p-4 border-3 border-secondary bg-blue-50">
              <div className="flex items-center justify-between mb-3">
                <span className="font-bold text-sm uppercase text-secondary">Save to My Foods?</span>
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
                className="w-full py-2 bg-white border-2 border-secondary font-black uppercase text-sm hover:bg-secondary hover:text-white transition-colors flex justify-center items-center gap-2"
              >
                <Save size={16} />
                {isSaving ? 'Saving...' : 'Save for Future'}
              </button>
            </div>
          )}

          {savedSuccess && (
            <div className="mb-4 p-3 bg-green-100 text-green-800 text-center font-bold uppercase border-2 border-green-200">
              Saved to Database!
            </div>
          )}

          <button
            onClick={handleSave}
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