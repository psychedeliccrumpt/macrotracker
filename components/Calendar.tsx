import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, Scale } from 'lucide-react';
import { FoodItem, Macros, WeightLog } from '../types';
import { getLocalDateString, formatLocalDateLong } from '../utils/dateUtils';

interface CalendarProps {
  logs: FoodItem[];
  weightLogs: WeightLog[];
  onSelectDate: (dateString: string) => void;
}

const Calendar: React.FC<CalendarProps> = ({ logs, weightLogs, onSelectDate }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDateStr, setSelectedDateStr] = useState<string>(getLocalDateString());

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = new Date(year, month, 1).getDay();

  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

  const formatDate = (y: number, m: number, d: number) => {
    return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  };

  const getLogsForDate = (dateStr: string) => {
    return logs.filter(log => {
      const logDate = getLocalDateString(new Date(log.timestamp));
      return logDate === dateStr;
    });
  };

  const getWeightForDate = (dateStr: string) => {
    const dayWeights = weightLogs.filter(log => {
      const logDate = getLocalDateString(new Date(log.timestamp));
      return logDate === dateStr;
    }).sort((a, b) => b.timestamp - a.timestamp);

    return dayWeights.length > 0 ? dayWeights[0] : null;
  };

  const calculateDailyTotal = (dateStr: string): Macros => {
    const dayLogs = getLogsForDate(dateStr);
    return dayLogs.reduce((acc, curr) => ({
      calories: acc.calories + curr.calories,
      protein: acc.protein + curr.protein,
      carbs: acc.carbs + curr.carbs,
      fat: acc.fat + curr.fat,
    }), { calories: 0, protein: 0, carbs: 0, fat: 0 });
  };

  const renderDays = () => {
    const days = [];
    for (let i = 0; i < firstDayOfMonth; i++) {
      days.push(<div key={`pad-${i}`} className="bg-gray-100 border-r-2 border-b-2 border-secondary/10"></div>);
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = formatDate(year, month, d);
      const dayLogs = getLogsForDate(dateStr);
      const weightLog = getWeightForDate(dateStr);
      const hasLogs = dayLogs.length > 0;
      const isSelected = selectedDateStr === dateStr;
      const isToday = dateStr === getLocalDateString();
      const totalCals = hasLogs ? dayLogs.reduce((acc, curr) => acc + curr.calories, 0) : 0;

      days.push(
        <button
          key={d}
          onClick={() => {
            setSelectedDateStr(dateStr);
            onSelectDate(dateStr);
          }}
          className={`h-24 relative border-r-2 border-b-2 border-secondary flex flex-col items-start justify-between p-1 transition-all ${isSelected ? 'bg-primary text-white shadow-[inset_0_0_10px_rgba(0,0,0,0.2)]' : 'bg-surface hover:bg-yellow-50'}`}
        >
          <div className="w-full flex justify-between items-start">
            <span className={`text-xs font-black font-mono ${isToday ? 'bg-accent text-secondary px-1 border border-secondary' : ''}`}>{d}</span>
            {weightLog && (
              <span className={`text-[9px] font-mono font-bold flex items-center gap-0.5 ${isSelected ? 'text-white/80' : 'text-primary'}`}>
                <Scale size={8} /> {weightLog.weight}
              </span>
            )}
          </div>

          {hasLogs && (
            <div className="w-full flex flex-col items-end">
              <span className={`text-[10px] font-mono font-bold ${isSelected ? 'text-white' : 'text-secondary'}`}>{Math.round(totalCals)}</span>
              <div className="flex gap-0.5">
                <div className="w-2 h-2 bg-white border border-secondary"></div>
                <div className="w-2 h-2 bg-accent border border-secondary"></div>
              </div>
            </div>
          )}
        </button>
      );
    }
    return days;
  };

  const selectedTotals = calculateDailyTotal(selectedDateStr);
  const selectedLogs = getLogsForDate(selectedDateStr);
  const selectedWeight = getWeightForDate(selectedDateStr);

  return (
    <div className="h-full flex flex-col bg-background">
      <div className="p-6 bg-surface border-b-3 border-secondary shadow-neo">
        <h1 className="text-4xl font-black uppercase tracking-tighter text-secondary">History</h1>
        <div className="w-16 h-3 bg-accent mt-2 border-2 border-secondary"></div>
      </div>

      <div className="flex-1 overflow-y-auto pb-24">
        {/* Calendar Header */}
        <div className="flex justify-between items-center p-4 bg-surface border-b-3 border-secondary">
          <button onClick={prevMonth} className="p-2 border-3 border-secondary hover:bg-secondary hover:text-white transition-colors shadow-neo-sm active:shadow-none active:translate-x-[2px] active:translate-y-[2px]">
            <ChevronLeft size={20} strokeWidth={3} />
          </button>
          <h2 className="text-xl font-black uppercase tracking-widest text-secondary">{monthNames[month]} {year}</h2>
          <button onClick={nextMonth} className="p-2 border-3 border-secondary hover:bg-secondary hover:text-white transition-colors shadow-neo-sm active:shadow-none active:translate-x-[2px] active:translate-y-[2px]">
            <ChevronRight size={20} strokeWidth={3} />
          </button>
        </div>

        {/* Days of Week */}
        <div className="grid grid-cols-7 border-b-3 border-secondary bg-secondary text-white">
          {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, i) => (
            <div key={i} className="text-center py-2 text-xs font-black uppercase tracking-wider">{day}</div>
          ))}
        </div>

        {/* Calendar Grid */}
        <div className="grid grid-cols-7 border-l-3 border-secondary bg-white">
          {renderDays()}
        </div>

        {/* Selected Day Summary */}
        <div className="p-6 mt-4 space-y-4">
          <h3 className="text-lg font-black uppercase bg-highlight px-2 inline-block mb-2 border-2 border-secondary transform rotate-1">
            {formatLocalDateLong(selectedDateStr)}
          </h3>

          {/* Weight Card */}
          {selectedWeight && (
            <div className="bg-white border-3 border-secondary p-3 shadow-neo-sm flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Scale className="text-primary" />
                <span className="font-black uppercase text-secondary">Recorded Weight</span>
              </div>
              <span className="font-mono font-black text-xl text-secondary">{selectedWeight.weight} kg</span>
            </div>
          )}

          {selectedLogs.length === 0 ? (
            <div className="p-6 border-3 border-dashed border-gray-300 text-center">
              <p className="text-gray-400 font-bold font-mono">NO FOOD LOGGED</p>
            </div>
          ) : (
            <div className="bg-surface border-3 border-secondary p-4 shadow-neo">
              <div className="flex justify-between items-end mb-4 border-b-3 border-secondary pb-2">
                <span className="font-bold uppercase text-secondary">Total Intake</span>
                <span className="text-3xl font-black font-mono">{Math.round(selectedTotals.calories)} <span className="text-xs text-secondary font-sans">KCAL</span></span>
              </div>
              <div className="flex gap-4">
                <div className="flex-1 bg-primary/10 border-2 border-secondary p-2 text-center">
                  <span className="block text-xl font-black text-primary font-mono">{Math.round(selectedTotals.protein)}g</span>
                  <span className="text-[10px] font-bold uppercase bg-primary text-white px-1">Prot</span>
                </div>
                <div className="flex-1 bg-accent/10 border-2 border-secondary p-2 text-center">
                  <span className="block text-xl font-black text-accent font-mono">{Math.round(selectedTotals.carbs)}g</span>
                  <span className="text-[10px] font-bold uppercase bg-accent text-secondary px-1">Carb</span>
                </div>
                <div className="flex-1 bg-highlight/10 border-2 border-secondary p-2 text-center">
                  <span className="block text-xl font-black text-highlight font-mono">{Math.round(selectedTotals.fat)}g</span>
                  <span className="text-[10px] font-bold uppercase bg-highlight text-secondary px-1">Fat</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Calendar;