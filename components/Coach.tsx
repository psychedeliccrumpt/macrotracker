import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Send, Loader2, MessageCircle, ClipboardList, UserCog, Trash2, Archive, ArchiveRestore, ChevronDown, ChevronUp, Dumbbell, Utensils, FileText, Database } from 'lucide-react';
import { CoachMessage, CoachPlan, CoachProfile, FoodItem, TrainingPhase, UserProfile, WeightLog } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { coachService, CoachSetupError } from '../services/coachService';
import { buildCoachContext, estimateCycle } from '../services/coachContext';
import Markdown from './Markdown';

interface CoachProps {
  logs: FoodItem[];
  weightLogs: WeightLog[];
  profile: UserProfile | null;
}

type CoachTab = 'chat' | 'plans' | 'profile';

const STARTERS = [
  'How did my eating look this week compared with my targets?',
  'Build me a weekly workout plan for my goals.',
  'Suggest meals that fill the gaps in my macros.',
  'How should I adjust training and food for where I am in my cycle?',
];

const PHASES: { value: TrainingPhase; label: string }[] = [
  { value: 'cut', label: 'Cut' },
  { value: 'bulk', label: 'Bulk' },
  { value: 'maintenance', label: 'Maintain' },
  { value: 'deload', label: 'Deload' },
];

const planIcon = (type: CoachPlan['type']) =>
  type === 'workout' ? <Dumbbell size={16} strokeWidth={3} /> : type === 'meal' ? <Utensils size={16} strokeWidth={3} /> : <FileText size={16} strokeWidth={3} />;

const inputCls = 'w-full p-3 border-3 border-secondary bg-white font-bold text-sm text-secondary placeholder:text-gray-300 focus:bg-highlight outline-none';
const labelCls = 'block text-[10px] font-black uppercase tracking-widest text-secondary mb-1';

