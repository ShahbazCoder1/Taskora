'use client';

import React from 'react';
import { ActiveTab, NotificationItem } from '@/types';
import { Kanban, Timer, BarChart2, Settings, Plus, Bell, WifiOff } from 'lucide-react';

interface HeaderProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  onOpenNewTaskModal: () => void;
  isOffline: boolean;
  notifications: NotificationItem[];
  onToggleNotificationCenter: () => void;
  isNotificationCenterOpen: boolean;
}

export function Header({
  activeTab,
  setActiveTab,
  onOpenNewTaskModal,
  isOffline,
  notifications,
  onToggleNotificationCenter,
  isNotificationCenterOpen,
}: HeaderProps) {
  const unreadCount = notifications.filter((n) => !n.read).length;

  const navItems: { id: ActiveTab; label: string; icon: React.ReactNode }[] = [
    { id: 'board', label: 'Board', icon: <Kanban className="w-4 h-4" /> },
    { id: 'pomodoro', label: 'Focus Timer', icon: <Timer className="w-4 h-4" /> },
    { id: 'analytics', label: 'Dashboard', icon: <BarChart2 className="w-4 h-4" /> },
    { id: 'settings', label: 'Settings', icon: <Settings className="w-4 h-4" /> },
  ];

  return (
    <header className="sticky top-0 z-30 w-full border-b border-[#30363d] bg-[#161b22]/95 backdrop-blur-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-15 flex items-center justify-between gap-4">
        {/* Brand */}
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-white flex items-center justify-center text-slate-950 font-bold text-sm shadow-xs">
              T
            </div>
            <span className="font-bold text-base tracking-tight text-white">Taskora</span>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-1.5">
            {navItems.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`flex items-center gap-2 px-3.5 py-1.5 rounded-md text-sm font-medium transition ${
                    isActive
                      ? 'bg-[#21262d] text-white border border-[#30363d]'
                      : 'text-slate-400 hover:text-slate-100 hover:bg-[#21262d]/60'
                  }`}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-3">
          {/* Offline Indicator */}
          {isOffline && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#21262d] border border-[#30363d] text-xs text-amber-400">
              <WifiOff className="w-3.5 h-3.5" />
              <span>Offline</span>
            </div>
          )}

          {/* Notification Bell */}
          <button
            onClick={onToggleNotificationCenter}
            className={`relative p-2 rounded-md text-slate-300 hover:text-white hover:bg-[#21262d] transition ${
              isNotificationCenterOpen ? 'bg-[#21262d] text-white' : ''
            }`}
            title="Notifications"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-rose-500" />
            )}
          </button>

          {/* Create Task Button (Desktop only; on mobile it is in the bottom navigation bar) */}
          <button
            onClick={onOpenNewTaskModal}
            className="hidden md:flex items-center gap-1.5 px-3.5 py-1.5 rounded-md bg-white hover:bg-slate-100 text-slate-950 text-xs font-semibold shadow-xs transition"
          >
            <Plus className="w-4 h-4" />
            <span>New Task</span>
          </button>
        </div>
      </div>
    </header>
  );
}
