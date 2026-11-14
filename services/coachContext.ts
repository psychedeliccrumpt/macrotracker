import { CoachPlan, CoachProfile, FoodItem, UserProfile, WeightLog } from '../types';
import { getLocalDateString } from '../utils/dateUtils';

const DAY_MS = 24 * 60 * 60 * 1000;

const parseLocalDate = (s: string): Date => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
};

const daysBetween = (from: Date, to: Date) =>
  Math.round((new Date(to.getFullYear(), to.getMonth(), to.getDate()).getTime() -
    new Date(from.getFullYear(), from.getMonth(), from.getDate()).getTime()) / DAY_MS);

export interface CycleEstimate {
  day: number;
  length: number;
  phase: 'menstrual' | 'follicular' | 'ovulatory' | 'luteal';
  stale: boolean; // last period date is more than ~2 cycles old, so the estimate is unreliable
}

/**
 * Rough calendar estimate of cycle phase from the last period start and average length.
 * Ovulation is assumed ~14 days before the next period. This is an estimate only.
 */
export const estimateCycle = (profile: CoachProfile | null, today = new Date()): CycleEstimate | null => {
  if (!profile?.trackCycle || !profile.lastPeriodStart) return null;
  const length = Math.min(45, Math.max(20, profile.cycleLength || 28));
  const elapsed = daysBetween(parseLocalDate(profile.lastPeriodStart), today);
  if (elapsed < 0) return null;
  const day = (elapsed % length) + 1;
  const ovulationDay = length - 14;
  const phase: CycleEstimate['phase'] =
    day <= 5 ? 'menstrual' : day < ovulationDay - 1 ? 'follicular' : day <= ovulationDay + 1 ? 'ovulatory' : 'luteal';
  return { day, length, phase, stale: elapsed > length * 2 };
};

const r = (n: number) => Math.round(n);

/**
 * Builds the text snapshot of the user's data that is sent to the coach with every message.
 */
