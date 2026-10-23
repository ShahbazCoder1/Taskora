import { Task, PomodoroSettings, DailyProductivityRecord, NotificationItem } from '@/types';

const STORAGE_KEYS = {
  TASKS: 'taskora_tasks_v2',
  POMODORO_SETTINGS: 'taskora_pomodoro_settings_v2',
  PRODUCTIVITY_HISTORY: 'taskora_productivity_history_v2',
  NOTIFICATIONS: 'taskora_notifications_v2',
};

export function formatDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function getTodayKey(): string {
  return formatDateKey(new Date());
}

const INITIAL_TASKS: Task[] = [
  {
    id: 't-1',
    title: 'Review project scope and requirements',
    description: 'Go through client notes and finalize deliverables list.',
    status: 'in_progress',
    priority: 'high',
    dueDate: getTodayKey(),
    dueTime: '16:00',
    tags: ['Work'],
    subtasks: [
      { id: 's-1', title: 'Outline core milestones', completed: true },
      { id: 's-2', title: 'Estimate timeline', completed: false },
    ],
    estimatedPomodoros: 2,
    completedPomodoros: 1,
    createdAt: new Date().toISOString(),
    completedAt: null,
    order: 0,
  },
  {
    id: 't-2',
    title: 'Respond to urgent emails',
    description: 'Clear inbox and follow up with team leads.',
    status: 'todo',
    priority: 'medium',
    dueDate: getTodayKey(),
    dueTime: '18:00',
    tags: ['Admin'],
    subtasks: [],
    estimatedPomodoros: 1,
    completedPomodoros: 0,
    createdAt: new Date().toISOString(),
    completedAt: null,
    order: 0,
  },
  {
    id: 't-3',
    title: 'Setup local workspace configuration',
    description: 'Environment variables and repository setup.',
    status: 'done',
    priority: 'low',
    dueDate: getTodayKey(),
    dueTime: '',
    tags: ['Dev'],
    subtasks: [],
    estimatedPomodoros: 1,
    completedPomodoros: 1,
    createdAt: new Date(Date.now() - 3600000 * 2).toISOString(),
    completedAt: new Date(Date.now() - 3600000 * 1).toISOString(),
    order: 0,
  },
];

export const DEFAULT_POMODORO_SETTINGS: PomodoroSettings = {
  workDuration: 25,
  shortBreakDuration: 5,
  longBreakDuration: 15,
  longBreakInterval: 4,
  autoStartBreaks: false,
  autoStartWork: false,
  soundEnabled: true,
  notificationEnabled: true,
};

export function getStoredTasks(): Task[] {
  if (typeof window === 'undefined') return INITIAL_TASKS;
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.TASKS);
    if (!stored) {
      localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(INITIAL_TASKS));
      return INITIAL_TASKS;
    }
    return JSON.parse(stored);
  } catch {
    return INITIAL_TASKS;
  }
}

export function saveStoredTasks(tasks: Task[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(tasks));
  } catch (e) {
    console.error('Failed to save tasks', e);
  }
}

export function getPomodoroSettings(): PomodoroSettings {
  if (typeof window === 'undefined') return DEFAULT_POMODORO_SETTINGS;
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.POMODORO_SETTINGS);
    return stored ? { ...DEFAULT_POMODORO_SETTINGS, ...JSON.parse(stored) } : DEFAULT_POMODORO_SETTINGS;
  } catch {
    return DEFAULT_POMODORO_SETTINGS;
  }
}

export function savePomodoroSettings(settings: PomodoroSettings): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEYS.POMODORO_SETTINGS, JSON.stringify(settings));
  } catch (e) {
    console.error('Failed to save settings', e);
  }
}

export function getProductivityHistory(): DailyProductivityRecord[] {
  if (typeof window === 'undefined') return [];
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.PRODUCTIVITY_HISTORY);
    if (!stored) {
      const initial: DailyProductivityRecord[] = [
        {
          date: getTodayKey(),
          tasksCompleted: 1,
          focusMinutes: 25,
          pomodorosCompleted: 1,
          taskIdsCompleted: ['t-3'],
        },
      ];
      localStorage.setItem(STORAGE_KEYS.PRODUCTIVITY_HISTORY, JSON.stringify(initial));
      return initial;
    }
    return JSON.parse(stored);
  } catch {
    return [];
  }
}

export function saveProductivityHistory(history: DailyProductivityRecord[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEYS.PRODUCTIVITY_HISTORY, JSON.stringify(history));
  } catch (e) {
    console.error('Failed to save history', e);
  }
}

export function recordTaskCompletion(taskId: string, isCompleted: boolean): DailyProductivityRecord[] {
  const history = getProductivityHistory();
  const todayKey = getTodayKey();
  const index = history.findIndex((h) => h.date === todayKey);

  if (index >= 0) {
    const record = { ...history[index] };
    const taskIds = new Set(record.taskIdsCompleted || []);
    if (isCompleted) {
      if (!taskIds.has(taskId)) {
        taskIds.add(taskId);
        record.tasksCompleted += 1;
      }
    } else {
      if (taskIds.has(taskId)) {
        taskIds.delete(taskId);
        record.tasksCompleted = Math.max(0, record.tasksCompleted - 1);
      }
    }
    record.taskIdsCompleted = Array.from(taskIds);
    history[index] = record;
  } else {
    history.push({
      date: todayKey,
      tasksCompleted: isCompleted ? 1 : 0,
      focusMinutes: 0,
      pomodorosCompleted: 0,
      taskIdsCompleted: isCompleted ? [taskId] : [],
    });
  }

  saveProductivityHistory(history);
  return history;
}

export function recordFocusSession(minutes: number): DailyProductivityRecord[] {
  const history = getProductivityHistory();
  const todayKey = getTodayKey();
  const index = history.findIndex((h) => h.date === todayKey);

  if (index >= 0) {
    const record = { ...history[index] };
    record.focusMinutes += minutes;
    record.pomodorosCompleted += 1;
    history[index] = record;
  } else {
    history.push({
      date: todayKey,
      tasksCompleted: 0,
      focusMinutes: minutes,
      pomodorosCompleted: 1,
      taskIdsCompleted: [],
    });
  }

  saveProductivityHistory(history);
  return history;
}

export function getNotifications(): NotificationItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.NOTIFICATIONS);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

export function saveNotifications(notifications: NotificationItem[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(notifications));
  } catch (e) {
    console.error('Failed to save notifications', e);
  }
}

export function exportTaskoraData(): string {
  const data = {
    version: '2.0',
    exportedAt: new Date().toISOString(),
    tasks: getStoredTasks(),
    pomodoroSettings: getPomodoroSettings(),
    productivityHistory: getProductivityHistory(),
  };
  return JSON.stringify(data, null, 2);
}

export function importTaskoraData(jsonString: string): boolean {
  try {
    const parsed = JSON.parse(jsonString);
    if (Array.isArray(parsed.tasks)) saveStoredTasks(parsed.tasks);
    if (parsed.pomodoroSettings) savePomodoroSettings(parsed.pomodoroSettings);
    if (Array.isArray(parsed.productivityHistory)) saveProductivityHistory(parsed.productivityHistory);
    return true;
  } catch {
    return false;
  }
}

export function resetAllData(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(STORAGE_KEYS.TASKS);
  localStorage.removeItem(STORAGE_KEYS.POMODORO_SETTINGS);
  localStorage.removeItem(STORAGE_KEYS.PRODUCTIVITY_HISTORY);
  localStorage.removeItem(STORAGE_KEYS.NOTIFICATIONS);
}
