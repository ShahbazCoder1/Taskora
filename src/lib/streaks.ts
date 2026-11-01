import { Task, TaskStatus, DailyProductivityRecord } from '@/types';
import { formatDateKey, getTodayKey } from './storage';

export interface StreakSummary {
  currentStreak: number;
  bestStreak: number;
  isMaintainedToday: boolean;
  dailyTasksCount: number;
  dailyTasksCompletedToday: number;
  dailyTasks: Task[];
}

/**
 * Returns yesterday's YYYY-MM-DD date key.
 */
export function getYesterdayKey(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return formatDateKey(d);
}

/**
 * Returns the YYYY-MM-DD key for the day before given date key.
 */
export function getPreviousDayKey(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() - 1);
  return formatDateKey(date);
}

/**
 * Resets daily recurring tasks to 'todo' on a new day and validates streaks.
 * When a user opens Taskora on a new day, daily tasks appear in the 'To Do' column.
 */
export function ensureDailyTasksForToday(tasks: Task[]): { updatedTasks: Task[]; changed: boolean } {
  const todayKey = getTodayKey();
  const yesterdayKey = getYesterdayKey();
  let changed = false;

  const updatedTasks = tasks.map((task) => {
    if (!task.isDaily) return task;

    let modified = { ...task };
    let taskChanged = false;

    // Check if task was completed on a previous day
    const completedDate = modified.completedAt ? modified.completedAt.slice(0, 10) : null;
    const isCompletedFromPreviousDay = modified.status === 'done' && completedDate && completedDate < todayKey;

    if (isCompletedFromPreviousDay) {
      // New day: move back to 'todo', clear completedAt, set dueDate to today, reset subtasks
      modified.status = 'todo';
      modified.completedAt = null;
      modified.dueDate = todayKey;
      if (modified.subtasks && modified.subtasks.length > 0) {
        modified.subtasks = modified.subtasks.map((s) => ({ ...s, completed: false }));
      }

      // Check if streak is still intact (was completed yesterday)
      if (modified.lastCompletedDate !== yesterdayKey && modified.lastCompletedDate !== todayKey) {
        // Missed yesterday: streak breaks
        modified.streak = 0;
      }

      taskChanged = true;
    } else if (modified.status !== 'done') {
      // For tasks that were not done yesterday, update dueDate to today
      if (modified.dueDate !== todayKey) {
        modified.dueDate = todayKey;
        // Check if streak was broken because yesterday wasn't completed
        if (modified.lastCompletedDate !== yesterdayKey && modified.lastCompletedDate !== todayKey) {
          if ((modified.streak || 0) > 0) {
            modified.streak = 0;
          }
        }
        taskChanged = true;
      }
    }

    if (taskChanged) {
      changed = true;
      modified.updatedAt = new Date().toISOString();
      return modified;
    }

    return task;
  });

  return { updatedTasks, changed };
}

/**
 * Updates streak counters when a task's status changes.
 */
export function calculateStreakUpdate(
  task: Task,
  newStatus: TaskStatus
): {
  streak?: number;
  bestStreak?: number;
  lastCompletedDate?: string;
  completedDates?: string[];
} {
  if (!task.isDaily) return {};

  const todayKey = getTodayKey();
  const yesterdayKey = getYesterdayKey();

  if (newStatus === 'done' && task.status !== 'done') {
    // Marking as done
    let newStreak = 1;
    if (task.lastCompletedDate === yesterdayKey) {
      newStreak = (task.streak || 0) + 1;
    } else if (task.lastCompletedDate === todayKey) {
      // Re-completing on same day
      newStreak = task.streak || 1;
    } else {
      // Starting new streak
      newStreak = 1;
    }

    const newBest = Math.max(task.bestStreak || 0, newStreak);
    const datesSet = new Set(task.completedDates || []);
    datesSet.add(todayKey);

    return {
      streak: newStreak,
      bestStreak: newBest,
      lastCompletedDate: todayKey,
      completedDates: Array.from(datesSet),
    };
  }

  if (newStatus !== 'done' && task.status === 'done') {
    // Unmarking from done on the same day
    if (task.lastCompletedDate === todayKey) {
      const reverted = Math.max(0, (task.streak || 1) - 1);
      const datesSet = new Set(task.completedDates || []);
      datesSet.delete(todayKey);
      return {
        streak: reverted,
        lastCompletedDate: reverted > 0 ? yesterdayKey : undefined,
        completedDates: Array.from(datesSet),
      };
    }
  }

  return {};
}

/**
 * Calculates longest consecutive days streak in productivity history.
 */
