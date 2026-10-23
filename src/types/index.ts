export type TaskStatus = 'todo' | 'in_progress' | 'done';

export type TaskPriority = 'low' | 'medium' | 'high';

export interface Subtask {
  id: string;
  title: string;
  completed: boolean;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: string; // YYYY-MM-DD
  dueTime?: string; // HH:mm
  tags: string[];
  subtasks: Subtask[];
  estimatedPomodoros: number;
  completedPomodoros: number;
  createdAt: string;
  updatedAt?: string;
  completedAt?: string | null;
  order: number;
}

export type PomodoroMode = 'work' | 'shortBreak' | 'longBreak';

export interface PomodoroSettings {
  workDuration: number; // in minutes (default: 25)
  shortBreakDuration: number; // in minutes (default: 5)
  longBreakDuration: number; // in minutes (default: 15)
  longBreakInterval: number; // every N work sessions (default: 4)
  autoStartBreaks: boolean;
  autoStartWork: boolean;
  soundEnabled: boolean;
  notificationEnabled: boolean;
}

export interface DailyProductivityRecord {
  date: string; // YYYY-MM-DD
  tasksCompleted: number;
  focusMinutes: number;
  pomodorosCompleted: number;
  taskIdsCompleted: string[];
}

export interface NotificationItem {
  id: string;
  taskId?: string;
  title: string;
  message: string;
  type: 'overdue' | 'due_today' | 'due_soon' | 'pomodoro' | 'streak';
  timestamp: string;
  read: boolean;
}

export type ActiveTab = 'board' | 'pomodoro' | 'analytics' | 'settings';

export interface TaskFilters {
  searchQuery: string;
  priority: 'all' | TaskPriority;
  tag: string;
  sortBy: 'order' | 'dueDate' | 'priority' | 'createdAt';
  sortDirection: 'asc' | 'desc';
}

export type SyncConnectionStatus = 'disconnected' | 'connecting' | 'authorizing' | 'connected' | 'error';

export type SyncMessageType =
  | 'PAIRING_REQUEST'
  | 'PAIRING_ACCEPTED'
  | 'PAIRING_DECLINED'
  | 'HANDSHAKE'
  | 'FULL_SYNC'
  | 'TASK_UPSERT'
  | 'TASK_DELETE'
  | 'TIMER_EVENT'
  | 'SETTINGS_UPDATE';

export interface TimerSyncPayload {
  action: 'start' | 'pause' | 'reset' | 'skip' | 'mode_change' | 'tick' | 'heartbeat';
  mode: PomodoroMode;
  timeLeft: number;
  isRunning: boolean;
  activeTaskId?: string | null;
  timestamp: number;
  targetEndTime?: number | null;
  masterId?: string | null;
}

export interface SyncMessage {
  type: SyncMessageType;
  senderId: string;
  senderDevice: string;
  timestamp: number;
  payload?: any;
}

export interface ConnectedDevice {
  id: string;
  name: string;
  isHost: boolean;
  connectedAt: number;
}

export interface PairingRequestInfo {
  deviceId: string;
  deviceName: string;
  requestedAt: number;
}
