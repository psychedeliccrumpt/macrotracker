import React from 'react';
import { WeightLog } from '../types';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { TrendingUp } from 'lucide-react';

interface WeightTrendProps {
  logs: WeightLog[];
}

const WeightTrend: React.FC<WeightTrendProps> = ({ logs }) => {
  const sortedLogs = [...logs].sort((a, b) => a.timestamp - b.timestamp);
  
  const chartData = sortedLogs.map(log => ({
    date: new Date(log.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
    weight: log.weight,
    timestamp: log.timestamp
  }));
  
  const currentWeight = sortedLogs.length > 0 ? sortedLogs[sortedLogs.length - 1].weight : 0;
  const startWeight = sortedLogs.length > 0 ? sortedLogs[0].weight : 0;
  const diff = currentWeight - startWeight;

  return (
    <div className="h-full flex flex-col bg-background">
      <div className="p-6 bg-surface border-b-3 border-secondary shadow-neo">
        <h1 className="text-4xl font-black uppercase tracking-tighter text-secondary">Trends</h1>
        <div className="w-16 h-3 bg-primary mt-2 border-2 border-secondary"></div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 pb-24">
         {sortedLogs.length === 0 ? (
           <div className="flex flex-col items-center justify-center h-64 border-3 border-dashed border-gray-300 bg-white">
             <TrendingUp size={48} className="text-gray-300 mb-4" />
             <p className="text-gray-400 font-bold uppercase">No Weight Data Yet</p>
             <p className="text-gray-400 text-xs mt-2">Log your weight in the "Log" tab</p>
           </div>
         ) : (
           <>
             {/* Summary Card */}
             <div className="bg-white border-3 border-secondary p-4 shadow-neo mb-8 flex justify-between items-center">
                <div>
                   <p className="text-xs font-black uppercase text-secondary tracking-wider mb-1">Current</p>
                   <p className="text-4xl font-black font-mono text-secondary">{currentWeight} <span className="text-sm">kg</span></p>
                </div>
                <div className="text-right">
                   <p className="text-xs font-black uppercase text-secondary tracking-wider mb-1">Change</p>
                   <p className={`text-2xl font-black font-mono ${diff > 0 ? 'text-accent' : 'text-primary'}`}>
                     {diff > 0 ? '+' : ''}{diff.toFixed(1)} <span className="text-sm">kg</span>
                   </p>
                </div>
             </div>

             {/* Chart Container */}
             <div className="bg-white border-3 border-secondary p-4 shadow-neo h-80 relative">
               <h3 className="text-xs font-black uppercase text-secondary mb-4 absolute top-4 left-4 bg-highlight px-2 border border-secondary z-10">Weight History</h3>
               <ResponsiveContainer width="100%" height="100%">
                 <LineChart data={chartData} margin={{ top: 20, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                    <XAxis 
                      dataKey="date" 
                      tick={{fontSize: 10, fontFamily: 'monospace', fontWeight: 'bold'}} 
                      axisLine={false}
                      tickLine={false}
                      dy={10}
                    />
                    <YAxis 
                      domain={['auto', 'auto']} 
                      tick={{fontSize: 10, fontFamily: 'monospace', fontWeight: 'bold'}}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        border: '3px solid #18181B', 
                        borderRadius: '0px', 
                        boxShadow: '4px 4px 0px #18181B',
                        fontFamily: 'monospace',
                        fontWeight: 'bold'
                      }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="weight" 
                      stroke="#8B5CF6" 
                      strokeWidth={4}
                      dot={{ fill: '#18181B', strokeWidth: 0, r: 4 }}
                      activeDot={{ r: 6, fill: '#FB7185', stroke: '#18181B', strokeWidth: 2 }}
                    />
                 </LineChart>
               </ResponsiveContainer>
             </div>
           </>
         )}
      </div>
    </div>
  );
};

export default WeightTrend;