function calculateLongestHistoryStreak(history: DailyProductivityRecord[]): number {
  if (!history || history.length === 0) return 0;

  const datesWithCompletions = new Set(
    history.filter((h) => h.tasksCompleted > 0).map((h) => h.date)
  );

  if (datesWithCompletions.size === 0) return 0;

  const sortedDates = Array.from(datesWithCompletions).sort();
  let longest = 0;
  let current = 0;
  let prevDateStr: string | null = null;

  for (const dateStr of sortedDates) {
    if (!prevDateStr) {
      current = 1;
    } else {
      const expectedNext = getPreviousDayKey(dateStr);
      if (expectedNext === prevDateStr) {
        current += 1;
      } else {
        current = 1;
      }
    }
    prevDateStr = dateStr;
    if (current > longest) longest = current;
  }

  return longest;
}

/**
 * Calculates consecutive active days from history up to today or yesterday.
 */
function calculateCurrentHistoryStreak(history: DailyProductivityRecord[], hasTodayCompletion: boolean): number {
  const todayKey = getTodayKey();
  const yesterdayKey = getYesterdayKey();

  const completionMap = new Map<string, number>();
  for (const rec of history) {
    if (rec.tasksCompleted > 0) {
      completionMap.set(rec.date, rec.tasksCompleted);
    }
  }

  const isTodayDone = hasTodayCompletion || (completionMap.get(todayKey) || 0) > 0;
  const isYesterdayDone = (completionMap.get(yesterdayKey) || 0) > 0;

  if (!isTodayDone && !isYesterdayDone) {
    return 0;
  }

  let streak = 0;
  let checkDate = isTodayDone ? todayKey : yesterdayKey;

  while (true) {
    const isDone = (checkDate === todayKey && isTodayDone) || (completionMap.get(checkDate) || 0) > 0;
    if (isDone) {
      streak += 1;
      checkDate = getPreviousDayKey(checkDate);
    } else {
      break;
    }
  }

  return streak;
}

/**
 * Computes overall streak summary for Header & Dashboard.
 */
export function calculateStreakSummary(
  tasks: Task[],
  history: DailyProductivityRecord[]
): StreakSummary {
  const todayKey = getTodayKey();
  const dailyTasks = tasks.filter((t) => Boolean(t.isDaily));
  const dailyTasksCount = dailyTasks.length;

  const dailyTasksCompletedToday = dailyTasks.filter(
    (t) => t.status === 'done' && (t.lastCompletedDate === todayKey || t.completedAt?.startsWith(todayKey))
  ).length;

  const isMaintainedToday = dailyTasksCount > 0
    ? dailyTasksCompletedToday > 0
    : (history.find((h) => h.date === todayKey)?.tasksCompleted || 0) > 0;

  // Max streak among daily tasks
  const maxDailyStreak = dailyTasksCount > 0
    ? Math.max(0, ...dailyTasks.map((t) => t.streak || 0))
    : 0;

  const maxDailyBestStreak = dailyTasksCount > 0
    ? Math.max(0, ...dailyTasks.map((t) => t.bestStreak || 0))
    : 0;

  // History consecutive active days
  const historyCurrentStreak = calculateCurrentHistoryStreak(history, isMaintainedToday);
  const historyBestStreak = calculateLongestHistoryStreak(history);

  // Overall current streak is the higher of individual daily habits streak or history streak
  const currentStreak = Math.max(maxDailyStreak, historyCurrentStreak);
  const bestStreak = Math.max(currentStreak, maxDailyBestStreak, historyBestStreak);

  return {
    currentStreak,
    bestStreak,
    isMaintainedToday,
    dailyTasksCount,
    dailyTasksCompletedToday,
    dailyTasks,
  };
}

export interface MonthDayInfo {
  dateKey: string;
  label: string;
  dayNumber: number;
}

/**
 * Generates an array representing the rolling last 30 days up to today.
 */
export function getLast30Days(): MonthDayInfo[] {
  const days: MonthDayInfo[] = [];
  const today = new Date();
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    days.push({
      dateKey: formatDateKey(d),
      label: d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', weekday: 'short' }),
      dayNumber: d.getDate(),
    });
  }
  return days;
}

/**
 * Checks if a specific daily routine was completed on a given dateKey.
 */
export function isDailyTaskCompletedOnDate(
  task: Task,
  dateKey: string,
  history: DailyProductivityRecord[] = [],
  todayKey = getTodayKey()
): boolean {
  if (task.completedDates && task.completedDates.includes(dateKey)) {
    return true;
  }

  if (dateKey === todayKey && task.status === 'done') {
    return true;
  }

  if (task.lastCompletedDate === dateKey) {
    return true;
  }

  // Check productivity history records
  if (history.some((h) => h.date === dateKey && h.taskIdsCompleted?.includes(task.id))) {
    return true;
  }

  // Check active streak range up to lastCompletedDate
  if (task.streak && task.streak > 0 && task.lastCompletedDate) {
    const [ly, lm, ld] = task.lastCompletedDate.split('-').map(Number);
    const lastDate = new Date(ly, lm - 1, ld);
    const [cy, cm, cd] = dateKey.split('-').map(Number);
    const checkDate = new Date(cy, cm - 1, cd);

    const diffDays = Math.round((lastDate.getTime() - checkDate.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays >= 0 && diffDays < task.streak) {
      return true;
    }
  }

  return false;
}

