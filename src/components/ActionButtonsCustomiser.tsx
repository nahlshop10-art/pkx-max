import React, { useState } from 'react';
import { WebsiteSettings, ActionButtonsConfig, ButtonDesign, FloatingButtonDesign, DEFAULT_ACTION_BUTTONS } from '../types';
import { ChevronDown, Type, PaintBucket, Layout, Move, MousePointerClick, AlignLeft, AlignCenter, AlignRight, Check, CheckCircle2, ChevronRight, GripVertical } from 'lucide-react';

interface ActionButtonsCustomiserProps {
  settings: WebsiteSettings;
  setSettings: React.Dispatch<React.SetStateAction<WebsiteSettings>>;
}

type ButtonKey = keyof ActionButtonsConfig;

export default function ActionButtonsCustomiser({ settings, setSettings }: ActionButtonsCustomiserProps) {
  const [selectedButton, setSelectedButton] = useState<ButtonKey>('viewCart');
  
  const buttonsConfig: ActionButtonsConfig = settings.actionButtons || DEFAULT_ACTION_BUTTONS;

  const currentSettings = buttonsConfig[selectedButton];

  const updateSettings = (key: string, value: any) => {
    setSettings(prev => {
      const prevButtons = prev.actionButtons || DEFAULT_ACTION_BUTTONS;
      return {
        ...prev,
        actionButtons: {
          ...prevButtons,
          [selectedButton]: {
            ...prevButtons[selectedButton],
            [key]: value
          }
        }
      };
    });
  };

  const buttonOptions: { key: ButtonKey; label: string }[] = [
    { key: 'viewCart', label: 'View Cart Floating Button' },
    { key: 'confirmOrder', label: 'Confirm Order Floating Button' },
    { key: 'checkout', label: 'Checkout Button (Cart)' },
    { key: 'placeOrder', label: 'Place Order Button' },
  ];

  return (
    <div className="p-4 space-y-6">
      <div className="bg-[var(--dash-card)] p-4 rounded-xl border border-[var(--dash-border)]">
        <h4 className="text-white font-medium mb-3">Select Button</h4>
        <div className="space-y-2">
          {buttonOptions.map(opt => (
            <button
              key={opt.key}
              onClick={() => setSelectedButton(opt.key)}
              className={`w-full text-left px-4 py-3 rounded-lg flex items-center justify-between transition-colors ${selectedButton === opt.key ? 'bg-[#fafafa] text-[var(--dash-bg)] font-semibold' : 'bg-[var(--dash-border)] text-white hover:bg-[#204033]'}`}
            >
              <span>{opt.label}</span>
              {selectedButton === opt.key && <CheckCircle2 size={18} />}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-[var(--dash-card)] p-4 rounded-xl border border-[var(--dash-border)] space-y-5">
        <h4 className="text-white font-medium flex items-center gap-2 border-b border-[var(--dash-border)] pb-3 mb-4">
          <Layout size={18} className="text-[#fafafa]" /> Size & Shape
        </h4>
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs uppercase tracking-wider text-gray-400 mb-1">Width</label>
            <select
              value={currentSettings.width}
              onChange={(e) => updateSettings('width', e.target.value)}
              className="w-full bg-[var(--dash-border)] text-white border border-[#2a4d3e] rounded-lg px-3 py-2 text-sm"
            >
              <option value="auto">Auto (Fit Content)</option>
              <option value="100%">100% (Full Width)</option>
              <option value="90%">90% Width</option>
              <option value="200px">Fixed (200px)</option>
            </select>
          </div>
          <div>
            <label className="block text-xs uppercase tracking-wider text-gray-400 mb-1">Height</label>
            <input 
              type="text"
              value={currentSettings.height}
              onChange={(e) => updateSettings('height', e.target.value)}
              className="w-full bg-[var(--dash-border)] text-white border border-[#2a4d3e] rounded-lg px-3 py-2 text-sm"
              placeholder="e.g. 48px"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs uppercase tracking-wider text-gray-400 mb-1">Border Radius</label>
            <input 
              type="text"
              value={currentSettings.borderRadius}
              onChange={(e) => updateSettings('borderRadius', e.target.value)}
              className="w-full bg-[var(--dash-border)] text-white border border-[#2a4d3e] rounded-lg px-3 py-2 text-sm"
              placeholder="e.g. 8px, 9999px"
            />
          </div>
          <div>
            <label className="block text-xs uppercase tracking-wider text-gray-400 mb-1">Shadow (Elevation)</label>
            <input 
              type="range" min="0" max="5"
              value={currentSettings.elevation}
              onChange={(e) => updateSettings('elevation', parseInt(e.target.value))}
              className="w-full mt-2"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs uppercase tracking-wider text-gray-400 mb-1">Padding X</label>
            <input 
              type="text"
              value={currentSettings.paddingX}
              onChange={(e) => updateSettings('paddingX', e.target.value)}
              className="w-full bg-[var(--dash-border)] text-white border border-[#2a4d3e] rounded-lg px-3 py-2 text-sm"
              placeholder="e.g. 24px"
            />
          </div>
          <div>
            <label className="block text-xs uppercase tracking-wider text-gray-400 mb-1">Padding Y</label>
            <input 
              type="text"
              value={currentSettings.paddingY}
              onChange={(e) => updateSettings('paddingY', e.target.value)}
              className="w-full bg-[var(--dash-border)] text-white border border-[#2a4d3e] rounded-lg px-3 py-2 text-sm"
              placeholder="e.g. 12px"
            />
          </div>
        </div>
      </div>

      <div className="bg-[var(--dash-card)] p-4 rounded-xl border border-[var(--dash-border)] space-y-5">
        <h4 className="text-white font-medium flex items-center gap-2 border-b border-[var(--dash-border)] pb-3 mb-4">
          <PaintBucket size={18} className="text-[#fafafa]" /> Colors
        </h4>
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs uppercase tracking-wider text-gray-400 mb-1">Background</label>
            <div className="flex items-center gap-2">
              <input 
                type="color" 
                value={currentSettings.backgroundColor} 
                onChange={(e) => updateSettings('backgroundColor', e.target.value)}
                className="w-8 h-8 rounded cursor-pointer bg-transparent border-0 p-0"
              />
              <input 
                type="text" 
                value={currentSettings.backgroundColor}
                onChange={(e) => updateSettings('backgroundColor', e.target.value)}
                className="flex-1 bg-[var(--dash-border)] text-white border border-[#2a4d3e] rounded-lg px-3 py-2 uppercase font-mono text-xs"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs uppercase tracking-wider text-gray-400 mb-1">Text / Icon</label>
            <div className="flex items-center gap-2">
              <input 
                type="color" 
                value={currentSettings.textColor} 
                onChange={(e) => updateSettings('textColor', e.target.value)}
                className="w-8 h-8 rounded cursor-pointer bg-transparent border-0 p-0"
              />
              <input 
                type="text" 
                value={currentSettings.textColor}
                onChange={(e) => updateSettings('textColor', e.target.value)}
                className="flex-1 bg-[var(--dash-border)] text-white border border-[#2a4d3e] rounded-lg px-3 py-2 uppercase font-mono text-xs"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="bg-[var(--dash-card)] p-4 rounded-xl border border-[var(--dash-border)] space-y-5">
        <h4 className="text-white font-medium flex items-center gap-2 border-b border-[var(--dash-border)] pb-3 mb-4">
          <Type size={18} className="text-[#fafafa]" /> Typography
        </h4>
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs uppercase tracking-wider text-gray-400 mb-1">Font Size</label>
            <input 
              type="text"
              value={currentSettings.fontSize}
              onChange={(e) => updateSettings('fontSize', e.target.value)}
              className="w-full bg-[var(--dash-border)] text-white border border-[#2a4d3e] rounded-lg px-3 py-2 text-sm"
              placeholder="e.g. 16px"
            />
          </div>
          <div>
            <label className="block text-xs uppercase tracking-wider text-gray-400 mb-1">Font Weight</label>
            <select
              value={currentSettings.fontWeight}
              onChange={(e) => updateSettings('fontWeight', parseInt(e.target.value))}
              className="w-full bg-[var(--dash-border)] text-white border border-[#2a4d3e] rounded-lg px-3 py-2 text-sm"
            >
              <option value="400">Normal (400)</option>
              <option value="500">Medium (500)</option>
              <option value="600">SemiBold (600)</option>
              <option value="700">Bold (700)</option>
              <option value="800">ExtraBold (800)</option>
            </select>
          </div>
        </div>
      </div>

      <div className="bg-[var(--dash-card)] p-4 rounded-xl border border-[var(--dash-border)] space-y-5">
        <h4 className="text-white font-medium flex items-center gap-2 border-b border-[var(--dash-border)] pb-3 mb-4">
          <MousePointerClick size={18} className="text-[#fafafa]" /> Icon Settings
        </h4>
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs uppercase tracking-wider text-gray-400 mb-1">Icon Style</label>
            <select
              value={currentSettings.icon}
              onChange={(e) => updateSettings('icon', e.target.value)}
              className="w-full bg-[var(--dash-border)] text-white border border-[#2a4d3e] rounded-lg px-3 py-2 text-sm"
            >
              <option value="none">None (Hide)</option>
              <option value="bag">Shopping Bag</option>
              <option value="cart">Shopping Cart</option>
              <option value="check">Checkmark</option>
              <option value="arrow">Right Arrow</option>
              <option value="plus">Plus Sign</option>
            </select>
          </div>
          <div>
            <label className="block text-xs uppercase tracking-wider text-gray-400 mb-1">Position</label>
            <div className="flex rounded-lg overflow-hidden border border-[#2a4d3e]">
              <button
                onClick={() => updateSettings('iconPosition', 'left')}
                className={`flex-1 py-2 text-sm font-medium ${currentSettings.iconPosition === 'left' ? 'bg-[#2a4d3e] text-white' : 'bg-[var(--dash-border)] text-gray-400'}`}
              >
                Left
              </button>
              <button
                onClick={() => updateSettings('iconPosition', 'right')}
                className={`flex-1 py-2 text-sm font-medium ${currentSettings.iconPosition === 'right' ? 'bg-[#2a4d3e] text-white' : 'bg-[var(--dash-border)] text-gray-400'}`}
              >
                Right
              </button>
            </div>
          </div>
        </div>
      </div>

      {('position' in currentSettings) && (
        <div className="bg-[var(--dash-card)] p-4 rounded-xl border border-[var(--dash-border)] space-y-5">
          <h4 className="text-white font-medium flex items-center gap-2 border-b border-[var(--dash-border)] pb-3 mb-4">
            <Move size={18} className="text-[#fafafa]" /> Floating Position
          </h4>
          
          <div>
            <label className="block text-xs uppercase tracking-wider text-gray-400 mb-2">Screen Position</label>
            <div className="grid grid-cols-3 gap-2">
              <button 
                onClick={() => updateSettings('position', 'top-left')}
                className={`py-2 rounded border border-[#2a4d3e] flex justify-center ${currentSettings.position === 'top-left' ? 'bg-[#fafafa] text-[var(--dash-bg)] font-bold' : 'bg-[var(--dash-border)] text-white hover:bg-[#204033]'}`}
              >
                Top Left
              </button>
              <div className="py-2 border border-dashed border-[#2a4d3e] rounded flex justify-center opacity-30">
                Top
              </div>
              <button 
                onClick={() => updateSettings('position', 'top-right')}
                className={`py-2 rounded border border-[#2a4d3e] flex justify-center ${currentSettings.position === 'top-right' ? 'bg-[#fafafa] text-[var(--dash-bg)] font-bold' : 'bg-[var(--dash-border)] text-white hover:bg-[#204033]'}`}
              >
                Top Right
              </button>
              <button 
                onClick={() => updateSettings('position', 'bottom-left')}
                className={`py-2 rounded border border-[#2a4d3e] flex justify-center ${currentSettings.position === 'bottom-left' ? 'bg-[#fafafa] text-[var(--dash-bg)] font-bold' : 'bg-[var(--dash-border)] text-white hover:bg-[#204033]'}`}
              >
                Bot Left
              </button>
              <button 
                onClick={() => updateSettings('position', 'bottom-center')}
                className={`py-2 rounded border border-[#2a4d3e] flex justify-center ${currentSettings.position === 'bottom-center' ? 'bg-[#fafafa] text-[var(--dash-bg)] font-bold' : 'bg-[var(--dash-border)] text-white hover:bg-[#204033]'}`}
              >
                Bot Center
              </button>
              <button 
                onClick={() => updateSettings('position', 'bottom-right')}
                className={`py-2 rounded border border-[#2a4d3e] flex justify-center ${currentSettings.position === 'bottom-right' ? 'bg-[#fafafa] text-[var(--dash-bg)] font-bold' : 'bg-[var(--dash-border)] text-white hover:bg-[#204033]'}`}
              >
                Bot Right
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-2">You can also drag the floating button preview on the main screen to change position.</p>
          </div>

          <div className="grid grid-cols-3 gap-3 pt-3">
            <div>
              <label className="block text-xs uppercase tracking-wider text-gray-400 mb-1">Mt/Mb</label>
              <input 
                type="text"
                value={(currentSettings as FloatingButtonDesign).marginBottom}
                onChange={(e) => updateSettings('marginBottom', e.target.value)}
                className="w-full bg-[var(--dash-border)] text-white border border-[#2a4d3e] rounded-lg px-2 py-2 text-sm text-center"
                placeholder="24px"
              />
            </div>
            <div>
              <label className="block text-xs uppercase tracking-wider text-gray-400 mb-1">Ml</label>
              <input 
                type="text"
                value={(currentSettings as FloatingButtonDesign).marginLeft}
                onChange={(e) => updateSettings('marginLeft', e.target.value)}
                className="w-full bg-[var(--dash-border)] text-white border border-[#2a4d3e] rounded-lg px-2 py-2 text-sm text-center"
                placeholder="0px"
              />
            </div>
            <div>
              <label className="block text-xs uppercase tracking-wider text-gray-400 mb-1">Mr</label>
              <input 
                type="text"
                value={(currentSettings as FloatingButtonDesign).marginRight}
                onChange={(e) => updateSettings('marginRight', e.target.value)}
                className="w-full bg-[var(--dash-border)] text-white border border-[#2a4d3e] rounded-lg px-2 py-2 text-sm text-center"
                placeholder="0px"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
