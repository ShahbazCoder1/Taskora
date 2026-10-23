'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Task, PomodoroMode, PomodoroSettings } from '@/types';
import { Play, Pause, RotateCcw, SkipForward } from 'lucide-react';
import { soundEffects } from '@/lib/audio';
import { notifyPomodoroComplete } from '@/lib/reminders';
import { syncManager } from '@/lib/sync';

interface PomodoroTimerProps {
  settings: PomodoroSettings;
  tasks: Task[];
  activeTask: Task | null;
  onSelectActiveTask: (task: Task | null) => void;
  onPomodoroCompleted: (taskId?: string, focusMinutes?: number) => void;
}

export function PomodoroTimer({
  settings,
  tasks,
  activeTask,
  onSelectActiveTask,
  onPomodoroCompleted,
}: PomodoroTimerProps) {
  const getDuration = (currentMode: PomodoroMode) => {
    switch (currentMode) {
      case 'work':
        return settings.workDuration * 60;
      case 'shortBreak':
        return settings.shortBreakDuration * 60;
      case 'longBreak':
        return settings.longBreakDuration * 60;
    }
  };

  const initialTimer = syncManager.getTimerState();
  const [mode, setMode] = useState<PomodoroMode>(() => initialTimer?.mode || 'work');
  const [isRunning, setIsRunning] = useState<boolean>(() => Boolean(initialTimer?.isRunning));
  const [timeLeft, setTimeLeft] = useState<number>(() => {
    if (initialTimer && typeof initialTimer.timeLeft === 'number') {
      return initialTimer.timeLeft;
    }
    return getDuration('work');
  });
  const [sessionsCompletedToday, setSessionsCompletedToday] = useState<number>(0);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const masterIdRef = useRef<string | null>(initialTimer?.masterId || null);
  const targetEndTimeRef = useRef<number | null>(
    initialTimer?.isRunning
      ? Date.now() + (initialTimer.timeLeft * 1000)
      : null
  );
  const isRemoteUpdateRef = useRef<boolean>(false);

  // Subscribe to live timer synchronization from paired device
  useEffect(() => {
    const unsubscribe = syncManager.onTimerSync((payload) => {
      isRemoteUpdateRef.current = true;
      if (payload.masterId) {
        masterIdRef.current = payload.masterId;
      }
      if (payload.mode) {
        setMode(payload.mode);
      }

      // If it's a heartbeat from master, smoothly reconcile any slight drift (>= 1s)
      if (payload.action === 'heartbeat') {
        if (payload.isRunning) {
          setTimeLeft((prev) => {
            const diff = Math.abs(prev - payload.timeLeft);
            if (diff >= 1) {
              // Anchor to this device's own Date.now() to eliminate device clock skew
              targetEndTimeRef.current = Date.now() + payload.timeLeft * 1000;
              return payload.timeLeft;
            }
            return prev;
          });
        }
        setTimeout(() => {
          isRemoteUpdateRef.current = false;
        }, 50);
        return;
      }

      // For start, pause, reset, skip, mode_change:
      const computedTimeLeft = payload.timeLeft;
      if (payload.isRunning) {
        // ALWAYS anchor targetEndTime to THIS device's own Date.now()!
        // This eliminates 100% of clock skew between devices!
        targetEndTimeRef.current = Date.now() + computedTimeLeft * 1000;
      } else {
        targetEndTimeRef.current = null;
      }

      setTimeLeft(computedTimeLeft);
      setIsRunning(Boolean(payload.isRunning));

      if (payload.activeTaskId !== undefined) {
        const found = tasks.find((t) => t.id === payload.activeTaskId) || null;
        onSelectActiveTask(found);
      }

      setTimeout(() => {
        isRemoteUpdateRef.current = false;
      }, 50);
    });

    return () => unsubscribe();
  }, [tasks, onSelectActiveTask]);

  // Adjust duration if settings changed in Settings tab while timer is idle
  const prevSettingsDurationsRef = useRef({
    work: settings.workDuration,
    shortBreak: settings.shortBreakDuration,
    longBreak: settings.longBreakDuration,
  });

  useEffect(() => {
    const prev = prevSettingsDurationsRef.current;
    if (
      prev.work !== settings.workDuration ||
      prev.shortBreak !== settings.shortBreakDuration ||
      prev.longBreak !== settings.longBreakDuration
    ) {
      prevSettingsDurationsRef.current = {
        work: settings.workDuration,
        shortBreak: settings.shortBreakDuration,
        longBreak: settings.longBreakDuration,
      };
      if (!isRunning) {
        setTimeLeft(getDuration(mode));
      }
    }
  }, [settings.workDuration, settings.shortBreakDuration, settings.longBreakDuration, isRunning, mode]);

  // Handle countdown with wall-clock accuracy and visibility/focus change recovery
  useEffect(() => {
    if (isRunning) {
      if (!targetEndTimeRef.current) {
        targetEndTimeRef.current = Date.now() + timeLeft * 1000;
      }

      const updateRemaining = () => {
        if (!targetEndTimeRef.current) return;
        const remaining = Math.max(0, Math.ceil((targetEndTimeRef.current - Date.now()) / 1000));
        setTimeLeft(remaining);
        if (remaining <= 0) {
          handleComplete();
        }
      };

      updateRemaining();
      timerRef.current = setInterval(updateRemaining, 1000);

      const handleVisibilityChange = () => {
        if (document.visibilityState === 'visible') {
          updateRemaining();
        }
      };
      const handleWindowFocus = () => {
        updateRemaining();
      };

      document.addEventListener('visibilitychange', handleVisibilityChange);
      window.addEventListener('focus', handleWindowFocus);

      return () => {
        if (timerRef.current) clearInterval(timerRef.current);
        document.removeEventListener('visibilitychange', handleVisibilityChange);
        window.removeEventListener('focus', handleWindowFocus);
      };
    } else {
      targetEndTimeRef.current = null;
      if (timerRef.current) clearInterval(timerRef.current);
    }
  }, [isRunning, mode]);

  // Periodic lockstep heartbeat while timer is running (every 3 seconds)
  useEffect(() => {
    if (!isRunning) return;
    const heartbeatInterval = setInterval(() => {
      const myId = syncManager.getSessionId();
      // ONLY the active master device broadcasts heartbeats to prevent ping-pong loops
      if (masterIdRef.current === myId && !isRemoteUpdateRef.current && targetEndTimeRef.current) {
        const remaining = Math.max(0, Math.ceil((targetEndTimeRef.current - Date.now()) / 1000));
        syncManager.broadcastTimerAction({
          action: 'heartbeat',
          mode,
          timeLeft: remaining,
          isRunning: true,
          activeTaskId: activeTask?.id || null,
          timestamp: Date.now(),
          targetEndTime: null,
          masterId: myId,
        });
      }
    }, 3000);

    return () => clearInterval(heartbeatInterval);
  }, [isRunning, mode, activeTask]);

  const handleComplete = () => {
    const myId = syncManager.getSessionId();
    masterIdRef.current = myId;
    setIsRunning(false);
    targetEndTimeRef.current = null;
    if (timerRef.current) clearInterval(timerRef.current);

    if (settings.soundEnabled) {
      soundEffects.playPomodoroFinish();
    }
    notifyPomodoroComplete(mode, activeTask?.title);

    let nextMode: PomodoroMode;
    let nextDuration: number;

    if (mode === 'work') {
      onPomodoroCompleted(activeTask?.id, settings.workDuration);
      setSessionsCompletedToday((prev) => prev + 1);
      nextMode = 'shortBreak';
      nextDuration = settings.shortBreakDuration * 60;
    } else {
      nextMode = 'work';
      nextDuration = settings.workDuration * 60;
    }

    setMode(nextMode);
    setTimeLeft(nextDuration);

    if (!isRemoteUpdateRef.current) {
      syncManager.broadcastTimerAction({
        action: 'mode_change',
        mode: nextMode,
        timeLeft: nextDuration,
        isRunning: false,
        activeTaskId: activeTask?.id || null,
        timestamp: Date.now(),
        targetEndTime: null,
        masterId: myId,
      });
    }
  };

  const toggleTimer = () => {
    const nextRunning = !isRunning;
    const myId = syncManager.getSessionId();
    masterIdRef.current = myId;

    if (nextRunning) {
      targetEndTimeRef.current = Date.now() + timeLeft * 1000;
    } else {
      targetEndTimeRef.current = null;
    }
    setIsRunning(nextRunning);
    if (!isRemoteUpdateRef.current) {
      syncManager.broadcastTimerAction({
        action: nextRunning ? 'start' : 'pause',
        mode,
        timeLeft,
        isRunning: nextRunning,
        activeTaskId: activeTask?.id || null,
        timestamp: Date.now(),
        targetEndTime: null,
        masterId: myId,
      });
    }
  };

  const resetTimer = () => {
    const myId = syncManager.getSessionId();
    masterIdRef.current = myId;
    setIsRunning(false);
    targetEndTimeRef.current = null;
    const duration = getDuration(mode);
    setTimeLeft(duration);
    if (!isRemoteUpdateRef.current) {
      syncManager.broadcastTimerAction({
        action: 'reset',
        mode,
        timeLeft: duration,
        isRunning: false,
        activeTaskId: activeTask?.id || null,
        timestamp: Date.now(),
        targetEndTime: null,
        masterId: myId,
      });
    }
  };

  const skipTimer = () => {
    const myId = syncManager.getSessionId();
    masterIdRef.current = myId;
    setIsRunning(false);
    targetEndTimeRef.current = null;
    let nextMode: PomodoroMode;
    let nextDuration: number;
    if (mode === 'work') {
      nextMode = 'shortBreak';
      nextDuration = settings.shortBreakDuration * 60;
    } else {
      nextMode = 'work';
      nextDuration = settings.workDuration * 60;
    }
    setMode(nextMode);
    setTimeLeft(nextDuration);
    if (!isRemoteUpdateRef.current) {
      syncManager.broadcastTimerAction({
        action: 'skip',
        mode: nextMode,
        timeLeft: nextDuration,
        isRunning: false,
        activeTaskId: activeTask?.id || null,
        timestamp: Date.now(),
        targetEndTime: null,
        masterId: myId,
      });
    }
  };

  const switchMode = (newMode: PomodoroMode) => {
    const myId = syncManager.getSessionId();
    masterIdRef.current = myId;
    setMode(newMode);
    setIsRunning(false);
    targetEndTimeRef.current = null;
    const duration = getDuration(newMode);
    setTimeLeft(duration);
    if (!isRemoteUpdateRef.current) {
      syncManager.broadcastTimerAction({
        action: 'mode_change',
        mode: newMode,
        timeLeft: duration,
        isRunning: false,
        activeTaskId: activeTask?.id || null,
        timestamp: Date.now(),
        targetEndTime: null,
        masterId: myId,
      });
    }
  };

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const formattedTime = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  const incompleteTasks = tasks.filter((t) => t.status !== 'done');

  return (
    <div className="w-full max-w-xl mx-auto px-4 py-8 space-y-6">
      {/* Mode Selectors */}
      <div className="grid grid-cols-3 gap-1.5 p-1 rounded-lg bg-[#161b22] border border-[#30363d]">
        <button
          onClick={() => switchMode('work')}
          className={`whitespace-nowrap py-2 px-1.5 sm:px-3 rounded-md text-xs sm:text-sm font-semibold transition text-center ${
            mode === 'work'
              ? 'bg-[#21262d] text-white border border-[#30363d]'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          Focus ({settings.workDuration}m)
        </button>

        <button
          onClick={() => switchMode('shortBreak')}
          className={`whitespace-nowrap py-2 px-1.5 sm:px-3 rounded-md text-xs sm:text-sm font-semibold transition text-center ${
            mode === 'shortBreak'
              ? 'bg-[#21262d] text-white border border-[#30363d]'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          Short <span className="hidden sm:inline">Break </span>({settings.shortBreakDuration}m)
        </button>

        <button
          onClick={() => switchMode('longBreak')}
          className={`whitespace-nowrap py-2 px-1.5 sm:px-3 rounded-md text-xs sm:text-sm font-semibold transition text-center ${
            mode === 'longBreak'
              ? 'bg-[#21262d] text-white border border-[#30363d]'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          Long <span className="hidden sm:inline">Break </span>({settings.longBreakDuration}m)
        </button>
      </div>

      {/* Timer Display Box */}
      <div className="p-8 sm:p-10 rounded-xl border border-[#30363d] bg-[#161b22] text-center flex flex-col items-center justify-center space-y-6 shadow-sm">
        {/* Linked Task Selector */}
        <div className="w-full max-w-sm">
          <label className="block text-xs font-semibold text-slate-300 mb-1.5 text-left">
            Active Task (Optional)
          </label>
          <select
            value={activeTask?.id || ''}
            onChange={(e) => {
              const selected = tasks.find((t) => t.id === e.target.value) || null;
              onSelectActiveTask(selected);
              if (!isRemoteUpdateRef.current) {
                syncManager.broadcastTimerAction({
                  action: isRunning ? 'start' : 'pause',
                  mode,
                  timeLeft,
                  isRunning,
                  activeTaskId: selected?.id || null,
                  timestamp: Date.now(),
                });
              }
            }}
            className="w-full bg-[#21262d] border border-[#30363d] rounded-md px-3.5 py-2 text-sm text-slate-200 focus:border-slate-400 transition cursor-pointer"
          >
            <option value="">No task linked</option>
            {incompleteTasks.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title}
              </option>
            ))}
          </select>
        </div>

        {/* Big Clean Countdown Digits */}
        <div className="py-3">
          <span className="text-7xl sm:text-8xl font-mono font-bold tracking-tight text-white">
            {formattedTime}
          </span>
          <p className="text-sm text-slate-400 mt-2 font-medium uppercase tracking-wider">
            {isRunning ? 'Timer Running' : 'Paused'}
          </p>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-3">
          <button
            onClick={resetTimer}
            className="p-3 rounded-lg border border-[#30363d] bg-[#21262d] text-slate-300 hover:text-white hover:bg-[#30363d] transition"
            title="Reset"
          >
            <RotateCcw className="w-4.5 h-4.5" />
          </button>

          <button
            onClick={toggleTimer}
            className="whitespace-nowrap px-6 py-2.5 rounded-lg bg-white hover:bg-slate-100 text-slate-950 font-bold text-sm transition shadow-xs"
          >
            {isRunning ? (
              <span className="flex items-center gap-2 whitespace-nowrap">
                <Pause className="w-4 h-4 fill-slate-950" /> Pause
              </span>
            ) : (
              <span className="flex items-center gap-2 whitespace-nowrap">
                <Play className="w-4 h-4 fill-slate-950" /> Start
              </span>
            )}
          </button>

          <button
            onClick={skipTimer}
            className="p-3 rounded-lg border border-[#30363d] bg-[#21262d] text-slate-300 hover:text-white hover:bg-[#30363d] transition"
            title="Skip"
          >
            <SkipForward className="w-4.5 h-4.5" />
          </button>
        </div>

        {/* Session Count */}
        <div className="text-sm text-slate-400 pt-4 border-t border-[#30363d] w-full">
          <span>Completed today: </span>
          <span className="text-slate-100 font-bold">{sessionsCompletedToday} sessions</span>
          <span> ({sessionsCompletedToday * settings.workDuration} min)</span>
        </div>
      </div>
    </div>
  );
}
