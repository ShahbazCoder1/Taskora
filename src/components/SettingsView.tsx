import React, { useState } from 'react';
import { PomodoroSettings, SyncConnectionStatus } from '@/types';
import { soundEffects } from '@/lib/audio';
import { exportTaskoraData, importTaskoraData } from '@/lib/storage';
import { Wifi, Smartphone, Download, Upload, Trash2 } from 'lucide-react';

interface SettingsViewProps {
  settings: PomodoroSettings;
  onUpdateSettings: (newSettings: PomodoroSettings) => void;
  onDataImported: () => void;
  onResetData: () => void;
  onOpenSyncModal?: () => void;
  syncStatus?: SyncConnectionStatus;
}

export function SettingsView({
  settings,
  onUpdateSettings,
  onDataImported,
  onResetData,
  onOpenSyncModal,
  syncStatus = 'disconnected',
}: SettingsViewProps) {
  const [formData, setFormData] = useState<PomodoroSettings>(settings);
  const [saved, setSaved] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateSettings(formData);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleExport = () => {
    const jsonStr = exportTaskoraData();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `taskora-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (importTaskoraData(content)) {
        onDataImported();
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="w-full max-w-2xl mx-auto px-4 pt-4 pb-28 sm:py-6 space-y-5 text-slate-200 overflow-x-hidden">
      <div className="pb-3 border-b border-[#30363d]">
        <h2 className="text-xl font-bold text-white">Settings</h2>
        <p className="text-sm text-slate-400 mt-0.5">Configure timer durations and local data storage.</p>
      </div>

      <form onSubmit={handleSave} className="space-y-4">
        {/* Timer durations */}
        <div className="p-4 sm:p-5 rounded-xl border border-[#30363d] bg-[#161b22] space-y-3 shadow-xs">
          <h3 className="text-sm font-bold text-white">Pomodoro Durations (Minutes)</h3>
          <div className="grid grid-cols-3 gap-2.5 sm:gap-3.5">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Focus</label>
              <input
                type="number"
                min={5}
                max={90}
                value={formData.workDuration}
                onChange={(e) =>
                  setFormData({ ...formData, workDuration: parseInt(e.target.value) || 25 })
                }
                className="w-full bg-[#21262d] border border-[#30363d] rounded-md px-2.5 py-1.5 text-sm text-slate-100 focus:border-slate-400 transition"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Short Break</label>
              <input
                type="number"
                min={1}
                max={30}
                value={formData.shortBreakDuration}
                onChange={(e) =>
                  setFormData({ ...formData, shortBreakDuration: parseInt(e.target.value) || 5 })
                }
                className="w-full bg-[#21262d] border border-[#30363d] rounded-md px-2.5 py-1.5 text-sm text-slate-100 focus:border-slate-400 transition"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Long Break</label>
              <input
                type="number"
                min={5}
                max={60}
                value={formData.longBreakDuration}
                onChange={(e) =>
                  setFormData({ ...formData, longBreakDuration: parseInt(e.target.value) || 15 })
                }
                className="w-full bg-[#21262d] border border-[#30363d] rounded-md px-2.5 py-1.5 text-sm text-slate-100 focus:border-slate-400 transition"
              />
            </div>
          </div>
        </div>

        {/* Audio */}
        <div className="p-4 sm:p-5 rounded-xl border border-[#30363d] bg-[#161b22] flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="sound"
              checked={formData.soundEnabled}
              onChange={(e) => setFormData({ ...formData, soundEnabled: e.target.checked })}
              className="w-4 h-4 rounded border-slate-600 bg-[#21262d] text-slate-200"
            />
            <label htmlFor="sound" className="text-sm font-medium text-slate-200 cursor-pointer">
              Play subtle sound on completion
            </label>
          </div>
          <button
            type="button"
            onClick={() => soundEffects.playPomodoroFinish()}
            className="w-full sm:w-auto px-3 py-1.5 text-xs font-semibold rounded bg-[#21262d] hover:bg-[#30363d] text-slate-200 border border-[#30363d] transition text-center shrink-0"
          >
            Test Sound
          </button>
        </div>

        {/* Device Push Notifications */}
        <div className="p-4 sm:p-5 rounded-xl border border-[#30363d] bg-[#161b22] flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
          <div className="min-w-0">
            <div className="text-sm font-semibold text-white">Device Push Notifications</div>
            <div className="text-xs text-slate-400 mt-0.5">
              Alerts for upcoming deadlines, task completions, and focus timers.
            </div>
          </div>
          <button
            type="button"
            onClick={async () => {
              if (typeof window !== 'undefined' && 'Notification' in window) {
                const perm = await Notification.requestPermission();
                if (perm === 'granted') {
                  new Notification('Taskora Push Active', {
                    body: 'Native device notifications are enabled for task deadlines & completions.',
                    icon: '/icon-192.svg',
                  });
                }
              }
            }}
            className="w-full sm:w-auto px-3 py-1.5 text-xs font-semibold rounded bg-[#21262d] hover:bg-[#30363d] text-white border border-[#30363d] transition text-center shrink-0"
          >
            Test Notification
          </button>
        </div>

        <div className="flex items-center justify-end gap-3 pt-1">
          {saved && <span className="text-xs text-emerald-400 font-medium">Saved</span>}
          <button
            type="submit"
            className="px-5 py-2 rounded-lg bg-white hover:bg-slate-100 text-slate-950 font-bold text-xs transition shadow-xs"
          >
            Save Settings
          </button>
        </div>
      </form>

      {/* Local Wi-Fi Device Sync */}
      <div className="p-4 sm:p-5 rounded-xl border border-[#30363d] bg-[#161b22] space-y-3.5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start sm:items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shrink-0 mt-0.5 sm:mt-0">
              <Wifi className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm font-bold text-white">Local Device Sync</h3>
                {syncStatus === 'connected' ? (
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2 py-0.5 rounded bg-emerald-950/60 border border-emerald-700/80 text-emerald-300">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Connected
                  </span>
                ) : syncStatus === 'authorizing' ? (
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2 py-0.5 rounded bg-indigo-950/60 border border-indigo-700/80 text-indigo-300">
                    Authorize
                  </span>
                ) : syncStatus === 'connecting' ? (
                  <span className="text-[11px] text-amber-400 font-medium">Pairing...</span>
                ) : (
                  <span className="text-[11px] text-slate-500">Not Connected</span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">Real-time peer-to-peer sync between phone and laptop.</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onOpenSyncModal}
            className="w-full sm:w-auto px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-white hover:bg-slate-100 text-slate-950 transition flex items-center justify-center gap-1.5 shadow-xs shrink-0 self-start sm:self-auto"
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>{syncStatus === 'connected' ? 'Manage Sync' : 'Pair Device'}</span>
          </button>
        </div>
      </div>

      {/* Backup and restore */}
      <div className="p-4 sm:p-5 rounded-xl border border-[#30363d] bg-[#161b22] space-y-3.5 shadow-xs">
        <h3 className="text-sm font-bold text-white">Data & Backup</h3>
        <p className="text-xs text-slate-400">
          All data is stored locally in your browser. You can export or import your data anytime.
        </p>

        <div className="flex flex-wrap items-center gap-2.5 pt-1">
          <button
            type="button"
            onClick={handleExport}
            className="px-3 py-1.5 rounded-md bg-[#21262d] border border-[#30363d] text-xs font-semibold text-slate-200 hover:text-white hover:bg-[#30363d] transition"
          >
            Export Backup
          </button>

          <label className="px-3 py-1.5 rounded-md bg-[#21262d] border border-[#30363d] text-xs font-semibold text-slate-200 hover:text-white hover:bg-[#30363d] cursor-pointer transition">
            Import Backup
            <input type="file" accept=".json" onChange={handleImport} className="hidden" />
          </label>

          <button
            type="button"
            onClick={() => {
              if (window.confirm('Reset all tasks back to defaults?')) onResetData();
            }}
            className="px-3 py-1.5 rounded-md border border-rose-900/60 text-xs font-semibold text-rose-400 hover:bg-rose-950/40 sm:ml-auto transition"
          >
            Reset All
          </button>
        </div>
      </div>
    </div>
  );
}
