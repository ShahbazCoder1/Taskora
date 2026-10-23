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
  QrCode, 
  KeyRound 
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
        setErrorMessage('Connection failed or was declined.');
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

    if (typeof window !== 'undefined') {
      const url = `${window.location.origin}/?syncPin=${code}`;
      try {
        const qr = await QRCode.toDataURL(url, {
          width: 148,
          margin: 1,
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

  useEffect(() => {
    if (isOpen && status === 'disconnected') {
      initHostPin();
    }
  }, [isOpen]);

  const handleClientConnect = async (pinToUse?: string) => {
    const targetPin = (pinToUse || clientInputPin).trim();
    if (targetPin.length !== 4 || !/^\d{4}$/.test(targetPin)) {
      setErrorMessage('Please enter a 4-digit PIN.');
      return;
    }

    setErrorMessage('');
    const success = await syncManager.connectWithPin(targetPin);
    if (!success && status !== 'connected') {
      setErrorMessage('Could not connect. Verify the PIN.');
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
    setTimeout(() => setIsSyncingNow(false), 1000);
  };

  const handleDisconnect = () => {
    syncManager.disconnect();
    setPendingPairing(null);
    initHostPin();
  };

  if (!isOpen) return null;

  const isMobileDevice = connectedDevice?.name.toLowerCase().includes('phone') || 
                         connectedDevice?.name.toLowerCase().includes('iphone') || 
                         connectedDevice?.name.toLowerCase().includes('android');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-150 overflow-y-auto">
      <div 
        className="w-full max-w-sm rounded-xl bg-[#161b22] border border-[#30363d] shadow-2xl text-slate-200 overflow-hidden max-h-[90vh] flex flex-col my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#30363d] shrink-0">
          <div className="flex items-center gap-2">
            <Wifi className="w-4 h-4 text-indigo-400" />
            <h3 className="font-semibold text-sm text-white">Device Sync</h3>
          </div>
          <button 
            onClick={onClose} 
            className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-[#21262d] transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-3.5 overflow-y-auto">
          {/* View 1: Connected State */}
          {status === 'connected' ? (
            <div className="space-y-3">
              <div className="p-3 rounded-lg bg-[#21262d] border border-[#30363d] flex items-center justify-between">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/15 text-emerald-400 flex items-center justify-center shrink-0">
                    {isMobileDevice ? <Smartphone className="w-4 h-4" /> : <Monitor className="w-4 h-4" />}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      <span className="text-white text-xs font-semibold truncate">
                        {connectedDevice?.name || 'Peer Device'}
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-400 block">P2P Connected</span>
                  </div>
                </div>

                <button
                  onClick={handleDisconnect}
                  className="px-2.5 py-1 rounded text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 border border-[#30363d] hover:border-rose-900 transition font-medium shrink-0"
                >
                  Disconnect
                </button>
              </div>

              <button
                onClick={handleManualSyncNow}
                disabled={isSyncingNow}
                className="w-full py-2 px-3 rounded-lg bg-white hover:bg-slate-100 text-slate-950 text-xs font-semibold transition flex items-center justify-center gap-1.5"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncingNow ? 'animate-spin' : ''}`} />
                <span>{isSyncingNow ? 'Syncing...' : 'Sync Now'}</span>
              </button>
            </div>
          ) : pendingPairing ? (
            /* View 2: Confirm Pairing on Laptop Prompt */
            <div className="p-3.5 rounded-lg bg-[#21262d] border border-indigo-500/50 space-y-3">
              <div className="flex items-start gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-indigo-500/15 text-indigo-400 flex items-center justify-center shrink-0 mt-0.5">
                  <Smartphone className="w-4 h-4 animate-pulse" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-white leading-tight">
                    Allow connection from &apos;{pendingPairing.deviceName}&apos;?
                  </h4>
                  <p className="text-xs text-slate-400 mt-1">
                    Accept on your laptop to start syncing tasks.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  onClick={() => syncManager.acceptPairing()}
                  className="py-2 px-3 rounded-lg bg-emerald-500 hover:bg-emerald-400 active:scale-[0.98] text-slate-950 font-semibold text-xs transition flex items-center justify-center gap-1.5"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Accept</span>
                </button>
                <button
                  onClick={() => syncManager.declinePairing()}
                  className="py-2 px-3 rounded-lg bg-[#161b22] hover:bg-rose-950/60 active:scale-[0.98] text-slate-300 hover:text-rose-300 border border-[#30363d] font-medium text-xs transition flex items-center justify-center gap-1.5"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>Decline</span>
                </button>
              </div>
            </div>
          ) : (
            /* View 3: Pair / Connect Tabs */
            <>
              {/* Tab Selector */}
              <div className="grid grid-cols-2 gap-1 p-0.5 rounded-lg bg-[#21262d] border border-[#30363d] text-xs font-medium">
                <button
                  onClick={() => {
                    setActiveTab('host');
                    setErrorMessage('');
                    if (!pin) initHostPin();
                  }}
                  className={`py-1.5 px-2.5 rounded-md transition flex items-center justify-center gap-1.5 ${
                    activeTab === 'host'
                      ? 'bg-white text-slate-950 font-semibold shadow-xs'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <QrCode className="w-3.5 h-3.5" />
                  <span>Host (PIN & QR)</span>
                </button>

                <button
                  onClick={() => {
                    setActiveTab('client');
                    setErrorMessage('');
                  }}
                  className={`py-1.5 px-2.5 rounded-md transition flex items-center justify-center gap-1.5 ${
                    activeTab === 'client'
                      ? 'bg-white text-slate-950 font-semibold shadow-xs'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <KeyRound className="w-3.5 h-3.5" />
                  <span>Connect</span>
                </button>
              </div>

              {/* Error Alert */}
              {errorMessage && (
                <div className="p-2.5 rounded-lg bg-rose-950/50 border border-rose-800 text-xs text-rose-300">
                  {errorMessage}
                </div>
              )}

              {/* Client Waiting for Approval */}
              {status === 'authorizing' && activeTab === 'client' ? (
                <div className="p-4 rounded-lg bg-[#21262d] border border-amber-500/40 text-center space-y-3">
                  <div className="w-8 h-8 rounded-full bg-amber-500/15 text-amber-400 flex items-center justify-center mx-auto">
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold text-white">
                      Waiting for Confirmation on Laptop
                    </h4>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Tap <strong className="text-emerald-400">Accept</strong> on your laptop to connect.
                    </p>
                  </div>
                  <button
                    onClick={handleDisconnect}
                    className="py-1 px-3 rounded text-xs text-slate-400 hover:text-white hover:bg-[#161b22] transition"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <>
                  {/* Host Mode */}
                  {activeTab === 'host' && (
                    <div className="space-y-3 text-center">
                      {/* PIN Card */}
                      <div className="p-2.5 rounded-lg bg-[#21262d] border border-[#30363d] flex items-center justify-between px-3">
                        <span className="text-xs text-slate-400 font-medium">PIN</span>
                        <span className="text-2xl font-mono font-bold tracking-widest text-white">
                          {pin || '----'}
                        </span>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={handleCopyPin}
                            className="p-1.5 rounded-md hover:bg-[#30363d] text-slate-300 hover:text-white transition"
                            title="Copy PIN"
                          >
                            {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                          <button
                            onClick={() => initHostPin()}
                            className="p-1.5 rounded-md hover:bg-[#30363d] text-slate-300 hover:text-white transition"
                            title="Regenerate PIN"
                          >
                            <RefreshCw className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* QR Code */}
                      {qrDataUrl && (
                        <div className="flex justify-center p-2 rounded-lg bg-[#21262d] border border-[#30363d] w-fit mx-auto">
                          <img 
                            src={qrDataUrl} 
                            alt="Sync QR Code" 
                            className="w-36 h-36 rounded bg-[#161b22]"
                          />
                        </div>
                      )}

                      <div className="flex items-center justify-center gap-1.5 text-xs text-amber-400/90 pt-0.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                        <span>Ready for connection</span>
                      </div>
                    </div>
                  )}

                  {/* Client Mode */}
                  {activeTab === 'client' && (
                    <div className="space-y-3">
                      <div className="space-y-1.5">
                        <label className="block text-[11px] font-medium text-slate-400 uppercase tracking-wider">
                          Enter 4-Digit PIN
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
                          className="w-full text-center text-2xl font-mono font-bold tracking-widest py-2 bg-[#21262d] border border-[#30363d] rounded-lg text-white placeholder:text-slate-600 focus:border-indigo-400 focus:outline-hidden transition"
                          autoFocus
                        />
                      </div>

                      <button
                        onClick={() => handleClientConnect()}
                        disabled={clientInputPin.length !== 4 || status === 'connecting'}
                        className="w-full py-2 rounded-lg bg-white hover:bg-slate-100 disabled:opacity-50 text-slate-950 font-semibold text-xs transition flex items-center justify-center gap-1.5"
                      >
                        {status === 'connecting' ? (
                          <>
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            <span>Connecting...</span>
                          </>
                        ) : (
                          <>
                            <span>Connect</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