const Coach: React.FC<CoachProps> = ({ logs, weightLogs, profile }) => {
  const { user } = useAuth();
  const [tab, setTab] = useState<CoachTab>('chat');
  const [loading, setLoading] = useState(true);
  const [setupNeeded, setSetupNeeded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [messages, setMessages] = useState<CoachMessage[]>([]);
  const [plans, setPlans] = useState<CoachPlan[]>([]);
  const [coachProfile, setCoachProfile] = useState<CoachProfile | null>(null);

  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [showContext, setShowContext] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const [form, setForm] = useState<Partial<CoachProfile>>({});
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);
  const [openPlanId, setOpenPlanId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [m, p, cp] = await Promise.all([
          coachService.getMessages(user.id),
          coachService.getPlans(user.id),
          coachService.getProfile(user.id),
        ]);
        if (cancelled) return;
        setMessages(m);
        setPlans(p);
        setCoachProfile(cp);
        setForm(cp || {});
      } catch (err: any) {
        if (cancelled) return;
        if (err instanceof CoachSetupError) setSetupNeeded(true);
        else setLoadError(err?.message || 'Could not load the coach.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user]);

  useEffect(() => {
    if (tab === 'chat' && scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, sending, tab]);

  // The exact snapshot of data sent to the AI with each message
  const context = useMemo(
    () => buildCoachContext({ logs, weightLogs, profile, coachProfile, plans }),
    [logs, weightLogs, profile, coachProfile, plans]
  );

  const cycle = useMemo(() => estimateCycle({ ...(coachProfile || { userId: '' }), ...form } as CoachProfile), [coachProfile, form]);

  const send = async (text: string) => {
    const message = text.trim();
    if (!message || sending || !user) return;
    setChatError(null);
    setSending(true);
    setDraft('');
    const history = messages;
    try {
      const userMsg = await coachService.addMessage(user.id, 'user', message);
      setMessages(prev => [...prev, userMsg]);

      const result = await coachService.ask(message, context, history);

      let reply = result.reply;
      const saved: CoachPlan[] = [];
      for (const d of result.plans || []) {
        try {
          saved.push(await coachService.savePlanDraft(user.id, d, plans));
        } catch (e: any) {
          reply += `\n\n**Could not save the plan "${d.title}":** ${e?.message || 'unknown error'}`;
        }
      }
      if (saved.length > 0) {
        setPlans(prev => [...saved, ...prev.filter(p => !saved.some(s => s.id === p.id))]);
        reply += `\n\n**Saved to Plans:** ${saved.map(s => s.title).join(', ')}`;
      }

      const aiMsg = await coachService.addMessage(user.id, 'assistant', reply);
      setMessages(prev => [...prev, aiMsg]);
    } catch (err: any) {
      setChatError(err?.message || 'The coach could not reply. Please try again.');
      setDraft(prev => prev || message);
    } finally {
      setSending(false);
    }
  };

  const clearChat = async () => {
    if (!user || !confirm('Delete the whole conversation? Your plans and profile are kept.')) return;
    try {
      await coachService.clearMessages(user.id);
      setMessages([]);
    } catch (err: any) {
      setChatError(err?.message || 'Could not clear the chat.');
    }
  };

  const saveProfile = async () => {
    if (!user) return;
    setSavingProfile(true);
    setProfileSaved(false);
    try {
      const clean = (v?: string | null) => (v && v.trim() ? v.trim() : null);
      const saved = await coachService.saveProfile(user.id, {
        goals: clean(form.goals),
        trainingSchedule: clean(form.trainingSchedule),
        experience: clean(form.experience),
        injuries: clean(form.injuries),
        foodPreferences: clean(form.foodPreferences),
        notes: clean(form.notes),
        trainingPhase: form.trainingPhase || null,
        phaseStart: form.phaseStart || null,
        phaseEnd: form.phaseEnd || null,
        trackCycle: !!form.trackCycle,
        lastPeriodStart: form.trackCycle ? form.lastPeriodStart || null : null,
        cycleLength: form.trackCycle ? Number(form.cycleLength) || 28 : null,
      });
      setCoachProfile(saved);
      setForm(saved);
      setProfileSaved(true);
    } catch (err: any) {
      alert(`Could not save: ${err?.message || 'unknown error'}`);
    } finally {
      setSavingProfile(false);
    }
  };

  const togglePlanStatus = async (plan: CoachPlan) => {
    if (!user) return;
    const status = plan.status === 'active' ? 'archived' : 'active';
    setPlans(prev => prev.map(p => (p.id === plan.id ? { ...p, status } : p)));
    try {
      await coachService.setPlanStatus(user.id, plan.id, status);
    } catch (err: any) {
      setPlans(prev => prev.map(p => (p.id === plan.id ? plan : p)));
      alert(`Could not update the plan: ${err?.message || 'unknown error'}`);
    }
  };

  const deletePlan = async (plan: CoachPlan) => {
    if (!user || !confirm(`Delete the plan "${plan.title}"? This cannot be undone.`)) return;
    try {
      await coachService.deletePlan(user.id, plan.id);
      setPlans(prev => prev.filter(p => p.id !== plan.id));
    } catch (err: any) {
      alert(`Could not delete the plan: ${err?.message || 'unknown error'}`);
    }
  };

  const set = <K extends keyof CoachProfile>(key: K, value: CoachProfile[K]) => {
    setProfileSaved(false);
    setForm(prev => ({ ...prev, [key]: value }));
  };

  // ---------- Render ----------

  const header = (
    <div className="p-4 pb-0 bg-surface border-b-3 border-secondary">
      <div className="flex items-end justify-between mb-3">
        <h1 className="text-3xl font-black uppercase tracking-tighter text-secondary">Coach</h1>
        {tab === 'chat' && messages.length > 0 && (
          <button onClick={clearChat} className="text-[10px] font-black uppercase tracking-widest text-secondary/50 hover:text-red-600 flex items-center gap-1 mb-1">
            <Trash2 size={12} strokeWidth={3} /> Clear chat
          </button>
        )}
      </div>
      <div role="tablist" className="grid grid-cols-3 border-3 border-b-0 border-secondary">
        {([
          ['chat', 'Chat', <MessageCircle size={14} strokeWidth={3} />],
          ['plans', `Plans${plans.filter(p => p.status === 'active').length ? ` (${plans.filter(p => p.status === 'active').length})` : ''}`, <ClipboardList size={14} strokeWidth={3} />],
          ['profile', 'Profile', <UserCog size={14} strokeWidth={3} />],
        ] as [CoachTab, string, React.ReactNode][]).map(([value, label, icon], i) => (
          <button
            key={value}
            role="tab"
            aria-selected={tab === value}
            onClick={() => setTab(value)}
            className={`flex items-center justify-center gap-1.5 py-2.5 text-xs font-black uppercase tracking-wider transition-colors ${i > 0 ? 'border-l-3 border-secondary' : ''} ${tab === value ? 'bg-secondary text-white' : 'bg-white text-secondary hover:bg-highlight'}`}
          >
            {icon}{label}
          </button>
        ))}
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="flex flex-col h-full bg-background">
        {header}
        <div className="flex-1 flex items-center justify-center"><Loader2 className="animate-spin text-secondary" size={40} /></div>
      </div>
    );
  }

  if (setupNeeded || loadError) {
    return (
      <div className="flex flex-col h-full bg-background">
        {header}
        <div className="p-4">
          <div className="bg-white border-3 border-secondary shadow-neo p-5">
            <p className="font-black uppercase text-secondary text-lg mb-2">{setupNeeded ? 'One-time setup needed' : 'Could not load the coach'}</p>
            {setupNeeded ? (
              <ol className="list-decimal pl-5 space-y-2 text-sm font-bold text-secondary">
                <li>Open your Supabase project and go to <span className="font-black">SQL Editor</span>.</li>
                <li>Paste the contents of <code className="font-mono bg-secondary/10 px-1">update_schema_v5_coach.sql</code> (in the project folder) and press <span className="font-black">Run</span>.</li>
                <li>Come back and reload this page.</li>
              </ol>
            ) : (
              <p className="text-sm font-bold text-secondary">{loadError}</p>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-background">
      {header}

      {/* ---------- CHAT ---------- */}
      {tab === 'chat' && (
        <>
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 && !sending && (
              <div>
                <p className="text-sm font-bold text-secondary mb-1">Ask about your food, training, phases or plans.</p>
                <p className="text-xs font-bold text-gray-500 mb-4">
                  The coach sees your last 14 days of intake, targets, weight trend, profile and active plans with every message.
                  {!coachProfile && ' Fill in the Profile tab so its advice fits your situation.'}
                </p>
                <div className="space-y-2">
                  {STARTERS.filter(s => coachProfile?.trackCycle || !s.includes('cycle')).map(s => (
                    <button key={s} onClick={() => send(s)} className="w-full text-left p-3 bg-white border-3 border-secondary shadow-neo-sm text-sm font-bold text-secondary hover:bg-highlight transition-colors">
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map(m => (
              <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[88%] p-3 border-3 border-secondary text-sm ${m.role === 'user' ? 'bg-secondary text-white font-bold' : 'bg-white text-secondary shadow-neo-sm font-medium'}`}>
                  {m.role === 'user' ? <p className="whitespace-pre-wrap break-words">{m.content}</p> : <Markdown text={m.content} />}
                </div>
              </div>
            ))}

            {sending && (
              <div className="flex justify-start">
                <div className="p-3 border-3 border-secondary bg-white shadow-neo-sm flex items-center gap-2">
                  <Loader2 className="animate-spin text-secondary" size={16} />
                  <span className="text-xs font-black uppercase tracking-widest text-secondary animate-pulse">Thinking...</span>
                </div>
              </div>
            )}

            {chatError && (
              <div className="bg-accent text-secondary p-3 border-3 border-secondary font-bold text-sm flex items-start gap-2">
                <span className="text-xl leading-none">!</span><span>{chatError}</span>
              </div>
            )}
          </div>

          <div className="border-t-3 border-secondary bg-surface p-3">
            <button onClick={() => setShowContext(v => !v)} className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-secondary/50 hover:text-secondary mb-2">
              <Database size={11} strokeWidth={3} /> Data shared with the coach {showContext ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </button>
            {showContext && (
              <pre className="mb-2 max-h-40 overflow-y-auto p-2 border-2 border-secondary/30 bg-white text-[10px] font-mono text-secondary whitespace-pre-wrap">{context}</pre>
            )}
            <form onSubmit={e => { e.preventDefault(); send(draft); }} className="flex items-end gap-2">
              <textarea
                value={draft}
                onChange={e => setDraft(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send(draft); } }}
                rows={Math.min(4, Math.max(1, draft.split('\n').length))}
                maxLength={4000}
                placeholder="Message your coach..."
                className="flex-1 p-3 border-3 border-secondary bg-white font-bold text-sm text-secondary placeholder:text-gray-300 focus:bg-highlight outline-none resize-none"
              />
              <button type="submit" disabled={sending || !draft.trim()} aria-label="Send" className="h-[46px] px-4 bg-secondary text-white border-3 border-secondary disabled:opacity-40 hover:bg-primary transition-colors">
                {sending ? <Loader2 className="animate-spin" size={20} /> : <Send size={20} strokeWidth={3} />}
              </button>
            </form>
            <p className="text-[9px] font-bold text-gray-400 mt-2 text-center uppercase tracking-wider">General coaching, not medical advice</p>
          </div>
        </>
      )}

      {/* ---------- PLANS ---------- */}
      {tab === 'plans' && (
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {plans.length === 0 ? (
            <div className="text-center border-3 border-secondary bg-white shadow-neo p-8">
              <ClipboardList size={40} className="mx-auto mb-3 text-secondary" strokeWidth={1.5} />
              <p className="font-black uppercase tracking-widest text-secondary text-sm">No plans yet</p>
              <p className="text-xs font-bold text-gray-500 mt-2">Ask the coach for a workout or meal plan and it will be saved here.</p>
              <button onClick={() => setTab('chat')} className="mt-4 px-4 py-2 bg-highlight border-3 border-secondary font-black uppercase text-xs text-secondary shadow-neo-sm">Go to chat</button>
            </div>
          ) : (
            [...plans].sort((a, b) => (a.status === b.status ? 0 : a.status === 'active' ? -1 : 1)).map(plan => {
              const open = openPlanId === plan.id;
              return (
                <div key={plan.id} className={`border-3 border-secondary bg-white ${plan.status === 'active' ? 'shadow-neo-sm' : 'opacity-60'}`}>
                  <button onClick={() => setOpenPlanId(open ? null : plan.id)} className="w-full p-4 text-left flex items-start gap-3">
                    <span className="mt-0.5 text-secondary">{planIcon(plan.type)}</span>
                    <span className="flex-1 min-w-0">
                      <span className="block font-black uppercase text-secondary">{plan.title}</span>
                      <span className="block text-[10px] font-bold uppercase tracking-widest text-gray-500 mt-1">
                        {plan.type} · {plan.status} · updated {new Date(plan.updatedAt).toLocaleDateString()}
                      </span>
                    </span>
                    {open ? <ChevronUp size={18} strokeWidth={3} /> : <ChevronDown size={18} strokeWidth={3} />}
                  </button>
                  {open && (
                    <div className="px-4 pb-4 border-t-2 border-secondary/20 pt-3">
                      <Markdown text={plan.content} className="text-sm text-secondary font-medium" />
                      <div className="flex gap-2 mt-4">
                        <button onClick={() => togglePlanStatus(plan)} className="flex-1 py-2 border-2 border-secondary bg-white font-black uppercase text-xs text-secondary hover:bg-highlight flex items-center justify-center gap-1.5">
                          {plan.status === 'active' ? <><Archive size={14} strokeWidth={3} /> Archive</> : <><ArchiveRestore size={14} strokeWidth={3} /> Make active</>}
                        </button>
                        <button onClick={() => deletePlan(plan)} className="px-3 py-2 border-2 border-secondary bg-white text-secondary hover:bg-red-100 hover:text-red-600" aria-label="Delete plan">
                          <Trash2 size={14} strokeWidth={3} />
                        </button>
                      </div>
                      <p className="text-[10px] font-bold text-gray-400 mt-2">Active plans are shared with the coach. To change one, ask in chat.</p>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ---------- PROFILE ---------- */}
      {tab === 'profile' && (
        <div className="flex-1 overflow-y-auto p-4 space-y-5 pb-8">
          <p className="text-xs font-bold text-gray-500">Everything here is optional and is shared with the coach on every message.</p>

          <div>
            <label className={labelCls}>Goals</label>
            <textarea rows={2} className={inputCls} value={form.goals || ''} onChange={e => set('goals', e.target.value)} placeholder="e.g. lose 3 kg of fat, first pull-up, run a 10k" />
          </div>
          <div>
            <label className={labelCls}>Training schedule & equipment</label>
            <textarea rows={2} className={inputCls} value={form.trainingSchedule || ''} onChange={e => set('trainingSchedule', e.target.value)} placeholder="e.g. gym Mon/Wed/Fri, 60 min, full gym; yoga on Sunday" />
          </div>
          <div>
            <label className={labelCls}>Experience</label>
            <textarea rows={1} className={inputCls} value={form.experience || ''} onChange={e => set('experience', e.target.value)} placeholder="e.g. lifting for 1 year, new to running" />
          </div>
          <div>
            <label className={labelCls}>Injuries or limitations</label>
            <textarea rows={1} className={inputCls} value={form.injuries || ''} onChange={e => set('injuries', e.target.value)} placeholder="e.g. sore left knee on deep squats" />
          </div>
          <div>
            <label className={labelCls}>Food preferences</label>
            <textarea rows={2} className={inputCls} value={form.foodPreferences || ''} onChange={e => set('foodPreferences', e.target.value)} placeholder="e.g. mostly cook at home, no seafood, quick breakfasts" />
          </div>
          <div>
            <label className={labelCls}>Anything else</label>
            <textarea rows={2} className={inputCls} value={form.notes || ''} onChange={e => set('notes', e.target.value)} placeholder="Schedule, sleep, stress, what has or hasn't worked before" />
          </div>

          <div className="border-3 border-secondary bg-white p-4 shadow-neo-sm">
            <p className="font-black uppercase text-secondary text-sm mb-3">Training phase</p>
            <div className="grid grid-cols-4 border-3 border-secondary mb-3">
              {PHASES.map((p, i) => (
                <button key={p.value} type="button" onClick={() => set('trainingPhase', form.trainingPhase === p.value ? null : p.value)}
                  className={`py-2 text-[11px] font-black uppercase ${i > 0 ? 'border-l-3 border-secondary' : ''} ${form.trainingPhase === p.value ? 'bg-secondary text-white' : 'bg-white text-secondary hover:bg-highlight'}`}>
                  {p.label}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Start</label>
                <input type="date" className={inputCls} value={form.phaseStart || ''} onChange={e => set('phaseStart', e.target.value || null)} />
              </div>
              <div>
                <label className={labelCls}>Planned end</label>
                <input type="date" className={inputCls} value={form.phaseEnd || ''} onChange={e => set('phaseEnd', e.target.value || null)} />
              </div>
            </div>
          </div>

          <div className="border-3 border-secondary bg-white p-4 shadow-neo-sm">
            <label className="flex items-center justify-between cursor-pointer">
              <span className="font-black uppercase text-secondary text-sm">Track menstrual cycle</span>
              <input type="checkbox" className="w-5 h-5 accent-[#0f172a]" checked={!!form.trackCycle} onChange={e => set('trackCycle', e.target.checked)} />
            </label>
            {form.trackCycle && (
              <div className="mt-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Last period started</label>
                    <input type="date" className={inputCls} value={form.lastPeriodStart || ''} onChange={e => set('lastPeriodStart', e.target.value || null)} />
                  </div>
                  <div>
                    <label className={labelCls}>Cycle length (days)</label>
                    <input type="number" min={20} max={45} className={inputCls} value={form.cycleLength ?? 28} onChange={e => set('cycleLength', e.target.value ? Number(e.target.value) : null)} />
                  </div>
                </div>
                {cycle && (
                  <p className="text-xs font-bold text-secondary mt-3 bg-highlight border-2 border-secondary px-2 py-1 inline-block">
                    Estimate: day {cycle.day}, {cycle.phase} phase{cycle.stale ? ' (date looks old, please update)' : ''}
                  </p>
                )}
                <p className="text-[10px] font-bold text-gray-400 mt-2">A calendar estimate only. Update the date when your next period starts.</p>
              </div>
            )}
          </div>

          <button onClick={saveProfile} disabled={savingProfile} className="w-full py-4 bg-primary text-white font-black uppercase text-lg border-3 border-secondary shadow-neo active:shadow-none active:translate-x-[4px] active:translate-y-[4px] transition-all disabled:opacity-50 flex justify-center gap-2">
            {savingProfile ? <Loader2 className="animate-spin" /> : profileSaved ? 'Saved' : 'Save profile'}
          </button>
        </div>
      )}
    </div>
  );
};

export default Coach;
