'use client';

import React from 'react';
import { ActiveTab } from '@/types';
import { Kanban, Timer, BarChart2, Settings, Plus } from 'lucide-react';

interface MobileNavigationProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  onOpenNewTaskModal: () => void;
}

export function MobileNavigation({
  activeTab,
  setActiveTab,
  onOpenNewTaskModal,
}: MobileNavigationProps) {
  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#161b22]/95 backdrop-blur-md border-t border-[#30363d] px-2 py-2 pb-5">
      <div className="grid grid-cols-5 items-center w-full max-w-md mx-auto">
        {/* Tab 1: Board */}
        <button
          onClick={() => setActiveTab('board')}
          className={`flex flex-col items-center justify-center py-1 transition ${
            activeTab === 'board' ? 'text-white font-semibold' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Kanban className="w-5 h-5" />
          <span className="text-[11px] mt-1">Board</span>
        </button>

        {/* Tab 2: Focus */}
        <button
          onClick={() => setActiveTab('pomodoro')}
          className={`flex flex-col items-center justify-center py-1 transition ${
            activeTab === 'pomodoro' ? 'text-white font-semibold' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Timer className="w-5 h-5" />
          <span className="text-[11px] mt-1">Focus</span>
        </button>

        {/* Center Tab: Add Task Button */}
        <div className="flex items-center justify-center">
          <button
            onClick={onOpenNewTaskModal}
            className="flex items-center justify-center w-11 h-11 rounded-full bg-white text-slate-950 shadow-md active:scale-95 transition -mt-3"
            aria-label="Add Task"
            title="Create Task"
          >
            <Plus className="w-6 h-6 stroke-[2.5]" />
          </button>
        </div>

        {/* Tab 4: Dashboard */}
        <button
          onClick={() => setActiveTab('analytics')}
          className={`flex flex-col items-center justify-center py-1 transition ${
            activeTab === 'analytics' ? 'text-white font-semibold' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <BarChart2 className="w-5 h-5" />
          <span className="text-[11px] mt-1">Dashboard</span>
        </button>

        {/* Tab 5: Settings */}
        <button
          onClick={() => setActiveTab('settings')}
          className={`flex flex-col items-center justify-center py-1 transition ${
            activeTab === 'settings' ? 'text-white font-semibold' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Settings className="w-5 h-5" />
          <span className="text-[11px] mt-1">Settings</span>
        </button>
      </div>
    </div>
  );
}
