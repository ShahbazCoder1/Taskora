'use client';

import React from 'react';
import { ActiveTab, NotificationItem, SyncConnectionStatus } from '@/types';
import { Kanban, Timer, BarChart2, Settings, Plus, Bell, WifiOff, Wifi } from 'lucide-react';

interface HeaderProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  onOpenNewTaskModal: () => void;
  isOffline: boolean;
  notifications: NotificationItem[];
  onToggleNotificationCenter: () => void;
  isNotificationCenterOpen: boolean;
  onOpenSyncModal: () => void;
  syncStatus: SyncConnectionStatus;
}

export function Header({
  activeTab,
  setActiveTab,
  onOpenNewTaskModal,
  isOffline,
  notifications,
  onToggleNotificationCenter,
  isNotificationCenterOpen,
  onOpenSyncModal,
  syncStatus,
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
          <button
            onClick={() => setActiveTab('board')}
            className="flex items-center gap-2.5 text-left group transition cursor-pointer"
            title="Taskora Home"
          >
            <div className="relative w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500/20 via-[#21262d] to-[#161b22] border border-[#30363d] group-hover:border-indigo-400/50 flex items-center justify-center transition-all">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <linearGradient id="taskoraLogoGrad" x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#818cf8" />
                    <stop offset="0.6" stopColor="#6366f1" />
                    <stop offset="1" stopColor="#38bdf8" />
                  </linearGradient>
                </defs>
                <circle
                  cx="12"
                  cy="12"
                  r="8.5"
                  stroke="url(#taskoraLogoGrad)"
                  strokeWidth="1.5"
                  strokeDasharray="2.5 2"
                  className="opacity-60"
                />
                <path
                  d="M7.5 12.2L10.5 15.2L16.5 8.5"
                  stroke="#ffffff"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <circle cx="16.5" cy="7.5" r="1.5" fill="#38bdf8" />
              </svg>
            </div>
            <span className="font-bold text-base tracking-tight text-white group-hover:text-slate-100 transition-colors">
              Taskora
            </span>
          </button>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-1.5">
            {navItems.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`flex items-center gap-2 px-3.5 py-1.5 rounded-md text-sm font-medium transition ${isActive
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

          {/* Device Sync Button */}
          <button
            onClick={onOpenSyncModal}
            className={`relative flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-semibold border transition ${
              syncStatus === 'connected'
                ? 'bg-emerald-950/60 border-emerald-700/80 text-emerald-300'
                : syncStatus === 'connecting'
                ? 'bg-amber-950/60 border-amber-700/80 text-amber-300'
                : 'bg-[#21262d] border-[#30363d] text-slate-300 hover:text-white hover:bg-[#30363d]'
            }`}
            title="Local Wi-Fi Device Sync"
          >
            {syncStatus === 'connected' ? (
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
            ) : syncStatus === 'connecting' ? (
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
              </span>
            ) : (
              <Wifi className="w-3.5 h-3.5 text-slate-400" />
            )}
            <span className="hidden sm:inline">
              {syncStatus === 'connected' ? 'Synced' : syncStatus === 'connecting' ? 'Pairing...' : 'Sync'}
            </span>
          </button>

          {/* Notification Bell */}
          <button
            onClick={onToggleNotificationCenter}
            className={`relative p-2 rounded-md text-slate-300 hover:text-white hover:bg-[#21262d] transition ${isNotificationCenterOpen ? 'bg-[#21262d] text-white' : ''
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
