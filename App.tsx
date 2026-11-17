import React, { useState, useEffect, useRef } from 'react'; // v1.1.0 build trigger
import { Calendar as CalendarIcon, LayoutGrid, CircleUser, NotebookPen, MessageCircle, Check } from 'lucide-react';
import { AppView, FoodItem, Recipe, SearchResult, Macros, UserProfile, WeightLog, DayNote } from './types';
import Scanner from './components/Scanner';
import Search from './components/Search';
import RecipeBuilder from './components/RecipeBuilder';
import AILogger from './components/AILogger';
import EditorModal from './components/EditorModal';
import MyPage from './components/MyPage';
import QuickAddModal from './components/QuickAddModal';
import WeightLogModal from './components/WeightLogModal';
import Dashboard from './components/Dashboard';
import FoodLogHub from './components/FoodLogHub';
import Calendar from './components/Calendar';
import Coach from './components/Coach';
import CopyDay from './components/CopyDay';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Auth } from './components/Auth';
import { userService } from './services/userService';
import { logService } from './services/logService';
import { noteService } from './services/noteService';
import { getLocalDateString, parseTimestamp } from './utils/dateUtils';

const AuthenticatedApp: React.FC = () => {
  const { session, loading, user } = useAuth();
  const [view, setView] = useState<AppView>('dashboard');
  const [logsLoading, setLogsLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  // Logs from Database
  const [logs, setLogs] = useState<FoodItem[]>([]);

  // Load Weight Logs sfgdfgdzsdvsfvs
  // Load Weight Logs from Database
  const [weightLogs, setWeightLogs] = useState<WeightLog[]>([]);

  // Day Notes from Database
  const [dayNotes, setDayNotes] = useState<DayNote[]>([]);

  // Load Recipes from LocalStorage
  const [recipes, setRecipes] = useState<Recipe[]>(() => {
    try {
      const saved = localStorage.getItem('macro_recipes');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      console.error("Failed to load recipes", e);
      return [];
    }
  });

  const [tempScanResult, setTempScanResult] = useState<SearchResult | null>(null);
  // Short "Logged" confirmation, since logging no longer jumps to the dashboard
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showToast = (msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2000);
  };
  const [editingItem, setEditingItem] = useState<FoodItem | null>(null);
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [showWeightLog, setShowWeightLog] = useState(false);
  const [editingWeightLog, setEditingWeightLog] = useState<WeightLog | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);


  // Ensure user profile exists in Supabase
  useEffect(() => {
    const ensureProfile = async () => {
      if (user) {
        console.log('Checking profile for user:', user.id);
        try {
          const data = await userService.getProfile(user.id);
          if (!data) {
            console.log('No profile found, creating initial record for:', user.id);
            const initialProfile: UserProfile = {
              id: user.id,
              email: user.email || 'no-email@example.com',
              targets: { calories: 2000, protein: 150, carbs: 200, fat: 70 }
            };
            await userService.updateProfile(user.id, initialProfile);
            setProfile(initialProfile);
            console.log('Profile initialized successfully');
          } else {
            setProfile(data);
          }
        } catch (err: any) {
          console.error('Error ensuring profile exists:', err);
          alert(`Critical: Failed to initialize your user profile. This will prevent saving data. Error: ${err.message}`);
        }
      }
    };
    ensureProfile();
  }, [user]);

  // Load logs on mount or when user changes and reset view to dashboard
  useEffect(() => {
    if (user) {
      loadLogs();
      setView('dashboard'); // Explicitly ensure we start on dashboard
    }
  }, [user]);

  const loadLogs = async () => {
    if (!user) return;
    setLogsLoading(true);
    try {
      const data = await logService.getAll(user.id);
      setLogs(data);

      // Also load weight logs
      const wLogs = await userService.getWeightLogs(user.id);
      setWeightLogs(wLogs.map((item: any) => ({
        id: item.id,
        weight: item.weight,
        timestamp: parseTimestamp(item.date),
        createdAt: item.createdAt
      })));

      // Load Day Notes
      const notes = await noteService.getNotes(user.id);
      setDayNotes(notes);
    } catch (e) {
      console.error('Failed to load logs', e);
    } finally {
      setLogsLoading(false);
    }
  };

  // Removed localStorage effect for weightLogs




  const generateId = () => Math.random().toString(36).substring(2, 9);

  const getEffectiveLogDate = () => {
    const now = new Date();
    if (getLocalDateString(selectedDate) === getLocalDateString(now)) {
      return now;
    }
    return selectedDate;
  };

  const addLog = async (data: Omit<FoodItem, 'timestamp'>) => {
    if (!user) return;
    try {
      const logDate = getEffectiveLogDate();
      const newItem = await logService.create(user.id, { ...data, foodId: data.id }, logDate);
      setLogs(prev => [newItem, ...prev]);
      setTempScanResult(null);
      // Stay on the current page (e.g. search results) and confirm instead
      showToast(`Logged ${data.name}`);
    } catch (e: any) {
      console.error('Failed to add log', e);
      alert(`Failed to save log: ${e.message || 'Unknown error'}`);
    }
  };

  const addLogs = async (items: any[]) => {
    if (!user) return;
    try {
      const logDate = getEffectiveLogDate();
      const newItems = await Promise.all(items.map(item =>
        logService.create(user.id, {
          name: item.name,
          calories: item.macros ? item.macros.calories : item.calories,
          protein: item.macros ? item.macros.protein : item.protein,
          fat: item.macros ? item.macros.fat : item.fat,
          carbs: item.macros ? item.macros.carbs : item.carbs,
          quantity: item.quantity || 1,
          unit: item.unit || 'serving',
          servingSize: item.servingSize,
          brand: item.brand,
          source: 'search'
        }, logDate)
      ));
      setLogs(prev => [...newItems, ...prev]);
      setView('dashboard');
    } catch (e: any) {
      console.error('Failed to add multiple logs', e);
      alert(`Failed to save logs: ${e.message || 'Unknown error'}`);
    }
  };

  const copyLogs = async (items: FoodItem[]) => {
    if (!user) return;
    try {
      const newItems = await logService.createMany(user.id, items, getEffectiveLogDate());
      setLogs(prev => [...newItems, ...prev]);
      showToast(`Logged ${newItems.length} item${newItems.length === 1 ? '' : 's'}`);
      setView('dashboard');
    } catch (e: any) {
      console.error('Failed to copy logs', e);
      alert(`Failed to copy logs: ${e.message || 'Unknown error'}`);
    }
  };

  const addWeightLog = async (weight: number) => {
    if (!user) return;
    try {
      // Use selectedDate if available
      const dbInfo: any = await userService.logWeight(user.id, weight, selectedDate);
      const newLog: WeightLog = {
        id: dbInfo.id,
        weight: dbInfo.weight,
        timestamp: parseTimestamp(dbInfo.date),
        createdAt: dbInfo.createdAt
      };
      setWeightLogs(prev => [newLog, ...prev]);

      setShowWeightLog(false);
      setView('my'); // Redirect to My page to see trend
    } catch (e: any) {
      console.error('Failed to log weight', e);
      alert(`Failed to save weight log: ${e.message}`);
    }
  };

  const updateWeightLog = async (weight: number) => {
    if (!user || !editingWeightLog) return;
    try {
      await userService.updateWeightLog(editingWeightLog.id, weight, user.id);
      setWeightLogs(prev => prev.map(log =>
        log.id === editingWeightLog.id ? { ...log, weight } : log
      ));
      setEditingWeightLog(null);
    } catch (e: any) {
      console.error('Failed to update weight log', e);
      alert(`Failed to update: ${e.message}`);
    }
  };

  const deleteWeightLog = async () => {
    if (!editingWeightLog) return;
    if (!confirm('Delete this weight entry?')) return;
    try {
      setWeightLogs(prev => prev.filter(log => log.id !== editingWeightLog.id));
      await userService.deleteWeightLog(editingWeightLog.id);
      setEditingWeightLog(null);
    } catch (e: any) {
      console.error('Failed to delete weight log', e);
      alert(`Failed to delete: ${e.message}`);
      loadLogs(); // Revert
    }
  };

  const updateLog = async (updatedData: Omit<FoodItem, 'id' | 'timestamp'>) => {
    if (!editingItem) return;

    try {
      await logService.update(editingItem.id, updatedData);
      setLogs(prev => prev.map(item =>
        item.id === editingItem.id
          ? { ...item, ...updatedData }
          : item
      ));
      setEditingItem(null);
    } catch (e: any) {
      console.error('Failed to update log', e);
      alert(`Failed to update log: ${e.message || 'Unknown error'}`);
    }
  };

  const deleteLog = async (id: string) => {
    try {
      // Optimistic update
      setLogs(logs.filter(item => item.id !== id));
      await logService.delete(id);
    } catch (e) {
      console.error('Failed to delete log', e);
      loadLogs(); // Revert on error
    }
  };



  if (loading) {
    return <div className="flex h-screen items-center justify-center">Loading...</div>;
  }

  if (!session) {
    return <Auth />;
  }

  const renderContent = () => {
    switch (view) {
      case 'dashboard':
        return <Dashboard
          logs={logs}
          targets={profile?.targets || {
            calories: 2200,
            protein: 150,
            carbs: 250,
            fat: 70
          }}
          onDeleteLog={deleteLog}
          onEditLog={(item) => setEditingItem(item)}
          selectedDate={selectedDate || new Date()}
          onDateClick={() => setView('calendar')}
        />;
      case 'log':
        return <FoodLogHub
          onQuickAdd={() => setShowQuickAdd(true)}
          onSearch={() => setView('search')}
          onRecipe={() => setView('recipe')}
          onLogWeight={() => setShowWeightLog(true)}
          onScan={() => setView('scan')}
          onAI={() => setView('ai-log')}
          onCopyDay={() => setView('copy-day')}
        />;
      case 'copy-day':
        return <CopyDay
          logs={logs}
          targetDate={selectedDate}
          onBack={() => setView('log')}
          onCopy={copyLogs}
        />;
      case 'ai-log':
        return <AILogger
          onBack={() => setView('log')}
          onLogItems={addLogs}
        />;
      case 'scan':
        return <Scanner
          onScanComplete={(result) => {
            setTempScanResult(result);
            setView('dashboard');
          }}
          onClose={() => setView('log')}
        />;
      case 'coach':
        return <Coach logs={logs} weightLogs={weightLogs} profile={profile} />;
      case 'calendar':
        return <Calendar
          logs={logs}
          weightLogs={weightLogs}
          dayNotes={dayNotes}
          onSaveNote={async (date, content) => {
            if (!user) return;
            const updatedNote = await noteService.saveNote(user.id, date, content);
            setDayNotes(prev => {
              const filtered = prev.filter(n => n.date !== date);
              return [...filtered, updatedNote];
            });
          }}
          onSelectDate={(dateStr) => {
            // Parse local date string YYYY-MM-DD back to local Date object
            const [y, m, d] = dateStr.split('-').map(Number);
            setSelectedDate(new Date(y, m - 1, d));
          }}
          selectedDate={selectedDate} // Pass current selected date to highlight
        />;
      case 'my':
        return <MyPage
          weightLogs={weightLogs}
          logs={logs}
          onUpdateProfile={setProfile}
          onEditWeightLog={(log) => setEditingWeightLog(log)}
        />;
      case 'search':
        return <Search
          onSelect={(result) => {
            // Keep Search mounted behind the editor: closing the editor returns
            // to the same results; logging still goes to the dashboard (addLog).
            setTempScanResult(result);
          }}
          onBack={() => setView('log')}
        />;
      case 'recipe':
        return <RecipeBuilder
          // savedRecipes prop is removed, component fetches its own data
          onLogRecipe={(r) => {
            // totalMacros is the whole recipe: log one serving's worth and let
            // the editor scale it (same as picking the recipe from Search).
            const servings = r.servings > 0 ? r.servings : 1;
            setTempScanResult({
              name: r.name,
              macros: {
                calories: r.totalMacros.calories / servings,
                protein: r.totalMacros.protein / servings,
                fat: r.totalMacros.fat / servings,
                carbs: r.totalMacros.carbs / servings,
              },
              servingSize: `1 serving (of ${servings})`,
              quantity: 1,
              unit: 'serving',
              brand: 'My Recipe',
              source: 'recipe',
            });
          }}
        />;
      default:
        return <Dashboard
          logs={logs}
          profile={profile}
          targets={profile?.targets || {
            calories: 2200,
            protein: 165,
            carbs: 275,
            fat: 49
          }}
          onDeleteLog={deleteLog}
          onEditLog={(item) => setEditingItem(item)}
          onNavigateToGoals={() => {
            setView('my');
            localStorage.setItem('my_page_tab', 'calculator');
          }}
          selectedDate={selectedDate || new Date()}
          onDateClick={() => setView('calendar')}
        />;
    }
  };

  const NavButton = ({ active, onClick, icon: Icon, label }: { active: boolean, onClick: () => void, icon: any, label: string }) => (
    <button
      onClick={onClick}
      className={`flex flex-col items-center justify-center gap-1 w-full h-full transition-all duration-200 border-l-3 border-secondary first:border-l-0 ${active
        ? 'bg-highlight text-secondary shadow-[inset_0_0_20px_rgba(0,0,0,0.1)]'
        : 'bg-white text-gray-500 hover:bg-gray-50'
        }`}
    >
      <Icon size={22} strokeWidth={active ? 3 : 2} className={active ? "scale-110 transition-transform" : ""} />
      <span className="text-[10px] font-black uppercase tracking-widest">{label}</span>
    </button>
  );

  return (
    <div className="h-screen w-full bg-background flex flex-col font-sans max-w-md mx-auto border-x-3 border-secondary relative overflow-hidden shadow-2xl">
      {/* Main Content Area */}
      <div className="flex-1 overflow-hidden relative bg-background">
        {renderContent()}
      </div>

      {/* Global Editor Modal */}
      {(tempScanResult || editingItem) && (
        <EditorModal
          initialData={editingItem || tempScanResult!}
          onSave={editingItem ? updateLog : addLog}
          onCancel={() => {
            setTempScanResult(null);
            setEditingItem(null);
          }}
        />
      )}

      {/* Logged confirmation */}
      {toast && (
        <div
          role="status"
          className="absolute left-4 right-4 bottom-[96px] z-40 flex items-center gap-2 px-4 py-3 bg-secondary text-white border-3 border-secondary shadow-neo font-black uppercase text-sm tracking-wide pointer-events-none"
        >
          <Check size={18} strokeWidth={4} className="shrink-0" />
          <span className="truncate">{toast}</span>
        </div>
      )}

      {/* Global Quick Add Modal */}
      {showQuickAdd && (
        <QuickAddModal
          onSave={(item) => {
            addLog(item);
            setShowQuickAdd(false);
          }}
          onCancel={() => setShowQuickAdd(false)}
        />
      )}

      {/* Global Weight Log Modal */}
      {(showWeightLog || editingWeightLog) && (
        <WeightLogModal
          onSave={editingWeightLog ? updateWeightLog : addWeightLog}
          onCancel={() => { setShowWeightLog(false); setEditingWeightLog(null); }}
          onDelete={editingWeightLog ? deleteWeightLog : undefined}
          initialWeight={editingWeightLog?.weight}
          isEditing={!!editingWeightLog}
        />
      )}

      {/* Standard Bottom Navigation Bar (5 items) */}
      {view !== 'scan' && (
        <div className="h-[80px] bg-white border-t-3 border-secondary grid grid-cols-5 relative z-30 shadow-[0px_-4px_0px_0px_rgba(0,0,0,0.05)]">
          <NavButton active={view === 'dashboard'} onClick={() => setView('dashboard')} icon={LayoutGrid} label="Dash" />
          <NavButton active={view === 'log' || view === 'search' || view === 'recipe' || view === 'copy-day'} onClick={() => setView('log')} icon={NotebookPen} label="Log" />
          <NavButton active={view === 'coach'} onClick={() => setView('coach')} icon={MessageCircle} label="Coach" />
          <NavButton active={view === 'calendar'} onClick={() => setView('calendar')} icon={CalendarIcon} label="History" />
          <NavButton active={view === 'my'} onClick={() => setView('my')} icon={CircleUser} label="My" />
        </div>
      )}
    </div>
  );
};

const App: React.FC = () => {
  return (
    <AuthProvider>
      <AuthenticatedApp />
    </AuthProvider>
  );
};

export default App;
