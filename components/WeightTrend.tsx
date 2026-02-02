import React from 'react';
import { WeightLog, FoodItem } from '../types';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts';
import { TrendingUp, Activity } from 'lucide-react';

interface WeightTrendProps {
  weightLogs: WeightLog[];
  foodLogs: FoodItem[];
}

const WeightTrend: React.FC<WeightTrendProps> = ({ weightLogs, foodLogs }) => {
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

  // Process weight logs
  weightLogs.forEach(log => {
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
          </>
        )}
      </div>
    </div>
  );
};

export default WeightTrend;