
import React, { useState, useEffect } from 'react';
import { UserProfile, MyTab, WeightLog } from '../types';
import Calculator from './Calculator';
import WeightTrend from './WeightTrend';
import { useAuth } from '../contexts/AuthContext';
import { userService } from '../services/userService';
import { Loader2, LogOut } from 'lucide-react';
import { supabase } from '../services/supabase';

interface MyPageProps {
  weightLogs: WeightLog[];
  onUpdateProfile?: (profile: UserProfile) => void;
}

const MyPage: React.FC<MyPageProps> = ({ weightLogs, onUpdateProfile }) => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<MyTab>('trends');
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // Load profile from database
  useEffect(() => {
    if (user) {
      loadProfile();
    }
  }, [user]);

  const loadProfile = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const data = await userService.getProfile(user.id);
      if (data) {
        setProfile(data);
        onUpdateProfile?.(data);
      } else {
        // Initialize with default profile and required fields
        const defaultProfile: UserProfile = {
          id: user.id,
          email: user.email || '',
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
        setProfile(defaultProfile);
      }
    } catch (e) {
      console.error('Failed to load profile', e);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProfile = async (updatedProfile: UserProfile) => {
    if (!user) return;
    try {
      await userService.updateProfile(user.id, updatedProfile);
      setProfile(updatedProfile);
      onUpdateProfile?.(updatedProfile);
    } catch (e) {
      console.error('Failed to save profile', e);
      alert('Failed to save profile. Please try again.');
    }
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.error('Logout failed:', e);
    }
  };

  const getTabClass = (tab: MyTab, activeColor: string) => `
    flex-1 flex items-center justify-center px-1 py-4 
    font-black uppercase text-xs tracking-widest border-3 border-secondary transition-all
    ${activeTab === tab ? `${activeColor} text-secondary shadow-[2px_2px_0px_white] -translate-y-1` : 'bg-secondary text-gray-400 border-gray-600 hover:bg-gray-800'}
  `;

  if (loading || !profile) {
    return (
      <div className="flex h-full items-center justify-center bg-background">
        <Loader2 className="animate-spin text-secondary" size={40} />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-background relative">
      {/* Sub-Navigation Header - Neobrutalist */}
      <div className="bg-secondary p-3 border-b-3 border-secondary flex justify-center gap-2">
        <button
          onClick={() => setActiveTab('trends')}
          className={getTabClass('trends', 'bg-primary text-white')}
          style={activeTab === 'trends' ? { color: 'white' } : {}}
        >
          Trends
        </button>
        <button
          onClick={() => setActiveTab('calculator')}
          className={getTabClass('calculator', 'bg-highlight')}
        >
          Settings
        </button>
        <button
          onClick={handleLogout}
          className="flex-1 flex items-center justify-center px-1 py-4 font-black uppercase text-xs tracking-widest border-3 border-secondary bg-red-400 text-white hover:bg-red-500 transition-all hover:-translate-y-1 active:translate-y-0 active:shadow-none"
        >
          <LogOut size={16} className="mr-2" strokeWidth={3} />
          Log Out
        </button>
      </div>

      <div className="flex-1 overflow-hidden relative bg-background">
        {activeTab === 'trends' && (
          <WeightTrend logs={weightLogs} />
        )}
        {activeTab === 'calculator' && (
          <Calculator
            currentProfile={profile}
            onSaveProfile={handleSaveProfile}
          />
        )}
      </div>
    </div>
  );
};

export default MyPage;
