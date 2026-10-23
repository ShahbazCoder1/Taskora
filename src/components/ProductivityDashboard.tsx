'use client';

import React, { useState, useMemo } from 'react';
import { Task, DailyProductivityRecord } from '@/types';
import { CheckCircle2, Circle, Check, Clock } from 'lucide-react';
import { formatDateKey, getTodayKey } from '@/lib/storage';

interface ProductivityDashboardProps {
  tasks: Task[];
  history: DailyProductivityRecord[];
}

export function ProductivityDashboard({ tasks, history }: ProductivityDashboardProps) {
  const todayKey = getTodayKey();
  const [selectedDateKey, setSelectedDateKey] = useState<string>(todayKey);

  const completedCount = tasks.filter((t) => t.status === 'done').length;
  const pendingCount = tasks.filter((t) => t.status !== 'done').length;

  const weekDays = useMemo(() => {
    const list: {
      dateKey: string;
      dayLetter: string;
      dayAbbr: string;
      dateNumber: number;
      isToday: boolean;
      completedCount: number;
    }[] = [];

    const today = new Date();

    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const key = formatDateKey(d);

      const dayLetters = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
      const dayLetter = dayLetters[d.getDay()];
      const dayAbbr = d.toLocaleDateString(undefined, { weekday: 'short' });
      const dateNumber = d.getDate();

      const tasksCompletedOnDay = tasks.filter((t) => {
        if (!t.completedAt) return false;
        return t.completedAt.startsWith(key);
      }).length;

      const recordFromHistory = history.find((h) => h.date === key)?.tasksCompleted || 0;
      const count = Math.max(tasksCompletedOnDay, recordFromHistory);

      list.push({
        dateKey: key,
        dayLetter,
        dayAbbr,
        dateNumber,
        isToday: key === todayKey,
        completedCount: count,
      });
    }

    return list;
  }, [tasks, history, todayKey]);

  const selectedDayInfo = useMemo(() => {
    const d = new Date(selectedDateKey + 'T00:00:00');
    const isToday = selectedDateKey === todayKey;

    const completedOnDate = tasks.filter((t) => {
      if (t.status !== 'done') return false;
      return t.completedAt?.startsWith(selectedDateKey);
    });

    const pendingOnDate = tasks.filter((t) => {
      if (t.status === 'done') return false;
      return t.dueDate === selectedDateKey;
    });

    const title = isToday
      ? 'Today'
      : d.toLocaleDateString(undefined, {
          weekday: 'long',
          month: 'short',
          day: 'numeric',
        });

    return {
      title,
      isToday,
      finishedCount: completedOnDate.length,
      pendingCount: pendingOnDate.length,
      completedTasks: completedOnDate,
      pendingTasks: pendingOnDate,
    };
  }, [selectedDateKey, tasks, todayKey]);

  return (
    <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6 text-slate-200">
      {/* Header */}
      <div>
        <span className="text-xs font-bold tracking-wider text-emerald-400 uppercase">
          THE BIG PICTURE
        </span>
        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white mt-1">
          Your progress
        </h2>
        <p className="text-sm text-slate-300 mt-1">
          Small steps make a steady rhythm.
        </p>
      </div>

      {/* Top Section: Responsive Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Progress KPI Cards */}
        <div className="grid grid-cols-2 gap-3.5 lg:col-span-1">
          {/* Completed */}
          <div className="p-5 rounded-xl bg-[#161b22] border border-[#30363d] flex flex-col justify-between shadow-xs">
            <div className="w-7 h-7 rounded-full flex items-center justify-center text-emerald-400">
              <CheckCircle2 className="w-6 h-6 text-emerald-400" />
            </div>
            <div className="mt-4">
              <span className="text-3xl sm:text-4xl font-extrabold text-white block">
                {completedCount}
              </span>
              <span className="text-sm text-slate-300 font-semibold">Completed</span>
            </div>
          </div>

          {/* Pending */}
          <div className="p-5 rounded-xl bg-[#161b22] border border-[#30363d] flex flex-col justify-between shadow-xs">
            <div className="w-7 h-7 rounded-full flex items-center justify-center text-slate-400">
              <Circle className="w-6 h-6 text-slate-400" />
            </div>
            <div className="mt-4">
              <span className="text-3xl sm:text-4xl font-extrabold text-white block">
                {pendingCount}
              </span>
              <span className="text-sm text-slate-300 font-semibold">Pending</span>
            </div>
          </div>
        </div>

        {/* This Week - Tasks completed each day */}
        <div className="p-5 rounded-xl bg-[#161b22] border border-[#30363d] lg:col-span-2 flex flex-col justify-between shadow-xs">
          <div>
            <h3 className="font-bold text-base text-white">This week</h3>
            <p className="text-sm text-slate-400 mb-4">Tasks completed each day</p>
          </div>

          <div className="flex items-end justify-between px-3 sm:px-8 pt-3 pb-2">
            {weekDays.map((day) => (
              <div key={day.dateKey} className="flex flex-col items-center gap-2.5">
                <span className="text-sm font-bold text-slate-300">
                  {day.completedCount}
                </span>

                <div
                  className={`h-2 w-8 sm:w-12 rounded-full transition-colors ${
                    day.completedCount > 0 ? 'bg-indigo-400' : 'bg-[#21262d]'
                  }`}
                />

                <span className="text-xs font-semibold text-slate-400">
                  {day.dayLetter}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Daily History Section */}
      <div className="space-y-4 pt-2">
        <h3 className="text-lg font-bold text-white">Daily history</h3>

        {/* Date Selector Chips */}
        <div className="flex items-center gap-2.5 overflow-x-auto pb-1 scrollbar-none">
          {weekDays.map((day) => {
            const isSelected = selectedDateKey === day.dateKey;

            return (
              <button
                key={day.dateKey}
                onClick={() => setSelectedDateKey(day.dateKey)}
                className={`shrink-0 min-w-[62px] py-2.5 px-3 rounded-lg text-center border transition flex flex-col items-center justify-center ${
                  isSelected
                    ? 'bg-white border-white text-slate-950 font-bold shadow-sm'
                    : 'bg-[#161b22] border-[#30363d] text-slate-300 hover:text-white hover:bg-[#21262d]'
                }`}
              >
                <span className={`text-xs uppercase font-semibold leading-none ${isSelected ? 'text-slate-950 font-bold' : 'text-slate-400'}`}>
                  {day.dayAbbr}
                </span>
                <span className={`text-base font-extrabold leading-tight mt-1 ${isSelected ? 'text-slate-950' : 'text-white'}`}>
                  {day.dateNumber}
                </span>
              </button>
            );
          })}
        </div>

        {/* Selected Date Tasks Card */}
        <div className="p-5 rounded-xl bg-[#161b22] border border-[#30363d] space-y-4 shadow-xs">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-bold text-base text-white">
                {selectedDayInfo.title}
              </h4>
              <p className="text-sm text-slate-300 mt-0.5">
                {selectedDayInfo.finishedCount} finished · {selectedDayInfo.pendingCount} pending
              </p>
            </div>

            <div className="flex items-center gap-2 text-xs font-medium">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
              <span className="text-slate-300 mr-2">{selectedDayInfo.finishedCount} done</span>
              <span className="w-2.5 h-2.5 rounded-full bg-slate-500" />
              <span className="text-slate-300">{selectedDayInfo.pendingCount} pending</span>
            </div>
          </div>

          {/* Task list for selected date */}
          {selectedDayInfo.completedTasks.length === 0 && selectedDayInfo.pendingTasks.length === 0 ? (
            <div className="py-8 text-center text-slate-400 text-sm">
              <p>No task activity recorded for this day.</p>
            </div>
          ) : (
            <div className="space-y-2 pt-1">
              {selectedDayInfo.completedTasks.map((t) => (
                <div
                  key={t.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-[#21262d] border border-[#30363d] text-sm"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span className="truncate text-slate-300 line-through">
                      {t.title}
                    </span>
                  </div>
                  <span className="text-xs uppercase font-bold text-emerald-400 px-2 py-0.5 rounded bg-emerald-950/70 border border-emerald-800 shrink-0">
                    Completed
                  </span>
                </div>
              ))}

              {selectedDayInfo.pendingTasks.map((t) => (
                <div
                  key={t.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-[#21262d] border border-[#30363d] text-sm"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Clock className="w-4 h-4 text-slate-400 shrink-0" />
                    <span className="truncate text-white font-medium">
                      {t.title}
                    </span>
                  </div>
                  <span className="text-xs uppercase font-bold text-amber-300 px-2 py-0.5 rounded bg-amber-950/70 border border-amber-800 shrink-0">
                    {t.status === 'in_progress' ? 'In Progress' : 'To Do'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
