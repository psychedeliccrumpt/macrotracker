import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Target, TrendingDown, TrendingUp, AlertTriangle, Calculator, Calendar } from 'lucide-react';
import { userService } from '../services/userService';
import { UserProfile } from '../types';

const GoalCalculator: React.FC = () => {
    const { user, profile, setProfile } = useAuth();

    // Local state for inputs (default to profile values)
    const [currentWeight, setCurrentWeight] = useState<string>('');
    const [goalWeight, setGoalWeight] = useState<string>('');
    const [targetDate, setTargetDate] = useState<string>('');

    // Result state
    const [results, setResults] = useState<{
        dailyCalories: number;
        weeklyChange: number;
        daysToGoal: number;
        isSafe: boolean;
        warnings: string[];
        requiredDeficit: number;
    } | null>(null);

    const [isSaving, setIsSaving] = useState(false);

    // Initialize from profile on mount
    useEffect(() => {
        if (profile) {
            if (profile.weight) setCurrentWeight(profile.weight.toString());
            if (profile.goalWeight) setGoalWeight(profile.goalWeight.toString());
            if (profile.goalDate) {
                const d = new Date(profile.goalDate);
                // Format YYYY-MM-DD for input
                setTargetDate(d.toISOString().split('T')[0]);
            }
        }
    }, [profile]);

    const calculate = () => {
        if (!profile?.tdee || !currentWeight || !goalWeight || !targetDate) return;

        const cw = parseFloat(currentWeight);
        const gw = parseFloat(goalWeight);
        const tdee = profile.tdee;

        // 1. Determine Weight Difference
        const weightDiff = gw - cw; // Negative = Loss, Positive = Gain

        // 2. Determine Timeline
        const now = new Date();
        const target = new Date(targetDate);
        // Reset times to midnight for fair day diff
        now.setHours(0, 0, 0, 0);
        target.setHours(0, 0, 0, 0);

        const days = Math.round((target.getTime() - now.getTime()) / (1000 * 3600 * 24));

        if (days <= 0) {
            alert("Target date must be in the future!");
            return;
        }

        // 3. Calculate Required Deficit/Surplus
        // 1 kg approx 7700 kcal (widely accepted avg)
        const totalCaloriesDiff = weightDiff * 7700;
        const dailyDiff = totalCaloriesDiff / days;

        const recommendedCalories = Math.round(tdee + dailyDiff);

        // Weekly change in kg
        const weeklyChange = (dailyDiff * 7) / 7700;

        // Safety Checks
        const warnings: string[] = [];
        let isSafe = true;

        // Check 1: Too low calories
        const minCalories = (profile.gender === 'male') ? 1500 : 1200;
        if (recommendedCalories < minCalories) {
            warnings.push(`Recommended ${recommendedCalories} kcal is dangerously low (Min: ${minCalories}).`);
            isSafe = false;
        }

        // Check 2: Too aggressive loss (>1kg/week)
        if (weeklyChange < -1.0) {
            warnings.push(`Losing ${Math.abs(weeklyChange).toFixed(1)}kg/week is aggressive. Recommended max is 1kg/week.`);
        }

        // Check 3: Too aggressive gain (>0.5kg/week typically fat)
        if (weeklyChange > 0.5) {
            warnings.push(`Gaining ${weeklyChange.toFixed(1)}kg/week might limit muscle gain ratio.`);
        }

        setResults({
            dailyCalories: recommendedCalories,
            weeklyChange,
            daysToGoal: days,
            isSafe,
            warnings,
            requiredDeficit: Math.round(dailyDiff)
        });
    };

    const saveGoal = async () => {
        if (!user || !profile || !results) return;
        setIsSaving(true);
        try {
            const updates: Partial<UserProfile> = {
                weight: parseFloat(currentWeight),
                goalWeight: parseFloat(goalWeight),
                goalDate: new Date(targetDate).toISOString(),
                // If it's a new goal (start date empty or goal changed significantly), set start date
                // For simplicity, we create specific logic if needed, but here we just save the goal target
            };

            // Optimistic update
            setProfile({ ...profile, ...updates });

            await userService.updateProfile(user.id, updates);
            alert("Goal saved!");
        } catch (e) {
            console.error(e);
            alert("Failed to save goal (Database offline?). Calculated values are still valid.");
        } finally {
            setIsSaving(false);
        }
    };

    if (!profile?.tdee) {
        return (
            <div className="p-6 bg-highlight border-3 border-secondary text-center">
                <AlertTriangle className="mx-auto mb-2 text-secondary" size={32} />
                <h3 className="font-black text-secondary uppercase">TDEE Missing</h3>
                <p className="text-secondary mb-4">Calculate your TDEE in the Profile settings first to use this calculator.</p>
            </div>
        );
    }

    return (
        <div className="bg-white border-3 border-secondary p-6 shadow-neo">
            <div className="flex items-center gap-3 mb-6 pb-4 border-b-3 border-secondary">
                <Target size={32} className="text-primary" strokeWidth={2.5} />
                <div>
                    <h2 className="text-2xl font-black uppercase text-secondary leading-none">Smart Goal</h2>
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">Trajectory Calculator</p>
                </div>
            </div>

            <div className="space-y-4 mb-6">
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-black uppercase text-secondary mb-1">Current Weight (kg)</label>
                        <input
                            type="number"
                            value={currentWeight}
                            onChange={e => setCurrentWeight(e.target.value)}
                            className="w-full p-2 border-3 border-secondary font-black text-lg bg-surface outline-none focus:bg-white transition-colors"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-black uppercase text-secondary mb-1">Goal Weight (kg)</label>
                        <input
                            type="number"
                            value={goalWeight}
                            onChange={e => setGoalWeight(e.target.value)}
                            className="w-full p-2 border-3 border-secondary font-black text-lg bg-surface outline-none focus:bg-white transition-colors"
                        />
                    </div>
                </div>

                <div>
                    <label className="block text-xs font-black uppercase text-secondary mb-1">Target Date</label>
                    <input
                        type="date"
                        value={targetDate}
                        onChange={e => setTargetDate(e.target.value)}
                        className="w-full p-2 border-3 border-secondary font-black text-lg bg-surface outline-none focus:bg-white transition-colors uppercase"
                    />
                </div>

                <button
                    onClick={calculate}
                    className="w-full py-3 bg-secondary text-white font-black uppercase tracking-widest hover:bg-primary transition-colors flex items-center justify-center gap-2 border-3 border-secondary shadow-neo-sm active:translate-y-[2px] active:translate-x-[2px] active:shadow-none"
                >
                    <Calculator size={20} />
                    Calculatate Path
                </button>
            </div>

            {results && (
                <div className="animate-in slide-in-from-bottom-5 fade-in duration-300">
                    <div className={`p-4 border-3 border-secondary mb-4 relative overflow-hidden ${results.isSafe ? 'bg-green-50' : 'bg-red-50'}`}>
                        {/* Status Icon Background */}
                        <div className="absolute -right-4 -top-4 opacity-10 rotate-12">
                            {results.weeklyChange < 0 ? <TrendingDown size={120} /> : <TrendingUp size={120} />}
                        </div>

                        <div className="relative z-10 text-center">
                            <p className="text-xs font-black uppercase text-gray-500 tracking-widest mb-1">Recommended Daily</p>
                            <h3 className="text-5xl font-black text-secondary mb-2 leading-none flex items-baseline justify-center gap-2">
                                {results.dailyCalories}
                                <span className="text-sm">kcal</span>
                            </h3>

                            <div className="inline-block px-3 py-1 bg-white border-2 border-secondary font-bold text-xs uppercase mb-4 shadow-sm">
                                {results.weeklyChange < 0 ? 'Losing' : 'Gaining'} {Math.abs(results.weeklyChange).toFixed(2)} kg / week
                            </div>

                            {results.warnings.length > 0 && (
                                <div className="text-left bg-white/80 p-3 border-2 border-red-200 text-red-800 text-xs font-bold uppercase space-y-1">
                                    <div className="flex items-center gap-2 mb-1 text-red-600 border-b border-red-200 pb-1">
                                        <AlertTriangle size={14} />
                                        <span>Advisory</span>
                                    </div>
                                    {results.warnings.map((w, i) => (
                                        <p key={i}>• {w}</p>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    <button
                        onClick={saveGoal}
                        disabled={isSaving}
                        className="w-full py-3 bg-white border-3 border-secondary font-black uppercase tracking-widest hover:bg-highlight transition-colors flex items-center justify-center gap-2 shadow-neo-sm"
                    >
                        <SaveIcon size={20} />
                        {isSaving ? 'Saving...' : 'Set as Goal'}
                    </button>

                    <p className="text-[10px] text-center mt-2 text-gray-400 font-bold uppercase">
                        Based on TDEE: {Math.round(profile.tdee)} kcal
                    </p>
                </div>
            )}
        </div>
    );
};

const SaveIcon = ({ size }: { size: number }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
        <polyline points="17 21 17 13 7 13 7 21"></polyline>
        <polyline points="7 3 7 8 15 8"></polyline>
    </svg>
);

export default GoalCalculator;
