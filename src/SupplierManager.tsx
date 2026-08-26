import React, { useState } from 'react';
import { ArrowLeft, Plus, X, Trash2, Edit3, Check, Save } from 'lucide-react';
import { WebsiteSettings } from './types';
import { cn } from './lib/utils';
import { cloudStore } from './lib/cloudStore';

interface SupplierManagerProps {
  settings: WebsiteSettings;
  setSettings: React.Dispatch<React.SetStateAction<WebsiteSettings>>;
  onClose: () => void;
}

export default function SupplierManager({ settings, setSettings, onClose }: SupplierManagerProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [newSupplier, setNewSupplier] = useState('');
  const [editingSupplier, setEditingSupplier] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  const suppliers = settings.suppliers || [];

  const handleAdd = () => {
    if (!newSupplier.trim() || suppliers.includes(newSupplier.trim())) {
      setIsAdding(false);
      setNewSupplier('');
      return;
    }
    const updated = [...suppliers, newSupplier.trim()];
    const updatedSettings = { ...settings, suppliers: updated };
    setSettings(updatedSettings);
    cloudStore.saveSetting('websiteSettings', updatedSettings).catch(console.error);
    setNewSupplier('');
    setIsAdding(false);
  };

  const handleEdit = (oldSupplier: string) => {
    if (!editValue.trim() || (editValue.trim() !== oldSupplier && suppliers.includes(editValue.trim()))) {
      setEditingSupplier(null);
      setEditValue('');
      return;
    }
    const updated = suppliers.map(s => s === oldSupplier ? editValue.trim() : s);
    const updatedSettings = { ...settings, suppliers: updated };
    setSettings(updatedSettings);
    cloudStore.saveSetting('websiteSettings', updatedSettings).catch(console.error);
    setEditingSupplier(null);
    setEditValue('');
  };

  const handleRemove = (supplier: string) => {
    const updated = suppliers.filter(s => s !== supplier);
    const updatedSettings = { ...settings, suppliers: updated };
    setSettings(updatedSettings);
    cloudStore.saveSetting('websiteSettings', updatedSettings).catch(console.error);
  };

  return (
    <div className="fixed inset-0 z-[110] bg-[var(--dash-bg)] text-[#e2e8f0] flex flex-col font-sans overflow-hidden md:left-[240px]">
      {/* Header */}
      <div className="flex items-center justify-center p-4 border-b border-[var(--dash-border)] bg-[var(--dash-bg)] relative">
        <button onClick={onClose} className="absolute left-4 p-2 -ml-2 text-white hover:bg-[var(--dash-border)] rounded-full transition-colors">
          <ArrowLeft size={24} />
        </button>
        <h2 className="text-xl font-bold text-white">Suppliers</h2>
      </div>

      <div className="flex-1 overflow-y-auto p-4 pb-safe bg-[var(--dash-bg)] flex flex-col items-center">
        {!isAdding && (
          <button 
            onClick={() => setIsAdding(true)}
            style={{ backgroundColor: settings.themeColors?.primary || 'var(--theme-primary, #ff4d6d)', color: '#ffffff' }}
            className="px-6 py-3 rounded-lg font-bold flex items-center justify-center gap-2 hover:brightness-95 active:scale-95 transition-all mb-6 shadow-md w-full max-w-sm cursor-pointer"
          >
            <Plus size={20} className="stroke-[3]" /> Add New
          </button>
        )}

        {isAdding && (
          <div className="w-full max-w-sm bg-[var(--dash-card)] p-4 rounded-xl border border-[var(--dash-border)] mb-6 flex gap-3 shadow-lg">
            <input 
              type="text" 
              value={newSupplier}
              onChange={(e) => setNewSupplier(e.target.value)}
              className="flex-1 bg-transparent text-white border-b border-[var(--dash-border)] focus:border-[#fafafa] px-2 py-2 outline-none font-medium placeholder-gray-500 transition-colors"
              placeholder="Supplier name"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAdd();
                if (e.key === 'Escape') {
                  setIsAdding(false);
                  setNewSupplier('');
                }
              }}
            />
            <button 
              onClick={handleAdd}
              style={{ backgroundColor: settings.themeColors?.primary || 'var(--theme-primary, #ff4d6d)', color: '#ffffff' }}
              className="px-5 py-2 rounded-lg font-bold hover:brightness-95 active:scale-95 transition-all whitespace-nowrap shadow-md cursor-pointer"
            >
              Save
            </button>
          </div>
        )}

        <div className="w-full max-w-sm space-y-3">
          {suppliers.map((supplier, idx) => (
            <div key={idx} className="bg-[var(--dash-card)] border border-[var(--dash-border)] rounded-xl p-3 flex items-center justify-between group transition-colors hover:border-[#2a4d3d]">
              {editingSupplier === supplier ? (
                 <div className="flex-1 flex gap-2 mr-1">
                    <input 
                      type="text" 
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      className="flex-1 bg-[var(--dash-bg)] text-white border border-[var(--dash-border)] rounded-lg focus:border-[#fafafa] px-3 py-1.5 outline-none font-medium"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleEdit(supplier);
                        if (e.key === 'Escape') {
                          setEditingSupplier(null);
                          setEditValue('');
                        }
                      }}
                    />
                    <button onClick={() => handleEdit(supplier)} className="text-[#fafafa] p-2 hover:bg-[var(--dash-border)] rounded-lg transition-colors flex items-center justify-center">
                      <Check size={18} className="stroke-[3]" />
                    </button>
                    <button onClick={() => setEditingSupplier(null)} className="text-gray-400 p-2 hover:bg-[var(--dash-border)] rounded-lg transition-colors flex items-center justify-center">
                      <X size={18} className="stroke-[3]" />
                    </button>
                 </div>
              ) : (
                 <>
                   <span className="text-white font-medium px-2 py-1 truncate">{supplier}</span>
                   <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                     <button onClick={() => { setEditingSupplier(supplier); setEditValue(supplier); }} className="text-gray-400 p-2 hover:bg-[var(--dash-border)] hover:text-[#fafafa] rounded-lg transition-colors">
                       <Edit3 size={18} />
                     </button>
                     <button onClick={() => handleRemove(supplier)} className="text-gray-400 p-2 hover:bg-[var(--dash-border)] hover:text-red-400 rounded-lg transition-colors">
                       <Trash2 size={18} />
                     </button>
                   </div>
                 </>
              )}
            </div>
          ))}
          {suppliers.length === 0 && !isAdding && (
            <div className="text-center text-gray-400 mt-10 p-6 bg-[var(--dash-card)] border border-dashed border-[var(--dash-border)] rounded-xl">
              No suppliers added yet.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
