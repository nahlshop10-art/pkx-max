import React, { useState } from 'react';
import { WebsiteSettings, SocialLink } from './types';
import { ArrowLeft, Plus, Trash2, Save, Check } from 'lucide-react';
import { cloudStore } from './lib/cloudStore';

export default function SocialMediaManager({
  websiteSettings,
  setWebsiteSettings,
  onClose
}: {
  websiteSettings: WebsiteSettings;
  setWebsiteSettings: React.Dispatch<React.SetStateAction<WebsiteSettings>>;
  onClose: () => void;
}) {
  const [links, setLinks] = useState<SocialLink[]>(websiteSettings.socialLinks || []);
  const [mainIcon, setMainIcon] = useState<string>(websiteSettings.socialMediaMainIcon || '');
  const [saved, setSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const handleAdd = () => {
    setLinks([...links, { id: Math.random().toString(36).substr(2, 9), icon: '', link: '' }]);
  };

  const handleRemove = (id: string) => {
    setLinks(links.filter(l => l.id !== id));
  };

  const handleChange = (id: string, field: keyof SocialLink, value: string) => {
    setLinks(links.map(l => l.id === id ? { ...l, [field]: value } : l));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const updatedSettings = { ...websiteSettings, socialLinks: links, socialMediaMainIcon: mainIcon };
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

  const handleIconUpload = (id: string, e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      cloudStore.uploadFile(file, `social_${Date.now()}_${file.name}`)
        .then(url => {
          handleChange(id, 'icon', url);
        })
        .catch(() => {
          const reader = new FileReader();
          reader.onload = (event) => {
            handleChange(id, 'icon', event.target?.result as string);
          };
          reader.readAsDataURL(file);
        });
    }
  };

  const handleMainIconUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      cloudStore.uploadFile(file, `social_main_${Date.now()}_${file.name}`)
        .then(url => {
          setMainIcon(url);
        })
        .catch(() => {
          const reader = new FileReader();
          reader.onload = (event) => {
            setMainIcon(event.target?.result as string);
          };
          reader.readAsDataURL(file);
        });
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-[var(--dash-bg)] text-[#e2e8f0] flex flex-col font-sans overflow-hidden md:left-[240px]">
      <div className="flex items-center justify-between p-4 bg-[var(--dash-card)] border-b border-[var(--dash-border)] md:px-8 md:py-5">
        <button onClick={onClose} className="p-2 -ml-2 text-gray-400 hover:text-white transition-colors">
          <ArrowLeft size={24} />
        </button>
        <h1 className="text-xl font-bold text-white absolute left-1/2 -translate-x-1/2">Social Media</h1>
        <button 
          onClick={handleSave} 
          disabled={isSaving}
          style={{ backgroundColor: websiteSettings.themeColors?.primary || 'var(--theme-primary, #ff4d6d)', color: '#ffffff' }}
          className="flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-xs md:text-sm hover:brightness-95 active:scale-95 transition-all shadow-md cursor-pointer disabled:opacity-50"
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

      <div className="flex-1 overflow-y-auto p-4 pb-24 md:p-8 md:pb-24 max-w-3xl mx-auto w-full">
        <div className="max-w-3xl mx-auto space-y-6">
          <div className="bg-[var(--dash-card)] border border-[var(--dash-border)] rounded-xl p-6">
            <h2 className="text-lg font-bold text-white mb-1">Main Button Icon</h2>
            <p className="text-sm text-gray-400 mb-4">Custom icon for the floating message button.</p>
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-[var(--dash-border)] rounded-lg border-2 border-dashed border-[#2a4d3e] flex-shrink-0 flex items-center justify-center overflow-hidden relative">
                {mainIcon ? (
                  <img src={mainIcon} alt="Main Icon" className="w-10 h-10 object-contain" />
                ) : (
                  <span className="text-xs text-gray-500 text-center px-1">Default Icon</span>
                )}
                <input 
                  type="file" 
                  accept="image/*"
                  className="absolute inset-0 opacity-0 cursor-pointer"
                  onChange={handleMainIconUpload}
                />
              </div>
              <div className="flex-1">
                {mainIcon && (
                  <button onClick={() => setMainIcon('')} className="text-sm text-red-400 hover:text-red-300 transition-colors">
                    Remove Custom Icon
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="bg-[var(--dash-card)] border border-[var(--dash-border)] rounded-xl p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-lg font-bold text-white mb-1">Floating Social Buttons</h2>
                <p className="text-sm text-gray-400">Add social media links to display on the frontend website.</p>
              </div>
              <button 
                onClick={handleAdd}
                className="flex items-center gap-2 bg-[var(--dash-border)] hover:bg-[#234538] text-[#fafafa] px-4 py-2 rounded-lg font-bold text-sm transition-colors"
              >
                <Plus size={16} /> Add New
              </button>
            </div>

            <div className="space-y-4">
              {links.map((link, index) => (
                <div key={link.id} className="bg-[var(--dash-bg)] border border-[var(--dash-border)] rounded-lg p-4 flex gap-4 items-start">
                  <div className="w-16 h-16 bg-[var(--dash-border)] rounded-lg border-2 border-dashed border-[#2a4d3e] flex-shrink-0 flex items-center justify-center overflow-hidden relative">
                    {link.icon ? (
                      <img src={link.icon} alt="Icon" className="w-10 h-10 object-contain" />
                    ) : (
                      <span className="text-xs text-gray-500 text-center px-1">Upload Icon</span>
                    )}
                    <input 
                      type="file" 
                      accept="image/*"
                      className="absolute inset-0 opacity-0 cursor-pointer"
                      onChange={(e) => handleIconUpload(link.id, e)}
                    />
                  </div>
                  
                  <div className="flex-1 space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-400 mb-1">Link URL</label>
                      <input 
                        type="url"
                        value={link.link}
                        onChange={(e) => handleChange(link.id, 'link', e.target.value)}
                        placeholder="https://wa.me/..."
                        className="w-full bg-[var(--dash-card)] border border-[var(--dash-border)] rounded-lg p-2 text-sm text-white focus:outline-none focus:border-[#fafafa]"
                      />
                    </div>
                  </div>

                  <button 
                    onClick={() => handleRemove(link.id)}
                    className="p-2 text-gray-500 hover:text-red-400 transition-colors"
                  >
                    <Trash2 size={20} />
                  </button>
                </div>
              ))}

              {links.length === 0 && (
                <div className="text-center py-8 bg-[var(--dash-bg)] border border-[var(--dash-border)] border-dashed rounded-lg">
                  <p className="text-gray-400 text-sm">No social links added yet.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
