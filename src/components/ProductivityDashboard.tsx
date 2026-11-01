'use client';

import React, { useState, useMemo } from 'react';
import { Task, TaskStatus, DailyProductivityRecord } from '@/types';
import { CheckCircle2, Circle, Check, Clock, Flame, Trophy, Target, Zap } from 'lucide-react';
import { formatDateKey, getTodayKey, isTaskCompletedOnDate } from '@/lib/storage';
import { calculateStreakSummary } from '@/lib/streaks';
import { GitHubMonthGrid } from './GitHubMonthGrid';

interface ProductivityDashboardProps {
  tasks: Task[];
  history: DailyProductivityRecord[];
  onStatusChange?: (taskId: string, newStatus: TaskStatus) => void;
  onOpenNewTaskModal?: () => void;
}

export function ProductivityDashboard({ 
  tasks, 
  history,
  onStatusChange,
  onOpenNewTaskModal,
}: ProductivityDashboardProps) {
  const [mounted, setMounted] = useState(false);
  const [selectedDateKey, setSelectedDateKey] = useState<string>('');

  React.useEffect(() => {
    setMounted(true);
    setSelectedDateKey(getTodayKey());
  }, []);

  const todayKey = mounted ? getTodayKey() : '';

  const streakSummary = useMemo(() => {
    if (!mounted) {
      return {
        currentStreak: 0,
        bestStreak: 0,
        isMaintainedToday: false,
        dailyTasksCount: 0,
        dailyTasksCompletedToday: 0,
        dailyTasks: [],
      };
    }
    return calculateStreakSummary(tasks, history);
  }, [mounted, tasks, history]);

  const completedCount = tasks.filter((t) => t.status === 'done').length;
  const pendingCount = tasks.filter((t) => t.status !== 'done').length;

  const weekDays = useMemo(() => {
    if (!mounted) return [];
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

      const tasksCompletedOnDay = tasks.filter((t) => isTaskCompletedOnDate(t, key)).length;

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
  }, [mounted, tasks, history, todayKey]);

  const selectedDayInfo = useMemo(() => {
    if (!mounted || !selectedDateKey) {
      return {
        title: 'Today',
        isToday: true,
        finishedCount: 0,
        pendingCount: 0,
        completedTasks: [],
        pendingTasks: [],
      };
    }
    const d = new Date(selectedDateKey + 'T00:00:00');
    const isToday = selectedDateKey === todayKey;

    const completedOnDate = tasks.filter((t) => isTaskCompletedOnDate(t, selectedDateKey));

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
  }, [mounted, selectedDateKey, tasks, todayKey]);

  return (
    <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6 text-slate-200">
      {/* Streaks & Habits Section */}
      <div className="space-y-4">
        <div>
          <span className="text-xs font-bold tracking-wider text-amber-400 uppercase flex items-center gap-1.5">
            <Flame className="w-3.5 h-3.5 fill-amber-400" />
            <span>STREAKS & DAILY ROUTINES</span>
          </span>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white mt-0.5">
            Habits & Momentum
          </h2>
        </div>

        {/* Streak Metrics Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
          {/* Current Streak */}
          <div className="p-4 sm:p-5 rounded-xl bg-[#161b22] border border-[#30363d] shadow-xs relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Current Streak</span>
              <div className="w-7 h-7 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
                <Flame className="w-4 h-4 fill-amber-400" />
              </div>
            </div>
            <div className="mt-3">
              <div className="flex items-baseline gap-1.5">
                <span className="text-3xl sm:text-4xl font-extrabold text-white">
                  {streakSummary.currentStreak}
                </span>
                <span className="text-sm font-semibold text-slate-400">
                  {streakSummary.currentStreak === 1 ? 'Day' : 'Days'}
                </span>
              </div>
              <div className="mt-2 flex items-center gap-1.5 text-xs font-medium">
                {streakSummary.isMaintainedToday ? (
                  <span className="text-emerald-400 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Maintained for today
                  </span>
                ) : streakSummary.currentStreak > 0 ? (
                  <span className="text-amber-400 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
                    Pending completion today
                  </span>
                ) : (
                  <span className="text-slate-400">Complete a daily task to start</span>
                )}
              </div>
            </div>
          </div>

          {/* Best Streak */}
          <div className="p-4 sm:p-5 rounded-xl bg-[#161b22] border border-[#30363d] shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Best Streak</span>
              <div className="w-7 h-7 rounded-lg bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                <Trophy className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <div className="flex items-baseline gap-1.5">
                <span className="text-3xl sm:text-4xl font-extrabold text-white">
                  {streakSummary.bestStreak}
                </span>
                <span className="text-sm font-semibold text-slate-400">
                  {streakSummary.bestStreak === 1 ? 'Day' : 'Days'}
                </span>
              </div>
              <p className="mt-2 text-xs text-slate-400">
                All-time record
              </p>
            </div>
          </div>

          {/* Daily Tasks Today */}
          <div className="p-4 sm:p-5 rounded-xl bg-[#161b22] border border-[#30363d] shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Today&apos;s Daily Tasks</span>
              <div className="w-7 h-7 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <Target className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <div className="flex items-baseline gap-1.5">
                <span className="text-3xl sm:text-4xl font-extrabold text-white">
                  {streakSummary.dailyTasksCompletedToday}
                  <span className="text-lg text-slate-500 font-normal"> / {streakSummary.dailyTasksCount}</span>
                </span>
                <span className="text-xs font-semibold text-slate-400">Done</span>
              </div>
              {/* Progress bar */}
              <div className="mt-2.5 w-full bg-[#21262d] rounded-full h-1.5 overflow-hidden">
                <div
                  className="bg-emerald-400 h-1.5 rounded-full transition-all duration-500"
                  style={{
                    width: `${streakSummary.dailyTasksCount > 0 ? (streakSummary.dailyTasksCompletedToday / streakSummary.dailyTasksCount) * 100 : 0}%`,
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Daily Tasks List */}
        {streakSummary.dailyTasks.length > 0 ? (
          <div className="p-4 sm:p-5 rounded-xl bg-[#161b22] border border-[#30363d] space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white">Daily Routines</h3>
              <span className="text-xs text-slate-400">
                Resets every morning in Kanban To-Do
              </span>
            </div>

            <div className="space-y-3">
              {streakSummary.dailyTasks.map((task) => {
                const isTaskDone = task.status === 'done';

                return (
                  <div
                    key={task.id}
                    className="p-3.5 sm:p-4 rounded-xl bg-[#21262d] border border-[#30363d] text-sm hover:border-[#484f58] transition"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      {/* Left: Checkbox + Title + Description */}
                      <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1">
                        {onStatusChange ? (
                          <button
                            onClick={() => onStatusChange(task.id, isTaskDone ? 'todo' : 'done')}
                            className="mt-0.5 sm:mt-0 shrink-0 text-slate-400 hover:text-white transition cursor-pointer"
                            title={isTaskDone ? 'Mark incomplete' : 'Mark done'}
                          >
                            {isTaskDone ? (
                              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                            ) : (
                              <Circle className="w-5 h-5 text-slate-400 hover:text-white" />
                            )}
                          </button>
                        ) : (
                          <div className="mt-0.5 sm:mt-0 shrink-0">
                            {isTaskDone ? (
                              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                            ) : (
                              <Circle className="w-5 h-5 text-slate-400" />
                            )}
                          </div>
                        )}

                        <div className="min-w-0">
                          <span className={`block truncate font-semibold text-sm sm:text-base ${isTaskDone ? 'line-through text-slate-400' : 'text-slate-100'}`}>
                            {task.title}
                          </span>
                          {task.description && (
                            <span className="block truncate text-xs text-slate-400 mt-0.5">
                              {task.description}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Right: The GitHub Month Contribution Grid + Streak badge + Status badge */}
                      <div className="flex items-center gap-3.5 shrink-0 self-start sm:self-center">
                        {/* 7-row GitHub commit calendar grid */}
                        <GitHubMonthGrid
                          task={task}
                          history={history}
                          todayKey={todayKey}
                        />

                        <div className="flex flex-col sm:flex-row items-end sm:items-center gap-2">
                          {/* Streak badge */}
                          <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-1 rounded bg-amber-500/15 border border-amber-500/30 text-amber-300 whitespace-nowrap">
                            <Flame className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                            <span>{task.streak || 0}d streak</span>
                          </span>

                          {/* Status badge */}
                          <span className={`text-[11px] font-semibold px-2.5 py-1 rounded whitespace-nowrap ${
                            isTaskDone 
                              ? 'bg-emerald-950/70 border border-emerald-800 text-emerald-300' 
                              : 'bg-[#161b22] border border-[#30363d] text-slate-400'
                          }`}>
                            {isTaskDone ? 'Done' : 'To Do'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="p-5 rounded-xl bg-[#161b22] border border-[#30363d] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
                <Zap className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white">Build a Daily Habit Streak</h4>
                <p className="text-xs text-slate-400 mt-0.5">
                  Create daily recurring tasks like workouts, reading, or meditation that reset to your board every day.
                </p>
              </div>
            </div>
            {onOpenNewTaskModal && (
              <button
                onClick={() => onOpenNewTaskModal()}
                className="px-3.5 py-1.5 rounded-md bg-white hover:bg-slate-100 text-slate-950 text-xs font-semibold transition shrink-0 cursor-pointer"
              >
                Create Daily Task
              </button>
            )}
          </div>
        )}
      </div>

      <hr className="border-[#30363d]" />

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
