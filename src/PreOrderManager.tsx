import React, { useState } from 'react';
import { WebsiteSettings } from './types';
import { ChevronLeft, Plus, Trash2, Save, Check } from 'lucide-react';
import { cn } from './lib/utils';
import { cloudStore } from './lib/cloudStore';

export default function PreOrderManager({
  websiteSettings,
  setWebsiteSettings,
  onClose
}: {
  websiteSettings: WebsiteSettings;
  setWebsiteSettings: React.Dispatch<React.SetStateAction<WebsiteSettings>>;
  onClose: () => void;
}) {
  const settings = websiteSettings.preOrder || {
    pWebsite: { enabled: false, link: '' },
    pDashboard: []
  };

  const [enabled, setEnabled] = useState(settings.pWebsite.enabled);
  const [link, setLink] = useState(settings.pWebsite.link);
  const [dashboards, setDashboards] = useState(settings.pDashboard);
  const [saved, setSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const updatedSettings = {
        ...websiteSettings,
        preOrder: {
          pWebsite: { enabled, link },
          pDashboard: dashboards
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

  const addDashboard = () => {
    setDashboards([...dashboards, { id: Date.now().toString(), name: '', link: '' }]);
  };

  const updateDashboard = (index: number, field: 'name' | 'link', value: string) => {
    const newDashs = [...dashboards];
    newDashs[index][field] = value;
    setDashboards(newDashs);
  };

  const removeDashboard = (index: number) => {
    const newDashs = [...dashboards];
    newDashs.splice(index, 1);
    setDashboards(newDashs);
  };

  return (
    <div className="fixed inset-0 z-[100] bg-[var(--dash-bg)] text-[#e2e8f0] flex flex-col font-sans overflow-hidden md:left-[240px]">
      <div className="flex items-center justify-between p-4 border-b border-[var(--dash-border)] bg-[var(--dash-card)] md:px-8 md:py-5">
        <button onClick={onClose} className="w-10 h-10 flex items-center justify-center text-gray-400 hover:text-white transition-colors">
          <ChevronLeft size={24} />
        </button>
        <h1 className="text-xl font-bold text-white">Pre-order Settings</h1>
        <div className="w-10" />
      </div>

      <div className="flex-1 overflow-y-auto p-4 pb-24 md:p-8 md:pb-24 max-w-2xl mx-auto w-full">
        <div className="space-y-6 max-w-sm mx-auto">
          {/* P-website Section */}
          <div className="bg-[var(--dash-card)] border border-[var(--dash-border)] rounded-xl p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-white text-lg">P-website</h2>
              <button
                onClick={() => setEnabled(!enabled)}
                className={cn("w-12 h-6 rounded-full relative flex items-center px-1 transition-colors group", enabled ? "bg-[#fafafa]" : "bg-[var(--dash-border)]")}
              >
                <div className={cn("w-4 h-4 rounded-full transition-all duration-300 ease-[cubic-bezier(0.25,1,0.5,1)]", enabled  ? "bg-[var(--dash-card)] translate-x-6 group-active:w-6 group-active:translate-x-4" : "bg-white translate-x-0 group-active:w-6")}></div>
              </button>
            </div>
            
            {enabled && (
               <div className="space-y-1">
                 <label className="text-xs text-gray-400">Main Website Pre-order Link</label>
                 <input 
                   type="text"
                   value={link}
                   onChange={e => setLink(e.target.value)}
                   placeholder="https://..."
                   className="w-full bg-[var(--dash-bg)] border border-[var(--dash-border)] rounded-lg p-3 text-sm text-white focus:outline-none focus:border-[#fafafa]"
                 />
               </div>
            )}
          </div>

          {/* P-dashboard Section */}
          <div className="bg-[var(--dash-card)] border border-[var(--dash-border)] rounded-xl p-4 space-y-4">
            <h2 className="font-bold text-white text-lg">P-dashboard</h2>
            
            <div className="space-y-3">
               {dashboards.map((dash, i) => (
                 <div key={dash.id} className="bg-[var(--dash-bg)] border border-[var(--dash-border)] p-3 rounded-lg space-y-3">
                   <div className="flex items-center justify-between">
                     <span className="text-sm font-bold text-[#fafafa]">Link {i + 1}</span>
                     <button onClick={() => removeDashboard(i)} className="text-red-500 p-1 hover:bg-red-500/10 rounded">
                       <Trash2 size={16} />
                     </button>
                   </div>
                   <input
                     type="text"
                     placeholder="Name (e.g. fariq)"
                     value={dash.name}
                     onChange={(e) => updateDashboard(i, 'name', e.target.value)}
                     className="w-full bg-[var(--dash-card)] border border-[var(--dash-border)] rounded-lg p-2 text-sm text-white focus:outline-none focus:border-[#fafafa]"
                   />
                   <input
                     type="text"
                     placeholder="Dashboard Link (https://...)"
                     value={dash.link}
                     onChange={(e) => updateDashboard(i, 'link', e.target.value)}
                     className="w-full bg-[var(--dash-card)] border border-[var(--dash-border)] rounded-lg p-2 text-sm text-white focus:outline-none focus:border-[#fafafa]"
                   />
                 </div>
               ))}
            </div>

            <button
               onClick={addDashboard}
               className="w-full py-3 rounded-lg border border-dashed border-[var(--dash-border)] text-gray-400 flex items-center justify-center gap-2 hover:bg-[var(--dash-border)] hover:text-white transition-colors text-sm"
            >
               <Plus size={16} />
               Add Dashboard Link
            </button>
          </div>

        </div>
      </div>

      <div className="absolute bottom-0 left-0 right-0 p-4 bg-[var(--dash-bg)] border-t border-[var(--dash-border)] flex justify-center z-[110]">
        <button
          onClick={handleSave}
          disabled={isSaving}
          style={{ backgroundColor: websiteSettings.themeColors?.primary || 'var(--theme-primary, #ff4d6d)', color: '#ffffff' }}
          className="w-full max-w-sm font-bold py-3.5 rounded-full shadow-lg hover:brightness-95 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
        >
          {isSaving ? (
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : saved ? (
            <Check size={18} className="text-white" />
          ) : (
            <Save size={18} />
          )}
          <span>{saved ? 'Saved' : 'Save Changes'}</span>
        </button>
      </div>
    </div>
  );
}
