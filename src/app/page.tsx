'use client';

import React, { useState, useEffect, useCallback, useMemo, useTransition } from 'react';
import { 
  Task, 
  TaskStatus, 
  ActiveTab, 
  PomodoroSettings, 
  DailyProductivityRecord, 
  NotificationItem,
  SyncConnectionStatus,
  PairingRequestInfo 
} from '@/types';
import { 
  getStoredTasks, 
  saveStoredTasks, 
  getPomodoroSettings, 
  savePomodoroSettings, 
  getProductivityHistory, 
  recordTaskCompletion, 
  recordFocusSession, 
  getNotifications, 
  saveNotifications, 
  resetAllData,
  getTodayKey 
} from '@/lib/storage';
import { soundEffects } from '@/lib/audio';
import { checkTaskDeadlines, notifyTaskCompleted } from '@/lib/reminders';
import { triggerTaskDoneConfetti } from '@/lib/confetti';
import { 
  ensureDailyTasksForToday, 
  calculateStreakUpdate, 
  calculateStreakSummary 
} from '@/lib/streaks';
import { usePWA } from '@/hooks/usePWA';
import { syncManager } from '@/lib/sync';

import { Header } from '@/components/Header';
import { NotificationCenter } from '@/components/NotificationCenter';
import { KanbanBoard } from '@/components/KanbanBoard';
import { PomodoroTimer } from '@/components/PomodoroTimer';
import { ProductivityDashboard } from '@/components/ProductivityDashboard';
import { SettingsView } from '@/components/SettingsView';
import { TaskModal } from '@/components/TaskModal';
import { SyncModal } from '@/components/SyncModal';
import { MobileNavigation } from '@/components/MobileNavigation';
import { WifiOff, Smartphone, Check, X } from 'lucide-react';

