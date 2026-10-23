import { Task, PomodoroSettings, DailyProductivityRecord, NotificationItem } from '@/types';

const STORAGE_KEYS = {
  TASKS: 'taskora_tasks_v3',
  POMODORO_SETTINGS: 'taskora_pomodoro_settings_v3',
  PRODUCTIVITY_HISTORY: 'taskora_productivity_history_v3',
  NOTIFICATIONS: 'taskora_notifications_v3',
  DELETED_TASK_IDS: 'taskora_deleted_task_ids_v3',
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

const DUMMY_TASK_IDS = new Set(['t-1', 't-2', 't-3']);

const INITIAL_TASKS: Task[] = [];

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
    const oldV2 = localStorage.getItem('taskora_tasks_v2');
    const stored = localStorage.getItem(STORAGE_KEYS.TASKS);

    if (!stored && oldV2) {
      try {
        const parsed = JSON.parse(oldV2);
        if (Array.isArray(parsed)) {
          const filtered = parsed.filter((t: Task) => !DUMMY_TASK_IDS.has(t.id));
          localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(filtered));
          localStorage.removeItem('taskora_tasks_v2');
          return filtered;
        }
      } catch {
        // ignore
      }
    }

    if (!stored) {
      localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(INITIAL_TASKS));
      return INITIAL_TASKS;
    }

    const tasks: Task[] = JSON.parse(stored);
    const cleaned = tasks.filter((t) => !DUMMY_TASK_IDS.has(t.id));
    if (cleaned.length !== tasks.length) {
      localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(cleaned));
      return cleaned;
    }
    return tasks;
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
    const oldV2 = localStorage.getItem('taskora_pomodoro_settings_v2');
    const stored = localStorage.getItem(STORAGE_KEYS.POMODORO_SETTINGS) || oldV2;
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
    const oldV2 = localStorage.getItem('taskora_productivity_history_v2');
    const stored = localStorage.getItem(STORAGE_KEYS.PRODUCTIVITY_HISTORY);

    if (!stored && oldV2) {
      try {
        const parsed: DailyProductivityRecord[] = JSON.parse(oldV2);
        if (Array.isArray(parsed)) {
          const cleaned = parsed
            .map((rec) => {
              const cleanedTaskIds = (rec.taskIdsCompleted || []).filter((id) => !DUMMY_TASK_IDS.has(id));
              const dummyDiff = (rec.taskIdsCompleted || []).length - cleanedTaskIds.length;
              return {
                ...rec,
                taskIdsCompleted: cleanedTaskIds,
                tasksCompleted: Math.max(0, rec.tasksCompleted - dummyDiff),
              };
            })
            .filter((rec) => rec.tasksCompleted > 0 || rec.focusMinutes > 0);

          localStorage.setItem(STORAGE_KEYS.PRODUCTIVITY_HISTORY, JSON.stringify(cleaned));
          localStorage.removeItem('taskora_productivity_history_v2');
          return cleaned;
        }
      } catch {
        // ignore
      }
    }

    if (!stored) {
      localStorage.setItem(STORAGE_KEYS.PRODUCTIVITY_HISTORY, JSON.stringify([]));
      return [];
    }

    const records: DailyProductivityRecord[] = JSON.parse(stored);
    const cleaned = records
      .map((rec) => {
        const cleanedTaskIds = (rec.taskIdsCompleted || []).filter((id) => !DUMMY_TASK_IDS.has(id));
        const dummyDiff = (rec.taskIdsCompleted || []).length - cleanedTaskIds.length;
        return {
          ...rec,
          taskIdsCompleted: cleanedTaskIds,
          tasksCompleted: Math.max(0, rec.tasksCompleted - dummyDiff),
        };
      })
      .filter((rec) => rec.tasksCompleted > 0 || rec.focusMinutes > 0);

    if (cleaned.length !== records.length) {
      localStorage.setItem(STORAGE_KEYS.PRODUCTIVITY_HISTORY, JSON.stringify(cleaned));
    }
    return cleaned;
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
    const oldV2 = localStorage.getItem('taskora_notifications_v2');
    if (oldV2) localStorage.removeItem('taskora_notifications_v2');

    const stored = localStorage.getItem(STORAGE_KEYS.NOTIFICATIONS);
    if (!stored) return [];

    const items: NotificationItem[] = JSON.parse(stored);
    const cleaned = items.filter((n) => !n.taskId || !DUMMY_TASK_IDS.has(n.taskId));
    if (cleaned.length !== items.length) {
      localStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(cleaned));
    }
    return cleaned;
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
    version: '3.0',
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

