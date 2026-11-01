'use client';

import React, { useState, useMemo } from 'react';
import { Task, DailyProductivityRecord } from '@/types';
import { isDailyTaskCompletedOnDate } from '@/lib/streaks';
import { formatDateKey } from '@/lib/storage';

interface GitHubMonthGridProps {
  task: Task;
  history: DailyProductivityRecord[];
  todayKey: string;
}

interface MonthGridCell {
  dateKey: string;
  dayNumber: number;
  label: string;
  isToday: boolean;
  isFuture: boolean;
}

export function GitHubMonthGrid({ task, history, todayKey }: GitHubMonthGridProps) {
  const [monthOffset, setMonthOffset] = useState<number>(0);

  const gridData = useMemo(() => {
    const targetDate = new Date();
    targetDate.setDate(1); // avoid 31st overflow issues
    targetDate.setMonth(targetDate.getMonth() + monthOffset);

    const year = targetDate.getFullYear();
    const month = targetDate.getMonth();
    const monthName = targetDate.toLocaleDateString(undefined, { month: 'short' });

    const firstDayWeekday = new Date(year, month, 1).getDay(); // 0 = Sun, 6 = Sat
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const totalSlots = firstDayWeekday + daysInMonth;
    const numWeeks = Math.ceil(totalSlots / 7);

    const weeks: (MonthGridCell | null)[][] = [];
    let currentDay = 1;

    for (let w = 0; w < numWeeks; w++) {
      const weekColumn: (MonthGridCell | null)[] = [];
      for (let r = 0; r < 7; r++) {
        const slotIndex = w * 7 + r;
        if (slotIndex < firstDayWeekday || currentDay > daysInMonth) {
          weekColumn.push(null);
        } else {
          const dateObj = new Date(year, month, currentDay);
          const dateKey = formatDateKey(dateObj);
          const isToday = dateKey === todayKey;
          const isFuture = Boolean(todayKey && dateKey > todayKey);

          weekColumn.push({
            dateKey,
            dayNumber: currentDay,
            label: dateObj.toLocaleDateString(undefined, {
              weekday: 'short',
              month: 'short',
              day: 'numeric',
            }),
            isToday,
            isFuture,
          });
          currentDay++;
        }
      }
      weeks.push(weekColumn);
    }

    let completedInMonth = 0;
    for (const week of weeks) {
      for (const cell of week) {
        if (cell && isDailyTaskCompletedOnDate(task, cell.dateKey, history, todayKey)) {
          completedInMonth++;
        }
      }
    }

    return {
      monthName,
      year,
      weeks,
      completedInMonth,
      daysInMonth,
    };
  }, [monthOffset, task, history, todayKey]);

  return (
    <div className="flex flex-col items-center select-none shrink-0">
      {/* 7-Row GitHub Commit Calendar Columns */}
      <div className="flex items-center gap-[3px] p-1.5 rounded-md bg-[#161b22]/70 border border-[#30363d]/60">
        {gridData.weeks.map((week, wIdx) => (
          <div key={wIdx} className="flex flex-col gap-[3px]">
            {week.map((cell, rIdx) => {
              if (!cell) {
                return (
                  <div
                    key={`empty-${rIdx}`}
                    className="w-2.5 h-2.5 sm:w-3 sm:h-3 opacity-0 pointer-events-none"
                  />
                );
              }

              const isDone = isDailyTaskCompletedOnDate(task, cell.dateKey, history, todayKey);

              return (
                <div
                  key={cell.dateKey}
                  title={`${cell.label}: ${isDone ? 'Completed' : cell.isFuture ? 'Upcoming' : 'No activity'}${cell.isToday ? ' (Today)' : ''}`}
                  className={`w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-[2px] transition-transform hover:scale-125 cursor-pointer ${
                    isDone
                      ? 'bg-emerald-500 border border-emerald-400/50 shadow-[0_0_5px_rgba(16,185,129,0.35)]'
                      : cell.isToday
                      ? 'bg-[#161b22] border border-slate-400 ring-1 ring-slate-400/40'
                      : cell.isFuture
                      ? 'bg-[#161b22]/40 border border-[#30363d]/40'
                      : 'bg-[#21262d] border border-[#30363d]'
                  }`}
                />
              );
            })}
          </div>
        ))}
      </div>

      {/* Month Label with navigation */}
      <div className="flex items-center justify-center gap-1.5 mt-1 text-[11px] text-slate-400 font-medium">
        <button
          onClick={(e) => {
            e.stopPropagation();
            setMonthOffset((prev) => prev - 1);
          }}
          className="p-0.5 hover:text-white transition leading-none text-slate-500 hover:text-slate-200 cursor-pointer"
          title="Previous month"
        >
          ‹
        </button>
        <span
          className="font-semibold text-slate-300 min-w-[28px] text-center"
          title={`${gridData.completedInMonth} days completed in ${gridData.monthName} ${gridData.year}`}
        >
          {gridData.monthName}
        </span>
        <button
          onClick={(e) => {
            e.stopPropagation();
            setMonthOffset((prev) => Math.min(0, prev + 1));
          }}
          disabled={monthOffset >= 0}
          className={`p-0.5 transition leading-none ${
            monthOffset >= 0
              ? 'text-slate-700 cursor-not-allowed'
              : 'text-slate-500 hover:text-slate-200 cursor-pointer'
          }`}
          title="Next month"
        >
          ›
        </button>
      </div>
    </div>
  );
}

