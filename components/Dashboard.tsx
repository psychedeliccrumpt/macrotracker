import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { FoodItem, Macros } from '../types';
import { Trash2, Edit2, Clock } from 'lucide-react';

interface DashboardProps {
  logs: FoodItem[];
  targets: Macros;
  onDeleteLog: (id: string) => void;
  onEditLog: (item: FoodItem) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ logs, targets, onDeleteLog, onEditLog }) => {
  // Filter logs for TODAY only
  const todayStr = new Date().toISOString().split('T')[0];
  const dailyLogs = logs.filter(log => {
      const logDate = new Date(log.timestamp).toISOString().split('T')[0];
      return logDate === todayStr;
  });

  const totals = dailyLogs.reduce((acc, curr) => ({
    calories: acc.calories + curr.calories,
    protein: acc.protein + curr.protein,
    carbs: acc.carbs + curr.carbs,
    fat: acc.fat + curr.fat,
  }), { calories: 0, protein: 0, carbs: 0, fat: 0 });

  // Calculate percentages of TOTAL INTAKE
  const totalConsumed = totals.calories;
  const pPct = totalConsumed > 0 ? Math.round((totals.protein * 4 / totalConsumed) * 100) : 0;
  const cPct = totalConsumed > 0 ? Math.round((totals.carbs * 4 / totalConsumed) * 100) : 0;
  const fPct = totalConsumed > 0 ? Math.round((totals.fat * 9 / totalConsumed) * 100) : 0;

  // Neobrutalist Colors
  const COLORS = {
    protein: '#8B5CF6', // Violet
    carbs: '#FB7185',   // Rose
    fat: '#FBBF24',     // Amber
    remaining: '#FFFFFF' // White
  };

  const pCals = totals.protein * 4;
  const cCals = totals.carbs * 4;
  const fCals = totals.fat * 9;
  
  const targetCals = targets.calories || 2200;
  const totalMacroCals = pCals + cCals + fCals;
  const remainingCals = Math.max(0, targetCals - totalMacroCals);

  const chartData = [
    { name: 'Protein', value: pCals, color: COLORS.protein },
    { name: 'Carbs', value: cCals, color: COLORS.carbs },
    { name: 'Fat', value: fCals, color: COLORS.fat },
    { name: 'Remaining', value: remainingCals, color: COLORS.remaining },
  ];

  const dateOptions: Intl.DateTimeFormatOptions = { weekday: 'long', month: 'short', day: 'numeric' };
  const dateStr = new Date().toLocaleDateString('en-US', dateOptions);

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Scrollable Content */}
      <div 
        className="flex-1 overflow-y-auto no-scrollbar pb-32"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        
        {/* Header / Chart Section */}
        <div className="p-6 bg-surface border-b-3 border-secondary shadow-neo mb-8 relative">
          
          {/* Slogan */}
          <div className="absolute top-0 right-0 p-2 z-10 opacity-10 pointer-events-none">
             <h1 className="text-6xl font-black uppercase text-right leading-none text-secondary">FOOD<br/>IS<br/>FUEL</h1>
          </div>

          {/* Date Label */}
          <div className="absolute top-0 left-0 p-4 z-10">
             <div className="inline-block bg-highlight px-4 py-2 border-3 border-secondary shadow-[2px_2px_0px_#18181B] transform -rotate-1">
                <p className="text-secondary font-black text-lg uppercase tracking-widest font-mono leading-none">
                  {dateStr}
                </p>
             </div>
          </div>

          <div className="mt-16 flex items-center justify-center relative">
            <div className="w-72 h-72 relative pointer-events-none">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={85}
                    outerRadius={115}
                    startAngle={90}
                    endAngle={-270}
                    dataKey="value"
                    stroke="none"
                    paddingAngle={0}
                  >
                    {chartData.map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={entry.color} 
                        stroke="#18181B" 
                        strokeWidth={3}
                        className="transition-all duration-300"
                      />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              
              {/* Center Info */}
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-sm font-bold text-gray-400 font-mono mb-2">/ {targets.calories}</span>
                <span className="text-6xl font-black text-secondary tracking-tighter leading-none">{Math.round(totals.calories)}</span>
                <span className="text-sm font-black uppercase tracking-widest bg-secondary text-white px-3 py-1 mt-2 border-2 border-secondary transform rotate-2">KCAL</span>
              </div>
            </div>
          </div>

          {/* Macro Breakdown Cards */}
          <div className="grid grid-cols-3 gap-4 mt-8 relative z-20">
            {/* Protein */}
            <div className="bg-primary p-3 border-3 border-secondary shadow-[4px_4px_0px_#18181B] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none transition-all">
              <div className="flex justify-between items-center mb-1">
                <div className="text-xs text-white uppercase font-black tracking-wider">Protein</div>
                <div className="text-[10px] font-mono font-bold bg-white text-primary px-1">{pPct}%</div>
              </div>
              <div className="text-3xl font-black text-white font-mono leading-none">{Math.round(totals.protein)}<span className="text-lg">g</span></div>
              <div className="text-[10px] text-white/90 mt-1 font-mono uppercase">Goal: {targets.protein}g</div>
              <div className="mt-2 w-full h-2 bg-black/20 border-2 border-secondary overflow-hidden">
                 <div className="h-full bg-white" style={{ width: `${Math.min((totals.protein / targets.protein) * 100, 100)}%` }}></div>
              </div>
            </div>

            {/* Carbs */}
            <div className="bg-accent p-3 border-3 border-secondary shadow-[4px_4px_0px_#18181B] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none transition-all">
              <div className="flex justify-between items-center mb-1">
                <div className="text-xs text-secondary uppercase font-black tracking-wider">Carbs</div>
                <div className="text-[10px] font-mono font-bold bg-white text-accent px-1">{cPct}%</div>
              </div>
              <div className="text-3xl font-black text-secondary font-mono leading-none">{Math.round(totals.carbs)}<span className="text-lg">g</span></div>
               <div className="text-[10px] text-secondary/80 mt-1 font-mono uppercase">Goal: {targets.carbs}g</div>
               <div className="mt-2 w-full h-2 bg-black/10 border-2 border-secondary overflow-hidden">
                 <div className="h-full bg-white" style={{ width: `${Math.min((totals.carbs / targets.carbs) * 100, 100)}%` }}></div>
              </div>
            </div>

            {/* Fat */}
            <div className="bg-highlight p-3 border-3 border-secondary shadow-[4px_4px_0px_#18181B] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none transition-all">
              <div className="flex justify-between items-center mb-1">
                <div className="text-xs text-secondary uppercase font-black tracking-wider">Fat</div>
                <div className="text-[10px] font-mono font-bold bg-white text-highlight px-1">{fPct}%</div>
              </div>
              <div className="text-3xl font-black text-secondary font-mono leading-none">{Math.round(totals.fat)}<span className="text-lg">g</span></div>
               <div className="text-[10px] text-secondary/80 mt-1 font-mono uppercase">Goal: {targets.fat}g</div>
               <div className="mt-2 w-full h-2 bg-white/40 border-2 border-secondary overflow-hidden">
                 <div className="h-full bg-secondary" style={{ width: `${Math.min((totals.fat / targets.fat) * 100, 100)}%` }}></div>
              </div>
            </div>
          </div>
        </div>

        {/* Logged Items List */}
        <div className="px-6">
          <div className="flex justify-between items-center mb-4">
             <h2 className="text-2xl font-black uppercase text-secondary flex items-center gap-2">
                <div className="w-4 h-4 bg-accent border-2 border-secondary"></div>
                LOGGED ITEMS
             </h2>
          </div>
          
          {dailyLogs.length === 0 ? (
            <div className="p-8 border-3 border-dashed border-gray-300 bg-white/50 text-center">
              <p className="text-gray-400 font-bold uppercase tracking-widest text-sm">NO FOOD LOGGED TODAY</p>
            </div>
          ) : (
            <div className="space-y-4">
              {dailyLogs.slice().reverse().map(item => {
                const timeStr = new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                return (
                  <div 
                    key={item.id} 
                    onClick={() => onEditLog(item)}
                    className="bg-surface p-4 border-3 border-secondary shadow-neo flex justify-between items-center transition-transform hover:-translate-y-1 group cursor-pointer active:scale-[0.98]"
                  >
                    <div>
                      <h3 className="font-black text-secondary text-lg leading-tight uppercase">{item.name}</h3>
                      <div className="flex flex-wrap items-center gap-2 mt-2">
                        <span className="flex items-center gap-1 text-[10px] font-mono font-bold text-gray-500 bg-gray-50 px-1 border border-secondary">
                          <Clock size={10} strokeWidth={3} /> {timeStr}
                        </span>
                        <span className="text-xs font-mono font-bold bg-gray-100 px-2 border border-secondary text-gray-600">
                          {item.quantity} {item.unit}
                        </span>
                        <span className="text-xs font-mono font-bold text-secondary">
                          {Math.round(item.calories)} kcal
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-gray-300 group-hover:text-primary transition-colors">
                        <Edit2 size={18} />
                      </div>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteLog(item.id);
                        }}
                        className="p-3 text-secondary hover:text-white hover:bg-accent border-3 border-transparent hover:border-secondary transition-all rounded-none"
                      >
                        <Trash2 size={20} strokeWidth={2.5} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;