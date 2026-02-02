import React, { useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { FoodItem, Macros } from '../types';
import { Trash2, Edit2, Clock, X } from 'lucide-react';
import { getLocalDateString, formatLocalTime } from '../utils/dateUtils';

const MacroDetailModal: React.FC<{
  macro: 'protein' | 'carbs' | 'fat';
  logs: FoodItem[];
  onClose: () => void;
  color: string;
}> = ({ macro, logs, onClose, color }) => {
  const sortedLogs = [...logs].sort((a, b) => b[macro] - a[macro]);
  const total = logs.reduce((acc, curr) => acc + curr[macro], 0);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="w-full max-w-md bg-white border-4 border-secondary shadow-[12px_12px_0px_#18181B] animate-in slide-in-from-bottom duration-300 sm:zoom-in-95 relative overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="absolute top-0 right-0 w-32 h-32 bg-secondary opacity-5 -rotate-12 translate-x-12 -translate-y-12"></div>
        <div className="p-4 border-b-4 border-secondary flex justify-between items-center relative z-10" style={{ backgroundColor: color }}>
          <h2 className="text-3xl font-black uppercase text-white tracking-tighter drop-shadow-[3px_3px_0px_rgba(0,0,0,0.5)] italic">
            {macro}
          </h2>
          <button
            onClick={onClose}
            className="p-2 bg-white border-3 border-secondary text-secondary hover:bg-highlight transition-all shadow-[4px_4px_0px_#18181B] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
          >
            <X size={20} strokeWidth={4} />
          </button>
        </div>

        <div className="p-4 max-h-[60vh] overflow-y-auto no-scrollbar relative z-10">
          <div className="mb-6 p-4 bg-surface border-4 border-secondary shadow-[6px_6px_0px_#18181B] flex justify-between items-center transform -rotate-1">
            <span className="font-black uppercase text-sm text-secondary tracking-widest underline decoration-4 decoration-accent">Daily Intake</span>
            <span className="text-3xl font-black text-secondary font-mono">{Math.round(total)}g</span>
          </div>

          <div className="space-y-4">
            {sortedLogs.map((item, idx) => (
              <div
                key={`${item.id}-${idx}`}
                className="flex justify-between items-center p-4 border-3 border-secondary hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[6px_6px_0px_#18181B] transition-all bg-white relative overflow-hidden group active:scale-[0.98]"
              >
                <div
                  className="absolute inset-y-0 left-0 opacity-20 group-hover:opacity-30 transition-opacity"
                  style={{ backgroundColor: color, width: `${(item[macro] / total) * 100}%` }}
                ></div>

                <div className="relative z-10 flex flex-col">
                  <span className="font-black text-secondary uppercase text-md leading-none tracking-tight">{item.name}</span>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-[10px] font-mono font-black text-white bg-secondary px-2 py-0.5 border border-secondary">{item.quantity}{item.unit}</span>
                  </div>
                </div>
                <div className="relative z-10 text-right">
                  <span className="text-2xl font-black font-mono text-secondary drop-shadow-[1px_1px_0px_white]">{Math.round(item[macro])}g</span>
                  <div className="text-[9px] font-black uppercase text-gray-500 mt-1">
                    {Math.round((item[macro] / total) * 100)}% contribution
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="p-4 bg-highlight border-t-4 border-secondary text-center">
          <span className="font-black uppercase text-xs tracking-[0.2em] text-secondary italic">END OF RECORDS</span>
        </div>
      </div>
    </div>
  );
};

interface DashboardProps {
  logs: FoodItem[];
  targets: Macros;
  onDeleteLog: (id: string) => void;
  onEditLog: (item: FoodItem) => void;
  selectedDate?: Date;
  onDateClick: () => void;
}

const Dashboard: React.FC<DashboardProps> = ({ logs, targets, onDeleteLog, onEditLog, selectedDate, onDateClick }) => {
  const [selectedMacro, setSelectedMacro] = useState<'protein' | 'carbs' | 'fat' | null>(null);

  // Filter logs for SELECTED DATE
  const activeDateStr = getLocalDateString(selectedDate || new Date());
  const dailyLogs = logs.filter(log => {
    const logDate = getLocalDateString(new Date(log.timestamp));
    return logDate === activeDateStr;
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
  const dateStr = (selectedDate || new Date()).toLocaleDateString('en-US', dateOptions);

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
            <h1 className="text-6xl font-black uppercase text-right leading-none text-secondary">FOOD<br />IS<br />FUEL</h1>
          </div>

          {/* Date Label - Clickable */}
          <div className="absolute top-0 left-0 p-4 z-10 cursor-pointer group" onClick={onDateClick}>
            <div className="inline-block bg-highlight px-4 py-2 border-3 border-secondary shadow-[2px_2px_0px_#18181B] transform -rotate-1 group-hover:rotate-0 group-hover:scale-105 transition-transform group-active:translate-y-1 group-active:shadow-none">
              <p className="text-secondary font-black text-lg uppercase tracking-widest font-mono leading-none flex items-center gap-2">
                {dateStr} <span className="text-xs bg-secondary text-white px-1 ml-1 rounded-sm">▼</span>
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
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none p-4 text-center">
                <span className="text-[10px] sm:text-sm font-bold text-gray-400 font-mono mb-1">/ {targets.calories}</span>
                <span className="text-[clamp(2.5rem,12vw,3.75rem)] font-black text-secondary tracking-tighter leading-none">{Math.round(totals.calories)}</span>
                <span className="text-[8px] sm:text-xs font-black uppercase tracking-widest bg-secondary text-white px-2 sm:px-3 py-0.5 sm:py-1 mt-1 sm:mt-2 border-2 border-secondary transform rotate-2">KCAL</span>
              </div>
            </div>
          </div>

          {/* Macro Breakdown Cards */}
          <div className="grid grid-cols-3 gap-4 mt-8 relative z-20">
            {/* Protein */}
            <div
              onClick={() => setSelectedMacro('protein')}
              className="bg-primary p-2 sm:p-3 border-3 border-secondary shadow-[4px_4px_0px_#18181B] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none transition-all cursor-pointer active:scale-95 flex flex-col justify-between"
            >
              <div className="flex justify-between items-center mb-1">
                <div className="text-[8px] sm:text-xs text-white uppercase font-black tracking-wider truncate">Protein</div>
                <div className="text-[8px] sm:text-[10px] font-mono font-bold bg-white text-primary px-0.5 sm:px-1">{pPct}%</div>
              </div>
              <div className="text-[clamp(1.25rem,6vw,1.875rem)] font-black text-white font-mono leading-none break-words">
                {Math.round(totals.protein)}<span className="text-xs sm:text-lg ml-0.5">g</span>
              </div>
              <div className="text-[8px] sm:text-[10px] text-white/90 mt-1 font-mono uppercase truncate">Goal: {targets.protein}g</div>
              <div className="mt-2 w-full h-2 bg-black/20 border-2 border-secondary overflow-hidden">
                <div className="h-full bg-white" style={{ width: `${Math.min((totals.protein / targets.protein) * 100, 100)}%` }}></div>
              </div>
            </div>

            {/* Carbs */}
            <div
              onClick={() => setSelectedMacro('carbs')}
              className="bg-accent p-2 sm:p-3 border-3 border-secondary shadow-[4px_4px_0px_#18181B] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none transition-all cursor-pointer active:scale-95 flex flex-col justify-between"
            >
              <div className="flex justify-between items-center mb-1">
                <div className="text-[8px] sm:text-xs text-secondary uppercase font-black tracking-wider truncate">Carbs</div>
                <div className="text-[8px] sm:text-[10px] font-mono font-bold bg-white text-accent px-0.5 sm:px-1">{cPct}%</div>
              </div>
              <div className="text-[clamp(1.25rem,6vw,1.875rem)] font-black text-secondary font-mono leading-none break-words">
                {Math.round(totals.carbs)}<span className="text-xs sm:text-lg ml-0.5">g</span>
              </div>
              <div className="text-[8px] sm:text-[10px] text-secondary/80 mt-1 font-mono uppercase truncate">Goal: {targets.carbs}g</div>
              <div className="mt-2 w-full h-2 bg-black/10 border-2 border-secondary overflow-hidden">
                <div className="h-full bg-white" style={{ width: `${Math.min((totals.carbs / targets.carbs) * 100, 100)}%` }}></div>
              </div>
            </div>

            {/* Fat */}
            <div
              onClick={() => setSelectedMacro('fat')}
              className="bg-highlight p-2 sm:p-3 border-3 border-secondary shadow-[4px_4px_0px_#18181B] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none transition-all cursor-pointer active:scale-95 flex flex-col justify-between"
            >
              <div className="flex justify-between items-center mb-1">
                <div className="text-[8px] sm:text-xs text-secondary uppercase font-black tracking-wider truncate">Fat</div>
                <div className="text-[8px] sm:text-[10px] font-mono font-bold bg-white text-highlight px-0.5 sm:px-1">{fPct}%</div>
              </div>
              <div className="text-[clamp(1.25rem,6vw,1.875rem)] font-black text-secondary font-mono leading-none break-words">
                {Math.round(totals.fat)}<span className="text-xs sm:text-lg ml-0.5">g</span>
              </div>
              <div className="text-[8px] sm:text-[10px] text-secondary/80 mt-1 font-mono uppercase truncate">Goal: {targets.fat}g</div>
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
                          <Clock size={10} strokeWidth={3} /> {formatLocalTime(item.timestamp)}
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

      {/* Macro Detail Modal */}
      {selectedMacro && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center sm:items-center p-4 bg-black/60 backdrop-blur-sm transition-all"
          onClick={() => setSelectedMacro(null)}
        >
          <MacroDetailModal
            macro={selectedMacro}
            logs={dailyLogs}
            onClose={() => setSelectedMacro(null)}
            color={COLORS[selectedMacro]}
          />
        </div>
      )}
    </div>
  );
};

export default Dashboard;