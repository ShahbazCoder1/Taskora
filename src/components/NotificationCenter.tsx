'use client';

import React from 'react';
import { NotificationItem } from '@/types';
import { Trash2, X, CheckCheck } from 'lucide-react';

interface NotificationCenterProps {
  notifications: NotificationItem[];
  isOpen: boolean;
  onClose: () => void;
  onMarkAsRead: (id: string) => void;
  onMarkAllAsRead: () => void;
  onClearAll: () => void;
  onSelectTask?: (taskId: string) => void;
}

export function NotificationCenter({
  notifications,
  isOpen,
  onClose,
  onMarkAsRead,
  onMarkAllAsRead,
  onClearAll,
  onSelectTask,
}: NotificationCenterProps) {
  if (!isOpen) return null;

  return (
    <div className="absolute right-4 top-15 z-50 w-84 rounded-xl border border-[#30363d] bg-[#161b22] shadow-2xl p-4 text-slate-200">
      <div className="flex items-center justify-between pb-3 mb-2 border-b border-[#30363d]">
        <span className="text-sm font-bold text-white">Notifications</span>
        <div className="flex items-center gap-1.5">
          {notifications.length > 0 && (
            <>
              <button
                onClick={onMarkAllAsRead}
                className="p-1 rounded text-slate-400 hover:text-white"
                title="Mark all read"
              >
                <CheckCheck className="w-4 h-4" />
              </button>
              <button
                onClick={onClearAll}
                className="p-1 rounded text-slate-400 hover:text-rose-400"
                title="Clear all"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </>
          )}
          <button onClick={onClose} className="p-1 rounded text-slate-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="max-h-72 overflow-y-auto space-y-2">
        {notifications.length === 0 ? (
          <div className="py-8 text-center text-slate-400 text-sm">
            <p>No notifications</p>
          </div>
        ) : (
          notifications.map((item) => (
            <div
              key={item.id}
              onClick={() => {
                onMarkAsRead(item.id);
                if (item.taskId && onSelectTask) {
                  onSelectTask(item.taskId);
                  onClose();
                }
              }}
              className={`p-3 rounded-lg border text-xs cursor-pointer transition ${
                item.read
                  ? 'border-[#30363d]/60 bg-[#21262d]/40 text-slate-400'
                  : 'border-[#30363d] bg-[#21262d] text-slate-200 hover:border-slate-400'
              }`}
            >
              <div className="font-semibold text-sm mb-1 text-white">{item.title}</div>
              <div className="text-xs text-slate-300 leading-relaxed">{item.message}</div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
