import { Task, NotificationItem } from '@/types';
import { getNotifications, saveNotifications, getTodayKey } from './storage';
import { soundEffects } from './audio';

// Helper to send a native device push notification
export async function sendDeviceNotification(
  title: string,
  options: {
    body?: string;
    tag?: string;
    icon?: string;
    badge?: string;
    vibrate?: number[];
  } = {}
) {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return false;
  }

  try {
    // If permission has not been requested yet, request it
    let perm = Notification.permission;
    if (perm === 'default') {
      perm = await Notification.requestPermission();
    }

    if (perm !== 'granted') {
      return false;
    }

    const notifOptions = {
      body: options.body || '',
      icon: options.icon || '/icon-192.svg',
      badge: options.badge || '/icon-192.svg',
      tag: options.tag || `taskora-${Date.now()}`,
      vibrate: options.vibrate || [150, 80, 150],
    };

    // If service worker is ready, use registration.showNotification (recommended for PWA & mobile)
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      const reg = await navigator.serviceWorker.ready;
      if (reg && 'showNotification' in reg) {
        await (reg as unknown as { showNotification: (t: string, o: typeof notifOptions) => Promise<void> }).showNotification(title, notifOptions);
        return true;
      }
    }

    // Fallback to standard Window Notification
    new Notification(title, notifOptions as NotificationOptions);
    return true;
  } catch (err) {
    console.warn('Failed to display device notification:', err);
    return false;
  }
}

// Push notification when a task is completed
export function notifyTaskCompleted(taskTitle: string) {
  sendDeviceNotification('Task Completed', {
    body: `"${taskTitle}" has been marked as finished.`,
    tag: `task-completed-${Date.now()}`,
  });
}

// Push notification when a Pomodoro timer finishes
export function notifyPomodoroComplete(
  mode: 'work' | 'shortBreak' | 'longBreak',
  taskTitle?: string
) {
  if (mode === 'work') {
    sendDeviceNotification('Focus Session Complete', {
      body: taskTitle
        ? `Great focus on "${taskTitle}"! Time to take a break.`
        : 'Focus session finished. Time for a well-deserved break.',
      tag: 'pomodoro-work-complete',
    });
  } else {
    sendDeviceNotification('Break Finished', {
      body: 'Break time is over. Ready to start your next focus session?',
      tag: 'pomodoro-break-complete',
    });
  }
}

// Background checker for approaching and overdue deadlines
export function checkTaskDeadlines(tasks: Task[], playSound = false): NotificationItem[] {
  if (typeof window === 'undefined') return [];

  const existingNotifications = getNotifications();
  const existingIds = new Set(existingNotifications.map((n) => n.id));
  const newNotifications: NotificationItem[] = [];

  const now = new Date();
  const todayKey = getTodayKey();

  tasks.forEach((task) => {
    if (task.status === 'done' || !task.dueDate) return;

    const deadlineStr = task.dueTime
      ? `${task.dueDate}T${task.dueTime}:00`
      : `${task.dueDate}T23:59:59`;
    const deadline = new Date(deadlineStr);
    const timeDiffMs = deadline.getTime() - now.getTime();
    const diffHours = timeDiffMs / (1000 * 60 * 60);

    // 1. Overdue
    if (timeDiffMs < 0) {
      const notifId = `overdue-${task.id}-${todayKey}`;
      if (!existingIds.has(notifId)) {
        const item: NotificationItem = {
          id: notifId,
          taskId: task.id,
          title: 'Task Overdue',
          message: `"${task.title}" was due ${
            task.dueTime ? `at ${task.dueTime}` : `on ${task.dueDate}`
          }.`,
          type: 'overdue',
          timestamp: new Date().toISOString(),
          read: false,
        };
        newNotifications.push(item);

        // Native Device Push Notification
        sendDeviceNotification('Task Overdue', {
          body: `"${task.title}" has passed its deadline!`,
          tag: notifId,
        });
      }
    }
    // 2. Due soon (within 2 hours)
    else if (diffHours > 0 && diffHours <= 2) {
      const notifId = `due-soon-${task.id}-${todayKey}`;
      if (!existingIds.has(notifId)) {
        const item: NotificationItem = {
          id: notifId,
          taskId: task.id,
          title: 'Due Soon',
          message: `"${task.title}" is due ${
            task.dueTime ? `at ${task.dueTime}` : 'today'
          }.`,
          type: 'due_soon',
          timestamp: new Date().toISOString(),
          read: false,
        };
        newNotifications.push(item);

        // Native Device Push Notification
        sendDeviceNotification('Task Due Soon', {
          body: `"${task.title}" is due within 2 hours.`,
          tag: notifId,
        });
      }
    }
    // 3. Due today
    else if (task.dueDate === todayKey) {
      const notifId = `due-today-${task.id}-${todayKey}`;
      if (!existingIds.has(notifId)) {
        newNotifications.push({
          id: notifId,
          taskId: task.id,
          title: 'Due Today',
          message: `"${task.title}" is scheduled for today.`,
          type: 'due_today',
          timestamp: new Date().toISOString(),
          read: false,
        });
      }
    }
  });

  if (newNotifications.length > 0) {
    const updated = [...newNotifications, ...existingNotifications].slice(0, 50);
    saveNotifications(updated);

    if (playSound) {
      soundEffects.playReminderAlert();
    }

    return updated;
  }

  return existingNotifications;
}

export async function requestNotificationPermission(): Promise<NotificationPermission | null> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return null;
  }
  try {
    const permission = await Notification.requestPermission();
    return permission;
  } catch {
    return null;
  }
}
