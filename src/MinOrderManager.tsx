import React, { useState } from 'react';
import { ChevronLeft, Save, ShoppingCart, Clock, Check } from 'lucide-react';
import { WebsiteSettings } from './types';
import { cn } from './lib/utils';
import { cloudStore } from './lib/cloudStore';

interface Props {
  websiteSettings: WebsiteSettings;
  setWebsiteSettings: (settings: WebsiteSettings) => void;
  onClose: () => void;
}

export default function MinOrderManager({ websiteSettings, setWebsiteSettings, onClose }: Props) {
  const [enabled, setEnabled] = useState(websiteSettings.minOrderFeature?.enabled ?? false);
  const [minQuantity, setMinQuantity] = useState(websiteSettings.minOrderFeature?.minQuantity ?? 3);
  const [message, setMessage] = useState(websiteSettings.minOrderFeature?.message ?? 'সর্বনিম্ন যেকোনো ৩টি কিনতে হবে');
  const [autoCloseTime, setAutoCloseTime] = useState(websiteSettings.minOrderFeature?.autoCloseTime ?? 2000);
  const [saved, setSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const updatedSettings = {
        ...websiteSettings,
        minOrderFeature: {
          enabled,
          minQuantity,
          message,
          autoCloseTime
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
            <ShoppingCart size={20} className="text-[#fafafa]" /> Minimum Order Rule
          </h1>
        </div>
        <button 
          onClick={handleSave}
          disabled={isSaving}
          style={{ backgroundColor: websiteSettings.themeColors?.primary || 'var(--theme-primary, #ff4d6d)', color: '#ffffff' }}
          className="flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-xs md:text-sm hover:brightness-95 active:scale-95 transition-all shadow-md cursor-pointer disabled:opacity-50"
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

      <div className="flex-1 overflow-y-auto p-4 md:p-8 max-w-2xl mx-auto w-full custom-scrollbar">
        <div className="max-w-3xl mx-auto space-y-6 md:space-y-8">
          
          {/* Main Toggle */}
          <div className="bg-[var(--dash-card)] border border-[var(--dash-border)] rounded-2xl p-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-white mb-2">Enable Feature</h2>
                <p className="text-sm text-gray-400">Block checkout if minimum quantity is not met.</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input 
                  type="checkbox" 
                  className="sr-only peer"
                  checked={enabled}
                  onChange={(e) => setEnabled(e.target.checked)}
                />
                <div className="w-14 h-7 bg-[var(--dash-border)] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-[var(--dash-card)] after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white peer-checked:after:bg-[var(--dash-card)] after:border-white peer-checked:after:border-[var(--dash-card)] after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-[#fafafa]"></div>
              </label>
            </div>
          </div>

          {enabled && (
             <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
               
               <div className="bg-[var(--dash-card)] border border-[var(--dash-border)] rounded-2xl p-6 space-y-6">
                 <div>
                   <label className="block text-sm font-medium text-gray-400 mb-2">Minimum Quantity Required</label>
                   <input
                     type="number"
                     value={minQuantity}
                     onChange={(e) => {
                       const val = e.target.value;
                       setMinQuantity(Number(val));
                     }}
                     className="w-full bg-[#0a1410] border border-[var(--dash-border)] rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#fafafa] transition-colors"
                     min="1"
                   />
                 </div>
                 
                 <div>
                   <label className="block text-sm font-medium text-gray-400 mb-2">Error Message (Supports customizing)</label>
                   <textarea
                     value={message}
                     onChange={(e) => setMessage(e.target.value)}
                     className="w-full bg-[#0a1410] border border-[var(--dash-border)] rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#fafafa] transition-colors min-h-[100px]"
                   />
                   <p className="text-xs text-gray-500 mt-2">Will be shown as a popup error when a customer tries to checkout</p>
                 </div>
                 
                 <div>
                   <label className="block text-sm font-medium text-gray-400 mb-2 flex items-center gap-2">
                      <Clock size={16} /> Auto-Close Time (ms)
                   </label>
                   <input
                     type="number"
                     value={autoCloseTime}
                     onChange={(e) => setAutoCloseTime(Number(e.target.value))}
                     className="w-full bg-[#0a1410] border border-[var(--dash-border)] rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#fafafa] transition-colors"
                     min="0"
                     step="1000"
                   />
                   <p className="text-xs text-gray-500 mt-2">0 means manual close only. e.g. 2000 for 2 seconds.</p>
                 </div>
               </div>

             </div>
          )}

        </div>
      </div>
    </div>
  );
}
