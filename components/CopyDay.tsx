import React, { useMemo, useState } from 'react';
import { ArrowLeft, ChevronLeft, ChevronRight, ChevronUp, ChevronDown, Check, Loader2, CopyPlus, Pencil, Undo2, X } from 'lucide-react';
import { FoodItem } from '../types';
import EditorModal from './EditorModal';
import { getLocalDateString, formatLocalDateLong, formatLocalTime } from '../utils/dateUtils';

interface CopyDayProps {
  logs: FoodItem[];
  /** The day the copies will be logged to (the app's selected date, usually today). */
  targetDate: Date;
  onBack: () => void;
  /** Logs copies of the given items to targetDate. Resolves when saved. */
  onCopy: (items: FoodItem[]) => Promise<void>;
}

const dayOf = (item: FoodItem) => getLocalDateString(new Date(item.timestamp));

const shortDay = (dayStr: string) => {
  const [y, m, d] = dayStr.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
};

const amountText = (item: FoodItem) =>
  item.quantity && item.unit ? `${+item.quantity.toFixed(2)} ${item.unit}` : null;

const CopyDay: React.FC<CopyDayProps> = ({ logs, targetDate, onBack, onCopy }) => {
  const targetStr = getLocalDateString(targetDate);
  const isTargetToday = targetStr === getLocalDateString(new Date());
  const targetLabel = isTargetToday
    ? 'Today'
    : targetDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

  // Days that have food logged, newest first, excluding the day we are copying into
  const daysWithLogs = useMemo(() => {
    const set = new Set(logs.map(dayOf));
    set.delete(targetStr);
    return Array.from(set).sort().reverse();
  }, [logs, targetStr]);

  // Start on the most recent logged day before the target day
  const [sourceDay, setSourceDay] = useState<string | null>(
    () => daysWithLogs.find(d => d < targetStr) ?? daysWithLogs[0] ?? null
  );

  // Selection is kept across days: browse several days and pick from each.
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  // Edited copies (new amount/macros), keyed by the original log id.
  // The original log is never changed.
  const [edits, setEdits] = useState<Record<string, FoodItem>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showReview, setShowReview] = useState(false);
  const [saving, setSaving] = useState(false);

  const byId = useMemo(() => new Map(logs.map(l => [l.id, l])), [logs]);
  const copyOf = (item: FoodItem) => edits[item.id] ?? item;

  const dayItems = useMemo(
    () => (sourceDay ? logs.filter(l => dayOf(l) === sourceDay).sort((a, b) => a.timestamp - b.timestamp) : []),
    [logs, sourceDay]
  );

  // Nearest logged days on either side (works even if the picked date has no logs)
  const olderDay = sourceDay ? daysWithLogs.find(d => d < sourceDay) : undefined;
  const newerDay = sourceDay ? [...daysWithLogs].reverse().find(d => d > sourceDay) : undefined;

  const toggle = (id: string) =>
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const dayAllSelected = dayItems.length > 0 && dayItems.every(i => selected.has(i.id));
  const daySelectedCount = dayItems.filter(i => selected.has(i.id)).length;
  const setDaySelection = (on: boolean) =>
    setSelected(prev => {
      const next = new Set(prev);
      dayItems.forEach(i => (on ? next.add(i.id) : next.delete(i.id)));
      return next;
    });

  // Everything selected, across all days, oldest first, with edits applied
  const chosen = useMemo(
    () =>
      Array.from(selected)
        .map(id => byId.get(id))
        .filter((l): l is FoodItem => !!l)
        .sort((a, b) => a.timestamp - b.timestamp),
    [selected, byId]
  );
  const chosenDays = new Set(chosen.map(dayOf)).size;
  const totals = chosen.map(copyOf).reduce(
    (t, i) => ({
      calories: t.calories + (i.calories || 0),
      protein: t.protein + (i.protein || 0),
      fat: t.fat + (i.fat || 0),
      carbs: t.carbs + (i.carbs || 0),
    }),
    { calories: 0, protein: 0, fat: 0, carbs: 0 }
  );

  const saveEdit = (original: FoodItem, data: Omit<FoodItem, 'timestamp'>) => {
    setEdits(prev => ({ ...prev, [original.id]: { ...original, ...data, id: original.id, timestamp: original.timestamp } }));
    setSelected(prev => new Set(prev).add(original.id)); // editing implies you want it
    setEditingId(null);
  };
  const resetEdit = (id: string) =>
    setEdits(prev => {
      const next = { ...prev };
      delete next[id];
      return next;
    });

  const handleCopy = async () => {
    if (chosen.length === 0 || saving) return;
    setSaving(true);
    try {
      await onCopy(chosen.map(copyOf));
    } finally {
      setSaving(false);
    }
  };

  const editingItem = editingId ? byId.get(editingId) : undefined;

  /** One food row: tap the row to select, pencil to edit the amount for the copy. */
  const renderRow = (item: FoodItem, showDay = false) => {
    const on = selected.has(item.id);
    const edited = !!edits[item.id];
    const c = copyOf(item);
    const details = [
      showDay ? shortDay(dayOf(item)) : item.brand,
      amountText(c),
      showDay ? null : formatLocalTime(item.timestamp),
    ].filter(Boolean);
    return (
      <div
        key={item.id}
        className={`flex items-stretch border-3 border-secondary transition-colors ${
          on ? 'bg-highlight shadow-neo-sm' : 'bg-white'
        }`}
      >
        <button
          onClick={() => toggle(item.id)}
          aria-pressed={on}
          className="flex-1 min-w-0 text-left flex items-center gap-3 p-3"
        >
          <span
            className={`shrink-0 w-6 h-6 border-3 border-secondary flex items-center justify-center ${
              on ? 'bg-secondary text-white' : 'bg-white'
            }`}
          >
            {on && <Check size={14} strokeWidth={4} />}
          </span>
          <span className="flex-1 min-w-0">
            <span className="block font-black text-secondary truncate">{item.name}</span>
            <span className="block text-[11px] font-bold text-gray-500 uppercase truncate">
              {details.join(' · ')}
              {edited && (
                <span className="ml-1 text-primary">· edited (was {amountText(item) ?? 'original'})</span>
              )}
            </span>
          </span>
          <span className="shrink-0 text-right">
            <span className="block font-black text-secondary">{Math.round(c.calories)}</span>
            <span className="block text-[10px] font-bold text-gray-500 uppercase">
              {Math.round(c.protein)}P {Math.round(c.fat)}F {Math.round(c.carbs)}C
            </span>
          </span>
        </button>
        {edited && (
          <button
            onClick={() => resetEdit(item.id)}
            aria-label={`Undo edit to ${item.name}`}
            title="Undo edit"
            className="px-2 border-l-3 border-secondary text-secondary hover:bg-secondary hover:text-white transition-colors"
          >
            <Undo2 size={16} strokeWidth={3} />
          </button>
        )}
        <button
          onClick={() => setEditingId(item.id)}
          aria-label={`Edit amount of ${item.name}`}
          title="Edit amount"
          className="px-3 border-l-3 border-secondary text-secondary hover:bg-secondary hover:text-white transition-colors"
        >
          <Pencil size={16} strokeWidth={3} />
        </button>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-background p-4">
      <div className="flex items-center mb-6">
        <button
          onClick={onBack}
          aria-label="Back"
          className="mr-4 p-2 border-3 border-secondary bg-white hover:bg-secondary hover:text-white transition-colors shadow-neo-sm"
        >
          <ArrowLeft size={24} strokeWidth={3} />
        </button>
        <h1 className="text-2xl font-black uppercase text-secondary tracking-tight">Copy Past Days</h1>
      </div>

      {daysWithLogs.length === 0 ? (
        <div className="flex flex-col items-center justify-center flex-1 text-center opacity-50">
          <CopyPlus size={72} className="mb-4 text-secondary" strokeWidth={1.5} />
          <p className="uppercase font-black tracking-widest text-secondary">No other days logged yet</p>
        </div>
      ) : (
        <>
          {/* Day picker: arrows step through days that have food logged */}
          <div className="flex items-stretch border-3 border-secondary bg-white shadow-neo-sm mb-2">
            <button
              onClick={() => olderDay && setSourceDay(olderDay)}
              disabled={!olderDay}
              aria-label="Earlier day"
              className="px-3 border-r-3 border-secondary text-secondary disabled:opacity-25 hover:bg-highlight"
            >
              <ChevronLeft size={24} strokeWidth={3} />
            </button>
            <label className="flex-1 relative py-3 text-center cursor-pointer">
              <span className="font-black uppercase text-secondary text-sm tracking-wide">
                {sourceDay ? formatLocalDateLong(sourceDay) : 'Pick a day'}
              </span>
              {/* Native date input for jumping straight to a date */}
              <input
                type="date"
                value={sourceDay ?? ''}
                max={getLocalDateString(new Date())}
                onChange={e => e.target.value && setSourceDay(e.target.value)}
                className="absolute inset-0 opacity-0 cursor-pointer"
                aria-label="Choose a day to copy from"
              />
            </label>
            <button
              onClick={() => newerDay && setSourceDay(newerDay)}
              disabled={!newerDay}
              aria-label="Later day"
              className="px-3 border-l-3 border-secondary text-secondary disabled:opacity-25 hover:bg-highlight"
            >
              <ChevronRight size={24} strokeWidth={3} />
            </button>
          </div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-secondary/50 mb-4 text-center">
            Picks stay selected when you change days · ✎ edits the copy only
          </p>

          {dayItems.length > 0 && (
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-black uppercase tracking-widest text-secondary">
                {daySelectedCount} of {dayItems.length} on this day
              </span>
              <button
                onClick={() => setDaySelection(!dayAllSelected)}
                className="text-xs font-black uppercase tracking-widest text-secondary underline underline-offset-4"
              >
                {dayAllSelected ? 'Unselect day' : 'Select whole day'}
              </button>
            </div>
          )}

          <div className="flex-1 overflow-y-auto space-y-3 pb-4">
            {dayItems.length === 0 && (
              <div className="p-4 border-3 border-dashed border-secondary/30 bg-white/50 text-center">
                <p className="text-secondary font-black uppercase text-sm">Nothing logged on this day</p>
              </div>
            )}
            {dayItems.map(item => renderRow(item))}
          </div>

          {/* Everything selected so far, across days */}
          <div className="border-t-3 border-secondary pt-3">
            {chosen.length > 0 && (
              <div className="flex items-center justify-between mb-2">
                <button
                  onClick={() => setShowReview(v => !v)}
                  aria-expanded={showReview}
                  className="flex items-center gap-1 text-xs font-black uppercase tracking-widest text-secondary"
                >
                  {showReview ? <ChevronDown size={16} strokeWidth={3} /> : <ChevronUp size={16} strokeWidth={3} />}
                  {chosen.length} selected · {chosenDays} day{chosenDays === 1 ? '' : 's'}
                </button>
                <button
                  onClick={() => setSelected(new Set())}
                  className="flex items-center gap-1 text-xs font-black uppercase tracking-widest text-secondary/60 hover:text-secondary"
                >
                  <X size={14} strokeWidth={3} /> Clear
                </button>
              </div>
            )}
            {showReview && chosen.length > 0 && (
              <div className="max-h-56 overflow-y-auto space-y-2 mb-3">
                {chosen.map(item => renderRow(item, true))}
              </div>
            )}
            <div className="flex justify-between text-xs font-black uppercase tracking-widest text-secondary mb-3">
              <span>{Math.round(totals.calories)} kcal</span>
              <span>
                {Math.round(totals.protein)}P · {Math.round(totals.fat)}F · {Math.round(totals.carbs)}C
              </span>
            </div>
            <button
              onClick={handleCopy}
              disabled={chosen.length === 0 || saving}
              className="w-full flex items-center justify-center gap-2 py-4 bg-secondary text-white border-3 border-secondary font-black uppercase tracking-wide shadow-neo hover:bg-primary disabled:opacity-40 disabled:hover:bg-secondary transition-colors"
            >
              {saving ? <Loader2 className="animate-spin" size={20} /> : <CopyPlus size={20} strokeWidth={3} />}
              {saving
                ? 'Logging...'
                : chosen.length === 0
                  ? 'Select foods to copy'
                  : `Log ${chosen.length} item${chosen.length === 1 ? '' : 's'} to ${targetLabel}`}
            </button>
          </div>
        </>
      )}

      {editingItem && (
        <EditorModal
          key={editingItem.id}
          initialData={copyOf(editingItem)}
          saveLabel={`Use for ${targetLabel}`}
          allowSaveToDb={false}
          onSave={data => saveEdit(editingItem, data)}
          onCancel={() => setEditingId(null)}
        />
      )}
    </div>
  );
};

export default CopyDay;
