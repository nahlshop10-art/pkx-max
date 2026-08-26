import React, { useState } from 'react';
import { ArrowLeft, Save, Check } from 'lucide-react';
import { WebsiteSettings } from './types';
import ActionButtonsCustomiser from './components/ActionButtonsCustomiser';
import { cloudStore } from './lib/cloudStore';

interface CustomiseManagerProps {
  settings: WebsiteSettings;
  setSettings: React.Dispatch<React.SetStateAction<WebsiteSettings>>;
  onClose: () => void;
}

const POPULAR_FONTS = [
  "Inter", "Roboto", "Open Sans", "Lato", "Montserrat", "Poppins", 
  "Oswald", "Source Sans Pro", "Slabo 27px", "Raleway", "PT Sans", 
  "Merriweather", "Noto Sans", "Nunito", "Playfair Display", 
  "Muli", "Rubik", "Ubuntu", "Work Sans", "Lora", 
  "Nunito Sans", "Fira Sans", "Quicksand", "Crimson Text", "Hind",
  "Titillium Web", "Inconsolata", "Josefin Sans", "Cabin", "Anton",
  "Oxygen", "Dosis", "Bitter", "Arimo", "Pacifico"
];

export default function CustomiseManager({ settings, setSettings, onClose }: CustomiseManagerProps) {
  const [draftSettings, setDraftSettings] = useState<WebsiteSettings>(() => JSON.parse(JSON.stringify(settings)));
  const [activeTab, setActiveTab] = useState<'website' | 'buttons' | 'dashboard'>('website');
  const [saved, setSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const defaultThemeColors = {
    primary: '#ff4d6d',
    black: '#000000',
    white: '#ffffff',
    bg: '#ffffff',
  };

  const themeColors = draftSettings.themeColors || defaultThemeColors;

  const handleColorChange = (key: keyof typeof themeColors, value: string) => {
    setDraftSettings((prev) => ({
      ...prev,
      themeColors: {
        ...(prev.themeColors || defaultThemeColors),
        [key]: value
      }
    }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      setSettings(draftSettings);
      await cloudStore.saveSetting('websiteSettings', draftSettings);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[110] bg-[var(--dash-bg)] text-[#e2e8f0] flex flex-col font-sans overflow-hidden md:left-[240px]">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-[var(--dash-border)] bg-[var(--dash-bg)]">
        <div className="flex items-center gap-4">
          <button onClick={onClose} className="p-2 -ml-2 text-white hover:bg-[var(--dash-border)] rounded-full transition-colors">
            <ArrowLeft size={24} />
          </button>
          <h2 className="text-xl font-bold text-white">Customise</h2>
        </div>
        <button
          onClick={handleSave}
          disabled={isSaving}
          style={{ backgroundColor: themeColors.primary || 'var(--theme-primary, #ff4d6d)', color: '#ffffff' }}
          className="flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-xs md:text-sm hover:brightness-95 active:scale-95 transition-all shadow-md cursor-pointer disabled:opacity-50"
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

      <div className="flex-1 overflow-y-auto pb-safe bg-[var(--dash-bg)]">
        <div className="flex border-b border-[var(--dash-border)]">
          <button 
            className={`flex-1 py-4 text-center text-sm font-medium ${activeTab === 'website' ? 'text-[#fafafa] border-b-2 border-[#fafafa]' : 'text-gray-400'}`}
            onClick={() => setActiveTab('website')}
          >
            Website
          </button>
          <button 
            className={`flex-1 py-4 text-center text-sm font-medium ${activeTab === 'buttons' ? 'text-[#fafafa] border-b-2 border-[#fafafa]' : 'text-gray-400'}`}
            onClick={() => setActiveTab('buttons')}
          >
            Buttons
          </button>
          <button 
            className={`flex-1 py-4 text-center text-sm font-medium ${activeTab === 'dashboard' ? 'text-[#fafafa] border-b-2 border-[#fafafa]' : 'text-gray-400'}`}
            onClick={() => setActiveTab('dashboard')}
          >
            Dashboard
          </button>
        </div>

        {activeTab === 'website' && (
          <div className="p-4 space-y-6">
            {draftSettings.mainFont && (
              <style>
                {`@import url('https://fonts.googleapis.com/css2?family=${draftSettings.mainFont.replace(/ /g, '+')}:wght@300;400;500;600;700&display=swap');`}
              </style>
            )}
            <h3 className="text-lg font-semibold text-white mb-2">Colour</h3>
            
            {/* Primary Colour Group */}
            <div className="bg-[var(--dash-card)] p-4 rounded-xl border border-[var(--dash-border)]">
              <h4 className="text-white font-medium mb-3">Primary Colour Group</h4>
              <div className="flex items-center gap-3">
                <input 
                  type="color" 
                  value={themeColors.primary.startsWith('#') && themeColors.primary.length === 7 ? themeColors.primary : '#ff4d6d'} 
                  onChange={(e) => handleColorChange('primary', e.target.value)}
                  className="w-10 h-10 rounded border border-[var(--dash-border)] shadow-sm shrink-0 cursor-pointer bg-transparent p-0"
                />
                <input 
                  type="text" 
                  value={themeColors.primary}
                  onChange={(e) => handleColorChange('primary', e.target.value)}
                  className="flex-1 bg-[var(--dash-border)] text-white border border-[#2a4d3e] rounded-lg px-3 py-2 uppercase font-mono text-sm"
                  placeholder="#FF4D6D"
                />
              </div>
            </div>

            {/* Black Colour Group */}
            <div className="bg-[var(--dash-card)] p-4 rounded-xl border border-[var(--dash-border)]">
              <h4 className="text-white font-medium mb-3">Black Colour Group</h4>
              <div className="flex items-center gap-3">
                <input 
                  type="color" 
                  value={themeColors.black.startsWith('#') && themeColors.black.length === 7 ? themeColors.black : '#000000'} 
                  onChange={(e) => handleColorChange('black', e.target.value)}
                  className="w-10 h-10 rounded border border-[var(--dash-border)] shadow-sm shrink-0 cursor-pointer bg-transparent p-0"
                />
                <input 
                  type="text" 
                  value={themeColors.black}
                  onChange={(e) => handleColorChange('black', e.target.value)}
                  className="flex-1 bg-[var(--dash-border)] text-white border border-[#2a4d3e] rounded-lg px-3 py-2 uppercase font-mono text-sm"
                  placeholder="#000000"
                />
              </div>
            </div>

            {/* White Colour Group */}
            <div className="bg-[var(--dash-card)] p-4 rounded-xl border border-[var(--dash-border)]">
              <h4 className="text-white font-medium mb-3">White Colour Group</h4>
              <div className="flex items-center gap-3">
                <input 
                  type="color" 
                  value={themeColors.white.startsWith('#') && themeColors.white.length === 7 ? themeColors.white : '#ffffff'} 
                  onChange={(e) => handleColorChange('white', e.target.value)}
                  className="w-10 h-10 rounded border border-[var(--dash-border)] shadow-sm shrink-0 cursor-pointer bg-transparent p-0"
                />
                <input 
                  type="text" 
                  value={themeColors.white}
                  onChange={(e) => handleColorChange('white', e.target.value)}
                  className="flex-1 bg-[var(--dash-border)] text-white border border-[#2a4d3e] rounded-lg px-3 py-2 uppercase font-mono text-sm"
                  placeholder="#FFFFFF"
                />
              </div>
            </div>

            {/* Store Background Colour */}
            <div className="bg-[var(--dash-card)] p-4 rounded-xl border border-[var(--dash-border)]">
              <h4 className="text-white font-medium mb-3">Front Store Background Colour</h4>
              <div className="flex items-center gap-3">
                <input 
                  type="color" 
                  value={(themeColors.bg && themeColors.bg.startsWith('#') && themeColors.bg.length === 7) ? themeColors.bg : '#ffffff'} 
                  onChange={(e) => handleColorChange('bg', e.target.value)}
                  className="w-10 h-10 rounded border border-[var(--dash-border)] shadow-sm shrink-0 cursor-pointer bg-transparent p-0"
                />
                <input 
                  type="text" 
                  value={themeColors.bg || ''}
                  onChange={(e) => handleColorChange('bg', e.target.value)}
                  className="flex-1 bg-[var(--dash-border)] text-white border border-[#2a4d3e] rounded-lg px-3 py-2 uppercase font-mono text-sm"
                  placeholder="#FFFFFF"
                />
              </div>
              <p className="text-xs text-gray-400 mt-2">This changes the main background color of the customer-facing storefront (e.g. main page, product details, cart list, and checkout views).</p>
            </div>

            <h3 className="text-lg font-semibold text-white mt-8 mb-2">Typography (Main Website)</h3>
            
            <div className="bg-[var(--dash-card)] p-4 rounded-xl border border-[var(--dash-border)] space-y-4">
              <div className="space-y-2">
                <label className="text-white font-medium block">Font Style (35 Popular Fonts)</label>
                <select
                  value={draftSettings.mainFont || 'Inter'}
                  onChange={(e) => setDraftSettings(prev => ({ ...prev, mainFont: e.target.value }))}
                  className="w-full bg-[var(--dash-border)] text-white border border-[#2a4d3e] rounded-lg px-3 py-2 font-mono text-sm"
                >
                  {POPULAR_FONTS.map(font => (
                    <option key={font} value={font} style={{ fontFamily: font }}>{font}</option>
                  ))}
                </select>
                <div 
                  className="mt-3 p-4 bg-[var(--dash-bg)]/20 rounded-lg text-center" 
                  style={{ fontFamily: draftSettings.mainFont || 'Inter' }}
                >
                  <p className="text-white text-lg">Preview Text</p>
                  <p className="text-gray-400 text-sm mt-1">The quick brown fox jumps over the lazy dog.</p>
                </div>
              </div>

              <div className="space-y-2 pt-2 border-t border-[var(--dash-border)]">
                <div className="flex justify-between">
                  <label className="text-white font-medium">Text Brightness</label>
                  <span className="text-[#fafafa] font-mono text-sm">{draftSettings.textBrightness ?? 100}%</span>
                </div>
                <input 
                  type="range" 
                  min="20" 
                  max="100" 
                  value={draftSettings.textBrightness ?? 100}
                  onChange={(e) => setDraftSettings(prev => ({ ...prev, textBrightness: parseInt(e.target.value) }))}
                  className="w-full accent-[#fafafa]"
                />
                <p className="text-xs text-gray-400">Controls the brightness/opacity of text elements across the storefront.</p>
              </div>
            </div>

          </div>
        )}

        {activeTab === 'buttons' && (
          <ActionButtonsCustomiser settings={draftSettings} setSettings={setDraftSettings} />
        )}

        {activeTab === 'dashboard' && (
          <div className="p-4 space-y-6">
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-lg font-semibold text-white">Mobile Navigation Bar</h3>
              <button 
                onClick={() => setDraftSettings(prev => ({ ...prev, dashboardNav: { height: 64, width: 92, blur: 4, bottomOffset: 10 } }))}
                className="text-xs bg-[var(--dash-border)] hover:bg-[#3f3f46] text-white px-3 py-1.5 rounded-lg transition-colors"
              >
                Reset to Default
              </button>
            </div>
            
            <div className="bg-[var(--dash-card)] p-4 rounded-xl border border-[var(--dash-border)] space-y-6">
              
              <div className="space-y-3">
                <div className="flex justify-between">
                  <label className="text-white font-medium text-sm">Height</label>
                  <span className="text-[#fafafa] font-mono text-sm">{draftSettings.dashboardNav?.height ?? 64}px</span>
                </div>
                <input 
                  type="range" 
                  min="40" 
                  max="100" 
                  value={draftSettings.dashboardNav?.height ?? 64}
                  onChange={(e) => setDraftSettings(prev => ({ ...prev, dashboardNav: { ...(prev.dashboardNav ?? { height: 64, width: 92, blur: 4, bottomOffset: 10 }), height: parseInt(e.target.value) } }))}
                  className="w-full accent-[#fafafa]"
                />
              </div>

              <div className="space-y-3 border-t border-[var(--dash-border)] pt-4">
                <div className="flex justify-between">
                  <label className="text-white font-medium text-sm">Width</label>
                  <span className="text-[#fafafa] font-mono text-sm">{draftSettings.dashboardNav?.width ?? 92}%</span>
                </div>
                <input 
                  type="range" 
                  min="50" 
                  max="100" 
                  value={draftSettings.dashboardNav?.width ?? 92}
                  onChange={(e) => setDraftSettings(prev => ({ ...prev, dashboardNav: { ...(prev.dashboardNav ?? { height: 64, width: 92, blur: 4, bottomOffset: 10 }), width: parseInt(e.target.value) } }))}
                  className="w-full accent-[#fafafa]"
                />
              </div>

              <div className="space-y-3 border-t border-[var(--dash-border)] pt-4">
                <div className="flex justify-between">
                  <label className="text-white font-medium text-sm">Blur Effect</label>
                  <span className="text-[#fafafa] font-mono text-sm">{draftSettings.dashboardNav?.blur ?? 4}px</span>
                </div>
                <input 
                  type="range" 
                  min="0" 
                  max="40" 
                  value={draftSettings.dashboardNav?.blur ?? 4}
                  onChange={(e) => setDraftSettings(prev => ({ ...prev, dashboardNav: { ...(prev.dashboardNav ?? { height: 64, width: 92, blur: 4, bottomOffset: 10 }), blur: parseInt(e.target.value) } }))}
                  className="w-full accent-[#fafafa]"
                />
              </div>

              <div className="space-y-3 border-t border-[var(--dash-border)] pt-4">
                <div className="flex justify-between">
                  <label className="text-white font-medium text-sm">Bottom Position (Offset)</label>
                  <span className="text-[#fafafa] font-mono text-sm">{draftSettings.dashboardNav?.bottomOffset ?? 10}px</span>
                </div>
                <input 
                  type="range" 
                  min="0" 
                  max="50" 
                  value={draftSettings.dashboardNav?.bottomOffset ?? 10}
                  onChange={(e) => setDraftSettings(prev => ({ ...prev, dashboardNav: { ...(prev.dashboardNav ?? { height: 64, width: 92, blur: 4, bottomOffset: 10 }), bottomOffset: parseInt(e.target.value) } }))}
                  className="w-full accent-[#fafafa]"
                />
              </div>

              <div className="space-y-3 border-t border-[var(--dash-border)] pt-4">
                <div className="flex justify-between">
                  <label className="text-white font-medium text-sm">Glass Border Whiteness</label>
                  <span className="text-[#fafafa] font-mono text-sm">{draftSettings.dashboardNav?.borderWhiteness ?? 40}%</span>
                </div>
                <input 
                  type="range" 
                  min="0" 
                  max="100" 
                  value={draftSettings.dashboardNav?.borderWhiteness ?? 40}
                  onChange={(e) => setDraftSettings(prev => ({ ...prev, dashboardNav: { ...(prev.dashboardNav ?? { height: 64, width: 92, blur: 4, bottomOffset: 10 }), borderWhiteness: parseInt(e.target.value) } }))}
                  className="w-full accent-[#fafafa]"
                />
                <p className="text-xs text-gray-400">Controls the opacity/whiteness of the glass border outline.</p>
              </div>

            </div>

            <div className="flex justify-between items-center mb-2 mt-8">
              <h3 className="text-lg font-semibold text-white">Dashboard Theme</h3>
              <button 
                onClick={() => setDraftSettings(prev => ({ ...prev, dashboardTheme: { blueTint: 47 } }))}
                className="text-xs bg-[var(--dash-border)] hover:bg-[#3f3f46] text-white px-3 py-1.5 rounded-lg transition-colors"
              >
                Reset Tint
              </button>
            </div>

            <div className="bg-[var(--dash-card)] p-4 rounded-xl border border-[var(--dash-border)] space-y-6">
              
              <div className="space-y-3">
                <div className="flex justify-between">
                  <label className="text-white font-medium text-sm">Blue Tint Level</label>
                  <span className="text-[#fafafa] font-mono text-sm">{draftSettings.dashboardTheme?.blueTint ?? 47}%</span>
                </div>
                <input 
                  type="range" 
                  min="0" 
                  max="100" 
                  value={draftSettings.dashboardTheme?.blueTint ?? 47}
                  onChange={(e) => setDraftSettings(prev => ({ ...prev, dashboardTheme: { ...(prev.dashboardTheme ?? { blueTint: 47 }), blueTint: parseInt(e.target.value) } }))}
                  className="w-full accent-[#fafafa]"
                />
                <p className="text-xs text-gray-400">Adjust the blue saturation of the dashboard dark mode theme.</p>
              </div>

            </div>
          </div>
        )}
      </div>
    </div>
  );
}
