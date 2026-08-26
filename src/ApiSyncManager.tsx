import React, { useState } from 'react';
import { 
  ChevronLeft, Save, Database, Server, Link2, Copy, Check, 
  RefreshCw, Info, AlertCircle, CheckCircle2, ArrowRight, ShieldCheck, 
  Layers, ExternalLink, Zap, HelpCircle, Radio, KeyRound, Globe2
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
    if (!connectedMasterUrl.trim() || !connectedMasterApiKey.trim()) {
      setConnectionStatus('error');
      setSyncMessage('Both Master Store URL and API Key are required.');
      return;
    }
    
    setConnectionStatus('testing');
    setSyncMessage('');
    
    try {
      const cleanUrl = connectedMasterUrl.trim().replace(/\/$/, "");
      
      const res = await fetch(`${cleanUrl}/api/sync_check`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${connectedMasterApiKey.trim()}`
        },
        body: JSON.stringify({ retailUrl: window.location.origin })
      });
      
      if (!res.ok) {
        throw new Error(`Verification failed (Status: ${res.status})`);
      }
      
      setConnectedMasterUrl(cleanUrl);
      setConnectionStatus('success');
      setSyncMessage('Successfully connected to Master Wholesale Store!');
    } catch (err: any) {
      setConnectionStatus('error');
      setSyncMessage('Failed to establish connection. Please verify the URL and API Key.');
    }
  };

  const handleForceSync = async () => {
    setIsSyncing(true);
    setSyncMessage('Syncing products, images, and inventory from master...');
    
    try {
      const dbUrl = connectedMasterUrl.trim().replace(/\/$/, "");
      
      const res = await fetch(`${dbUrl}/api/sync_data`, {
        headers: {
          'Authorization': `Bearer ${connectedMasterApiKey.trim()}`
        }
      });
      
      if (!res.ok) throw new Error('Failed to retrieve inventory data from Master');
      
      const data = await res.json();
      const products = data.products || [];
      
      const applyRes = await fetch('/api/sync_apply', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${connectedMasterApiKey.trim()}`
        },
        body: JSON.stringify({ products })
      });
      
      if (!applyRes.ok) throw new Error('Failed to apply synced products locally');
      
      setSyncMessage(`Sync completed successfully! ${products.length} products updated.`);
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
      }, 800);
    } catch (e) {
      console.error(e);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-[100] bg-[var(--dash-bg)] text-[#e2e8f0] flex flex-col font-sans overflow-hidden md:left-[240px]"
      id="api_sync_manager_view"
    >
      {/* Top Header Bar */}
      <div 
        className="flex items-center justify-between px-4 py-3 md:px-8 border-b border-[var(--dash-border)] bg-[var(--dash-card)] relative z-10 shrink-0"
        id="api_sync_header"
      >
        <div className="flex items-center gap-3">
          <button 
            onClick={onClose} 
            className="w-10 h-10 rounded-full border border-[var(--dash-border)] bg-[var(--dash-card)] hover:bg-[var(--dash-border)]/50 flex items-center justify-center text-slate-300 hover:text-white transition-all shrink-0 cursor-pointer"
            id="api_sync_back_btn"
            title="Go back"
          >
            <ChevronLeft size={20} />
          </button>
          <div className="flex flex-col">
            <h1 className="text-sm md:text-base font-bold text-white flex items-center gap-2 tracking-tight">
              <Database size={18} className="text-indigo-400" /> Store API Sync
            </h1>
            <p className="text-[10px] md:text-xs text-slate-400 font-normal hidden sm:block">
              Multi-store inventory synchronization, real-time stock deduction, and catalog replication.
            </p>
          </div>
        </div>

        <button
          onClick={handleSave}
          disabled={isSaving}
          style={{ backgroundColor: settings.themeColors?.primary || 'var(--theme-primary, #ff4d6d)', color: '#ffffff' }}
          className="flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-xs md:text-sm transition-all shrink-0 shadow-md cursor-pointer hover:brightness-95 active:scale-95 disabled:opacity-50"
          id="api_sync_save_btn"
        >
          {isSaving ? (
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : saved ? (
            <Check size={16} className="text-white" />
          ) : (
            <Save size={16} />
          )}
          <span>{saved ? 'Saved' : 'Save Changes'}</span>
        </button>
      </div>

      {/* Main Content Body */}
      <div 
        className="flex-1 overflow-y-auto p-4 space-y-6 pb-24 md:p-8 md:space-y-6 max-w-3xl mx-auto w-full"
        id="api_sync_content"
      >
        {/* Master Switch Card */}
        <div 
          className="bg-[var(--dash-card)] border border-[var(--dash-border)] rounded-2xl overflow-hidden shadow-lg shadow-black/10 flex flex-col p-4.5 md:p-6 space-y-4"
          id="api_sync_main_card"
        >
          <div className="flex items-start justify-between gap-4 border-b border-[var(--dash-border)]/40 pb-4.5">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 flex items-center justify-center shrink-0 mt-0.5">
                <Zap size={20} />
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <h2 className="text-sm md:text-base font-bold text-white tracking-wide">Multi-Store Real-Time Sync</h2>
                  <span className={cn(
                    "text-[10px] font-semibold px-2 py-0.5 rounded-full border transition-colors",
                    enabled 
                      ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" 
                      : "bg-slate-700/30 text-slate-400 border-slate-700/50"
                  )}>
                    {enabled ? 'Active' : 'Disabled'}
                  </span>
                </div>
                <p className="text-[11px] md:text-xs text-slate-400 mt-1 font-normal leading-relaxed">
                  Automatically sync products, variants, images, and live inventory between Master Wholesale and Retail stores without sharing customer orders or profit margins.
                </p>
              </div>
            </div>

            {/* Switch Toggle */}
            <button 
              onClick={() => setEnabled(!enabled)}
              className={cn(
                "w-12 h-6.5 rounded-full transition-colors relative duration-200 outline-none shrink-0 cursor-pointer p-0.5 mt-1",
                enabled ? "bg-[#fafafa]" : "bg-[var(--dash-border)]"
              )}
              id="api_sync_toggle"
              aria-label="Toggle API Sync"
            >
              <div 
                className={cn(
                  "w-5.5 h-5.5 rounded-full transition-all duration-300 shadow-sm",
                  enabled 
                    ? "bg-[var(--dash-card)] translate-x-5.5" 
                    : "bg-white translate-x-0"
                )} 
              />
            </button>
          </div>

          {/* Collapsible Options when Enabled */}
          <div className={cn("transition-all duration-300 overflow-hidden", enabled ? "opacity-100 max-h-[1400px]" : "opacity-0 max-h-0")}>
            
            {/* Step 1: Role Selection */}
            <div className="space-y-3 pt-1">
              <label className="text-xs font-bold text-slate-200 uppercase tracking-wider block">
                Select Store Role
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {/* Option 1: Master Store */}
                <button
                  type="button"
                  onClick={() => setIsMaster(true)}
                  className={cn(
                    "relative p-4 rounded-xl border text-left transition-all flex flex-col justify-between gap-3 cursor-pointer",
                    isMaster
                      ? "bg-indigo-500/10 border-indigo-500/60 shadow-sm shadow-indigo-500/10 ring-1 ring-indigo-500/40"
                      : "bg-[var(--dash-bg)]/60 border-[var(--dash-border)] hover:border-[var(--dash-border-light)] text-slate-300"
                  )}
                  id="role_master_btn"
                >
                  <div className="flex items-center justify-between w-full">
                    <div className={cn(
                      "w-9 h-9 rounded-lg flex items-center justify-center transition-colors",
                      isMaster ? "bg-indigo-500 text-white" : "bg-[var(--dash-card)] text-slate-400 border border-[var(--dash-border)]"
                    )}>
                      <Server size={18} />
                    </div>
                    <div className={cn(
                      "w-4.5 h-4.5 rounded-full border flex items-center justify-center transition-colors",
                      isMaster ? "border-indigo-400 bg-indigo-500 text-white" : "border-slate-600 bg-transparent"
                    )}>
                      {isMaster && <Check size={11} strokeWidth={3} />}
                    </div>
                  </div>

                  <div>
                    <h3 className="text-xs md:text-sm font-bold text-white">Act as Master (Wholesale Hub)</h3>
                    <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                      Primary central inventory store. Other connected stores will pull products from here and broadcast order stock deductions.
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
                      ? "bg-indigo-500/10 border-indigo-500/60 shadow-sm shadow-indigo-500/10 ring-1 ring-indigo-500/40"
                      : "bg-[var(--dash-bg)]/60 border-[var(--dash-border)] hover:border-[var(--dash-border-light)] text-slate-300"
                  )}
                  id="role_retail_btn"
                >
                  <div className="flex items-center justify-between w-full">
                    <div className={cn(
                      "w-9 h-9 rounded-lg flex items-center justify-center transition-colors",
                      !isMaster ? "bg-indigo-500 text-white" : "bg-[var(--dash-card)] text-slate-400 border border-[var(--dash-border)]"
                    )}>
                      <Link2 size={18} />
                    </div>
                    <div className={cn(
                      "w-4.5 h-4.5 rounded-full border flex items-center justify-center transition-colors",
                      !isMaster ? "border-indigo-400 bg-indigo-500 text-white" : "border-slate-600 bg-transparent"
                    )}>
                      {!isMaster && <Check size={11} strokeWidth={3} />}
                    </div>
                  </div>

                  <div>
                    <h3 className="text-xs md:text-sm font-bold text-white">Act as Retail (Connected Store)</h3>
                    <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                      Receives catalog and stock updates from your Master Hub. Retail stores maintain independent selling prices.
                    </p>
                  </div>
                </button>
              </div>
            </div>

            {/* Step 2: Configuration View based on Role */}
            <div className="mt-5 pt-5 border-t border-[var(--dash-border)]/40">
              {isMaster ? (
                /* MASTER CONFIGURATION */
                <div className="bg-[var(--dash-bg)]/80 border border-[var(--dash-border)] rounded-xl p-4.5 md:p-5 space-y-4" id="master_config_box">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <KeyRound size={16} className="text-indigo-400" />
                      <h3 className="text-xs md:text-sm font-bold text-white">Master API Credentials</h3>
                    </div>
                    <button
                      type="button"
                      onClick={handleRegenerateKey}
                      className="text-[11px] font-semibold text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition-colors cursor-pointer"
                      id="regenerate_key_btn"
                    >
                      <RefreshCw size={12} /> Regenerate Key
                    </button>
                  </div>

                  <p className="text-[11px] md:text-xs text-slate-400 leading-relaxed">
                    Provide your Retail stores with this Master API Key and your store URL. They will use these to authenticate and sync products.
                  </p>

                  <div className="space-y-1.5">
                    <label className="text-[11px] font-semibold text-slate-300">
                      Your Master Secret API Key
                    </label>
                    <div className="flex items-center gap-2">
                      <div className="relative flex-1">
                        <input
                          type="text"
                          value={masterApiKey}
                          readOnly
                          className="w-full bg-[var(--dash-card)] border border-[var(--dash-border)] rounded-lg px-3.5 py-2.5 text-xs md:text-sm font-mono text-slate-200 tracking-wider focus:outline-none select-all"
                          id="master_api_key_input"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={handleCopy}
                        className="px-3.5 py-2.5 bg-[var(--dash-card)] hover:bg-[var(--dash-border)]/50 border border-[var(--dash-border)] rounded-lg text-slate-300 hover:text-white transition-all flex items-center gap-1.5 text-xs font-semibold shrink-0 cursor-pointer shadow-sm"
                        id="copy_master_key_btn"
                        title="Copy Master Key"
                      >
                        {copied ? (
                          <>
                            <Check size={14} className="text-emerald-400" />
                            <span className="text-emerald-400">Copied!</span>
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

                  {/* Information Tips */}
                  <div className="bg-indigo-500/5 border border-indigo-500/15 rounded-lg p-3 flex items-start gap-2.5 text-slate-300">
                    <Info size={16} className="text-indigo-400 shrink-0 mt-0.5" />
                    <div className="text-[11px] text-slate-400 space-y-1 leading-relaxed">
                      <p><strong className="text-slate-200">How real-time deduction works:</strong> When a customer places an order on any retail store, that store notifies this Master Hub to automatically deduct stock from your central inventory.</p>
                    </div>
                  </div>
                </div>
              ) : (
                /* RETAIL CONFIGURATION */
                <div className="bg-[var(--dash-bg)]/80 border border-[var(--dash-border)] rounded-xl p-4.5 md:p-5 space-y-4.5" id="retail_config_box">
                  <div className="flex items-center gap-2">
                    <Globe2 size={16} className="text-indigo-400" />
                    <h3 className="text-xs md:text-sm font-bold text-white">Connect to Master Hub</h3>
                  </div>

                  <p className="text-[11px] md:text-xs text-slate-400 leading-relaxed">
                    Paste the Master Wholesale store's website address and generated API Key below to establish a live connection.
                  </p>

                  <div className="space-y-3.5">
                    {/* Master URL input */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label className="text-[11px] font-semibold text-slate-300">
                          Master Store URL <span className="text-rose-400">*</span>
                        </label>
                      </div>
                      <input
                        type="url"
                        value={connectedMasterUrl}
                        onChange={(e) => setConnectedMasterUrl(e.target.value)}
                        placeholder="https://master-store.com"
                        className="w-full bg-[var(--dash-card)] border border-[var(--dash-border)] rounded-lg px-3.5 py-2.5 text-xs md:text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-[var(--dash-border-light)] transition-colors"
                        id="connected_master_url_input"
                      />
                    </div>

                    {/* Master Key input */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label className="text-[11px] font-semibold text-slate-300">
                          Master API Key <span className="text-rose-400">*</span>
                        </label>
                      </div>
                      <input
                        type="text"
                        value={connectedMasterApiKey}
                        onChange={(e) => setConnectedMasterApiKey(e.target.value)}
                        placeholder="Paste 32-character API key from Master store"
                        className="w-full bg-[var(--dash-card)] border border-[var(--dash-border)] rounded-lg px-3.5 py-2.5 text-xs md:text-sm font-mono text-slate-100 placeholder-slate-500 focus:outline-none focus:border-[var(--dash-border-light)] transition-colors"
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
                      className="w-full py-2.5 px-4 rounded-lg font-bold text-xs md:text-sm bg-indigo-500 hover:bg-indigo-600 text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-indigo-500/20 active:scale-[0.99]"
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
                        "text-xs p-3 rounded-lg flex items-center gap-2 font-medium leading-relaxed transition-all",
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
                      <div className="pt-2 border-t border-[var(--dash-border)]/40 mt-1">
                        <button
                          type="button"
                          onClick={handleForceSync}
                          disabled={isSyncing}
                          className="w-full py-3 px-4 rounded-lg font-bold text-xs md:text-sm bg-emerald-600 hover:bg-emerald-700 text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-emerald-600/20 active:scale-[0.99]"
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
                        <p className="text-[10px] text-slate-400 text-center mt-2">
                          Downloads full product list, categories, variants, and stock from master without touching your custom retail selling prices.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Architecture Overview Feature Grid */}
            <div className="pt-4 grid grid-cols-1 sm:grid-cols-2 gap-3" id="api_sync_features_grid">
              <div className="bg-[var(--dash-bg)]/40 border border-[var(--dash-border)]/50 rounded-xl p-3.5 flex items-start gap-3">
                <div className="p-2 rounded-lg bg-[var(--dash-card)] text-indigo-400 border border-[var(--dash-border)]/60 shrink-0">
                  <ShieldCheck size={16} />
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-white">Independent Retail Pricing</h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Synced products retain Master wholesale costs while allowing retail stores to freely set their own retail prices and margins.
                  </p>
                </div>
              </div>

              <div className="bg-[var(--dash-bg)]/40 border border-[var(--dash-border)]/50 rounded-xl p-3.5 flex items-start gap-3">
                <div className="p-2 rounded-lg bg-[var(--dash-card)] text-indigo-400 border border-[var(--dash-border)]/60 shrink-0">
                  <RefreshCw size={16} />
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-white">Direct Stock Syncing</h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Order checkouts and stock deductions broadcast across authenticated stores in real-time.
                  </p>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
export default ApiSyncManager;
