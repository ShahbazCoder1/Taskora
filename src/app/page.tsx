'use client';

import React, { useState, useEffect, useCallback, useTransition } from 'react';
import { 
  Task, 
  TaskStatus, 
  ActiveTab, 
  PomodoroSettings, 
  DailyProductivityRecord, 
  NotificationItem 
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
  resetAllData 
} from '@/lib/storage';
import { soundEffects } from '@/lib/audio';
import { checkTaskDeadlines, notifyTaskCompleted } from '@/lib/reminders';
import { usePWA } from '@/hooks/usePWA';

import { Header } from '@/components/Header';
import { NotificationCenter } from '@/components/NotificationCenter';
import { KanbanBoard } from '@/components/KanbanBoard';
import { PomodoroTimer } from '@/components/PomodoroTimer';
import { ProductivityDashboard } from '@/components/ProductivityDashboard';
import { SettingsView } from '@/components/SettingsView';
import { TaskModal } from '@/components/TaskModal';
import { MobileNavigation } from '@/components/MobileNavigation';
import { WifiOff } from 'lucide-react';

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

  // Modal & Notification Center state
  const [isTaskModalOpen, setIsTaskModalOpen] = useState<boolean>(false);
  const [taskToEdit, setTaskToEdit] = useState<Task | null>(null);
  const [defaultStatusForNew, setDefaultStatusForNew] = useState<TaskStatus>('todo');
  const [isNotificationCenterOpen, setIsNotificationCenterOpen] = useState<boolean>(false);

  // PWA & Offline
  const { isOffline } = usePWA();

  useEffect(() => {
    setMounted(true);
    const loadedTasks = getStoredTasks();
    const loadedSettings = getPomodoroSettings();
    const loadedHistory = getProductivityHistory();
    const loadedNotifications = getNotifications();

    setTasks(loadedTasks);
    setSettings(loadedSettings);
    setProductivityHistory(loadedHistory);
    setNotifications(loadedNotifications);

    const checked = checkTaskDeadlines(loadedTasks, false);
    setNotifications(checked);
  }, []);

  // Periodic reminder check
  useEffect(() => {
    if (!mounted || tasks.length === 0) return;

    const interval = setInterval(() => {
      const updatedNotifs = checkTaskDeadlines(tasks, settings.soundEnabled);
      setNotifications(updatedNotifs);
    }, 45000);

    return () => clearInterval(interval);
  }, [mounted, tasks, settings.soundEnabled]);

  const updateTasks = useCallback((newTasks: Task[]) => {
    setTasks(newTasks);
    saveStoredTasks(newTasks);
  }, []);

  const handleSaveTask = (taskData: Partial<Task>) => {
    if (taskToEdit) {
      const updated = tasks.map((t) => {
        if (t.id === taskToEdit.id) {
          const isMarkedDone = taskData.status === 'done' && t.status !== 'done';
          const isUnmarkedDone = taskData.status !== 'done' && t.status === 'done';

          if (isMarkedDone) {
            if (settings.soundEnabled) soundEffects.playCompleteTask();
            notifyTaskCompleted(t.title);
            const updatedHist = recordTaskCompletion(t.id, true);
            setProductivityHistory(updatedHist);
          } else if (isUnmarkedDone) {
            const updatedHist = recordTaskCompletion(t.id, false);
            setProductivityHistory(updatedHist);
          }

          return {
            ...t,
            ...taskData,
            completedAt: isMarkedDone ? new Date().toISOString() : isUnmarkedDone ? null : t.completedAt,
          } as Task;
        }
        return t;
      });
      updateTasks(updated);
    } else {
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
        createdAt: new Date().toISOString(),
        completedAt: taskData.status === 'done' ? new Date().toISOString() : null,
        order: tasks.length,
      };

      if (newTask.status === 'done') {
        const updatedHist = recordTaskCompletion(newTask.id, true);
        setProductivityHistory(updatedHist);
        if (settings.soundEnabled) soundEffects.playCompleteTask();
        notifyTaskCompleted(newTask.title);
      }

      updateTasks([...tasks, newTask]);
    }
    setTaskToEdit(null);
  };

  const handleDeleteTask = (taskId: string) => {
    const updated = tasks.filter((t) => t.id !== taskId);
    updateTasks(updated);
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
      if (settings.soundEnabled) soundEffects.playCompleteTask();
      notifyTaskCompleted(target.title);
      const updatedHist = recordTaskCompletion(taskId, true);
      setProductivityHistory(updatedHist);
    } else if (isUnmarkedDone) {
      const updatedHist = recordTaskCompletion(taskId, false);
      setProductivityHistory(updatedHist);
    }

    const updated = tasks.map((t) =>
      t.id === taskId
        ? {
            ...t,
            status: newStatus,
            completedAt: isMarkedDone
              ? new Date().toISOString()
              : isUnmarkedDone
              ? null
              : t.completedAt,
          }
        : t
    );
    updateTasks(updated);
  };

  const handleToggleSubtask = (taskId: string, subtaskId: string) => {
    const updated = tasks.map((t) => {
      if (t.id === taskId) {
        const updatedSubs = t.subtasks.map((s) =>
          s.id === subtaskId ? { ...s, completed: !s.completed } : s
        );
        return { ...t, subtasks: updatedSubs };
      }
      return t;
    });
    updateTasks(updated);
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

  const handleUpdateSettings = (newSettings: PomodoroSettings) => {
    setSettings(newSettings);
    savePomodoroSettings(newSettings);
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

        {activeTab === 'pomodoro' && (
          <PomodoroTimer
            settings={settings}
            tasks={tasks}
            activeTask={activeFocusTask}
            onSelectActiveTask={setActiveFocusTask}
            onPomodoroCompleted={handlePomodoroCompleted}
          />
        )}

        {activeTab === 'analytics' && (
          <ProductivityDashboard
            tasks={tasks}
            history={productivityHistory}
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