export default function HomePage() {
  const [mounted, setMounted] = useState<boolean>(false);
  const [, startTransition] = useTransition();

  // App State
  const [tasks, setTasks] = useState<Task[]>([]);
  const [settings, setSettings] = useState<PomodoroSettings>(getPomodoroSettings);
  const [productivityHistory, setProductivityHistory] = useState<DailyProductivityRecord[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [activeTab, setActiveTab] = useState<ActiveTab>('board');
  const [activeFocusTask, setActiveFocusTask] = useState<Task | null>(null);

  // Sync state
  const [isSyncModalOpen, setIsSyncModalOpen] = useState<boolean>(false);
  const [syncStatus, setSyncStatus] = useState<SyncConnectionStatus>('disconnected');
  const [pendingPairing, setPendingPairing] = useState<PairingRequestInfo | null>(null);
  const [initialPinFromUrl, setInitialPinFromUrl] = useState<string | null>(null);

  // Modal & Notification Center state
  const [isTaskModalOpen, setIsTaskModalOpen] = useState<boolean>(false);
  const [taskToEdit, setTaskToEdit] = useState<Task | null>(null);
  const [defaultStatusForNew, setDefaultStatusForNew] = useState<TaskStatus>('todo');
  const [isNotificationCenterOpen, setIsNotificationCenterOpen] = useState<boolean>(false);

  // PWA & Offline
  const { isOffline } = usePWA();

  useEffect(() => {
    setMounted(true);
    const rawTasks = getStoredTasks();
    const { updatedTasks: loadedTasks, changed: dailyChanged } = ensureDailyTasksForToday(rawTasks);
    if (dailyChanged) {
      saveStoredTasks(loadedTasks);
    }

    const loadedSettings = getPomodoroSettings();
    const loadedHistory = getProductivityHistory();
    const loadedNotifications = getNotifications();

    setTasks(loadedTasks);
    setSettings(loadedSettings);
    setProductivityHistory(loadedHistory);
    setNotifications(loadedNotifications);

    const checked = checkTaskDeadlines(loadedTasks, false);
    setNotifications(checked);

    // Subscribe to P2P sync changes
    const unsubStatus = syncManager.onStatusChange((newStatus) => {
      setSyncStatus(newStatus);
    });

    const unsubData = syncManager.onDataSync((newTasks, newHistory, newSettings) => {
      const { updatedTasks: syncedTasks, changed } = ensureDailyTasksForToday(newTasks);
      if (changed) {
        saveStoredTasks(syncedTasks);
      }
      setTasks(syncedTasks);
      setProductivityHistory(newHistory);
      if (newSettings) {
        setSettings(newSettings);
      }
      soundEffects.playPop();
    });

    const unsubPairing = syncManager.onPairingRequest((req) => {
      setPendingPairing(req);
      if (req) {
        soundEffects.playReminderAlert();
      }
    });

    // Check URL query param for QR code auto-connect (e.g. ?syncPin=1234)
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const pinParam = urlParams.get('syncPin');
      if (pinParam && /^\d{4}$/.test(pinParam)) {
        setInitialPinFromUrl(pinParam);
        setIsSyncModalOpen(true);
      }
    }

    return () => {
      unsubStatus();
      unsubData();
      unsubPairing();
    };
  }, []);

  // Periodic reminder check & day rollover
  useEffect(() => {
    if (!mounted) return;

    const checkRollover = () => {
      setTasks((current) => {
        const { updatedTasks, changed } = ensureDailyTasksForToday(current);
        if (changed) {
          saveStoredTasks(updatedTasks);
          return updatedTasks;
        }
        return current;
      });
    };

    const interval = setInterval(() => {
      if (tasks.length > 0) {
        const updatedNotifs = checkTaskDeadlines(tasks, settings.soundEnabled);
        setNotifications(updatedNotifs);
      }
      checkRollover();
    }, 45000);

    const handleFocus = () => {
      checkRollover();
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleFocus);
    };
  }, [mounted, tasks, settings.soundEnabled]);

  const updateTasks = useCallback((newTasks: Task[]) => {
    setTasks(newTasks);
    saveStoredTasks(newTasks);
  }, []);

  const handleSaveTask = (taskData: Partial<Task>) => {
    if (taskToEdit) {
      let savedTask: Task | null = null;
      const updated = tasks.map((t) => {
        if (t.id === taskToEdit.id) {
          const isMarkedDone = taskData.status === 'done' && t.status !== 'done';
          const isUnmarkedDone = taskData.status !== 'done' && t.status === 'done';

          if (isMarkedDone) {
            triggerTaskDoneConfetti();
            if (settings.soundEnabled) soundEffects.playCompleteTask();
            notifyTaskCompleted(t.title);
            const updatedHist = recordTaskCompletion(t.id, true);
            setProductivityHistory(updatedHist);
          } else if (isUnmarkedDone) {
            const updatedHist = recordTaskCompletion(t.id, false);
            setProductivityHistory(updatedHist);
          }

          const targetStatus = taskData.status || t.status;
          const streakDiff = calculateStreakUpdate(
            { ...t, isDaily: taskData.isDaily ?? t.isDaily },
            targetStatus
          );

          savedTask = {
            ...t,
            ...taskData,
            ...streakDiff,
            updatedAt: new Date().toISOString(),
            completedAt: isMarkedDone ? new Date().toISOString() : isUnmarkedDone ? null : t.completedAt,
          } as Task;
          return savedTask;
        }
        return t;
      });
      updateTasks(updated);
      if (savedTask) {
        syncManager.broadcastTaskUpsert(savedTask);
      }
    } else {
      const isDone = (taskData.status || defaultStatusForNew) === 'done';
      const isDailyTask = Boolean(taskData.isDaily);
      const newTask: Task = {
        id: `t-${Date.now()}`,
        title: taskData.title || 'Untitled',
        description: taskData.description || '',
        status: taskData.status || defaultStatusForNew,
        priority: taskData.priority || 'medium',
        dueDate: taskData.dueDate || '',
        dueTime: taskData.dueTime,
        tags: taskData.tags || [],
        subtasks: taskData.subtasks || [],
        estimatedPomodoros: 1,
        completedPomodoros: 0,
        isDaily: isDailyTask,
        streak: isDailyTask && isDone ? 1 : 0,
        bestStreak: isDailyTask && isDone ? 1 : 0,
        lastCompletedDate: isDailyTask && isDone ? getTodayKey() : undefined,
        completedDates: isDailyTask && isDone ? [getTodayKey()] : [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        completedAt: isDone ? new Date().toISOString() : null,
        order: tasks.length,
      };

      if (newTask.status === 'done') {
        triggerTaskDoneConfetti();
        const updatedHist = recordTaskCompletion(newTask.id, true);
        setProductivityHistory(updatedHist);
        if (settings.soundEnabled) soundEffects.playCompleteTask();
        notifyTaskCompleted(newTask.title);
      }

      updateTasks([...tasks, newTask]);
      syncManager.broadcastTaskUpsert(newTask);
    }
    setTaskToEdit(null);
  };

  const handleDeleteTask = (taskId: string) => {
    const updated = tasks.filter((t) => t.id !== taskId);
    updateTasks(updated);
    syncManager.broadcastTaskDelete(taskId);
    if (activeFocusTask?.id === taskId) {
      setActiveFocusTask(null);
    }
  };

  const handleStatusChange = (taskId: string, newStatus: TaskStatus) => {
    soundEffects.playPop();

    const target = tasks.find((t) => t.id === taskId);
    if (!target) return;

    const isMarkedDone = newStatus === 'done' && target.status !== 'done';
    const isUnmarkedDone = newStatus !== 'done' && target.status === 'done';

    if (isMarkedDone) {
      triggerTaskDoneConfetti();
      if (settings.soundEnabled) soundEffects.playCompleteTask();
      notifyTaskCompleted(target.title);
      const updatedHist = recordTaskCompletion(taskId, true);
      setProductivityHistory(updatedHist);
    } else if (isUnmarkedDone) {
      const updatedHist = recordTaskCompletion(taskId, false);
      setProductivityHistory(updatedHist);
    }

    const streakDiff = calculateStreakUpdate(target, newStatus);

    let modifiedTask: Task | null = null;
    const updated = tasks.map((t) => {
      if (t.id === taskId) {
        modifiedTask = {
          ...t,
          status: newStatus,
          ...streakDiff,
          updatedAt: new Date().toISOString(),
          completedAt: isMarkedDone
            ? new Date().toISOString()
            : isUnmarkedDone
            ? null
            : t.completedAt,
        };
        return modifiedTask;
      }
      return t;
    });
    updateTasks(updated);
    if (modifiedTask) {
      syncManager.broadcastTaskUpsert(modifiedTask);
    }
  };

  const handleToggleSubtask = (taskId: string, subtaskId: string) => {
    let modifiedTask: Task | null = null;
    const updated = tasks.map((t) => {
      if (t.id === taskId) {
        const updatedSubs = t.subtasks.map((s) =>
          s.id === subtaskId ? { ...s, completed: !s.completed } : s
        );
        modifiedTask = { 
          ...t, 
          subtasks: updatedSubs, 
          updatedAt: new Date().toISOString() 
        };
        return modifiedTask;
      }
      return t;
    });
    updateTasks(updated);
    if (modifiedTask) {
      syncManager.broadcastTaskUpsert(modifiedTask);
    }
  };

  const handleStartFocus = (task: Task) => {
    setActiveFocusTask(task);
    startTransition(() => {
      setActiveTab('pomodoro');
    });
  };

  const handlePomodoroCompleted = (taskId?: string, focusMinutes = 25) => {
    const updatedHist = recordFocusSession(focusMinutes);
    setProductivityHistory(updatedHist);

    if (taskId) {
      const updated = tasks.map((t) =>
        t.id === taskId
          ? { ...t, completedPomodoros: (t.completedPomodoros || 0) + 1 }
          : t
      );
      updateTasks(updated);
    }
  };

  const handleMarkAsRead = (id: string) => {
    const updated = notifications.map((n) => (n.id === id ? { ...n, read: true } : n));
    setNotifications(updated);
    saveNotifications(updated);
  };

  const handleMarkAllAsRead = () => {
    const updated = notifications.map((n) => ({ ...n, read: true }));
    setNotifications(updated);
    saveNotifications(updated);
  };

  const handleClearAllNotifications = () => {
    setNotifications([]);
    saveNotifications([]);
  };

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
    return calculateStreakSummary(tasks, productivityHistory);
  }, [mounted, tasks, productivityHistory]);

  const handleUpdateSettings = (newSettings: PomodoroSettings) => {
    setSettings(newSettings);
    savePomodoroSettings(newSettings);
    syncManager.broadcastSettingsUpdate(newSettings);
  };

  const handleResetData = () => {
    resetAllData();
    setTasks(getStoredTasks());
    setProductivityHistory(getProductivityHistory());
    setSettings(getPomodoroSettings());
    setNotifications([]);
  };

  if (!mounted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#09090b] text-zinc-500">
        <span className="text-xs">Loading...</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#0d1117] text-slate-100 pb-16 md:pb-6">
      {isOffline && (
        <div className="bg-[#161b22] border-b border-[#30363d] px-4 py-1.5 text-center text-xs text-amber-300 flex items-center justify-center gap-2">
          <WifiOff className="w-3.5 h-3.5 text-amber-400" />
          <span>Offline mode · Changes saved locally</span>
        </div>
      )}

      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenNewTaskModal={() => {
          setTaskToEdit(null);
          setDefaultStatusForNew('todo');
          setIsTaskModalOpen(true);
        }}
        isOffline={isOffline}
        notifications={notifications}
        onToggleNotificationCenter={() =>
          setIsNotificationCenterOpen(!isNotificationCenterOpen)
        }
        isNotificationCenterOpen={isNotificationCenterOpen}
        onOpenSyncModal={() => setIsSyncModalOpen(true)}
        syncStatus={syncStatus}
        streakSummary={streakSummary}
      />

      <NotificationCenter
        notifications={notifications}
        isOpen={isNotificationCenterOpen}
        onClose={() => setIsNotificationCenterOpen(false)}
        onMarkAsRead={handleMarkAsRead}
        onMarkAllAsRead={handleMarkAllAsRead}
        onClearAll={handleClearAllNotifications}
        onSelectTask={(taskId) => {
          const t = tasks.find((item) => item.id === taskId);
          if (t) {
            setTaskToEdit(t);
            setIsTaskModalOpen(true);
          }
        }}
      />

      <main className="flex-1 w-full">
        {activeTab === 'board' && (
          <KanbanBoard
            tasks={tasks}
            onOpenNewTaskModal={(status = 'todo') => {
              setTaskToEdit(null);
              setDefaultStatusForNew(status);
              setIsTaskModalOpen(true);
            }}
            onEditTask={(task) => {
              setTaskToEdit(task);
              setIsTaskModalOpen(true);
            }}
            onDeleteTask={handleDeleteTask}
            onStatusChange={handleStatusChange}
            onStartFocus={handleStartFocus}
            onToggleSubtask={handleToggleSubtask}
          />
        )}

        <div className={activeTab === 'pomodoro' ? 'block' : 'hidden'}>
          <PomodoroTimer
            settings={settings}
            tasks={tasks}
            activeTask={activeFocusTask}
            onSelectActiveTask={setActiveFocusTask}
            onPomodoroCompleted={handlePomodoroCompleted}
          />
        </div>

        {activeTab === 'analytics' && (
          <ProductivityDashboard
            tasks={tasks}
            history={productivityHistory}
            onStatusChange={handleStatusChange}
            onOpenNewTaskModal={() => {
              setTaskToEdit(null);
              setDefaultStatusForNew('todo');
              setIsTaskModalOpen(true);
            }}
          />
        )}

        {activeTab === 'settings' && (
          <SettingsView
            settings={settings}
            onUpdateSettings={handleUpdateSettings}
            onDataImported={() => {
              setTasks(getStoredTasks());
              setSettings(getPomodoroSettings());
              setProductivityHistory(getProductivityHistory());
            }}
            onResetData={handleResetData}
            onOpenSyncModal={() => setIsSyncModalOpen(true)}
            syncStatus={syncStatus}
          />
        )}
      </main>

      <TaskModal
        isOpen={isTaskModalOpen}
        onClose={() => {
          setIsTaskModalOpen(false);
          setTaskToEdit(null);
        }}
        onSave={handleSaveTask}
        taskToEdit={taskToEdit}
        defaultStatus={defaultStatusForNew}
      />

      <SyncModal
        isOpen={isSyncModalOpen}
        onClose={() => setIsSyncModalOpen(false)}
        initialPinFromUrl={initialPinFromUrl}
      />

      {/* Floating Confirm Pairing Prompt on Laptop when modal is closed */}
      {pendingPairing && !isSyncModalOpen && (
        <aside 
          aria-label="Confirm Pairing on Laptop"
          className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-full max-w-sm px-4 animate-in slide-in-from-top-4 duration-200 pointer-events-auto"
        >
          <div className="p-3.5 rounded-xl bg-[#161b22] border border-indigo-500/70 shadow-2xl text-white space-y-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-indigo-500/15 text-indigo-400 flex items-center justify-center shrink-0">
                <Smartphone className="w-4 h-4 animate-pulse" />
              </div>
              <div className="min-w-0 flex-1">
                <h4 className="text-xs font-semibold text-white truncate">
                  Allow connection from &apos;{pendingPairing.deviceName}&apos;?
                </h4>
                <p className="text-[11px] text-slate-400">Device requested to sync tasks.</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 pt-0.5">
              <button
                onClick={() => syncManager.acceptPairing()}
                className="py-1.5 px-3 rounded-lg bg-emerald-500 hover:bg-emerald-400 active:scale-[0.98] text-slate-950 font-semibold text-xs transition flex items-center justify-center gap-1.5"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Accept</span>
              </button>
              <button
                onClick={() => syncManager.declinePairing()}
                className="py-1.5 px-3 rounded-lg bg-[#21262d] hover:bg-rose-950/60 active:scale-[0.98] text-slate-300 hover:text-rose-300 border border-[#30363d] font-medium text-xs transition flex items-center justify-center gap-1.5"
              >
                <X className="w-3.5 h-3.5" />
                <span>Decline</span>
              </button>
            </div>
          </div>
        </aside>
      )}

      <MobileNavigation
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenNewTaskModal={() => {
          setTaskToEdit(null);
          setDefaultStatusForNew('todo');
          setIsTaskModalOpen(true);
        }}
      />
    </div>
  );
}
