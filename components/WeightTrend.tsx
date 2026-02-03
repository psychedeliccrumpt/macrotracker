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

  // Process food logs first
  foodLogs.forEach(log => {
    const date = new Date(log.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    const dayStart = new Date(log.timestamp).setHours(0, 0, 0, 0);

    if (!aggregatedData[date]) {
      aggregatedData[date] = { date, calories: 0, timestamp: dayStart };
    }
    aggregatedData[date].calories += log.calories;
  });

  // Process weight logs - Sort ascending first to ensure latest per day overwrites
  [...weightLogs].sort((a, b) => a.timestamp - b.timestamp).forEach(log => {
    const date = new Date(log.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    const dayStart = new Date(log.timestamp).setHours(0, 0, 0, 0);

    if (!aggregatedData[date]) {
      aggregatedData[date] = { date, calories: 0, timestamp: dayStart };
    }
    aggregatedData[date].weight = log.weight;
  });

  // Convert to sorted array
  const chartData = Object.values(aggregatedData).sort((a, b) => a.timestamp - b.timestamp);

  const sortedWeightLogs = [...weightLogs].sort((a, b) => a.timestamp - b.timestamp);
  const currentWeight = sortedWeightLogs.length > 0 ? sortedWeightLogs[sortedWeightLogs.length - 1].weight : 0;
  const startWeight = sortedWeightLogs.length > 0 ? sortedWeightLogs[0].weight : 0;
  const weightDiff = currentWeight - startWeight;

  // 4. Dynamic TDEE Calculation
  // Find period with both weight and food data
  const dataWithWeight = chartData.filter(d => d.weight !== undefined);
  let dynamicTDEE = null;
  let tdeeBreakdown = null;

  if (dataWithWeight.length >= 2) {
    const startEntry = dataWithWeight[0];
    const endEntry = dataWithWeight[dataWithWeight.length - 1];

    // Period in days
    const days = Math.max(1, (endEntry.timestamp - startEntry.timestamp) / (1000 * 60 * 60 * 24));

    if (days >= 3) { // Require at least 3 days for a meaningful trend
      const totalWeightChange = endEntry.weight! - startEntry.weight!;

      // Calculate average calories in THIS specific window
      const windowData = chartData.filter(d => d.timestamp >= startEntry.timestamp && d.timestamp <= endEntry.timestamp);
      const avgCaloriesInWindow = windowData.reduce((acc, curr) => acc + curr.calories, 0) / windowData.length;

      // 1kg of fat ~ 7700 kcal
      const calorieDeltaFromWeight = (totalWeightChange * 7700) / days;
      dynamicTDEE = Math.round(avgCaloriesInWindow - calorieDeltaFromWeight);

      tdeeBreakdown = {
        days: Math.round(days),
        weightChange: totalWeightChange.toFixed(1),
        avgIntake: Math.round(avgCaloriesInWindow),
        adjustment: Math.round(Math.abs(calorieDeltaFromWeight))
      };
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
                <p className="text-[10px] font-black uppercase text-secondary tracking-widest mb-1 underline decoration-highlight">Avg Calories</p>
                <div className="flex items-end justify-between">
                  <p className="text-3xl font-black font-mono text-secondary">
                    {chartData.length > 0
                      ? Math.round(chartData.reduce((acc, curr) => acc + curr.calories, 0) / chartData.length)
                      : 0}
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
                    domain={['auto', 'auto']}
                    tick={{ fontSize: 9, fontFamily: 'monospace', fontWeight: 'bold', fill: '#8B5CF6' }}
                    axisLine={false}
                    tickLine={false}
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
                          *Log regularly for better accuracy. Calculations are based on your {tdeeBreakdown?.days}-day trend.
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