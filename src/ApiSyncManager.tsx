import React, { useState } from 'react';
import { 
  ChevronLeft, Save, Database, Server, Link2, Copy, Check, 
  RefreshCw, Info, AlertCircle, CheckCircle2, ShieldCheck, 
  Zap, KeyRound, Globe2
} from 'lucide-react';
import { WebsiteSettings } from './types';
import { cn } from './lib/utils';
import { cloudStore } from './lib/cloudStore';

interface ApiSyncManagerProps {
  settings: WebsiteSettings;
  setSettings: React.Dispatch<React.SetStateAction<WebsiteSettings>>;
  onClose: () => void;
}

export function ApiSyncManager({ settings, setSettings, onClose }: ApiSyncManagerProps) {
  const [enabled, setEnabled] = useState(settings.apiSync?.enabled ?? false);
  const [isMaster, setIsMaster] = useState(settings.apiSync?.isMaster ?? true);
  const [masterApiKey, setMasterApiKey] = useState(
    settings.apiSync?.masterApiKey || 
    Array.from({ length: 32 }, () => Math.floor(Math.random() * 36).toString(36)).join('')
  );
  const [connectedMasterUrl, setConnectedMasterUrl] = useState(settings.apiSync?.connectedMasterUrl || '');
  const [connectedMasterApiKey, setConnectedMasterApiKey] = useState(settings.apiSync?.connectedMasterApiKey || '');
  
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState('');

  const themeColor = settings.themeColors?.primary || '#ff3b69';

  const handleCopy = () => {
    navigator.clipboard.writeText(masterApiKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRegenerateKey = () => {
    const newKey = Array.from({ length: 32 }, () => Math.floor(Math.random() * 36).toString(36)).join('');
    setMasterApiKey(newKey);
  };

  const handleConnect = async () => {
    const cleanUrl = connectedMasterUrl.trim().replace(/\/$/, "");
    const cleanApiKey = connectedMasterApiKey.trim();

    if (!cleanUrl || !cleanApiKey) {
      setConnectionStatus('error');
      setSyncMessage('Both Master Store URL and API Key are required.');
      return;
    }
    
    setConnectionStatus('testing');
    setSyncMessage('');
    
    try {
      const res = await fetch(`${cleanUrl}/api/sync_check`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${cleanApiKey}`
        },
        body: JSON.stringify({ retailUrl: window.location.origin })
      });
      
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `Verification failed (Status: ${res.status})`);
      }
      
      const updated = {
        ...settings,
        apiSync: {
          enabled: true,
          isMaster: false,
          masterApiKey,
          connectedMasterUrl: cleanUrl,
          connectedMasterApiKey: cleanApiKey
        }
      };
      setSettings(updated);
      setEnabled(true);
      setIsMaster(false);
      setConnectedMasterUrl(cleanUrl);
      setConnectedMasterApiKey(cleanApiKey);
      await cloudStore.saveSetting('websiteSettings', updated);

      setConnectionStatus('success');
      setSyncMessage('Successfully connected to Master Wholesale Store!');
    } catch (err: any) {
      setConnectionStatus('error');
      setSyncMessage(err.message || 'Failed to establish connection. Please verify the URL and API Key.');
    }
  };

  const handleForceSync = async () => {
    setIsSyncing(true);
    setSyncMessage('Syncing products, images, and inventory from master...');
    
    try {
      const dbUrl = connectedMasterUrl.trim().replace(/\/$/, "");
      const cleanApiKey = connectedMasterApiKey.trim();
      
      const res = await fetch(`${dbUrl}/api/sync_data`, {
        headers: {
          'Authorization': `Bearer ${cleanApiKey}`
        }
      });
      
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || 'Failed to retrieve inventory data from Master');
      }
      
      const data = await res.json();
      const products = data.products || [];
      const categories = data.categories || [];
      
      const applyRes = await fetch('/api/sync_apply', {
        method: 'POST',
        credentials: 'include',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${cleanApiKey}`
        },
        body: JSON.stringify({ products, categories })
      });
      
      if (!applyRes.ok) {
        const errJson = await applyRes.json().catch(() => ({}));
        throw new Error(errJson.error || 'Failed to apply synced products locally');
      }
      
      setSyncMessage(`Sync completed successfully! ${products.length} products synced.`);
      setTimeout(() => {
        setSyncMessage('');
        window.location.reload();
      }, 1500);
      
    } catch (err: any) {
      setConnectionStatus('error');
      setSyncMessage(err.message || 'Sync failed. Please try again.');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const updated = {
        ...settings,
        apiSync: {
          enabled,
          isMaster,
          masterApiKey,
          connectedMasterUrl: connectedMasterUrl.trim(),
          connectedMasterApiKey: connectedMasterApiKey.trim()
        }
      };
      setSettings(updated);
      await cloudStore.saveSetting('websiteSettings', updated);
      setSaved(true);
      setTimeout(() => {
        setSaved(false);
        onClose();
      }, 600);
    } catch (e) {
      console.error(e);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-[100] bg-[#070b14] text-[#e2e8f0] flex flex-col font-sans overflow-hidden md:left-[240px]"
      id="api_sync_manager_view"
    >
      {/* Top Header Bar */}
      <div 
        className="flex items-center justify-between px-4 py-3.5 md:px-8 md:py-4 border-b border-[#1e293b]/70 bg-[#070b14]/90 backdrop-blur-md sticky top-0 z-20 shrink-0"
        id="api_sync_header"
      >
        <div className="flex items-center gap-3">
          <button 
            onClick={onClose} 
            className="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 active:scale-95 border border-white/10 flex items-center justify-center text-slate-300 hover:text-white transition-all shrink-0 cursor-pointer"
            id="api_sync_back_btn"
            title="Go back"
          >
            <ChevronLeft size={20} />
          </button>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shrink-0 shadow-inner">
              <Database size={20} />
            </div>
            <div>
              <h1 className="text-base md:text-lg font-bold text-white tracking-tight flex items-center gap-2">
                Multi-Store Sync Engine
              </h1>
              <p className="text-[11px] text-slate-400 font-medium hidden sm:block">
                Master inventory distribution, real-time stock deduction, and catalog replication
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={handleSave}
          disabled={isSaving}
          style={{ backgroundColor: themeColor }}
          className="flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-xs md:text-sm text-white hover:brightness-110 active:scale-95 transition-all shadow-lg shadow-pink-500/20 disabled:opacity-50 cursor-pointer shrink-0"
          id="api_sync_save_btn"
        >
          {isSaving ? (
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : saved ? (
            <Check size={16} className="text-white stroke-[3]" />
          ) : (
            <Save size={16} />
          )}
          <span>{saved ? 'Saved' : isSaving ? 'Saving...' : 'Save Settings'}</span>
        </button>
      </div>

      {/* Main Content Body */}
      <div 
        className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6 max-w-3xl mx-auto w-full pb-28 overscroll-y-contain custom-scrollbar"
        style={{ WebkitOverflowScrolling: 'touch' }}
        id="api_sync_content"
      >
        {/* Master Switch Card */}
        <div 
          className="bg-[#0b1120] border border-[#1e293b]/70 rounded-2xl p-4 md:p-6 shadow-xl space-y-4"
          id="api_sync_main_card"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shrink-0 shadow-inner">
                <Zap size={22} />
              </div>
              <div>
                <h2 className="text-sm md:text-base font-bold text-white">Enable Multi-Store Synchronization</h2>
                <p className="text-xs text-slate-400 mt-0.5">Live stock updates between wholesale parent and sub-branches</p>
              </div>
            </div>

            <button
              onClick={() => setEnabled(!enabled)}
              className={cn(
                "w-12 h-6.5 rounded-full relative transition-all duration-300 ease-in-out p-0.5 focus:outline-none shrink-0",
                enabled ? "bg-indigo-500 shadow-md shadow-indigo-500/20" : "bg-slate-700/60"
              )}
              id="api_sync_toggle"
            >
              <div
                className={cn(
                  "w-5.5 h-5.5 rounded-full bg-white transition-all duration-300 shadow-md",
                  enabled ? "translate-x-5.5" : "translate-x-0"
                )}
              />
            </button>
          </div>
        </div>

        {/* Collapsible Options when Enabled */}
        {enabled && (
          <div className="space-y-6 animate-in fade-in slide-in-from-top-2 duration-200">
            {/* Step 1: Role Selection */}
            <div className="bg-[#0b1120] border border-[#1e293b]/70 rounded-2xl p-4 md:p-6 shadow-xl space-y-4">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-300 block">
                Store Sync Architecture
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {/* Option 1: Master Store */}
                <button
                  type="button"
                  onClick={() => setIsMaster(true)}
                  className={cn(
                    "relative p-4 rounded-xl border text-left transition-all flex flex-col justify-between gap-3 cursor-pointer",
                    isMaster
                      ? "bg-indigo-500/10 border-indigo-500/60 shadow-lg shadow-indigo-500/10 ring-1 ring-indigo-500/40"
                      : "bg-[#070b14] border-[#1e293b] hover:border-slate-700 text-slate-300"
                  )}
                  id="role_master_btn"
                >
                  <div className="flex items-center justify-between w-full">
                    <div className={cn(
                      "w-9 h-9 rounded-xl flex items-center justify-center transition-colors",
                      isMaster ? "bg-indigo-500 text-white" : "bg-white/5 text-slate-400 border border-[#1e293b]"
                    )}>
                      <Server size={18} />
                    </div>
                    <div className={cn(
                      "w-5 h-5 rounded-full border flex items-center justify-center transition-colors",
                      isMaster ? "border-indigo-400 bg-indigo-500 text-white" : "border-slate-600 bg-transparent"
                    )}>
                      {isMaster && <Check size={12} strokeWidth={3} />}
                    </div>
                  </div>

                  <div>
                    <h3 className="text-xs md:text-sm font-bold text-white">Act as Master (Wholesale Hub)</h3>
                    <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                      Primary central inventory store. Connected branches will pull catalog and push order deductions.
                    </p>
                  </div>
                </button>

                {/* Option 2: Retail Store */}
                <button
                  type="button"
                  onClick={() => setIsMaster(false)}
                  className={cn(
                    "relative p-4 rounded-xl border text-left transition-all flex flex-col justify-between gap-3 cursor-pointer",
                    !isMaster
                      ? "bg-indigo-500/10 border-indigo-500/60 shadow-lg shadow-indigo-500/10 ring-1 ring-indigo-500/40"
                      : "bg-[#070b14] border-[#1e293b] hover:border-slate-700 text-slate-300"
                  )}
                  id="role_retail_btn"
                >
                  <div className="flex items-center justify-between w-full">
                    <div className={cn(
                      "w-9 h-9 rounded-xl flex items-center justify-center transition-colors",
                      !isMaster ? "bg-indigo-500 text-white" : "bg-white/5 text-slate-400 border border-[#1e293b]"
                    )}>
                      <Link2 size={18} />
                    </div>
                    <div className={cn(
                      "w-5 h-5 rounded-full border flex items-center justify-center transition-colors",
                      !isMaster ? "border-indigo-400 bg-indigo-500 text-white" : "border-slate-600 bg-transparent"
                    )}>
                      {!isMaster && <Check size={12} strokeWidth={3} />}
                    </div>
                  </div>

                  <div>
                    <h3 className="text-xs md:text-sm font-bold text-white">Act as Retail (Connected Store)</h3>
                    <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                      Syncs catalog and stock from Master Hub while letting you set custom retail margins.
                    </p>
                  </div>
                </button>
              </div>
            </div>

            {/* Step 2: Configuration View based on Role */}
            <div className="bg-[#0b1120] border border-[#1e293b]/70 rounded-2xl p-4 md:p-6 shadow-xl space-y-4">
              {isMaster ? (
                /* MASTER CONFIGURATION */
                <div className="space-y-4" id="master_config_box">
                  <div className="flex items-center justify-between pb-3 border-b border-[#1e293b]/50">
                    <div className="flex items-center gap-2">
                      <KeyRound size={16} className="text-indigo-400" />
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">Master Hub Credentials</h3>
                    </div>
                    <button
                      type="button"
                      onClick={handleRegenerateKey}
                      className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 flex items-center gap-1.5 transition-colors cursor-pointer"
                      id="regenerate_key_btn"
                    >
                      <RefreshCw size={13} /> Regenerate Key
                    </button>
                  </div>

                  <p className="text-xs text-slate-400 leading-relaxed">
                    Provide your connected Retail stores with this Master API Key and your store URL to authenticate.
                  </p>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-400 block">
                      Master Secret API Key
                    </label>
                    <div className="flex items-center gap-2">
                      <div className="relative flex-1">
                        <input
                          type="text"
                          value={masterApiKey}
                          readOnly
                          className="w-full bg-[#070b14] border border-[#1e293b] rounded-xl px-4 py-2.5 text-xs md:text-sm font-mono text-slate-200 tracking-wider focus:outline-none select-all"
                          id="master_api_key_input"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={handleCopy}
                        className="px-4 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-slate-300 hover:text-white transition-all flex items-center gap-1.5 text-xs font-bold shrink-0 cursor-pointer active:scale-95"
                        id="copy_master_key_btn"
                        title="Copy Master Key"
                      >
                        {copied ? (
                          <>
                            <Check size={14} className="text-emerald-400 stroke-[3]" />
                            <span className="text-emerald-400">Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy size={14} />
                            <span>Copy</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                /* RETAIL CONFIGURATION */
                <div className="space-y-4" id="retail_config_box">
                  <div className="flex items-center gap-2 pb-3 border-b border-[#1e293b]/50">
                    <Globe2 size={16} className="text-indigo-400" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">Connect to Master Hub</h3>
                  </div>

                  <div className="space-y-4">
                    {/* Master URL input */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-400 block">
                        Master Store URL <span className="text-rose-400">*</span>
                      </label>
                      <input
                        type="url"
                        value={connectedMasterUrl}
                        onChange={(e) => setConnectedMasterUrl(e.target.value)}
                        placeholder="https://master-store.com"
                        className="w-full bg-[#070b14] border border-[#1e293b] rounded-xl px-4 py-2.5 text-xs md:text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-colors"
                        id="connected_master_url_input"
                      />
                    </div>

                    {/* Master Key input */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-400 block">
                        Master API Key <span className="text-rose-400">*</span>
                      </label>
                      <input
                        type="text"
                        value={connectedMasterApiKey}
                        onChange={(e) => setConnectedMasterApiKey(e.target.value)}
                        placeholder="Paste 32-character API key from Master store"
                        className="w-full bg-[#070b14] border border-[#1e293b] rounded-xl px-4 py-2.5 text-xs md:text-sm font-mono text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-colors"
                        id="connected_master_key_input"
                      />
                    </div>
                  </div>

                  {/* Actions & Status message */}
                  <div className="pt-2 flex flex-col gap-3">
                    <button
                      type="button"
                      onClick={handleConnect}
                      disabled={connectionStatus === 'testing'}
                      className="w-full py-2.5 px-4 rounded-xl font-bold text-xs md:text-sm bg-indigo-500 hover:bg-indigo-600 text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-indigo-500/20 active:scale-95"
                      id="test_connection_btn"
                    >
                      {connectionStatus === 'testing' ? (
                        <>
                          <RefreshCw size={15} className="animate-spin" />
                          <span>Verifying Connection...</span>
                        </>
                      ) : (
                        <>
                          <Link2 size={16} />
                          <span>Test & Verify Connection</span>
                        </>
                      )}
                    </button>

                    {syncMessage && (
                      <div className={cn(
                        "text-xs p-3 rounded-xl flex items-center gap-2 font-medium leading-relaxed transition-all",
                        connectionStatus === 'error'
                          ? "bg-rose-500/10 text-rose-300 border border-rose-500/20"
                          : connectionStatus === 'success'
                          ? "bg-emerald-500/10 text-emerald-300 border border-emerald-500/20"
                          : "bg-indigo-500/10 text-indigo-300 border border-indigo-500/20"
                      )}>
                        {connectionStatus === 'error' && <AlertCircle size={15} className="shrink-0 text-rose-400" />}
                        {connectionStatus === 'success' && <CheckCircle2 size={15} className="shrink-0 text-emerald-400" />}
                        {connectionStatus === 'idle' && <Info size={15} className="shrink-0 text-indigo-400" />}
                        <span>{syncMessage}</span>
                      </div>
                    )}

                    {connectionStatus === 'success' && (
                      <div className="pt-2 border-t border-[#1e293b]/50 mt-1">
                        <button
                          type="button"
                          onClick={handleForceSync}
                          disabled={isSyncing}
                          className="w-full py-3 px-4 rounded-xl font-bold text-xs md:text-sm bg-emerald-600 hover:bg-emerald-700 text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-emerald-600/20 active:scale-95"
                          id="force_sync_btn"
                        >
                          {isSyncing ? (
                            <>
                              <RefreshCw size={15} className="animate-spin" />
                              <span>Pulling Catalog & Inventory...</span>
                            </>
                          ) : (
                            <>
                              <Database size={16} />
                              <span>Force Sync Catalog Now</span>
                            </>
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Sticky Bottom Bar */}
      <div className="sticky bottom-0 bg-[#070b14]/90 backdrop-blur-md border-t border-[#1e293b] p-3.5 md:p-4 flex items-center justify-between z-20 shrink-0">
        <button
          onClick={onClose}
          className="px-4 py-2.5 rounded-xl border border-slate-700 hover:bg-white/5 text-slate-300 font-semibold text-xs transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={isSaving}
          style={{ backgroundColor: themeColor }}
          className="flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-xs md:text-sm text-white hover:brightness-110 active:scale-95 transition-all shadow-lg shadow-pink-500/20 disabled:opacity-50 cursor-pointer"
        >
          {isSaving ? (
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <Check size={16} className="stroke-[3]" />
          )}
          Save Settings
        </button>
      </div>
    </div>
  );
}
export default ApiSyncManager;