export function getDeletedTaskIds(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.DELETED_TASK_IDS);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

export function recordDeletedTaskId(id: string): void {
  if (typeof window === 'undefined') return;
  try {
    const list = getDeletedTaskIds();
    if (!list.includes(id)) {
      const updated = [...list.slice(-100), id];
      localStorage.setItem(STORAGE_KEYS.DELETED_TASK_IDS, JSON.stringify(updated));
    }
  } catch (e) {
    console.error('Failed to record deleted task ID', e);
  }
}

export function mergeTasks(
  localTasks: Task[],
  remoteTasks: Task[],
  remoteDeletedIds: string[] = []
): Task[] {
  const localDeleted = new Set(getDeletedTaskIds());
  const allDeleted = new Set([...localDeleted, ...remoteDeletedIds]);

  const taskMap = new Map<string, Task>();

  // Add local tasks that haven't been deleted
  for (const task of localTasks) {
    if (!allDeleted.has(task.id)) {
      taskMap.set(task.id, task);
    }
  }

  // Merge remote tasks
  for (const remote of remoteTasks) {
    if (allDeleted.has(remote.id)) continue;

    const existing = taskMap.get(remote.id);
    if (!existing) {
      taskMap.set(remote.id, remote);
    } else {
      const localTime = new Date(existing.updatedAt || existing.createdAt || 0).getTime();
      const remoteTime = new Date(remote.updatedAt || remote.createdAt || 0).getTime();
      if (remoteTime > localTime) {
        taskMap.set(remote.id, remote);
      }
    }
  }

  return Array.from(taskMap.values());
}

export function mergeProductivityHistory(
  local: DailyProductivityRecord[],
  remote: DailyProductivityRecord[]
): DailyProductivityRecord[] {
  const map = new Map<string, DailyProductivityRecord>();

  for (const item of local) {
    map.set(item.date, { ...item });
  }

  for (const rItem of remote) {
    const existing = map.get(rItem.date);
    if (!existing) {
      map.set(rItem.date, { ...rItem });
    } else {
      const allTaskIds = Array.from(new Set([...(existing.taskIdsCompleted || []), ...(rItem.taskIdsCompleted || [])]));
      map.set(rItem.date, {
        date: rItem.date,
        tasksCompleted: Math.max(existing.tasksCompleted, rItem.tasksCompleted, allTaskIds.length),
        focusMinutes: Math.max(existing.focusMinutes, rItem.focusMinutes),
        pomodorosCompleted: Math.max(existing.pomodorosCompleted, rItem.pomodorosCompleted),
        taskIdsCompleted: allTaskIds,
      });
    }
  }

  return Array.from(map.values());
}

export function resetAllData(): void {
  if (typeof window === 'undefined') return;
  Object.values(STORAGE_KEYS).forEach((k) => localStorage.removeItem(k));
  localStorage.removeItem('taskora_tasks_v2');
  localStorage.removeItem('taskora_pomodoro_settings_v2');
  localStorage.removeItem('taskora_productivity_history_v2');
  localStorage.removeItem('taskora_notifications_v2');
  localStorage.removeItem('taskora_tasks_v1');
  localStorage.removeItem('taskora_pomodoro_settings_v1');
  localStorage.removeItem('taskora_productivity_history_v1');
  localStorage.removeItem('taskora_notifications_v1');
}
