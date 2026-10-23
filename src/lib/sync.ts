'use client';

import { 
  Task, 
  DailyProductivityRecord, 
  PomodoroSettings, 
  SyncMessage, 
  SyncConnectionStatus, 
  TimerSyncPayload, 
  ConnectedDevice,
  PairingRequestInfo
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
  if (/iPhone/.test(ua)) return 'iPhone';
  if (/iPad/.test(ua)) return 'iPad';
  if (/Android/.test(ua)) return 'Android Phone';
  if (/Macintosh/.test(ua)) return 'Mac Desktop';
  if (/Windows/.test(ua)) return 'Windows Laptop';
  if (/Linux/.test(ua)) return 'Linux PC';
  return 'Mobile Device';
}

// Generate random 4-digit numeric PIN (1000 - 9999)
export function generateRandomPin(): string {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

type MessageHandler = (message: SyncMessage) => void;
type StatusHandler = (status: SyncConnectionStatus, device?: ConnectedDevice | null) => void;
type TimerSyncHandler = (payload: TimerSyncPayload) => void;
type DataSyncHandler = (tasks: Task[], history: DailyProductivityRecord[], settings?: PomodoroSettings) => void;
type PairingRequestHandler = (request: PairingRequestInfo | null) => void;

const LOCAL_SESSION_ID = typeof window !== 'undefined'
  ? (window.sessionStorage.getItem('taskora_session_id') || (() => {
      const id = 'sess_' + Math.random().toString(36).substring(2, 9);
      try { window.sessionStorage.setItem('taskora_session_id', id); } catch {}
      return id;
    })())
  : 'server';

class DeviceSyncManager {
  private peer: any = null;
  private activeConn: any = null;
  private currentPin: string | null = null;
  private isHost: boolean = false;
  private status: SyncConnectionStatus = 'disconnected';
  private connectedDevice: ConnectedDevice | null = null;
  private pendingPairingRequest: PairingRequestInfo | null = null;
  private currentTimerState: TimerSyncPayload | null = null;

  private statusListeners: Set<StatusHandler> = new Set();
  private timerListeners: Set<TimerSyncHandler> = new Set();
  private dataListeners: Set<DataSyncHandler> = new Set();
  private pairingListeners: Set<PairingRequestHandler> = new Set();

  constructor() {
    // Listen for cross-tab local updates using BroadcastChannel if supported
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        const bc = new BroadcastChannel('taskora_tab_sync');
        bc.onmessage = (event) => {
          if (event.data?.type === 'TAB_TIMER') {
            this.currentTimerState = event.data.payload;
            this.timerListeners.forEach((fn) => fn(event.data.payload));
          } else if (event.data?.type === 'TAB_DATA') {
            const tasks = getStoredTasks();
            const history = getProductivityHistory();
            const settings = getPomodoroSettings();
            this.dataListeners.forEach((fn) => fn(tasks, history, settings));
          } else if (event.data?.type === 'TAB_SETTINGS') {
            const tasks = getStoredTasks();
            const history = getProductivityHistory();
            const settings = getPomodoroSettings();
            this.dataListeners.forEach((fn) => fn(tasks, history, settings));
          } else if (event.data?.type === 'TAB_PAIRING_REQUEST') {
            this.pendingPairingRequest = event.data.payload;
            this.pairingListeners.forEach((fn) => fn(this.pendingPairingRequest));
          } else if (event.data?.type === 'TAB_PAIRING_RESOLVED') {
            this.pendingPairingRequest = null;
            this.pairingListeners.forEach((fn) => fn(null));
          }
        };
      } catch (err) {
        console.warn('BroadcastChannel not initialized', err);
      }
    }
  }

  public getSessionId(): string {
    return LOCAL_SESSION_ID;
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

  public getPendingPairingRequest(): PairingRequestInfo | null {
    return this.pendingPairingRequest;
  }

  public getTimerState(): TimerSyncPayload | null {
    if (!this.currentTimerState) return null;
    if (this.currentTimerState.isRunning && this.currentTimerState.targetEndTime) {
      const remaining = Math.max(0, Math.ceil((this.currentTimerState.targetEndTime - Date.now()) / 1000));
      return {
        ...this.currentTimerState,
        timeLeft: remaining,
      };
    }
    return this.currentTimerState;
  }

  // Subscribe to pairing requests on Host laptop
  public onPairingRequest(callback: PairingRequestHandler): () => void {
    this.pairingListeners.add(callback);
    callback(this.pendingPairingRequest);
    return () => this.pairingListeners.delete(callback);
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
    const active = this.getTimerState();
    if (active) {
      callback(active);
    }
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
      if (isInitiator) {
        // Client (Phone): Request authorization from laptop before exchanging tasks
        this.setStatus('authorizing', null);

        this.send({
          type: 'PAIRING_REQUEST',
          senderId: this.peer?.id || '',
          senderDevice: getDeviceName(),
          timestamp: Date.now(),
        });
      } else {
        // Host (Laptop): Wait for client's PAIRING_REQUEST.
        // DO NOT send any tasks or data yet!
        this.setStatus('connecting', null);
      }
    });

    conn.on('data', (data: any) => {
      this.handleIncomingMessage(data);
    });

    conn.on('close', () => {
      this.pendingPairingRequest = null;
      this.pairingListeners.forEach((fn) => fn(null));
      if (this.isHost) {
        this.setStatus('connecting', null);
      } else {
        this.setStatus('disconnected', null);
      }
      this.activeConn = null;
    });

    conn.on('error', (err: any) => {
      console.warn('Data connection error:', err);
      this.pendingPairingRequest = null;
      this.pairingListeners.forEach((fn) => fn(null));
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
      case 'PAIRING_REQUEST': {
        // Received on Laptop Host from Phone
        const req: PairingRequestInfo = {
          deviceId: msg.senderId || this.activeConn?.peer || 'client',
          deviceName: msg.senderDevice || 'Phone',
          requestedAt: Date.now(),
        };
        this.pendingPairingRequest = req;
        this.setStatus('authorizing', null);
        this.pairingListeners.forEach((fn) => fn(req));
        this.broadcastTabMessage({ type: 'TAB_PAIRING_REQUEST', payload: req });
        break;
      }

      case 'PAIRING_ACCEPTED': {
        // Received on Phone Client when Laptop clicked "Accept"
        const hostDevice: ConnectedDevice = {
          id: msg.senderId || this.activeConn?.peer || 'host',
          name: msg.senderDevice || 'Laptop',
          isHost: false,
          connectedAt: Date.now(),
        };
        this.setStatus('connected', hostDevice);

        // NOW exchange tasks and data safely
        this.sendFullSync();
        break;
      }

      case 'PAIRING_DECLINED': {
        // Received on Phone Client when Laptop clicked "Decline"
        if (this.activeConn) {
          try {
            this.activeConn.close();
          } catch {}
          this.activeConn = null;
        }
        this.setStatus('error', null);
        break;
      }

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
        this.dataListeners.forEach((fn) => fn(mergedTasks, mergedHistory, remoteSettings));
        this.broadcastTabMessage({ type: 'TAB_DATA' });

        // Synchronize active timer state if present
        if (msg.payload?.timerState) {
          const remoteTimer: TimerSyncPayload = { ...msg.payload.timerState };
          if (remoteTimer.isRunning) {
            // Anchor targetEndTime to receiver's own local clock to eliminate device clock skew
            remoteTimer.targetEndTime = Date.now() + remoteTimer.timeLeft * 1000;
          } else {
            remoteTimer.targetEndTime = null;
          }
          this.currentTimerState = remoteTimer;
          this.timerListeners.forEach((fn) => fn(remoteTimer));
          this.broadcastTabMessage({ type: 'TAB_TIMER', payload: remoteTimer });
        }
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

        if (timerPayload.isRunning) {
          // Anchor targetEndTime to receiver's own local clock to eliminate device clock skew
          timerPayload.targetEndTime = Date.now() + timerPayload.timeLeft * 1000;
        } else {
          timerPayload.targetEndTime = null;
        }

        this.currentTimerState = timerPayload;
        this.timerListeners.forEach((fn) => fn(timerPayload));
        this.broadcastTabMessage({ type: 'TAB_TIMER', payload: timerPayload });
        break;
      }

      case 'SETTINGS_UPDATE': {
        const settings: PomodoroSettings = msg.payload;
        if (!settings) return;

        savePomodoroSettings(settings);
        const tasks = getStoredTasks();
        const history = getProductivityHistory();
        this.dataListeners.forEach((fn) => fn(tasks, history, settings));
        this.broadcastTabMessage({ type: 'TAB_SETTINGS', payload: settings });
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

    let timerSnapshot: TimerSyncPayload | null = null;
    const current = this.getTimerState();
    if (current) {
      timerSnapshot = {
        ...current,
        timestamp: Date.now(),
      };
    }

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
        timerState: timerSnapshot,
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
    if (payload.isRunning && !payload.targetEndTime) {
      payload.targetEndTime = Date.now() + payload.timeLeft * 1000;
    } else if (!payload.isRunning) {
      payload.targetEndTime = null;
    }
    this.currentTimerState = payload;
    this.send({
      type: 'TIMER_EVENT',
      senderId: this.peer?.id || '',
      senderDevice: getDeviceName(),
      timestamp: Date.now(),
      payload,
    });
    this.broadcastTabMessage({ type: 'TAB_TIMER', payload });
  }

  // Broadcast Pomodoro settings update (durations, sound, etc.)
  public broadcastSettingsUpdate(settings: PomodoroSettings) {
    savePomodoroSettings(settings);
    this.send({
      type: 'SETTINGS_UPDATE',
      senderId: this.peer?.id || '',
      senderDevice: getDeviceName(),
      timestamp: Date.now(),
      payload: settings,
    });
    this.broadcastTabMessage({ type: 'TAB_SETTINGS', payload: settings });
  }

  // Host approves connection from client device (e.g. iPhone)
  public acceptPairing() {
    if (!this.activeConn || !this.pendingPairingRequest) return;

    const clientName = this.pendingPairingRequest.deviceName;
    const clientId = this.pendingPairingRequest.deviceId;

    // Send confirmation to client
    this.send({
      type: 'PAIRING_ACCEPTED',
      senderId: this.peer?.id || '',
      senderDevice: getDeviceName(),
      timestamp: Date.now(),
    });

    const device: ConnectedDevice = {
      id: clientId || this.activeConn.peer,
      name: clientName,
      isHost: true,
      connectedAt: Date.now(),
    };

    this.pendingPairingRequest = null;
    this.pairingListeners.forEach((fn) => fn(null));
    this.setStatus('connected', device);
    this.broadcastTabMessage({ type: 'TAB_PAIRING_RESOLVED' });

    // Now exchange full local tasks and data with authorized client
    this.sendFullSync();
  }

  // Host declines connection from client device
  public declinePairing() {
    if (this.activeConn) {
      this.send({
        type: 'PAIRING_DECLINED',
        senderId: this.peer?.id || '',
        senderDevice: getDeviceName(),
        timestamp: Date.now(),
      });

      setTimeout(() => {
        try {
          this.activeConn?.close();
        } catch {
          // ignore
        }
        this.activeConn = null;
      }, 150);
    }

    this.pendingPairingRequest = null;
    this.pairingListeners.forEach((fn) => fn(null));
    this.broadcastTabMessage({ type: 'TAB_PAIRING_RESOLVED' });

    // Host remains listening for next pairing attempt
    this.setStatus('connecting', null);
  }

  // Disconnect active session
  public disconnect() {
    this.pendingPairingRequest = null;
    this.pairingListeners.forEach((fn) => fn(null));
    this.broadcastTabMessage({ type: 'TAB_PAIRING_RESOLVED' });

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
