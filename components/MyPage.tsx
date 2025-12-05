
import React, { useState } from 'react';
import { UserProfile, MyTab, WeightLog } from '../types';
import Calculator from './Calculator';
import WeightTrend from './WeightTrend';

interface MyPageProps {
  weightLogs: WeightLog[];
  userProfile: UserProfile;
  onUpdateProfile: (p: UserProfile) => void;
}

const MyPage: React.FC<MyPageProps> = ({ weightLogs, userProfile, onUpdateProfile }) => {
  const [activeTab, setActiveTab] = useState<MyTab>('trends');

  const getTabClass = (tab: MyTab, activeColor: string) => `
    flex-1 flex items-center justify-center px-1 py-4 
    font-black uppercase text-xs tracking-widest border-3 border-secondary transition-all
    ${activeTab === tab ? `${activeColor} text-secondary shadow-[2px_2px_0px_white] -translate-y-1` : 'bg-secondary text-gray-400 border-gray-600 hover:bg-gray-800'}
  `;

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
      </div>

      <div className="flex-1 overflow-hidden relative bg-background">
        {activeTab === 'trends' && (
           <WeightTrend logs={weightLogs} />
        )}
        {activeTab === 'calculator' && (
           <Calculator 
             currentProfile={userProfile} 
             onSaveProfile={(p) => {
               onUpdateProfile(p);
             }}
           />
        )}
      </div>
    </div>
  );
};

export default MyPage;
