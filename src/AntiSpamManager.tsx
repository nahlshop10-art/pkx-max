import React, { useState } from 'react';
import { ChevronLeft, Save, ShieldAlert, Zap, Clock, Smartphone, Check } from 'lucide-react';
import { WebsiteSettings } from './types';
import { cn } from './lib/utils';
import { cloudStore } from './lib/cloudStore';

interface Props {
  websiteSettings: WebsiteSettings;
  setWebsiteSettings: (settings: WebsiteSettings) => void;
  onClose: () => void;
}

export default function AntiSpamManager({ websiteSettings, setWebsiteSettings, onClose }: Props) {
  const [enabled, setEnabled] = useState(websiteSettings.antiSpam?.enabled ?? false);
  const [rateLimitEnabled, setRateLimitEnabled] = useState(websiteSettings.antiSpam?.rateLimitEnabled ?? true);
  const [deviceTrackingEnabled, setDeviceTrackingEnabled] = useState(websiteSettings.antiSpam?.deviceTrackingEnabled ?? true);
  
  const [shortTermOrdersCount, setShortTermOrdersCount] = useState(websiteSettings.antiSpam?.shortTermOrdersCount ?? 3);
  const [shortTermMinutes, setShortTermMinutes] = useState(websiteSettings.antiSpam?.shortTermMinutes ?? 10);
  const [hourlyOrdersCount, setHourlyOrdersCount] = useState(websiteSettings.antiSpam?.hourlyOrdersCount ?? 5);
  const [dailyOrdersCount, setDailyOrdersCount] = useState(websiteSettings.antiSpam?.dailyOrdersCount ?? 10);
  const [blockDurationMinutes, setBlockDurationMinutes] = useState(websiteSettings.antiSpam?.blockDurationMinutes ?? 60);
  const [saved, setSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const updatedSettings = {
        ...websiteSettings,
        antiSpam: {
          enabled,
          rateLimitEnabled,
          deviceTrackingEnabled,
          shortTermOrdersCount,
          shortTermMinutes,
          hourlyOrdersCount,
          dailyOrdersCount,
          blockDurationMinutes
        }
      };
      setWebsiteSettings(updatedSettings);
      await cloudStore.saveSetting('websiteSettings', updatedSettings);
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
    <div className="fixed inset-0 z-[100] bg-[var(--dash-bg)] text-[#e2e8f0] flex flex-col font-sans overflow-hidden md:left-[240px]">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-[var(--dash-border)] bg-[var(--dash-card)] shrink-0 md:px-8 md:py-5">
        <div className="flex items-center gap-2">
          <button onClick={onClose} className="p-2 -ml-2 text-white hover:text-[#fafafa] transition-colors rounded-full hover:bg-white/5">
            <ChevronLeft size={24} />
          </button>
          <h1 className="text-xl font-bold text-white tracking-wide flex items-center gap-2">
            <ShieldAlert size={20} className="text-[#fafafa]" /> Anti-Spam System
          </h1>
        </div>
        <button 
          onClick={handleSave} 
          disabled={isSaving}
          style={{ backgroundColor: websiteSettings.themeColors?.primary || 'var(--theme-primary, #ff4d6d)', color: '#ffffff' }}
          className="flex items-center gap-2 px-5 py-2 rounded-xl font-bold text-xs md:text-sm hover:brightness-95 active:scale-95 transition-all shadow-md cursor-pointer disabled:opacity-50"
        >
          {isSaving ? (
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : saved ? (
            <Check size={16} className="text-white" />
          ) : (
            <Save size={16} />
          )}
          <span>{saved ? 'Saved' : 'Save'}</span>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-6 md:p-8 space-y-8 max-w-3xl mx-auto w-full pb-20">
        
        {/* Master Control */}
        <div className="bg-[var(--dash-card)] rounded-2xl p-5 md:p-6 border border-[var(--dash-border)] shadow-md flex justify-between items-center transition-all">
          <div className="flex items-center gap-4">
            <div className={cn("p-3 rounded-xl", enabled ? "bg-[#fafafa]/10 text-[#fafafa]" : "bg-[var(--dash-card)] text-gray-500")}>
              <ShieldAlert size={24} />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white mb-1">Master Control</h2>
              <p className="text-sm text-gray-400">Toggle the entire Anti-Spam system on or off.</p>
            </div>
          </div>
          <div 
             className={cn(
               "w-[50px] h-[28px] rounded-full p-1 cursor-pointer transition-colors duration-200 ease-in-out flex items-center shrink-0 ml-4",
               enabled ? "bg-[#fafafa]" : "bg-gray-600"
             )}
             onClick={() => setEnabled(!enabled)}
           >
             <div className={cn("w-5 h-5 rounded-full shadow transform transition-transform duration-200", enabled ? "bg-[var(--dash-card)] translate-x-[22px]" : "bg-white translate-x-0")} />
           </div>
        </div>

        {/* Settings blocks */}
        <div className={cn("space-y-6 transition-all duration-300", enabled ? "opacity-100" : "opacity-50 pointer-events-none")}>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Rate Limit Feature */}
            <div className="bg-[var(--dash-card)] rounded-2xl p-5 border border-[var(--dash-border)] shadow-md">
              <div className="flex justify-between items-center mb-4 pb-4 border-b border-[var(--dash-border)]">
                <div className="flex items-center gap-2 text-white font-semibold">
                  <Zap size={18} className="text-blue-400" /> Rate Limits
                </div>
                <div 
                   className={cn(
                     "w-10 h-6 rounded-full p-1 cursor-pointer transition-colors duration-200 ease-in-out flex items-center",
                     rateLimitEnabled ? "bg-blue-500" : "bg-gray-600"
                   )}
                   onClick={() => setRateLimitEnabled(!rateLimitEnabled)}
                 >
                   <div className={cn("w-4 h-4 rounded-full shadow transform transition-transform duration-200", rateLimitEnabled ? "bg-[var(--dash-card)] translate-x-4" : "bg-white translate-x-0")} />
                </div>
              </div>
              <p className="text-sm text-gray-400 mb-6 font-medium">Prevent rapid sequential orders from being placed.</p>

              <div className="space-y-5">
                <div>
                  <label className="text-xs font-semibold text-gray-300 uppercase tracking-wider mb-2 block">Short-Term Limit</label>
                  <div className="flex items-center gap-2">
                    <input type="number" value={shortTermOrdersCount} onChange={e => setShortTermOrdersCount(Number(e.target.value))} className="w-16 bg-[var(--dash-bg)] border border-[var(--dash-border)] rounded-lg p-2 text-center text-white focus:border-blue-500 outline-none" />
                    <span className="text-sm text-gray-400">orders per</span>
                    <input type="number" value={shortTermMinutes} onChange={e => setShortTermMinutes(Number(e.target.value))} className="w-16 bg-[var(--dash-bg)] border border-[var(--dash-border)] rounded-lg p-2 text-center text-white focus:border-blue-500 outline-none" />
                    <span className="text-sm text-gray-400">mins</span>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-300 uppercase tracking-wider mb-2 block">Hourly Limit</label>
                  <div className="flex items-center gap-2">
                    <input type="number" value={hourlyOrdersCount} onChange={e => setHourlyOrdersCount(Number(e.target.value))} className="w-16 bg-[var(--dash-bg)] border border-[var(--dash-border)] rounded-lg p-2 text-center text-white focus:border-blue-500 outline-none" />
                    <span className="text-sm text-gray-400">orders per 1 hour</span>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-300 uppercase tracking-wider mb-2 block">Daily Limit</label>
                  <div className="flex items-center gap-2">
                    <input type="number" value={dailyOrdersCount} onChange={e => setDailyOrdersCount(Number(e.target.value))} className="w-16 bg-[var(--dash-bg)] border border-[var(--dash-border)] rounded-lg p-2 text-center text-white focus:border-blue-500 outline-none" />
                    <span className="text-sm text-gray-400">orders per day</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Device Tracking */}
            <div className="bg-[var(--dash-card)] rounded-2xl p-5 border border-[var(--dash-border)] shadow-md">
               <div className="flex justify-between items-center mb-4 pb-4 border-b border-[var(--dash-border)]">
                <div className="flex items-center gap-2 text-white font-semibold">
                  <Smartphone size={18} className="text-purple-400" /> Device Tracking
                </div>
                <div 
                   className={cn(
                     "w-10 h-6 rounded-full p-1 cursor-pointer transition-colors duration-200 ease-in-out flex items-center",
                     deviceTrackingEnabled ? "bg-purple-500" : "bg-gray-600"
                   )}
                   onClick={() => setDeviceTrackingEnabled(!deviceTrackingEnabled)}
                 >
                   <div className={cn("w-4 h-4 rounded-full shadow transform transition-transform duration-200", deviceTrackingEnabled ? "bg-[var(--dash-card)] translate-x-4" : "bg-white translate-x-0")} />
                </div>
              </div>
              <p className="text-sm text-gray-400 mb-4 font-medium leading-relaxed">
                Generates a unique fingerprint for each device based on browser data & resolution. Helps block users even if they use multiple tabs or a basic VPN.
              </p>

              <div className="bg-[var(--dash-bg)] rounded-xl p-4 border border-[var(--dash-border)]">
                <p className="text-xs text-gray-400 mb-1">Block Duration</p>
                <div className="flex items-center gap-2">
                  <input type="number" value={blockDurationMinutes} onChange={e => setBlockDurationMinutes(Number(e.target.value))} className="w-20 bg-transparent border-b border-[var(--dash-border)] p-1 text-white focus:border-purple-500 outline-none" />
                  <span className="text-sm text-gray-400 font-medium">Minutes</span>
                </div>
                <p className="text-[11px] text-gray-500 mt-2">How long a user stays blocked if they exceed the rate limit.</p>
              </div>
            </div>

          </div>

          <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 flex gap-3 text-sm text-blue-200">
            <Clock className="shrink-0 text-blue-400 mt-0.5" size={18} />
            <p>If a limit is reached, the user will be temporarily blocked from creating any new orders, displaying a "Too many orders" error.</p>
          </div>

        </div>

      </div>
    </div>
  );
}
