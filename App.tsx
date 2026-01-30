
import React, { useState, useEffect } from 'react';
import { Calendar as CalendarIcon, LayoutGrid, CircleUser, NotebookPen } from 'lucide-react';
import { AppView, FoodItem, Recipe, SearchResult, Macros, UserProfile, WeightLog } from './types';
import Scanner from './components/Scanner';
import Search from './components/Search';
import RecipeBuilder from './components/RecipeBuilder';
import EditorModal from './components/EditorModal';
import MyPage from './components/MyPage';
import QuickAddModal from './components/QuickAddModal';
import WeightLogModal from './components/WeightLogModal';
import Dashboard from './components/Dashboard';
import FoodLogHub from './components/FoodLogHub';
import Calendar from './components/Calendar';

const App: React.FC = () => {
  const [view, setView] = useState<AppView>('dashboard');

  // Load Logs from LocalStorage
  const [logs, setLogs] = useState<FoodItem[]>(() => {
    try {
      const saved = localStorage.getItem('macro_logs');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      console.error("Failed to load logs", e);
      return [];
    }
  });

  // Load Weight Logs sfgdfgdzsdvsfvs
  const [weightLogs, setWeightLogs] = useState<WeightLog[]>(() => {
    try {
      const saved = localStorage.getItem('macro_weight_logs');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

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
  const [editingItem, setEditingItem] = useState<FoodItem | null>(null);
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [showWeightLog, setShowWeightLog] = useState(false);

  // Load User Profile from LocalStorage
  const [userProfile, setUserProfile] = useState<UserProfile>(() => {
    try {
      const saved = localStorage.getItem('macro_profile');
      return saved ? JSON.parse(saved) : {
        gender: 'male',
        age: 25,
        height: 175,
        weight: 70,
        activity: 1.55,
        targets: {
          calories: 2200,
          protein: 150,
          carbs: 250,
          fat: 70
        }
      };
    } catch (e) {
      console.error("Failed to load profile", e);
      return {
        gender: 'male',
        age: 25,
        height: 175,
        weight: 70,
        activity: 1.55,
        targets: {
          calories: 2200,
          protein: 150,
          carbs: 250,
          fat: 70
        }
      };
    }
  });

  // Persistence Effects
  useEffect(() => {
    localStorage.setItem('macro_logs', JSON.stringify(logs));
  }, [logs]);

  useEffect(() => {
    localStorage.setItem('macro_weight_logs', JSON.stringify(weightLogs));
  }, [weightLogs]);

  useEffect(() => {
    localStorage.setItem('macro_recipes', JSON.stringify(recipes));
  }, [recipes]);

  useEffect(() => {
    localStorage.setItem('macro_profile', JSON.stringify(userProfile));
  }, [userProfile]);

  const generateId = () => Math.random().toString(36).substring(2, 9);

  const addLog = (data: Omit<FoodItem, 'id' | 'timestamp'>) => {
    const newItem: FoodItem = {
      ...data,
      id: generateId(),
      timestamp: Date.now(),
    };
    setLogs(prev => [...prev, newItem]);
    setTempScanResult(null);
    setView('dashboard'); // Redirect to dashboard after logging
  };

  const addWeightLog = (weight: number) => {
    const newLog: WeightLog = {
      id: generateId(),
      weight: weight,
      timestamp: Date.now()
    };
    setWeightLogs(prev => [...prev, newLog]);

    // Also update current profile weight
    setUserProfile(prev => ({
      ...prev,
      weight: weight
    }));

    setShowWeightLog(false);
    setView('my'); // Redirect to My page to see trend
  };

  const updateLog = (updatedData: Omit<FoodItem, 'id' | 'timestamp'>) => {
    if (!editingItem) return;

    setLogs(prev => prev.map(item =>
      item.id === editingItem.id
        ? { ...item, ...updatedData }
        : item
    ));
    setEditingItem(null);
  };

  const deleteLog = (id: string) => {
    setLogs(logs.filter(item => item.id !== id));
  };

  const saveRecipe = (name: string, ingredients: FoodItem[], totalMacros: Macros) => {
    const newRecipe: Recipe = {
      id: generateId(),
      name,
      ingredients,
      totalMacros,
    };
    setRecipes([...recipes, newRecipe]);
  };

  const renderContent = () => {
    switch (view) {
      case 'dashboard':
        return <Dashboard
          logs={logs}
          targets={userProfile.targets}
          onDeleteLog={deleteLog}
          onEditLog={(item) => setEditingItem(item)}
        />;
      case 'log':
        return <FoodLogHub
          onQuickAdd={() => setShowQuickAdd(true)}
          onSearch={() => setView('search')}
          onRecipe={() => setView('recipe')}
          onLogWeight={() => setShowWeightLog(true)}
          onScan={() => setView('scan')}
        />;
      case 'scan':
        return <Scanner
          onScanComplete={(result) => {
            setTempScanResult(result);
            setView('dashboard');
          }}
          onClose={() => setView('log')}
        />;
      case 'calendar':
        return <Calendar
          logs={logs}
          weightLogs={weightLogs}
          onSelectDate={(date) => { }}
        />;
      case 'my':
        return <MyPage
          weightLogs={weightLogs}
          userProfile={userProfile}
          onUpdateProfile={setUserProfile}
        />;
      case 'search':
        return <Search
          onSelect={(result) => {
            setTempScanResult(result);
            setView('dashboard');
          }}
          onBack={() => setView('log')}
        />;
      case 'recipe':
        return <RecipeBuilder
          savedRecipes={recipes}
          onSaveRecipe={saveRecipe}
          onLogRecipe={(r) => {
            addLog({
              name: r.name,
              ...r.totalMacros,
              quantity: 1,
              unit: 'serving',
              source: 'recipe'
            });
          }}
        />;
      default:
        return <Dashboard
          logs={logs}
          targets={userProfile.targets}
          onDeleteLog={deleteLog}
          onEditLog={(item) => setEditingItem(item)}
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
      {showWeightLog && (
        <WeightLogModal
          onSave={addWeightLog}
          onCancel={() => setShowWeightLog(false)}
        />
      )}

      {/* Standard Bottom Navigation Bar (4 items) */}
      {view !== 'scan' && (
        <div className="h-[80px] bg-white border-t-3 border-secondary grid grid-cols-4 relative z-30 shadow-[0px_-4px_0px_0px_rgba(0,0,0,0.05)]">
          <NavButton active={view === 'dashboard'} onClick={() => setView('dashboard')} icon={LayoutGrid} label="Dash" />
          <NavButton active={view === 'log' || view === 'search' || view === 'recipe'} onClick={() => setView('log')} icon={NotebookPen} label="Log" />
          <NavButton active={view === 'calendar'} onClick={() => setView('calendar')} icon={CalendarIcon} label="Calendar" />
          <NavButton active={view === 'my'} onClick={() => setView('my')} icon={CircleUser} label="My" />
        </div>
      )}
    </div>
  );
};

export default App;
