import React, { useState, useEffect } from 'react';
import { UserProfile, Macros, GoalLog } from '../types';
import { Save, Calculator as CalcIcon, RefreshCw, Target, TrendingDown, TrendingUp, ChevronRight, ChevronLeft, History, AlertTriangle, CheckCircle2, Calendar, Trash2, Activity } from 'lucide-react';
import { userService } from '../services/userService';

interface CalculatorProps {
  currentProfile: UserProfile;
  onSaveProfile: (profile: UserProfile) => void;
}

type Step = 'objective' | 'stats' | 'tdee' | 'method' | 'timeline' | 'pace' | 'result';

const Calculator: React.FC<CalculatorProps> = ({ currentProfile, onSaveProfile }) => {
  const [step, setStep] = useState<Step>('objective');
  const [planningMethod, setPlanningMethod] = useState<'timeline' | 'calorie'>('timeline');
  const [tdeeSource, setTdeeSource] = useState<'formula' | 'dynamic'>(currentProfile.tdeeSource || (currentProfile.dynamicTDEE ? 'dynamic' : 'formula'));
  const [paceKcal, setPaceKcal] = useState<string>('500');

  // 1. Objective State
  const [goalType, setGoalType] = useState<'lose' | 'gain' | 'maintain'>(currentProfile.goalType || 'maintain');

  // 2. Stats State
  const [formData, setFormData] = useState({
    gender: currentProfile.gender || 'male',
    age: currentProfile.age || 25,
    weight: currentProfile.weight || 70,
    height: currentProfile.height || 175,
    activity: currentProfile.activity || 1.375
  });

  // 3. Timeline State
  const [goalWeight, setGoalWeight] = useState<string>(currentProfile.goalWeight?.toString() || '');
  const [targetDate, setTargetDate] = useState<string>(() => {
    if (currentProfile.goalDate) {
      return new Date(currentProfile.goalDate).toISOString().split('T')[0];
    }
    return '';
  });

  // 4. Recommendation & Targets
  const [targets, setTargets] = useState<Macros>(currentProfile.targets || {
    calories: 2000,
    protein: 150,
    carbs: 200,
    fat: 65
  });

  const [history, setHistory] = useState<GoalLog[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    loadHistory();
    loadLocalGoal();
  }, []);

  const loadLocalGoal = () => {
    const local = localStorage.getItem(`goal_path_${currentProfile.id}`);
    if (local) {
      try {
        const data = JSON.parse(local);
        if (data.goalType) setGoalType(data.goalType);
        if (data.goalWeight) setGoalWeight(data.goalWeight.toString());
        if (data.goalDate) setTargetDate(data.goalDate.split('T')[0]);
      } catch (e) {
        console.error("Failed to load local goal", e);
      }
    }

    // Backfill baseline for pre-existing goals
    if (isGoalActive && !currentProfile.tdeeAtGoalStart && currentProfile.targets?.calories) {
      const calculatedCurrent = calculateTDEE(formData.weight);
      onSaveProfile({
        ...currentProfile,
        tdeeAtGoalStart: calculatedCurrent,
        updatedAt: new Date().toISOString()
      } as UserProfile);
    }

    const offlineProfile = localStorage.getItem(`offline_profile_${currentProfile.id}`);
    if (offlineProfile) {
      try {
        const data = JSON.parse(offlineProfile);
        setFormData(prev => ({ ...prev, ...data }));
        if (data.targets) setTargets(data.targets);
        if (data.tdeeSource) setTdeeSource(data.tdeeSource);
      } catch (e) {
        console.error("Failed to load offline profile", e);
      }
    }
  };

  const loadHistory = async () => {
    setLoadingHistory(true);
    try {
      const data = await userService.getGoalHistory(currentProfile.id);
      setHistory(data);
    } catch (e) {
      console.warn("Goal history table not found, skipping fetch.");
    } finally {
      setLoadingHistory(false);
    }
  };

  const calculateTDEE = (weight: number) => {
    if (tdeeSource === 'dynamic' && currentProfile.dynamicTDEE) {
      return currentProfile.dynamicTDEE;
    }
    let bmr = 10 * weight + 6.25 * formData.height - 5 * formData.age;
    bmr = (formData.gender === 'male') ? bmr + 5 : bmr - 161;
    return Math.round(bmr * formData.activity);
  };

  const applyRecommendation = () => {
    const tdee = calculateTDEE(formData.weight);
    let recommendedCals = tdee;

    if (goalType !== 'maintain' && goalWeight) {
      const gw = parseFloat(goalWeight);
      const cw = formData.weight;
      const tdeeDetail = calculateTDEE(formData.weight);

      if (planningMethod === 'timeline' && targetDate) {
        const target = new Date(targetDate);
        const now = new Date();
        now.setHours(0, 0, 0, 0);
        target.setHours(0, 0, 0, 0);

        const days = Math.round((target.getTime() - now.getTime()) / (1000 * 3600 * 24));
        if (days > 0) {
          const weightDiff = gw - cw;
          const totalCalsDiff = weightDiff * 7700;
          const dailyDiff = totalCalsDiff / days;
          recommendedCals = Math.round(tdeeDetail + dailyDiff);
        }
      } else if (planningMethod === 'calorie') {
        const pace = parseFloat(paceKcal);
        const dailyDiff = (goalType === 'lose') ? -Math.abs(pace) : Math.abs(pace);
        recommendedCals = Math.round(tdeeDetail + dailyDiff);

        // Calculate estimated date for UI info
        const weightDiff = gw - cw;
        const totalCalsDiff = weightDiff * 7700;
        const daysRequired = Math.abs(totalCalsDiff / dailyDiff);
        const estDate = new Date();
        estDate.setDate(estDate.getDate() + Math.round(daysRequired));
        setTargetDate(estDate.toISOString().split('T')[0]);
      }
    } else if (goalType === 'lose') {
      recommendedCals = tdee - 500;
    } else if (goalType === 'gain') {
      recommendedCals = tdee + 300;
    }

    // Default macro split
    const p = Math.round((recommendedCals * 0.3) / 4);
    const f = Math.round((recommendedCals * 0.3) / 9);
    const c = Math.round((recommendedCals * 0.4) / 4);

    setTargets({
      calories: recommendedCals,
      protein: p,
      fat: f,
      carbs: c
    });
    setStep('result');
  };

  const isGoalActive = !!currentProfile.goalType ||
    (localStorage.getItem(`goal_path_${currentProfile.id}`) !== null) ||
    history.some(g => g.status === 'active');

  const activeGoalLog = history.find(g => g.status === 'active');
  const displayGoal = {
    type: currentProfile.goalType || activeGoalLog?.type || goalType,
    weight: currentProfile.goalWeight || activeGoalLog?.goalWeight || parseFloat(goalWeight) || 0,
    date: currentProfile.goalDate || activeGoalLog?.targetDate || targetDate
  };

  const tdeeDrift = currentProfile.dynamicTDEE && currentProfile.tdeeAtGoalStart
    ? Math.round(currentProfile.dynamicTDEE - currentProfile.tdeeAtGoalStart)
    : 0;

  const showAdjustment = Math.abs(tdeeDrift) >= 50 && isGoalActive;

  const handleApplySmartTDEE = async () => {
    if (!currentProfile.dynamicTDEE || !window.confirm(`Your Smart TDEE has ${tdeeDrift > 0 ? 'increased' : 'decreased'} by ${Math.abs(tdeeDrift)} kcal. Would you like to adjust your daily targets accordingly?`)) return;

    const newTdee = currentProfile.dynamicTDEE;
    const currentCals = currentProfile.targets?.calories || targets.calories;
    const newCals = Math.round(currentCals + tdeeDrift);

    const ratio = newCals / currentCals;
    const newTargets = {
      calories: newCals,
      protein: Math.round((currentProfile.targets?.protein || targets.protein) * ratio),
      fat: Math.round((currentProfile.targets?.fat || targets.fat) * ratio),
      carbs: Math.round((currentProfile.targets?.carbs || targets.carbs) * ratio),
    };

    setTargets(newTargets);

    try {
      await onSaveProfile({
        ...currentProfile,
        targets: newTargets,
        tdeeAtGoalStart: newTdee,
        updatedAt: new Date().toISOString()
      } as UserProfile);
    } catch (e) {
      console.error("Failed to save smart adjustment", e);
    }
  };

  const handleResetGoal = async (status: 'completed' | 'abandoned' | 'deleted') => {
    const isDelete = status === 'deleted';
    const confirmMsg = isDelete
      ? "Delete current goal completely?"
      : `Are you sure you want to ${status === 'completed' ? 'finish' : 'stop'} this goal?`;

    if (!window.confirm(confirmMsg)) return;

    // 1. Log to history/cleanup active logs
    if (activeGoalLog) {
      try {
        if (!isDelete) {
          await userService.createGoalLog(currentProfile.id, {
            type: displayGoal.type,
            startWeight: currentProfile.startWeight || formData.weight,
            goalWeight: displayGoal.weight,
            targetDate: new Date(displayGoal.date).toISOString(),
            status: status
          });
        }
        // Always remove the "active" record when resetting
        await userService.deleteGoalLog(activeGoalLog.id);
      } catch (e) {
        console.warn("Could not update history on end.");
      }
    }

    // 2. Clear Profile fields
    const clearedProfile: Partial<UserProfile> = {
      goalType: undefined,
      goalWeight: undefined,
      goalDate: undefined,
      startWeight: undefined,
      startDate: undefined,
      updatedAt: new Date().toISOString()
    };

    try {
      await onSaveProfile({ ...currentProfile, ...clearedProfile } as UserProfile);
    } catch (e) {
      console.warn("DB Clear failed, clearing local only.");
    }

    // 3. Clear Local Storage
    localStorage.removeItem(`goal_path_${currentProfile.id}`);
    localStorage.removeItem(`offline_profile_${currentProfile.id}`);

    // 4. Reset Local State
    setGoalType('maintain');
    setGoalWeight('');
    setTargetDate('');
    setStep('objective');
    loadHistory();
  };

  const handleDeleteHistory = async (id: string) => {
    if (window.confirm("Are you sure you want to delete this history record?")) {
      try {
        await userService.deleteGoalLog(id);
        loadHistory();
      } catch (e) {
        console.error("Failed to delete history record", e);
      }
    }
  };

  const handleSave = async () => {
    // 1. Core Profile Updates (Fields that existed before the schema change)
    const coreUpdates: Partial<UserProfile> = {
      ...formData,
      targets,
      tdeeSource,
      updatedAt: new Date().toISOString()
    };

    // 2. New Goal Fields (May not exist in DB yet)
    const goalMetadata = {
      goalType,
      goalWeight: goalType !== 'maintain' ? parseFloat(goalWeight) : undefined,
      goalDate: goalType !== 'maintain' ? new Date(targetDate).toISOString() : undefined,
      tdeeAtGoalStart: calculateTDEE(formData.weight)
    };

    try {
      // Try saving everything first
      await onSaveProfile({ ...currentProfile, ...coreUpdates, ...goalMetadata } as UserProfile);
    } catch (e) {
      console.warn("Full profile save failed. Retrying core fields only.");
      try {
        // Fallback: Save only core targets to DB
        await onSaveProfile({ ...currentProfile, ...coreUpdates } as UserProfile);
        // Save goal metadata locally
        localStorage.setItem(`goal_path_${currentProfile.id}`, JSON.stringify(goalMetadata));
      } catch (err) {
        console.warn("Total DB save failure. Saving all data to Offline Cache.");
        // Emergency Fallback: Save EVERYTHING locally so the app keeps working
        localStorage.setItem(`goal_path_${currentProfile.id}`, JSON.stringify(goalMetadata));
        localStorage.setItem(`offline_profile_${currentProfile.id}`, JSON.stringify(coreUpdates));

        // We don't return here anymore, we let the user "see" their success locally
      }
    }

    // 3. Try to log history (non-critical)
    try {
      await userService.createGoalLog(currentProfile.id, {
        type: goalType,
        startWeight: formData.weight,
        goalWeight: goalType !== 'maintain' ? parseFloat(goalWeight) : formData.weight,
        targetDate: goalType !== 'maintain' ? new Date(targetDate).toISOString() : new Date().toISOString(),
        status: 'active'
      });
      loadHistory();
    } catch (e) {
      console.warn("Could not save to history table (Schema not updated).");
    }

    setSaved(true);
    setTimeout(() => {
      setSaved(false);
      setStep('objective');
    }, 1500);
  };

  const getPct = (val: number, isFat?: boolean) => {
    const total = (targets.protein * 4) + (targets.carbs * 4) + (targets.fat * 9);
    if (!total) return 0;
    return Math.round((val * (isFat ? 9 : 4) / total) * 100);
  };

  return (
    <div className="h-full flex flex-col bg-background overflow-y-auto pb-24">
      {/* Step Header */}
      <div className="p-6 bg-surface border-b-3 border-secondary shadow-neo sticky top-0 z-20">
        <div className="flex justify-between items-center mb-2">
          <h1 className="text-3xl font-black uppercase tracking-tighter text-secondary">Set Your Goal</h1>
          <div className="flex gap-1">
            {(['objective', 'stats', 'method', 'timeline', 'pace', 'result'] as Step[])
              .filter(s => {
                if (goalType === 'maintain' && (s === 'method' || s === 'timeline' || s === 'pace')) return false;
                if (planningMethod === 'timeline' && s === 'pace') return false;
                if (planningMethod === 'calorie' && s === 'timeline') return false;
                return true;
              })
              .map((s, i) => (
                <div key={s} className={`w-3 h-3 border-2 border-secondary ${step === s ? 'bg-primary' : (['objective', 'stats', 'method', 'timeline', 'pace', 'result'] as Step[]).indexOf(step) > (['objective', 'stats', 'method', 'timeline', 'pace', 'result'] as Step[]).indexOf(s) ? 'bg-secondary' : 'bg-white'}`}></div>
              ))}
          </div>
        </div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-secondary/60">Step Planning</p>
      </div>

      <div className="p-6">
        {/* Smart Adjustment Banner */}
        {showAdjustment && step === 'objective' && (
          <div className="mb-6 animate-in slide-in-from-top-4 duration-500">
            <div className="bg-primary text-secondary p-4 border-3 border-secondary shadow-neo relative overflow-hidden group">
              <div className="absolute top-[-10px] right-[-10px] opacity-10 group-hover:rotate-12 transition-transform">
                <Activity size={80} />
              </div>
              <div className="relative z-10 flex items-center justify-between">
                <div className="flex-1 pr-4">
                  <h4 className="text-sm font-black uppercase tracking-widest mb-1 flex items-center gap-2">
                    <CalcIcon size={16} /> Smart Recalculation
                  </h4>
                  <p className="text-[10px] font-bold uppercase leading-tight opacity-80">
                    Your metabolism has shifted by <span className="underline">{Math.abs(tdeeDrift)} kcal</span>.
                    Update your targets to stay on track?
                  </p>
                </div>
                <button
                  onClick={handleApplySmartTDEE}
                  className="bg-white border-2 border-secondary px-4 py-2 text-xs font-black uppercase shadow-neo-sm active:translate-y-[2px] active:shadow-none transition-all"
                >
                  Sync Now
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Active Goal Dashboard - Fixed Overview */}
        {isGoalActive && step === 'objective' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-top-4 duration-500">
            {/* Header / Management Card */}
            <div className="p-4 border-3 border-secondary bg-white shadow-neo">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-xs font-black uppercase text-secondary/40 tracking-widest">Active Journey</h3>
                  <p className="text-2xl font-black text-secondary uppercase leading-none mt-1">
                    {displayGoal.type} to {displayGoal.weight}kg
                  </p>
                  {displayGoal.date && (
                    <p className="text-[10px] font-bold text-primary mt-1 uppercase">
                      Target: {new Date(displayGoal.date).toLocaleDateString()}
                    </p>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleResetGoal('completed')}
                    className="p-2 border-2 border-secondary bg-green-400 text-white hover:bg-green-500 transition-all shadow-neo-sm"
                    title="Mark as Completed"
                  >
                    <CheckCircle2 size={18} />
                  </button>
                  <button
                    onClick={() => handleResetGoal('abandoned')}
                    className="p-2 border-2 border-secondary bg-orange-400 text-white hover:bg-orange-500 transition-all shadow-neo-sm"
                    title="Abandon Goal"
                  >
                    <AlertTriangle size={18} />
                  </button>
                  <button
                    onClick={() => handleResetGoal('deleted')}
                    className="p-2 border-2 border-secondary bg-red-400 text-white hover:bg-red-500 transition-all shadow-neo-sm"
                    title="Delete Goal"
                  >
                    <CalcIcon size={18} className="rotate-45" />
                  </button>
                </div>
              </div>
              <div className="pt-4 border-t-2 border-secondary border-dashed">
                <p className="text-[10px] font-bold text-secondary/40 uppercase italic leading-tight">
                  Successfully reaching your targets? Mark it as complete to save the achievement to your history.
                </p>
              </div>
            </div>

            {/* Daily Intake Overview Card */}
            <div className="text-center p-6 bg-highlight border-3 border-secondary shadow-neo relative overflow-hidden">
              <div className="absolute -right-4 -top-4 opacity-10 rotate-12">
                <Target size={80} className="text-secondary" />
              </div>
              <h2 className="text-xs font-bold uppercase tracking-widest text-secondary/60 mb-2">Current Daily Budget</h2>
              <div className="flex items-baseline justify-center gap-2">
                <span className="text-7xl font-black text-secondary">{currentProfile.targets?.calories || targets.calories}</span>
                <span className="text-xl font-black uppercase text-secondary">kcal</span>
              </div>

              <div className="mt-4 flex flex-col gap-1">
                <p className="font-bold uppercase text-[10px] tracking-wider text-secondary/40">
                  Your TDEE: <span className="text-secondary">{calculateTDEE(currentProfile.weight || formData.weight)} kcal</span>
                </p>
                <p className="font-black uppercase text-xs">
                  {((currentProfile.targets?.calories || targets.calories) < calculateTDEE(currentProfile.weight || formData.weight)) ? (
                    <span className="text-primary italic">-{calculateTDEE(currentProfile.weight || formData.weight) - (currentProfile.targets?.calories || targets.calories)} Deficit</span>
                  ) : ((currentProfile.targets?.calories || targets.calories) > calculateTDEE(currentProfile.weight || formData.weight)) ? (
                    <span className="text-accent italic">+{(currentProfile.targets?.calories || targets.calories) - calculateTDEE(currentProfile.weight || formData.weight)} Surplus</span>
                  ) : (
                    <span className="text-secondary">Maintenance</span>
                  )}
                </p>
              </div>
            </div>

            {/* Macro Breakdown Summary */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-white border-2 border-secondary p-3 shadow-neo-sm text-center">
                <span className="text-[8px] font-black uppercase text-primary block mb-1">Protein</span>
                <span className="text-xl font-black text-secondary">{currentProfile.targets?.protein || targets.protein}g</span>
              </div>
              <div className="bg-white border-2 border-secondary p-3 shadow-neo-sm text-center">
                <span className="text-[8px] font-black uppercase text-accent block mb-1">Carbs</span>
                <span className="text-xl font-black text-secondary">{currentProfile.targets?.carbs || targets.carbs}g</span>
              </div>
              <div className="bg-white border-2 border-secondary p-3 shadow-neo-sm text-center">
                <span className="text-[8px] font-black uppercase text-highlight block mb-1">Fat</span>
                <span className="text-xl font-black text-secondary">{currentProfile.targets?.fat || targets.fat}g</span>
              </div>
            </div>

            <div className="pt-4 flex flex-col items-center">
              <button
                onClick={() => setStep('stats')}
                className="text-[10px] font-black uppercase text-secondary/40 hover:text-secondary underline underline-offset-4 tracking-widest transition-colors"
              >
                Adjust Profile or Re-Calculate Goal
              </button>
            </div>
          </div>
        )}

        {step === 'objective' && !isGoalActive && (
          <div className="space-y-4 animate-in slide-in-from-right-5 fade-in duration-300">
            <h2 className="text-xl font-black uppercase text-secondary mb-6">What is your objective?</h2>
            <button
              onClick={() => { setGoalType('lose'); setStep('stats'); }}
              className={`w-full p-6 border-3 border-secondary flex items-center justify-between group transition-all ${goalType === 'lose' ? 'bg-primary text-white' : 'bg-white text-secondary hover:bg-highlight'}`}
            >
              <div className="flex items-center gap-4">
                <TrendingDown size={32} />
                <div className="text-left">
                  <span className="block font-black uppercase text-xl">Weight Loss</span>
                  <span className="text-xs font-bold opacity-70">Burn more than you eat</span>
                </div>
              </div>
              <ChevronRight className="group-hover:translate-x-1 transition-transform" />
            </button>
            <button
              onClick={() => { setGoalType('maintain'); setStep('stats'); }}
              className={`w-full p-6 border-3 border-secondary flex items-center justify-between group transition-all ${goalType === 'maintain' ? 'bg-highlight text-secondary' : 'bg-white text-secondary hover:bg-highlight'}`}
            >
              <div className="flex items-center gap-4">
                <RefreshCw size={32} />
                <div className="text-left">
                  <span className="block font-black uppercase text-xl">Maintain</span>
                  <span className="text-xs font-bold opacity-70">Find your balance</span>
                </div>
              </div>
              <ChevronRight className="group-hover:translate-x-1 transition-transform" />
            </button>
            <button
              onClick={() => { setGoalType('gain'); setStep('stats'); }}
              className={`w-full p-6 border-3 border-secondary flex items-center justify-between group transition-all ${goalType === 'gain' ? 'bg-accent text-secondary' : 'bg-white text-secondary hover:bg-highlight'}`}
            >
              <div className="flex items-center gap-4">
                <TrendingUp size={32} />
                <div className="text-left">
                  <span className="block font-black uppercase text-xl">Muscle Gain</span>
                  <span className="text-xs font-bold opacity-70">Support growth & strength</span>
                </div>
              </div>
              <ChevronRight className="group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        )}

        {step === 'stats' && (
          <div className="space-y-6 animate-in slide-in-from-right-5 fade-in duration-300">
            <h2 className="text-xl font-black uppercase text-secondary">Tell us about you</h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-xs font-black uppercase mb-1">Gender</label>
                <div className="flex border-3 border-secondary">
                  <button onClick={() => setFormData({ ...formData, gender: 'male' })} className={`flex-1 py-2 font-black uppercase ${formData.gender === 'male' ? 'bg-secondary text-white' : 'bg-white'}`}>Male</button>
                  <button onClick={() => setFormData({ ...formData, gender: 'female' })} className={`flex-1 py-2 font-black uppercase ${formData.gender === 'female' ? 'bg-secondary text-white' : 'bg-white'}`}>Female</button>
                </div>
              </div>
              <div>
                <label className="block text-xs font-black uppercase mb-1">Age</label>
                <input type="number" value={formData.age} onChange={e => setFormData({ ...formData, age: Number(e.target.value) })} className="w-full p-2 border-3 border-secondary font-black text-lg outline-none focus:bg-highlight" />
              </div>
              <div>
                <label className="block text-xs font-black uppercase mb-1">Current Weight (kg)</label>
                <input type="number" value={formData.weight} onChange={e => setFormData({ ...formData, weight: Number(e.target.value) })} className="w-full p-2 border-3 border-secondary font-black text-lg outline-none focus:bg-highlight" />
              </div>
              <div>
                <label className="block text-xs font-black uppercase mb-1">Height (cm)</label>
                <input type="number" value={formData.height} onChange={e => setFormData({ ...formData, height: Number(e.target.value) })} className="w-full p-2 border-3 border-secondary font-black text-lg outline-none focus:bg-highlight" />
              </div>
              <div>
                <label className="block text-xs font-black uppercase mb-1">Activity Level</label>
                <select value={formData.activity} onChange={e => setFormData({ ...formData, activity: Number(e.target.value) })} className="w-full p-2 border-3 border-secondary font-bold text-sm bg-white outline-none">
                  <option value={1.2}>Sedentary</option>
                  <option value={1.375}>Lightly Active</option>
                  <option value={1.55}>Moderately Active</option>
                  <option value={1.725}>Very Active</option>
                  <option value={1.9}>Extra Active</option>
                </select>
              </div>
            </div>
            <div className="flex gap-3 pt-4">
              <button onClick={() => setStep('objective')} className="flex-1 py-4 border-3 border-secondary font-black uppercase hover:bg-gray-100"><ChevronLeft className="inline mr-1" /> Back</button>
              <button
                onClick={() => {
                  if (currentProfile.dynamicTDEE) setStep('tdee');
                  else goalType === 'maintain' ? applyRecommendation() : setStep('method');
                }}
                className="flex-[2] py-4 bg-secondary text-white font-black uppercase hover:bg-primary shadow-neo-sm"
              >
                Continue <ChevronRight className="inline ml-1" />
              </button>
            </div>

            {!currentProfile.dynamicTDEE && (
              <div className="mt-6 p-4 bg-highlight/20 border-2 border-dashed border-secondary/20 flex gap-3 items-center">
                <Activity size={20} className="text-secondary/40 shrink-0" />
                <p className="text-[10px] font-bold text-secondary/60 leading-tight uppercase">
                  <span className="text-secondary font-black">Note:</span> Smart Dynamic TDEE is currently locked. <span className="text-secondary">Log 3 days of weight/food</span> to unlock personalized metabolism tracking!
                </p>
              </div>
            )}
          </div>
        )}

        {/* TDEE Source Selection Step (Only if dynamic exists) */}
        {step === 'tdee' && (
          <div className="space-y-6 animate-in slide-in-from-right-5 fade-in duration-300 pointer-events-auto">
            <h2 className="text-xl font-black uppercase text-secondary">Base Metabolism</h2>
            <div className="space-y-3">
              <button
                onClick={() => setTdeeSource('formula')}
                className={`w-full p-4 border-3 border-secondary text-left group transition-all ${tdeeSource === 'formula' ? 'bg-secondary text-white shadow-neo-sm' : 'bg-white text-secondary hover:bg-highlight'}`}
              >
                <div className="flex justify-between items-center">
                  <span className="font-black uppercase">Formula (Mifflin-St Jeor)</span>
                  <span className="text-sm font-black italic">{calculateTDEE(formData.weight)} kcal</span>
                </div>
                <p className="text-[10px] font-bold opacity-60 mt-1 uppercase">Standard mathematical estimation</p>
              </button>

              <button
                onClick={() => setTdeeSource('dynamic')}
                className={`w-full p-4 border-3 border-secondary text-left group transition-all ${tdeeSource === 'dynamic' ? 'bg-primary text-white shadow-neo-sm' : 'bg-white text-secondary hover:bg-highlight'}`}
              >
                <div className="flex justify-between items-center">
                  <span className="font-black uppercase">Smart Dynamic TDEE</span>
                  <span className="text-sm font-black italic">{currentProfile.dynamicTDEE} kcal</span>
                </div>
                <p className="text-[10px] font-bold opacity-60 mt-1 uppercase tracking-widest text-highlight">Calculated from your weight/food trends</p>
              </button>
            </div>
            <div className="flex gap-3 pt-4">
              <button onClick={() => setStep('stats')} className="flex-1 py-4 border-3 border-secondary font-black uppercase hover:bg-gray-100">Back</button>
              <button onClick={() => goalType === 'maintain' ? applyRecommendation() : setStep('method')} className="flex-[2] py-4 bg-secondary text-white font-black uppercase hover:bg-primary shadow-neo-sm">Confirm Source</button>
            </div>
          </div>
        )}

        {step === 'method' && (
          <div className="space-y-6 animate-in slide-in-from-right-5 fade-in duration-300">
            <h2 className="text-xl font-black uppercase text-secondary">Choose your path</h2>
            <div className="space-y-4">
              <button
                onClick={() => { setPlanningMethod('timeline'); setStep('timeline'); }}
                className="w-full p-4 border-3 border-secondary bg-white text-secondary flex items-center justify-between hover:bg-highlight group transition-all"
              >
                <div className="flex items-center gap-3">
                  <Calendar size={24} />
                  <div className="text-left">
                    <span className="block font-black uppercase">By Target Date</span>
                    <span className="text-[10px] font-bold opacity-60 uppercase">I want to reach my goal by a specific day</span>
                  </div>
                </div>
                <ChevronRight className="group-hover:translate-x-1" />
              </button>
              <button
                onClick={() => { setPlanningMethod('calorie'); setStep('pace'); }}
                className="w-full p-4 border-3 border-secondary bg-white text-secondary flex items-center justify-between hover:bg-highlight group transition-all"
              >
                <div className="flex items-center gap-3">
                  <RefreshCw size={24} />
                  <div className="text-left">
                    <span className="block font-black uppercase">By Calorie Pace</span>
                    <span className="text-[10px] font-bold opacity-60 uppercase">I want to set a specific daily calorie offset</span>
                  </div>
                </div>
                <ChevronRight className="group-hover:translate-x-1" />
              </button>
            </div>
            <button onClick={() => setStep('stats')} className="w-full py-4 border-3 border-secondary font-black uppercase hover:bg-gray-100"><ChevronLeft className="inline mr-1" /> Back to Stats</button>
          </div>
        )}

        {step === 'pace' && (
          <div className="space-y-6 animate-in slide-in-from-right-5 fade-in duration-300">
            <h2 className="text-xl font-black uppercase text-secondary">Set your pace</h2>
            <div className="space-y-4 p-4 border-3 border-secondary bg-white shadow-neo-sm">
              <div>
                <label className="block text-xs font-black uppercase mb-1">Goal Weight (kg)</label>
                <input type="number" value={goalWeight} onChange={e => setGoalWeight(e.target.value)} placeholder="e.g. 65" className="w-full p-3 border-3 border-secondary font-black text-2xl outline-none focus:bg-highlight" />
              </div>
              <div>
                <label className="block text-xs font-black uppercase mb-1">Daily {goalType === 'lose' ? 'Deficit' : 'Surplus'} (kcal)</label>
                <div className="relative">
                  <input type="number" value={paceKcal} onChange={e => setPaceKcal(e.target.value)} className="w-full p-3 border-3 border-secondary font-black text-2xl outline-none focus:bg-highlight" />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-black uppercase opacity-40">kcal</span>
                </div>
              </div>
            </div>
            <div className="flex gap-3 pt-4">
              <button onClick={() => setStep('method')} className="flex-1 py-4 border-3 border-secondary font-black uppercase hover:bg-gray-100"><ChevronLeft className="inline mr-1" /> Back</button>
              <button onClick={applyRecommendation} className="flex-[2] py-4 bg-secondary text-white font-black uppercase hover:bg-primary shadow-neo-sm">Calculate Path <ChevronRight className="inline ml-1" /></button>
            </div>
          </div>
        )}

        {step === 'timeline' && (
          <div className="space-y-6 animate-in slide-in-from-right-5 fade-in duration-300">
            <h2 className="text-xl font-black uppercase text-secondary">Set your destination</h2>
            <div className="space-y-4 p-4 border-3 border-secondary bg-white shadow-neo-sm">
              <div>
                <label className="block text-xs font-black uppercase mb-1">Goal Weight (kg)</label>
                <input type="number" value={goalWeight} onChange={e => setGoalWeight(e.target.value)} placeholder="e.g. 65" className="w-full p-3 border-3 border-secondary font-black text-2xl outline-none focus:bg-highlight" />
              </div>
              <div>
                <label className="block text-xs font-black uppercase mb-1">By Target Date</label>
                <input type="date" value={targetDate} onChange={e => setTargetDate(e.target.value)} className="w-full p-3 border-3 border-secondary font-black text-xl outline-none focus:bg-highlight" />
              </div>
            </div>
            <div className="flex gap-3 pt-4">
              <button onClick={() => setStep('stats')} className="flex-1 py-4 border-3 border-secondary font-black uppercase hover:bg-gray-100"><ChevronLeft className="inline mr-1" /> Back</button>
              <button onClick={applyRecommendation} className="flex-[2] py-4 bg-secondary text-white font-black uppercase hover:bg-primary shadow-neo-sm">Finalize Path <ChevronRight className="inline ml-1" /></button>
            </div>
          </div>
        )}

        {step === 'result' && (
          <div className="space-y-8 animate-in zoom-in-95 duration-300">
            <div className="text-center p-6 bg-highlight border-3 border-secondary shadow-neo relative overflow-hidden">
              <CheckCircle2 size={80} className="absolute -right-4 -top-4 opacity-10 rotate-12" />
              <h2 className="text-xs font-bold uppercase tracking-widest text-secondary/60 mb-2">Recommended Daily Intake</h2>
              <div className="flex items-baseline justify-center gap-2">
                <span className="text-7xl font-black text-secondary">{targets.calories}</span>
                <span className="text-xl font-black uppercase">kcal</span>
              </div>

              <div className="mt-4 flex flex-col gap-1">
                <p className="font-bold uppercase text-[10px] tracking-wider text-secondary/40">
                  Your TDEE: <span className="text-secondary">{calculateTDEE(formData.weight)} kcal</span>
                </p>
                <p className="font-black uppercase text-xs">
                  {targets.calories < calculateTDEE(formData.weight) ? (
                    <span className="text-primary italic">-{calculateTDEE(formData.weight) - targets.calories} Deficit</span>
                  ) : targets.calories > calculateTDEE(formData.weight) ? (
                    <span className="text-accent italic">+{targets.calories - calculateTDEE(formData.weight)} Surplus</span>
                  ) : (
                    <span className="text-highlight">Maintenance</span>
                  )}
                </p>
                <p className="mt-2 font-bold uppercase text-[10px] text-secondary/60">Based on your {goalType} objective</p>

                {planningMethod === 'calorie' && targetDate && (
                  <div className="mt-4 pt-4 border-t-2 border-secondary/10">
                    <p className="text-[10px] font-black uppercase text-secondary/40 tracking-widest">Estimated Goal Achievement</p>
                    <p className="text-xl font-black text-secondary uppercase">
                      {new Date(targetDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Macro Adjustment Card */}
            <div className="bg-white border-3 border-secondary p-4 shadow-neo">
              <div className="flex justify-between items-center mb-4 border-b-2 border-secondary pb-1">
                <h3 className="text-sm font-black uppercase text-secondary tracking-wider">Manual Adjustment</h3>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black uppercase text-secondary/40">Total:</span>
                  <span className={`text-sm font-black ${(targets.protein * 4 + targets.carbs * 4 + targets.fat * 9) !== targets.calories ? 'text-accent animate-pulse' : 'text-secondary'}`}>
                    {Math.round(targets.protein * 4 + targets.carbs * 4 + targets.fat * 9)} kcal
                  </span>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="text-center">
                  <label className="block text-[8px] font-black uppercase mb-1 text-primary">Protein</label>
                  <input type="number" value={targets.protein} onChange={e => setTargets({ ...targets, protein: Number(e.target.value) })} className="w-full p-2 border-3 border-secondary font-black text-center outline-none focus:bg-primary focus:text-white" />
                  <span className="text-[10px] font-bold text-gray-400">{getPct(targets.protein)}%</span>
                </div>
                <div className="text-center">
                  <label className="block text-[8px] font-black uppercase mb-1 text-accent">Carbs</label>
                  <input type="number" value={targets.carbs} onChange={e => setTargets({ ...targets, carbs: Number(e.target.value) })} className="w-full p-2 border-3 border-secondary font-black text-center outline-none focus:bg-accent" />
                  <span className="text-[10px] font-bold text-gray-400">{getPct(targets.carbs)}%</span>
                </div>
                <div className="text-center">
                  <label className="block text-[8px] font-black uppercase mb-1 text-highlight">Fat</label>
                  <input type="number" value={targets.fat} onChange={e => setTargets({ ...targets, fat: Number(e.target.value) })} className="w-full p-2 border-3 border-secondary font-black text-center outline-none focus:bg-highlight" />
                  <span className="text-[10px] font-bold text-gray-400">{getPct(targets.fat, true)}%</span>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setStep(goalType === 'maintain' ? 'stats' : planningMethod === 'timeline' ? 'timeline' : 'pace')}
                className="flex-1 py-4 border-3 border-secondary font-black uppercase hover:bg-gray-100"
              >
                Adjust Path
              </button>
              <button onClick={handleSave} className={`flex-[2] py-4 text-white font-black uppercase shadow-neo-sm flex items-center justify-center gap-2 ${saved ? 'bg-green-500' : 'bg-primary hover:bg-violet-600'}`}>
                {saved ? <CheckCircle2 size={24} /> : <Save size={24} />}
                {saved ? 'Saved!' : 'Accept Plan'}
              </button>
            </div>
          </div>
        )}

        {/* Goal History Section */}
        <div className="mt-12 pt-8 border-t-3 border-secondary border-dashed">
          <h2 className="text-xl font-black uppercase text-secondary mb-4 flex items-center gap-2 text-secondary/40">
            <History size={20} /> Goal History
          </h2>

          {loadingHistory ? (
            <div className="animate-pulse space-y-3">
              <div className="h-16 bg-gray-100 border-2 border-secondary/10"></div>
              <div className="h-16 bg-gray-100 border-2 border-secondary/10"></div>
            </div>
          ) : history.length > 0 ? (
            <div className="space-y-3">
              {history.map((log) => (
                <div key={log.id} className="p-3 border-2 border-secondary/20 bg-white flex justify-between items-center group hover:border-secondary transition-colors">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-black uppercase px-1.5 py-0.5 border border-secondary ${log.type === 'lose' ? 'bg-primary text-white' : log.type === 'gain' ? 'bg-accent' : 'bg-highlight'}`}>
                        {log.type}
                      </span>
                      <span className="text-xs font-bold text-secondary">{new Date(log.createdAt).toLocaleDateString()}</span>
                    </div>
                    <p className="text-xs font-black text-secondary/60 mt-1 uppercase">
                      {log.startWeight}kg → {log.goalWeight}kg
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <span className="text-[10px] font-bold uppercase text-gray-400 block group-hover:text-secondary">Status</span>
                      <span className="text-xs font-black uppercase text-secondary">{log.status}</span>
                    </div>
                    <button
                      onClick={() => handleDeleteHistory(log.id)}
                      className="p-2 text-secondary/20 hover:text-accent transition-colors"
                      title="Delete History"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 opacity-20 italic font-bold uppercase text-xs">No previous goals found</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Calculator;
