'use client';

import React, { useState, useEffect } from 'react';
import { 
  X, 
  Smartphone, 
  Monitor, 
  Wifi, 
  Check, 
  Copy, 
  RefreshCw, 
  ArrowRight, 
  Unlink, 
  Activity, 
  QrCode, 
  KeyRound, 
  ShieldCheck,
  ShieldAlert,
  Shield 
} from 'lucide-react';
import QRCode from 'qrcode';
import { syncManager, generateRandomPin, getDeviceName } from '@/lib/sync';
import { SyncConnectionStatus, ConnectedDevice, PairingRequestInfo } from '@/types';

interface SyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialPinFromUrl?: string | null;
}

export function SyncModal({ isOpen, onClose, initialPinFromUrl }: SyncModalProps) {
  const [activeTab, setActiveTab] = useState<'host' | 'client'>('host');
  const [pin, setPin] = useState<string>('');
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [clientInputPin, setClientInputPin] = useState<string>('');
  const [status, setStatus] = useState<SyncConnectionStatus>('disconnected');
  const [connectedDevice, setConnectedDevice] = useState<ConnectedDevice | null>(null);
  const [pendingPairing, setPendingPairing] = useState<PairingRequestInfo | null>(null);
  const [isCopied, setIsCopied] = useState<boolean>(false);
  const [isSyncingNow, setIsSyncingNow] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');

  // Subscribe to syncManager status & pairing requests
  useEffect(() => {
    const unsubscribeStatus = syncManager.onStatusChange((newStatus, device) => {
      setStatus(newStatus);
      setConnectedDevice(device || null);
      if (newStatus === 'connected') {
        setErrorMessage('');
      } else if (newStatus === 'error') {
        setErrorMessage('Connection failed or was declined. Verify the PIN and make sure both devices are on the network.');
      }
    });

    const unsubscribePairing = syncManager.onPairingRequest((req) => {
      setPendingPairing(req);
    });

    return () => {
      unsubscribeStatus();
      unsubscribePairing();
    };
  }, []);

  // Handle URL auto-connect if opened with ?syncPin=XXXX
  useEffect(() => {
    if (initialPinFromUrl && initialPinFromUrl.length === 4 && status === 'disconnected') {
      setActiveTab('client');
      setClientInputPin(initialPinFromUrl);
      handleClientConnect(initialPinFromUrl);
    }
  }, [initialPinFromUrl, status]);

  // Generate new Host PIN & QR Code
  const initHostPin = async (newPin?: string) => {
    const code = newPin || generateRandomPin();
    setPin(code);
    setErrorMessage('');

    // Generate QR code pointing to this website with ?syncPin=code
    if (typeof window !== 'undefined') {
      const url = `${window.location.origin}/?syncPin=${code}`;
      try {
        const qr = await QRCode.toDataURL(url, {
          width: 220,
          margin: 1.5,
          color: {
            dark: '#ffffff',
            light: '#161b22',
          },
        });
        setQrDataUrl(qr);
      } catch (err) {
        console.warn('Failed to generate QR code', err);
      }
    }

    try {
      await syncManager.startHostSession(code);
    } catch (err) {
      console.warn('Error starting host session', err);
    }
  };

  // Open modal initial state
  useEffect(() => {
    if (isOpen) {
      if (status === 'disconnected') {
        initHostPin();
      }
    }
  }, [isOpen]);

  const handleClientConnect = async (pinToUse?: string) => {
    const targetPin = (pinToUse || clientInputPin).trim();
    if (targetPin.length !== 4 || !/^\d{4}$/.test(targetPin)) {
      setErrorMessage('Please enter a valid 4-digit PIN.');
      return;
    }

    setErrorMessage('');
    const success = await syncManager.connectWithPin(targetPin);
    if (!success && status !== 'connected') {
      setErrorMessage('Could not connect. Verify the PIN and make sure both devices are on the same Wi-Fi network.');
    }
  };

  const handleCopyPin = () => {
    if (!pin) return;
    navigator.clipboard.writeText(pin);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleManualSyncNow = () => {
    setIsSyncingNow(true);
    syncManager.sendFullSync();
    setTimeout(() => setIsSyncingNow(false), 1200);
  };

  const handleDisconnect = () => {
    syncManager.disconnect();
    initHostPin();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
      <div 
        className="w-full max-w-md rounded-2xl bg-[#161b22] border border-[#30363d] shadow-2xl text-slate-200 overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#30363d]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <Wifi className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white">Local Device Sync</h3>
              <p className="text-xs text-slate-400">Wi-Fi Peer-to-Peer & Realtime Sync</p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-[#21262d] transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-5">
          {/* Status Banner when Connected */}
          {status === 'connected' ? (
            <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-800/80 space-y-3.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="relative flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" />
                  </span>
                  <span className="text-sm font-bold text-emerald-300">Live P2P Connected</span>
                </div>
                <span className="text-xs text-emerald-400/80 font-mono">0ms Local Wi-Fi</span>
              </div>

              {/* Connected Device Card */}
              <div className="p-3 rounded-lg bg-[#21262d] border border-[#30363d] flex items-center justify-between text-xs">
                <div className="flex items-center gap-2.5">
                  {connectedDevice?.name.toLowerCase().includes('phone') || connectedDevice?.name.toLowerCase().includes('iphone') ? (
                    <Smartphone className="w-4 h-4 text-indigo-400" />
                  ) : (
                    <Monitor className="w-4 h-4 text-indigo-400" />
                  )}
                  <div>
                    <span className="text-white font-semibold block">{connectedDevice?.name || 'Peer Device'}</span>
                    <span className="text-slate-400 text-[11px]">Tasks & Live Timer Synchronized</span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                  <ShieldCheck className="w-4 h-4" />
                  <span>Encrypted</span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2.5 pt-1">
                <button
                  onClick={handleManualSyncNow}
                  disabled={isSyncingNow}
                  className="flex-1 py-2 px-3 rounded-lg bg-white hover:bg-slate-100 text-slate-950 text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-xs"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isSyncingNow ? 'animate-spin' : ''}`} />
                  <span>{isSyncingNow ? 'Syncing...' : 'Sync All Data Now'}</span>
                </button>

                <button
                  onClick={handleDisconnect}
                  className="py-2 px-3 rounded-lg bg-[#21262d] hover:bg-rose-950/50 text-slate-300 hover:text-rose-300 border border-[#30363d] hover:border-rose-800 text-xs font-semibold transition flex items-center gap-1.5"
                >
                  <Unlink className="w-3.5 h-3.5" />
                  <span>Disconnect</span>
                </button>
              </div>
            </div>
          ) : pendingPairing ? (
            /* Confirm Pairing on Laptop Prompt */
            <div className="p-5 rounded-2xl bg-[#1c2128] border-2 border-indigo-500 shadow-2xl space-y-4 animate-in zoom-in-95 duration-200">
              <div className="flex items-start gap-3.5">
                <div className="w-12 h-12 rounded-xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shrink-0 mt-0.5">
                  <Smartphone className="w-6 h-6 animate-pulse" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-indigo-500/25 text-indigo-300">
                      Confirm Pairing on Laptop
                    </span>
                    <span className="text-[11px] text-slate-400 font-mono">P2P Security</span>
                  </div>
                  <h4 className="text-base font-bold text-white leading-snug">
                    Allow connection from &apos;{pendingPairing.deviceName}&apos;?
                  </h4>
                  <p className="text-xs text-slate-300 mt-1.5 leading-relaxed">
                    A nearby device entered your 4-digit PIN. Confirm below before exchanging any tasks or timers.
                  </p>
                </div>
              </div>

              {/* Security info note */}
              <div className="p-3 rounded-lg bg-[#161b22] border border-[#30363d] text-xs text-slate-300 flex items-center gap-2.5">
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Encrypted P2P connection. Your tasks remain private on your devices.</span>
              </div>

              {/* Accept / Decline Action Buttons */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                <button
                  onClick={() => syncManager.acceptPairing()}
                  className="py-2.5 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 active:scale-[0.98] text-slate-950 font-bold text-xs transition flex items-center justify-center gap-1.5 shadow-md shadow-emerald-500/20"
                >
                  <Check className="w-4 h-4" />
                  <span>Accept</span>
                </button>
                <button
                  onClick={() => syncManager.declinePairing()}
                  className="py-2.5 px-4 rounded-xl bg-[#21262d] hover:bg-rose-950/60 active:scale-[0.98] text-slate-300 hover:text-rose-300 border border-[#30363d] hover:border-rose-800 font-semibold text-xs transition flex items-center justify-center gap-1.5"
                >
                  <X className="w-4 h-4" />
                  <span>Decline</span>
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Tab Selector */}
              <div className="grid grid-cols-2 gap-1 p-1 rounded-lg bg-[#21262d] border border-[#30363d] text-xs font-semibold">
                <button
                  onClick={() => {
                    setActiveTab('host');
                    setErrorMessage('');
                    if (!pin) initHostPin();
                  }}
                  className={`py-2 px-3 rounded-md transition flex items-center justify-center gap-2 ${
                    activeTab === 'host'
                      ? 'bg-white text-slate-950 shadow-xs'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <QrCode className="w-3.5 h-3.5" />
                  <span>Pair This Device</span>
                </button>

                <button
                  onClick={() => {
                    setActiveTab('client');
                    setErrorMessage('');
                  }}
                  className={`py-2 px-3 rounded-md transition flex items-center justify-center gap-2 ${
                    activeTab === 'client'
                      ? 'bg-white text-slate-950 shadow-xs'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <KeyRound className="w-3.5 h-3.5" />
                  <span>Connect with PIN</span>
                </button>
              </div>

              {/* Error Alert */}
              {errorMessage && (
                <div className="p-3 rounded-lg bg-rose-950/50 border border-rose-800 text-xs text-rose-300 leading-relaxed">
                  {errorMessage}
                </div>
              )}

              {/* Client Waiting for Laptop Approval Screen */}
              {status === 'authorizing' && activeTab === 'client' ? (
                <div className="p-5 rounded-2xl bg-[#1c2128] border border-amber-500/40 text-center space-y-4 animate-in fade-in duration-200">
                  <div className="w-12 h-12 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mx-auto">
                    <ShieldAlert className="w-6 h-6 animate-pulse" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white">
                      Waiting for Confirmation on Laptop...
                    </h4>
                    <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                      Your laptop is showing: <br />
                      <span className="font-semibold text-indigo-300">
                        &ldquo;Allow connection from &apos;{getDeviceName()}&apos;? [Accept / Decline]&rdquo;
                      </span>
                    </p>
                    <p className="text-[11px] text-slate-400 mt-2">
                      Please tap <strong className="text-emerald-400 font-semibold">Accept</strong> on your laptop before exchanging any tasks.
                    </p>
                  </div>

                  <div className="flex items-center justify-center gap-2 text-xs text-amber-400 pt-1">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Awaiting laptop approval...</span>
                  </div>

                  <button
                    onClick={handleDisconnect}
                    className="py-1.5 px-4 rounded-lg bg-[#21262d] hover:bg-[#30363d] text-xs text-slate-300 hover:text-white transition"
                  >
                    Cancel Request
                  </button>
                </div>
              ) : (
                <>
                  {/* Tab 1: Host Mode (Show PIN & QR Code) */}
                  {activeTab === 'host' && (
                    <div className="space-y-4 text-center">
                      <p className="text-xs text-slate-300">
                        Scan this QR code with your phone camera or enter the 4-digit PIN on your other device.
                      </p>

                      {/* 4-Digit PIN Display */}
                      <div className="p-4 rounded-xl bg-[#21262d] border border-[#30363d] flex flex-col items-center justify-center">
                        <span className="text-xs uppercase tracking-wider text-slate-400 font-bold mb-1">
                          Your Device PIN
                        </span>
                        <div className="flex items-center gap-3">
                          <span className="text-4xl font-mono font-extrabold tracking-widest text-white">
                            {pin || '----'}
                          </span>
                          <button
                            onClick={handleCopyPin}
                            className="p-2 rounded-lg bg-[#161b22] hover:bg-[#30363d] border border-[#30363d] text-slate-300 hover:text-white transition"
                            title="Copy PIN"
                          >
                            {isCopied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                          </button>
                          <button
                            onClick={() => initHostPin()}
                            className="p-2 rounded-lg bg-[#161b22] hover:bg-[#30363d] border border-[#30363d] text-slate-300 hover:text-white transition"
                            title="Regenerate PIN"
                          >
                            <RefreshCw className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* QR Code Container */}
                      {qrDataUrl && (
                        <div className="flex flex-col items-center justify-center p-3 rounded-xl bg-[#21262d] border border-[#30363d] w-fit mx-auto shadow-sm">
                          <img 
                            src={qrDataUrl} 
                            alt="Taskora Sync QR Code" 
                            className="w-44 h-44 rounded-lg bg-[#161b22]"
                          />
                          <span className="text-[11px] text-slate-400 mt-2 font-medium">
                            Instant Scan & Connect
                          </span>
                        </div>
                      )}

                      {/* Waiting Status */}
                      <div className="flex items-center justify-center gap-2 text-xs text-amber-400 pt-1">
                        <span className="relative flex h-2.5 w-2.5">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500" />
                        </span>
                        <span>Waiting for other device on same Wi-Fi...</span>
                      </div>
                    </div>
                  )}

                  {/* Tab 2: Client Mode (Enter PIN) */}
                  {activeTab === 'client' && (
                    <div className="space-y-4">
                      <p className="text-xs text-slate-300 leading-relaxed">
                        Enter the 4-digit PIN displayed on your desktop or other device:
                      </p>

                      <div className="space-y-2">
                        <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">
                          4-Digit PIN
                        </label>
                        <input
                          type="text"
                          maxLength={4}
                          inputMode="numeric"
                          placeholder="1234"
                          value={clientInputPin}
                          onChange={(e) => {
                            const val = e.target.value.replace(/\D/g, '').slice(0, 4);
                            setClientInputPin(val);
                            if (val.length === 4) {
                              handleClientConnect(val);
                            }
                          }}
                          className="w-full text-center text-3xl font-mono font-bold tracking-widest py-3 bg-[#21262d] border border-[#30363d] rounded-xl text-white placeholder:text-slate-600 focus:border-indigo-400 transition"
                          autoFocus
                        />
                      </div>

                      <button
                        onClick={() => handleClientConnect()}
                        disabled={clientInputPin.length !== 4 || status === 'connecting'}
                        className="w-full py-2.5 rounded-xl bg-white hover:bg-slate-100 disabled:opacity-50 text-slate-950 font-bold text-sm transition shadow-xs flex items-center justify-center gap-2"
                      >
                        {status === 'connecting' ? (
                          <>
                            <RefreshCw className="w-4 h-4 animate-spin" />
                            <span>Connecting...</span>
                          </>
                        ) : (
                          <>
                            <span>Connect & Sync</span>
                            <ArrowRight className="w-4 h-4" />
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </>
              )}
            </>
          )}

          {/* Wi-Fi & Privacy Notice */}
          <div className="pt-2 border-t border-[#30363d] text-[11px] text-slate-400 leading-relaxed space-y-1">
            <div className="flex items-center gap-1.5 font-semibold text-slate-300">
              <Activity className="w-3.5 h-3.5 text-indigo-400" />
              <span>How Local P2P Sync Works:</span>
            </div>
            <p>
              Devices exchange a direct WebRTC DataChannel over your local Wi-Fi. 
              All data stays on your devices locally — zero database servers involved.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
