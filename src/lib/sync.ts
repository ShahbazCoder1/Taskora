'use client';

import { 
  Task, 
  DailyProductivityRecord, 
  PomodoroSettings, 
  SyncMessage, 
  SyncConnectionStatus, 
  TimerSyncPayload, 
  ConnectedDevice 
} from '@/types';
import { 
  getStoredTasks, 
  saveStoredTasks, 
  getProductivityHistory, 
  saveProductivityHistory, 
  getPomodoroSettings, 
  savePomodoroSettings, 
  getDeletedTaskIds, 
  recordDeletedTaskId, 
  mergeTasks, 
  mergeProductivityHistory 
} from './storage';

// Helper to determine device name
export function getDeviceName(): string {
  if (typeof window === 'undefined') return 'Taskora Device';
  const ua = navigator.userAgent;
  if (/iPad|iPhone|iPod/.test(ua)) return 'iPhone / iPad';
  if (/Android/.test(ua)) return 'Android Device';
  if (/Macintosh/.test(ua)) return 'Mac Desktop';
  if (/Windows/.test(ua)) return 'Windows PC';
  if (/Linux/.test(ua)) return 'Linux Device';
  return 'Web Device';
}

// Generate random 4-digit numeric PIN (1000 - 9999)
export function generateRandomPin(): string {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

type MessageHandler = (message: SyncMessage) => void;
type StatusHandler = (status: SyncConnectionStatus, device?: ConnectedDevice | null) => void;
type TimerSyncHandler = (payload: TimerSyncPayload) => void;
type DataSyncHandler = (tasks: Task[], history: DailyProductivityRecord[]) => void;

class DeviceSyncManager {
  private peer: any = null;
  private activeConn: any = null;
  private currentPin: string | null = null;
  private isHost: boolean = false;
  private status: SyncConnectionStatus = 'disconnected';
  private connectedDevice: ConnectedDevice | null = null;

  private statusListeners: Set<StatusHandler> = new Set();
  private timerListeners: Set<TimerSyncHandler> = new Set();
  private dataListeners: Set<DataSyncHandler> = new Set();

  constructor() {
    // Listen for cross-tab local updates using BroadcastChannel if supported
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        const bc = new BroadcastChannel('taskora_tab_sync');
        bc.onmessage = (event) => {
          if (event.data?.type === 'TAB_TIMER') {
            this.timerListeners.forEach((fn) => fn(event.data.payload));
          } else if (event.data?.type === 'TAB_DATA') {
            const tasks = getStoredTasks();
            const history = getProductivityHistory();
            this.dataListeners.forEach((fn) => fn(tasks, history));
          }
        };
      } catch (err) {
        console.warn('BroadcastChannel not initialized', err);
      }
    }
  }

  public getStatus(): SyncConnectionStatus {
    return this.status;
  }

  public getConnectedDevice(): ConnectedDevice | null {
    return this.connectedDevice;
  }

  public getCurrentPin(): string | null {
    return this.currentPin;
  }

  public getIsHost(): boolean {
    return this.isHost;
  }

  // Subscribe to connection status changes
  public onStatusChange(callback: StatusHandler): () => void {
    this.statusListeners.add(callback);
    callback(this.status, this.connectedDevice);
    return () => this.statusListeners.delete(callback);
  }

  // Subscribe to incoming live Pomodoro events
  public onTimerSync(callback: TimerSyncHandler): () => void {
    this.timerListeners.add(callback);
    return () => this.timerListeners.delete(callback);
  }

  // Subscribe to incoming database changes
  public onDataSync(callback: DataSyncHandler): () => void {
    this.dataListeners.add(callback);
    return () => this.dataListeners.delete(callback);
  }

  private setStatus(newStatus: SyncConnectionStatus, device?: ConnectedDevice | null) {
    this.status = newStatus;
    if (device !== undefined) this.connectedDevice = device;
    this.statusListeners.forEach((fn) => fn(this.status, this.connectedDevice));
  }

  // Start Host mode: generates 4-digit PIN and listens for client connection
  public async startHostSession(pin: string): Promise<string> {
    this.disconnect();
    this.isHost = true;
    this.currentPin = pin;
    this.setStatus('connecting', null);

    try {
      const PeerClass = (await import('peerjs')).default;
      const hostId = `taskora-sync-${pin}`;

      this.peer = new PeerClass(hostId, {
        debug: 1,
      });

      return new Promise((resolve, reject) => {
        this.peer.on('open', (id: string) => {
          this.setStatus('connecting', null);
          resolve(pin);
        });

        this.peer.on('connection', (conn: any) => {
          this.setupConnection(conn, false);
        });

        this.peer.on('error', (err: any) => {
          console.warn('PeerJS Host Error:', err);
          if (err?.type === 'unavailable-id') {
            // ID already in use, suggest retry
            this.setStatus('error', null);
          } else {
            this.setStatus('error', null);
          }
          reject(err);
        });
      });
    } catch (e) {
      console.error('Failed to start Host session:', e);
      this.setStatus('error', null);
      throw e;
    }
  }

  // Connect to Host via 4-digit PIN
  public async connectWithPin(pin: string): Promise<boolean> {
    this.disconnect();
    this.isHost = false;
    this.currentPin = pin;
    this.setStatus('connecting', null);

    try {
      const PeerClass = (await import('peerjs')).default;
      this.peer = new PeerClass({
        debug: 1,
      });

      return new Promise((resolve) => {
        const hostId = `taskora-sync-${pin}`;

        this.peer.on('open', () => {
          const conn = this.peer.connect(hostId, {
            reliable: true,
          });

          this.setupConnection(conn, true);

          conn.on('open', () => {
            resolve(true);
          });
        });

        this.peer.on('error', (err: any) => {
          console.warn('PeerJS Client Error:', err);
          this.setStatus('error', null);
          resolve(false);
        });

        // 12s timeout for connection attempt
        setTimeout(() => {
          if (this.status === 'connecting') {
            this.setStatus('error', null);
            resolve(false);
          }
        }, 12000);
      });
    } catch (e) {
      console.error('Failed to connect to Host:', e);
      this.setStatus('error', null);
      return false;
    }
  }

  // Setup connection handlers
  private setupConnection(conn: any, isInitiator: boolean) {
    this.activeConn = conn;

    conn.on('open', () => {
      const device: ConnectedDevice = {
        id: conn.peer,
        name: isInitiator ? 'Host Device' : 'Connected Client',
        isHost: !isInitiator,
        connectedAt: Date.now(),
      };
      this.setStatus('connected', device);

      // Send initial handshake with our device name
      this.send({
        type: 'HANDSHAKE',
        senderId: this.peer?.id || '',
        senderDevice: getDeviceName(),
        timestamp: Date.now(),
      });

      // Send full local data to perform bidirectional merge
      this.sendFullSync();
    });

    conn.on('data', (data: any) => {
      this.handleIncomingMessage(data);
    });

    conn.on('close', () => {
      this.setStatus('disconnected', null);
      this.activeConn = null;
    });

    conn.on('error', (err: any) => {
      console.warn('Data connection error:', err);
      this.setStatus('error', null);
    });
  }

  // Dispatch raw message to active WebRTC DataChannel
  private send(msg: SyncMessage): boolean {
    if (this.activeConn && this.activeConn.open) {
      try {
        this.activeConn.send(msg);
        return true;
      } catch (e) {
        console.warn('Failed to send message over DataChannel', e);
        return false;
      }
    }
    return false;
  }

  // Handle incoming messages
  private handleIncomingMessage(msg: SyncMessage) {
    if (!msg || !msg.type) return;

    switch (msg.type) {
      case 'HANDSHAKE': {
        if (this.connectedDevice) {
          const updated: ConnectedDevice = {
            ...this.connectedDevice,
            name: msg.senderDevice || this.connectedDevice.name,
          };
          this.connectedDevice = updated;
          this.statusListeners.forEach((fn) => fn('connected', updated));
        }
        break;
      }

      case 'FULL_SYNC': {
        const remoteTasks: Task[] = msg.payload?.tasks || [];
        const remoteHistory: DailyProductivityRecord[] = msg.payload?.history || [];
        const remoteSettings: PomodoroSettings | undefined = msg.payload?.settings;
        const remoteDeletedIds: string[] = msg.payload?.deletedIds || [];

        const localTasks = getStoredTasks();
        const mergedTasks = mergeTasks(localTasks, remoteTasks, remoteDeletedIds);
        saveStoredTasks(mergedTasks);

        const localHistory = getProductivityHistory();
        const mergedHistory = mergeProductivityHistory(localHistory, remoteHistory);
        saveProductivityHistory(mergedHistory);

        if (remoteSettings) {
          savePomodoroSettings(remoteSettings);
        }

        // Notify app components to re-render with merged data
        this.dataListeners.forEach((fn) => fn(mergedTasks, mergedHistory));
        this.broadcastTabMessage({ type: 'TAB_DATA' });
        break;
      }

      case 'TASK_UPSERT': {
        const task: Task = msg.payload;
        if (!task || !task.id) return;

        const currentTasks = getStoredTasks();
        const existingIdx = currentTasks.findIndex((t) => t.id === task.id);
        let updatedTasks: Task[];

        if (existingIdx >= 0) {
          updatedTasks = [...currentTasks];
          updatedTasks[existingIdx] = task;
        } else {
          updatedTasks = [task, ...currentTasks];
        }

        saveStoredTasks(updatedTasks);
        const history = getProductivityHistory();
        this.dataListeners.forEach((fn) => fn(updatedTasks, history));
        this.broadcastTabMessage({ type: 'TAB_DATA' });
        break;
      }

      case 'TASK_DELETE': {
        const taskId: string = msg.payload;
        if (!taskId) return;

        recordDeletedTaskId(taskId);
        const currentTasks = getStoredTasks();
        const updated = currentTasks.filter((t) => t.id !== taskId);
        saveStoredTasks(updated);

        const history = getProductivityHistory();
        this.dataListeners.forEach((fn) => fn(updated, history));
        this.broadcastTabMessage({ type: 'TAB_DATA' });
        break;
      }

      case 'TIMER_EVENT': {
        const timerPayload: TimerSyncPayload = msg.payload;
        if (!timerPayload) return;

        this.timerListeners.forEach((fn) => fn(timerPayload));
        this.broadcastTabMessage({ type: 'TAB_TIMER', payload: timerPayload });
        break;
      }
    }
  }

  // Cross-tab broadcast helper
  private broadcastTabMessage(data: any) {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        const bc = new BroadcastChannel('taskora_tab_sync');
        bc.postMessage(data);
        bc.close();
      } catch {
        // ignore
      }
    }
  }

  // Send full database snapshot for bidirectional merge
  public sendFullSync() {
    const tasks = getStoredTasks();
    const history = getProductivityHistory();
    const settings = getPomodoroSettings();
    const deletedIds = getDeletedTaskIds();

    this.send({
      type: 'FULL_SYNC',
      senderId: this.peer?.id || '',
      senderDevice: getDeviceName(),
      timestamp: Date.now(),
      payload: {
        tasks,
        history,
        settings,
        deletedIds,
      },
    });
  }

  // Broadcast single task create/update
  public broadcastTaskUpsert(task: Task) {
    this.send({
      type: 'TASK_UPSERT',
      senderId: this.peer?.id || '',
      senderDevice: getDeviceName(),
      timestamp: Date.now(),
      payload: {
        ...task,
        updatedAt: new Date().toISOString(),
      },
    });
  }

  // Broadcast single task deletion
  public broadcastTaskDelete(taskId: string) {
    recordDeletedTaskId(taskId);
    this.send({
      type: 'TASK_DELETE',
      senderId: this.peer?.id || '',
      senderDevice: getDeviceName(),
      timestamp: Date.now(),
      payload: taskId,
    });
  }

  // Broadcast live Pomodoro timer action (Start / Pause / Reset / Skip)
  public broadcastTimerAction(payload: TimerSyncPayload) {
    this.send({
      type: 'TIMER_EVENT',
      senderId: this.peer?.id || '',
      senderDevice: getDeviceName(),
      timestamp: Date.now(),
      payload,
    });
    this.broadcastTabMessage({ type: 'TAB_TIMER', payload });
  }

  // Disconnect active session
  public disconnect() {
    if (this.activeConn) {
      try {
        this.activeConn.close();
      } catch {
        // ignore
      }
      this.activeConn = null;
    }

    if (this.peer) {
      try {
        this.peer.destroy();
      } catch {
        // ignore
      }
      this.peer = null;
    }

    this.currentPin = null;
    this.isHost = false;
    this.setStatus('disconnected', null);
  }
}

export const syncManager = new DeviceSyncManager();
