import React, { useState, useEffect } from 'react';
import { UserProfile, Macros } from '../types';
import { Save, Calculator as CalcIcon, RefreshCw } from 'lucide-react';

interface CalculatorProps {
  currentProfile: UserProfile;
  onSaveProfile: (profile: UserProfile) => void;
}

const Calculator: React.FC<CalculatorProps> = ({ currentProfile, onSaveProfile }) => {
  // Stats for Calculation
  const [formData, setFormData] = useState<Omit<UserProfile, 'targets'>>({
    gender: currentProfile.gender,
    age: currentProfile.age,
    weight: currentProfile.weight,
    height: currentProfile.height,
    activity: currentProfile.activity
  });

  // Editable Targets
  const [targets, setTargets] = useState<Macros>(currentProfile.targets);
  
  // Feedback state
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (saved) {
      const timer = setTimeout(() => setSaved(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [saved]);

  const calculateTDEE = () => {
    // Mifflin-St Jeor Equation
    let bmr = 10 * formData.weight + 6.25 * formData.height - 5 * formData.age;
    if (formData.gender === 'male') {
      bmr += 5;
    } else {
      bmr -= 161;
    }

    const tdee = Math.round(bmr * formData.activity);

    // Standard Macro Split (30% P / 35% C / 35% F roughly)
    const p = Math.round((tdee * 0.3) / 4);
    const f = Math.round((tdee * 0.35) / 9);
    const c = Math.round((tdee * 0.35) / 4);

    setTargets({
      calories: tdee,
      protein: p,
      fat: f,
      carbs: c
    });
    
    // Scroll to targets
    const targetElement = document.getElementById('target-section');
    if (targetElement) targetElement.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSave = () => {
    onSaveProfile({
      ...formData,
      targets: targets
    });
    setSaved(true);
  };

  // Helper to calculate percentages
  const totalCalFromMacros = (targets.protein * 4) + (targets.carbs * 4) + (targets.fat * 9);
  const pPct = totalCalFromMacros ? Math.round((targets.protein * 4 / totalCalFromMacros) * 100) : 0;
  const cPct = totalCalFromMacros ? Math.round((targets.carbs * 4 / totalCalFromMacros) * 100) : 0;
  const fPct = totalCalFromMacros ? Math.round((targets.fat * 9 / totalCalFromMacros) * 100) : 0;

  return (
    <div className="h-full flex flex-col bg-background">
      <div className="p-6 bg-surface border-b-3 border-secondary shadow-neo z-10">
        <h1 className="text-4xl font-black uppercase tracking-tighter text-secondary">Settings</h1>
        <div className="w-16 h-3 bg-highlight mt-2 border-2 border-secondary"></div>
      </div>

      <div className="flex-1 overflow-y-auto pb-24 p-6">
        
        {/* Stats Section */}
        <div className="mb-8">
           <h2 className="text-xl font-black uppercase text-secondary mb-4 flex items-center gap-2">
             <CalcIcon size={24} /> Stats Calculator
           </h2>
           <div className="p-4 bg-white border-3 border-secondary shadow-neo-sm">
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="col-span-2">
                  <label className="block text-xs font-black uppercase mb-1 tracking-wider text-secondary">Gender</label>
                  <div className="flex border-3 border-secondary">
                    <button 
                      onClick={() => setFormData({...formData, gender: 'male'})}
                      className={`flex-1 py-2 font-black uppercase transition-colors border-r-2 border-secondary ${formData.gender === 'male' ? 'bg-secondary text-white' : 'bg-surface text-secondary hover:bg-gray-100'}`}
                    >Male</button>
                    <button 
                       onClick={() => setFormData({...formData, gender: 'female'})}
                       className={`flex-1 py-2 font-black uppercase transition-colors ${formData.gender === 'female' ? 'bg-secondary text-white' : 'bg-surface text-secondary hover:bg-gray-100'}`}
                    >Female</button>
                  </div>
                </div>

                <div>
                   <label className="block text-xs font-black uppercase mb-1 tracking-wider text-secondary">Age</label>
                   <input 
                     type="number" 
                     value={formData.age} 
                     onChange={(e) => setFormData({...formData, age: Number(e.target.value)})}
                     className="w-full p-2 border-3 border-secondary font-mono font-bold text-lg outline-none focus:bg-accent focus:text-white transition-colors"
                   />
                </div>
                <div>
                   <label className="block text-xs font-black uppercase mb-1 tracking-wider text-secondary">Weight (kg)</label>
                   <input 
                     type="number" 
                     value={formData.weight} 
                     onChange={(e) => setFormData({...formData, weight: Number(e.target.value)})}
                     className="w-full p-2 border-3 border-secondary font-mono font-bold text-lg outline-none focus:bg-accent focus:text-white transition-colors"
                   />
                </div>
                <div>
                   <label className="block text-xs font-black uppercase mb-1 tracking-wider text-secondary">Height (cm)</label>
                   <input 
                     type="number" 
                     value={formData.height} 
                     onChange={(e) => setFormData({...formData, height: Number(e.target.value)})}
                     className="w-full p-2 border-3 border-secondary font-mono font-bold text-lg outline-none focus:bg-accent focus:text-white transition-colors"
                   />
                </div>
                <div>
                  <label className="block text-xs font-black uppercase mb-1 tracking-wider text-secondary">Activity</label>
                  <select 
                    value={formData.activity}
                    onChange={(e) => setFormData({...formData, activity: Number(e.target.value)})}
                    className="w-full p-2 border-3 border-secondary font-bold font-mono text-sm outline-none bg-surface"
                  >
                    <option value={1.2}>Sedentary</option>
                    <option value={1.375}>Light Active</option>
                    <option value={1.55}>Mod. Active</option>
                    <option value={1.725}>Very Active</option>
                    <option value={1.9}>Athlete</option>
                  </select>
                </div>
              </div>
              <button 
                onClick={calculateTDEE}
                className="w-full py-3 bg-secondary text-white font-black uppercase tracking-widest border-3 border-secondary hover:bg-primary transition-colors flex items-center justify-center gap-2"
              >
                <RefreshCw size={18} /> Auto-Calculate
              </button>
           </div>
        </div>

        {/* Editable Targets Section */}
        <div id="target-section" className="mb-8">
           <h2 className="text-xl font-black uppercase text-secondary mb-4 flex items-center gap-2">
             <span className="w-6 h-6 bg-accent border-2 border-secondary flex items-center justify-center text-xs">!</span>
             Daily Goals
           </h2>
           
           <div className="bg-white border-3 border-secondary p-4 shadow-neo">
              
              {/* Calories Input */}
              <div className="mb-6">
                 <label className="block text-xs font-black uppercase mb-2 tracking-wider text-secondary">Daily Calories</label>
                 <div className="relative">
                   <input 
                     type="number" 
                     value={targets.calories}
                     onChange={(e) => setTargets({...targets, calories: Number(e.target.value)})}
                     className="w-full p-4 border-3 border-secondary text-4xl font-black font-mono text-center outline-none focus:bg-highlight transition-colors"
                   />
                   <span className="absolute right-4 top-1/2 -translate-y-1/2 font-bold uppercase text-secondary text-xs bg-white px-1 border border-secondary">kcal</span>
                 </div>
              </div>

              {/* Macros Inputs */}
              <div className="grid grid-cols-3 gap-3 mb-2">
                 {/* Protein */}
                 <div>
                    <label className="block text-[10px] font-black uppercase mb-1 text-primary">Protein (g)</label>
                    <input 
                      type="number"
                      value={targets.protein}
                      onChange={(e) => setTargets({...targets, protein: Number(e.target.value)})}
                      className="w-full p-2 border-3 border-secondary text-xl font-black font-mono text-center outline-none focus:bg-primary focus:text-white transition-colors"
                    />
                    <div className="text-[10px] font-mono font-bold text-center mt-1 text-gray-500">{pPct}%</div>
                 </div>

                 {/* Carbs */}
                 <div>
                    <label className="block text-[10px] font-black uppercase mb-1 text-accent">Carbs (g)</label>
                    <input 
                      type="number"
                      value={targets.carbs}
                      onChange={(e) => setTargets({...targets, carbs: Number(e.target.value)})}
                      className="w-full p-2 border-3 border-secondary text-xl font-black font-mono text-center outline-none focus:bg-accent focus:text-secondary transition-colors"
                    />
                    <div className="text-[10px] font-mono font-bold text-center mt-1 text-gray-500">{cPct}%</div>
                 </div>

                 {/* Fat */}
                 <div>
                    <label className="block text-[10px] font-black uppercase mb-1 text-highlight">Fat (g)</label>
                    <input 
                      type="number"
                      value={targets.fat}
                      onChange={(e) => setTargets({...targets, fat: Number(e.target.value)})}
                      className="w-full p-2 border-3 border-secondary text-xl font-black font-mono text-center outline-none focus:bg-highlight focus:text-secondary transition-colors"
                    />
                    <div className="text-[10px] font-mono font-bold text-center mt-1 text-gray-500">{fPct}%</div>
                 </div>
              </div>
              
              <div className="text-center mb-6">
                 {Math.abs(totalCalFromMacros - targets.calories) > 50 && (
                   <p className="text-[10px] font-bold text-accent uppercase bg-accent/10 py-1 px-2 inline-block border border-accent">
                     Warning: Macro sum ({Math.round(totalCalFromMacros)}) ≠ Calories ({targets.calories})
                   </p>
                 )}
              </div>

              <button 
                onClick={handleSave}
                className={`w-full py-4 font-black uppercase text-xl border-3 border-secondary shadow-neo active:translate-x-[4px] active:translate-y-[4px] active:shadow-none transition-all flex items-center justify-center gap-3 ${saved ? 'bg-green-500 text-white' : 'bg-primary text-white hover:bg-violet-600'}`}
              >
                <Save size={24} strokeWidth={3} />
                {saved ? 'Saved!' : 'Save Targets'}
              </button>
           </div>
        </div>

      </div>
    </div>
  );
};

export default Calculator;
