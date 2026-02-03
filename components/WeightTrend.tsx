import React from 'react';
import { WeightLog, FoodItem, UserProfile } from '../types';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts';
import { TrendingUp, Activity } from 'lucide-react';

interface WeightTrendProps {
  weightLogs: WeightLog[];
  foodLogs: FoodItem[];
  currentProfile?: UserProfile;
  onUpdateProfile?: (profile: UserProfile) => void;
}

const WeightTrend: React.FC<WeightTrendProps> = ({ weightLogs, foodLogs, currentProfile, onUpdateProfile }) => {
  // 1. Group all dates and aggregate calories
  const aggregatedData: { [key: string]: { date: string, weight?: number, calories: number, timestamp: number } } = {};

  // Helper to get a stable local day key and label
  const getDayInfo = (timestamp: number) => {
    const d = new Date(timestamp);
    const dayKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const dateLabel = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    const dayStart = new Date(timestamp).setHours(0, 0, 0, 0);
    return { dayKey, dateLabel, dayStart };
  };

  // Process food logs first
  foodLogs.forEach(log => {
    const { dayKey, dateLabel, dayStart } = getDayInfo(log.timestamp);
    if (!aggregatedData[dayKey]) {
      aggregatedData[dayKey] = { date: dateLabel, calories: 0, timestamp: dayStart };
    }
    aggregatedData[dayKey].calories += log.calories;
  });

  // Process weight logs - For each day, keep the one created LATEST
  const weightByDay: { [key: string]: WeightLog } = {};
  weightLogs.forEach(log => {
    const { dayKey } = getDayInfo(log.timestamp);
    const existing = weightByDay[dayKey];

    // If we have two logs for the same day, pick the more recently created one
    if (!existing || (log.createdAt && (!existing.createdAt || log.createdAt > existing.createdAt))) {
      weightByDay[dayKey] = log;
    }
  });

  // Apply winners to aggregation
  Object.entries(weightByDay).forEach(([dayKey, log]) => {
    const { dateLabel, dayStart } = getDayInfo(log.timestamp);
    if (!aggregatedData[dayKey]) {
      aggregatedData[dayKey] = { date: dateLabel, calories: 0, timestamp: dayStart };
    }
    aggregatedData[dayKey].weight = Number(log.weight); // Ensure it's a number for charts
  });

  // Convert to sorted array
  const chartData = Object.values(aggregatedData).sort((a, b) => a.timestamp - b.timestamp);

  const sortedWeightLogs = [...weightLogs].sort((a, b) => {
    if (a.timestamp !== b.timestamp) return a.timestamp - b.timestamp;
    if (a.createdAt && b.createdAt) return a.createdAt.localeCompare(b.createdAt);
    return 0;
  });
  const currentWeight = sortedWeightLogs.length > 0 ? sortedWeightLogs[sortedWeightLogs.length - 1].weight : 0;
  const startWeight = sortedWeightLogs.length > 0 ? sortedWeightLogs[0].weight : 0;
  const weightDiff = currentWeight - startWeight;

  // 4. Dynamic TDEE Calculation (Rolling 14-day window, excluding today)
  const todayStart = new Date().setHours(0, 0, 0, 0);
  const twoWeeksAgo = todayStart - (14 * 1000 * 60 * 60 * 24);
  const oneWeekAgo = todayStart - (7 * 1000 * 60 * 60 * 24);

  // Filter for completed days in the last 14 days
  const validWindowData = chartData.filter(d =>
    d.timestamp >= twoWeeksAgo &&
    d.timestamp < todayStart
  );

  const dataWithWeight = validWindowData.filter(d => d.weight !== undefined);
  let dynamicTDEE = null;
  let tdeeBreakdown = null;

  if (dataWithWeight.length >= 2) {
    const startEntry = dataWithWeight[0];
    const endEntry = dataWithWeight[dataWithWeight.length - 1];

    // Period in days between the first and last weight log in the window
    const days = Math.max(1, (endEntry.timestamp - startEntry.timestamp) / (1000 * 60 * 60 * 24));

    if (days >= 3) {
      const totalWeightChange = endEntry.weight! - startEntry.weight!;

      // Calculate average calories based ONLY on days that actually have calorie data
      const daysWithCalories = validWindowData.filter(d => d.calories > 0);
      const avgCaloriesInWindow = daysWithCalories.length > 0
        ? daysWithCalories.reduce((acc, curr) => acc + curr.calories, 0) / daysWithCalories.length
        : 0;

      // 1kg of fat ~ 7700 kcal
      const calorieDeltaFromWeight = (totalWeightChange * 7700) / days;

      if (avgCaloriesInWindow > 0) {
        dynamicTDEE = Math.round(avgCaloriesInWindow - calorieDeltaFromWeight);

        tdeeBreakdown = {
          days: Math.round(days),
          weightChange: totalWeightChange.toFixed(1),
          avgIntake: Math.round(avgCaloriesInWindow),
          adjustment: Math.round(Math.abs(calorieDeltaFromWeight)),
          samples: daysWithCalories.length
        };
      }
    }
  }

  // Auto-sync dynamic TDEE to profile if it changes significantly
  React.useEffect(() => {
    if (dynamicTDEE && currentProfile && onUpdateProfile) {
      if (currentProfile.dynamicTDEE !== dynamicTDEE) {
        onUpdateProfile({ ...currentProfile, dynamicTDEE });
      }
    }
  }, [dynamicTDEE]);

  return (
    <div className="h-full flex flex-col bg-background">
      <div className="p-6 bg-surface border-b-3 border-secondary shadow-neo">
        <h1 className="text-4xl font-black uppercase tracking-tighter text-secondary">Trends</h1>
        <div className="w-16 h-3 bg-primary mt-2 border-2 border-secondary"></div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 pb-24">
        {chartData.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 border-3 border-dashed border-gray-300 bg-white">
            <TrendingUp size={48} className="text-gray-300 mb-4" />
            <p className="text-gray-400 font-bold uppercase">No Data Yet</p>
            <p className="text-gray-400 text-xs mt-2">Log your food and weight to see trends</p>
          </div>
        ) : (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-2 gap-4 mb-8">
              <div className="bg-white border-3 border-secondary p-4 shadow-neo flex flex-col justify-between">
                <p className="text-[10px] font-black uppercase text-secondary tracking-widest mb-1 underline decoration-primary">Live Weight</p>
                <div className="flex items-end justify-between">
                  <p className="text-3xl font-black font-mono text-secondary">{currentWeight}<span className="text-xs ml-1">kg</span></p>
                  <span className={`text-sm font-black font-mono ${weightDiff > 0 ? 'text-accent' : 'text-primary'}`}>
                    {weightDiff > 0 ? '↑' : '↓'}{Math.abs(weightDiff).toFixed(1)}
                  </span>
                </div>
              </div>
              <div className="bg-white border-3 border-secondary p-4 shadow-neo flex flex-col justify-between">
                <p className="text-[10px] font-black uppercase text-secondary tracking-widest mb-1 underline decoration-highlight">Avg Calories <span className="text-[8px] opacity-40">(7D)</span></p>
                <div className="flex items-end justify-between">
                  <p className="text-3xl font-black font-mono text-secondary">
                    {(() => {
                      const last7Days = chartData.filter(d => d.timestamp >= oneWeekAgo && d.timestamp < todayStart && d.calories > 0);
                      return last7Days.length > 0
                        ? Math.round(last7Days.reduce((acc, curr) => acc + curr.calories, 0) / last7Days.length)
                        : 0;
                    })()}
                  </p>
                  <Activity size={18} className="text-highlight mb-1" strokeWidth={3} />
                </div>
              </div>
            </div>

            {/* Chart Container */}
            <div className="bg-white border-3 border-secondary p-4 shadow-neo h-80 relative">
              <div className="flex items-center gap-2 absolute top-4 left-4 z-10">
                <h3 className="text-[10px] font-black uppercase text-white bg-secondary px-2 border border-secondary">Correlation View</h3>
              </div>

              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 30, right: 0, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 9, fontFamily: 'monospace', fontWeight: 'bold' }}
                    axisLine={false}
                    tickLine={false}
                    dy={10}
                  />
                  {/* Weight Axis */}
                  <YAxis
                    yAxisId="left"
                    orientation="left"
                    tick={{ fontSize: 9, fontFamily: 'monospace', fontWeight: 'bold', fill: '#8B5CF6' }}
                    axisLine={false}
                    tickLine={false}
                    domain={['dataMin - 0.2', 'dataMax + 0.2']}
                    tickFormatter={(val) => Number(val).toFixed(2).replace(/\.00$/, '')}
                  />
                  {/* Calories Axis */}
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    domain={[0, 'auto']}
                    hide={true} // Keep it hidden but functional for scaling
                  />

                  <Tooltip
                    contentStyle={{
                      border: '3px solid #18181B',
                      borderRadius: '0px',
                      boxShadow: '4px 4px 0px #18181B',
                      fontFamily: 'monospace',
                      fontSize: '12px',
                      fontWeight: 'bold'
                    }}
                    formatter={(value: any, name: string) => {
                      if (name === "Weight (kg)") return [typeof value === 'number' ? value.toFixed(1) : value, name];
                      if (name === "Calories") return [Math.round(value), name];
                      return [value, name];
                    }}
                  />

                  <Legend
                    verticalAlign="top"
                    align="right"
                    iconType="rect"
                    wrapperStyle={{
                      paddingBottom: '20px',
                      fontSize: '9px',
                      fontFamily: 'monospace',
                      fontWeight: '900',
                      textTransform: 'uppercase'
                    }}
                  />

                  {/* Weight Line */}
                  <Line
                    yAxisId="left"
                    name="Weight (kg)"
                    type="monotone"
                    dataKey="weight"
                    stroke="#8B5CF6"
                    strokeWidth={4}
                    dot={{ fill: '#18181B', strokeWidth: 0, r: 4 }}
                    activeDot={{ r: 6, fill: '#FB7185', stroke: '#18181B', strokeWidth: 2 }}
                  />

                  {/* Calorie Line */}
                  <Line
                    yAxisId="right"
                    name="Calories"
                    type="stepAfter"
                    dataKey="calories"
                    stroke="#FFEE58"
                    strokeWidth={3}
                    strokeDasharray="5 5"
                    dot={false}
                    activeDot={{ r: 5, fill: '#18181B' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="mt-4 p-4 bg-highlight/10 border-2 border-dashed border-secondary/20 rounded-sm">
              <p className="text-[10px] font-bold text-secondary/60 leading-tight">
                <span className="font-black text-secondary">PRO TIP:</span> Compare your yellow line (intake) with your purple line (weight) to see how your body reacts to different calorie levels over time.
              </p>
            </div>

            {/* Dynamic TDEE Estimation Card */}
            <div className="mt-8 mb-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
              <div className="bg-white border-3 border-secondary p-4 shadow-neo">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-primary border-2 border-secondary shadow-neo-sm">
                    <Activity className="text-white" size={24} />
                  </div>
                  <div>
                    <h3 className="text-[10px] font-black uppercase text-secondary/40 tracking-widest leading-none">Smart Analysis</h3>
                    <p className="text-xl font-black text-secondary uppercase italic">Dynamic TDEE</p>
                  </div>
                </div>

                {!dynamicTDEE ? (
                  <div className="bg-highlight/20 p-4 border-2 border-dashed border-secondary/20">
                    <p className="text-xs font-bold text-secondary/60 uppercase text-center">
                      Need at least <span className="text-secondary">3 days</span> of data to unlock smart estimation.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="bg-highlight p-6 border-3 border-secondary flex items-baseline justify-between relative overflow-hidden">
                      <div className="absolute top-0 right-0 w-16 h-16 bg-white/40 rotate-45 translate-x-8 -translate-y-8"></div>
                      <div>
                        <p className="text-[10px] font-black uppercase text-secondary/60 tracking-widest mb-1">Your Maintenance Level</p>
                        <p className="text-5xl font-black text-secondary">{dynamicTDEE} <span className="text-lg font-black uppercase">kcal</span></p>
                      </div>
                      <div className="text-right">
                        <span className="px-2 py-1 bg-secondary text-white text-[10px] font-black uppercase tracking-widest border-2 border-secondary">Refined</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-2">
                      <div className="p-4 bg-gray-50 border-2 border-secondary/10">
                        <p className="text-[10px] font-black uppercase text-secondary/40 mb-3 tracking-widest italic flex items-center gap-2">
                          Calculation Breakdown
                        </p>
                        <div className="space-y-2">
                          <div className="flex justify-between text-xs font-bold text-gray-500 font-mono">
                            <span>Average Daily Intake</span>
                            <span className="text-secondary">{tdeeBreakdown?.avgIntake} kcal</span>
                          </div>
                          <div className="flex justify-between text-xs font-bold text-primary font-mono">
                            <span className="flex items-center gap-1">Weight Change Correction <span className="text-[9px] opacity-40">({tdeeBreakdown?.weightChange}kg)</span></span>
                            <span>{Number(tdeeBreakdown?.weightChange) > 0 ? '-' : '+'}{tdeeBreakdown?.adjustment} kcal</span>
                          </div>
                          <div className="pt-2 mt-2 border-t-2 border-dashed border-secondary/10 flex justify-between text-sm font-black text-secondary font-mono">
                            <span>Final Estimate</span>
                            <span>{dynamicTDEE} kcal</span>
                          </div>
                        </div>
                        <p className="mt-4 text-[9px] font-bold text-secondary/30 uppercase leading-tight italic">
                          *Log regularly for better accuracy. Calculations use your most recent 14-day trend ({tdeeBreakdown?.samples} days logged).
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </>
        )}

      </div>
    </div>
  );
};

export default WeightTrend;