export const buildCoachContext = (args: {
  logs: FoodItem[];
  weightLogs: WeightLog[];
  profile: UserProfile | null;
  coachProfile: CoachProfile | null;
  plans: CoachPlan[];
  today?: Date;
}): string => {
  const { logs, weightLogs, profile, coachProfile, plans } = args;
  const today = args.today || new Date();
  const lines: string[] = [];

  lines.push(`Today: ${getLocalDateString(today)} (${today.toLocaleDateString('en-US', { weekday: 'long' })})`);

  // --- Body & targets ---
  lines.push('', '## Body and targets');
  if (profile) {
    const body = [
      profile.gender && `sex: ${profile.gender}`,
      profile.age && `age: ${profile.age}`,
      profile.height && `height: ${profile.height} cm`,
      profile.weight && `current weight: ${profile.weight} kg`,
    ].filter(Boolean);
    if (body.length) lines.push(body.join(', '));
    if (profile.targets) {
      const t = profile.targets;
      lines.push(`Daily targets: ${r(t.calories)} kcal, protein ${r(t.protein)} g, carbs ${r(t.carbs)} g, fat ${r(t.fat)} g`);
    }
    if (profile.dynamicTDEE) lines.push(`Estimated TDEE (from logged data): ${r(profile.dynamicTDEE)} kcal`);
    if (profile.goalType) {
      const goal = [`Weight goal: ${profile.goalType}`];
      if (profile.startWeight) goal.push(`from ${profile.startWeight} kg`);
      if (profile.goalWeight) goal.push(`to ${profile.goalWeight} kg`);
      if (profile.goalDate) goal.push(`by ${String(profile.goalDate).slice(0, 10)}`);
      lines.push(goal.join(' '));
    }
  } else {
    lines.push('No body profile set.');
  }

  // --- Intake, last 14 days ---
  const byDay = new Map<string, { calories: number; protein: number; carbs: number; fat: number; items: string[] }>();
  const cutoff = today.getTime() - 14 * DAY_MS;
  for (const log of logs) {
    if (log.timestamp < cutoff) continue;
    const key = getLocalDateString(new Date(log.timestamp));
    const day = byDay.get(key) || { calories: 0, protein: 0, carbs: 0, fat: 0, items: [] };
    day.calories += log.calories || 0;
    day.protein += log.protein || 0;
    day.carbs += log.carbs || 0;
    day.fat += log.fat || 0;
    day.items.push(log.name);
    byDay.set(key, day);
  }

  lines.push('', '## Food intake, last 14 days (days not listed have nothing logged)');
  const todayKey = getLocalDateString(today);
  const dayKeys: string[] = [];
  for (let i = 13; i >= 0; i--) dayKeys.push(getLocalDateString(new Date(today.getTime() - i * DAY_MS)));
  const logged = dayKeys.filter(k => byDay.has(k));
  if (logged.length === 0) {
    lines.push('No food logged in this period.');
  } else {
    for (const k of logged) {
      const d = byDay.get(k)!;
      const note = k === todayKey ? ' (today, may be incomplete)' : '';
      lines.push(`${k}: ${r(d.calories)} kcal, P ${r(d.protein)} g, C ${r(d.carbs)} g, F ${r(d.fat)} g, ${d.items.length} items${note}`);
    }
    const complete = logged.filter(k => k !== todayKey);
    if (complete.length > 0) {
      const sum = complete.reduce(
        (a, k) => {
          const d = byDay.get(k)!;
          return { calories: a.calories + d.calories, protein: a.protein + d.protein, carbs: a.carbs + d.carbs, fat: a.fat + d.fat };
        },
        { calories: 0, protein: 0, carbs: 0, fat: 0 }
      );
      const n = complete.length;
      lines.push(`Average over ${n} logged day(s) before today: ${r(sum.calories / n)} kcal, P ${r(sum.protein / n)} g, C ${r(sum.carbs / n)} g, F ${r(sum.fat / n)} g`);
    }
    // Foods from the 3 most recent logged days, so suggestions can build on what the user actually eats
    lines.push('', 'Foods logged on the most recent days:');
    for (const k of logged.slice(-3)) {
      const items = Array.from(new Set(byDay.get(k)!.items)).slice(0, 25);
      lines.push(`${k}: ${items.join('; ')}`);
    }
  }

  // --- Weight ---
  lines.push('', '## Weight entries, last 30 days (kg)');
  const recentWeights = weightLogs
    .filter(w => w.timestamp >= today.getTime() - 30 * DAY_MS)
    .sort((a, b) => a.timestamp - b.timestamp);
  if (recentWeights.length === 0) {
    lines.push('No weight entries in this period.');
  } else {
    lines.push(recentWeights.slice(-20).map(w => `${getLocalDateString(new Date(w.timestamp))}: ${w.weight}`).join(', '));
    if (recentWeights.length >= 2) {
      const first = recentWeights[0];
      const last = recentWeights[recentWeights.length - 1];
      const days = Math.max(1, daysBetween(new Date(first.timestamp), new Date(last.timestamp)));
      const change = last.weight - first.weight;
      lines.push(`Change: ${change >= 0 ? '+' : ''}${change.toFixed(1)} kg over ${days} day(s)`);
    }
  }

  // --- Situation ---
  lines.push('', "## The user's situation (their own words)");
  const cp = coachProfile;
  const fields: [string, string | null | undefined][] = [
    ['Goals', cp?.goals],
    ['Training schedule', cp?.trainingSchedule],
    ['Experience', cp?.experience],
    ['Injuries / limitations', cp?.injuries],
    ['Food preferences', cp?.foodPreferences],
    ['Other notes', cp?.notes],
  ];
  const filled = fields.filter(([, v]) => v && v.trim());
  if (filled.length === 0) lines.push('Not filled in yet. Ask what you need to know.');
  for (const [label, value] of filled) lines.push(`${label}: ${value!.trim()}`);

  // --- Training phase ---
  lines.push('', '## Training phase');
  if (cp?.trainingPhase) {
    let phase = `Current phase: ${cp.trainingPhase}`;
    if (cp.phaseStart) {
      const week = Math.floor(daysBetween(parseLocalDate(cp.phaseStart), today) / 7) + 1;
      phase += `, started ${cp.phaseStart}${week >= 1 ? ` (week ${week})` : ' (not started yet)'}`;
    }
    if (cp.phaseEnd) {
      const left = daysBetween(today, parseLocalDate(cp.phaseEnd));
      phase += `, planned end ${cp.phaseEnd}${left >= 0 ? ` (${left} day(s) left)` : ' (end date has passed)'}`;
    }
    lines.push(phase);
  } else {
    lines.push('No phase set.');
  }

  // --- Cycle ---
  lines.push('', '## Menstrual cycle');
  const cycle = estimateCycle(cp, today);
  if (!cp?.trackCycle) {
    lines.push('Not tracked. Do not bring it up unless the user does.');
  } else if (!cycle) {
    lines.push('Tracking is on but no last period date is set.');
  } else {
    lines.push(
      `Estimated: day ${cycle.day} of a ~${cycle.length}-day cycle, ${cycle.phase} phase (calendar estimate from last period start ${cp.lastPeriodStart}).` +
        (cycle.stale ? ' The last period date is old, so this estimate is unreliable; ask the user to update it.' : '')
    );
  }

  // --- Plans ---
  lines.push('', '## Active plans');
  const active = plans.filter(p => p.status === 'active');
  if (active.length === 0) lines.push('None.');
  for (const p of active.slice(0, 5)) {
    lines.push(`### ${p.title} (id: ${p.id}, type: ${p.type}, updated ${p.updatedAt.slice(0, 10)})`);
    lines.push(p.content.length > 3000 ? p.content.slice(0, 3000) + '\n[plan truncated]' : p.content);
  }

  return lines.join('\n');
};
