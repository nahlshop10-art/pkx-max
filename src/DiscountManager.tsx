import React, { useState } from 'react';
import { ChevronLeft, Plus, Edit, Trash2, Check, X, ChevronRight, Save } from 'lucide-react';
import { WebsiteSettings, DiscountRule, DiscountType, Product, Category } from './types';
import { cn, formatPrice } from './lib/utils';
import { cloudStore } from './lib/cloudStore';

interface DiscountManagerProps {
  websiteSettings: WebsiteSettings;
  setWebsiteSettings: React.Dispatch<React.SetStateAction<WebsiteSettings>>;
  products: Product[];
  categories: Category[];
  onClose: () => void;
}

const defaultDiscount: DiscountRule = {
  id: '',
  name: '',
  status: true,
  priority: 1,
  type: 'percentage',
  conditions: {},
  action: {},
  limits: {},
  time: {}
};

export default function DiscountManager({ websiteSettings, setWebsiteSettings, products, categories, onClose }: DiscountManagerProps) {
  const [discounts, setDiscounts] = useState<DiscountRule[]>(websiteSettings.discounts || []);
  const [editingDiscount, setEditingDiscount] = useState<DiscountRule | null>(null);
  const [step, setStep] = useState(1);

  const handleSaveSettings = (newDiscounts: DiscountRule[]) => {
    setDiscounts(newDiscounts);
    const updatedSettings = { ...websiteSettings, discounts: newDiscounts };
    setWebsiteSettings(updatedSettings);
    cloudStore.saveSetting('websiteSettings', updatedSettings).catch(console.error);
  };

  const handleAdd = () => {
    setEditingDiscount({ ...defaultDiscount, id: Date.now().toString() });
    setStep(1);
  };

  const handleEdit = (discount: DiscountRule) => {
    setEditingDiscount({ ...discount });
    setStep(1);
  };

  const handleDelete = (id: string) => {
    if (window.confirm('Are you sure you want to delete this discount?')) {
      handleSaveSettings(discounts.filter(d => d.id !== id));
    }
  };

  const handleToggleStatus = (id: string) => {
    handleSaveSettings(discounts.map(d => d.id === id ? { ...d, status: !d.status } : d));
  };

  const handleSaveDiscount = () => {
    if (!editingDiscount) return;
    
    if (!editingDiscount.name) {
      alert('Please enter a discount name');
      return;
    }

    if (editingDiscount.type === 'coupon' && !editingDiscount.action.couponCode) {
      alert('Please enter a coupon code');
      return;
    }

    const exists = discounts.find(d => d.id === editingDiscount.id);
    if (exists) {
      handleSaveSettings(discounts.map(d => d.id === editingDiscount.id ? editingDiscount : d));
    } else {
      handleSaveSettings([...discounts, editingDiscount]);
    }
    setEditingDiscount(null);
  };

  if (editingDiscount) {
    return (
      <div className="fixed inset-0 bg-[var(--dash-bg)] z-50 flex flex-col font-sans md:left-[240px]">
        <div className="flex items-center justify-between p-4 border-b border-[var(--dash-border)] bg-[var(--dash-bg)] sticky top-0 z-10 md:px-8 md:py-5">
          <button onClick={() => setEditingDiscount(null)} className="p-2 -ml-2 text-gray-400 hover:text-white transition-colors">
            <ChevronLeft size={24} />
          </button>
          <h1 className="text-xl font-bold text-white">
            {discounts.find(d => d.id === editingDiscount.id) ? 'Edit Discount' : 'Create Discount'}
          </h1>
          <div className="w-10" />
        </div>

        <div className="flex-1 overflow-y-auto p-4 pb-24 md:p-8 max-w-3xl mx-auto w-full">
          {/* Step Indicator */}
          <div className="flex items-center justify-between mb-8 px-2">
            {[1, 2, 3, 4, 5, 6].map(s => (
              <div key={s} className="flex flex-col items-center gap-2">
                <div className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors",
                  step === s ? "bg-[#fafafa] text-[var(--dash-bg)]" : 
                  step > s ? "bg-[#fafafa]/20 text-[#fafafa]" : "bg-[var(--dash-border)] text-gray-500"
                )}>
                  {step > s ? <Check size={16} /> : s}
                </div>
              </div>
            ))}
          </div>

          <div className="bg-[var(--dash-card)] border border-[var(--dash-border)] rounded-xl p-5 shadow-lg">
            {step === 1 && (
              <div className="space-y-4">
                <h2 className="text-lg font-bold text-white mb-4">Step 1: Basic Info</h2>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1.5">Discount Name *</label>
                  <input 
                    type="text" 
                    value={editingDiscount.name}
                    onChange={e => setEditingDiscount({...editingDiscount, name: e.target.value})}
                    placeholder="e.g. Eid Special 20%"
                    className="w-full bg-[var(--dash-bg)] border border-[var(--dash-border)] rounded-lg px-3 py-2.5 text-white focus:outline-none focus:border-[#fafafa]"
                  />
                </div>
                <div className="flex items-center justify-between p-3 bg-[var(--dash-bg)] rounded-lg border border-[var(--dash-border)]">
                  <span className="text-white font-medium">Status</span>
                  <button 
                    onClick={() => setEditingDiscount({...editingDiscount, status: !editingDiscount.status})}
                    className={cn("w-12 h-6 rounded-full relative flex items-center px-1 transition-colors group", editingDiscount.status ? "bg-[#fafafa]" : "bg-[var(--dash-border)]")}
                  >
                    <div className={cn("w-4 h-4 rounded-full transition-all duration-300 ease-[cubic-bezier(0.25,1,0.5,1)]", editingDiscount.status  ? "bg-[var(--dash-card)] translate-x-6 group-active:w-6 group-active:translate-x-4" : "bg-white translate-x-0 group-active:w-6")}></div>
                  </button>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1.5">Priority (Higher number applies first)</label>
                  <input 
                    type="number" 
                    value={editingDiscount.priority}
                    onChange={e => setEditingDiscount({...editingDiscount, priority: parseInt(e.target.value) || 0})}
                    className="w-full bg-[var(--dash-bg)] border border-[var(--dash-border)] rounded-lg px-3 py-2.5 text-white focus:outline-none focus:border-[#fafafa]"
                  />
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-4">
                <h2 className="text-lg font-bold text-white mb-4">Step 2: Select Type</h2>
                <div className="space-y-2">
                  {[
                    { id: 'percentage', label: 'Percentage Discount (%)' },
                    { id: 'fixed', label: 'Fixed Amount Discount (৳)' },
                    { id: 'free_delivery', label: 'Free Delivery' },
                    { id: 'buy_x_get_y', label: 'Buy X Get Y' },
                    { id: 'coupon', label: 'Coupon Code' }
                  ].map(t => (
                    <div 
                      key={t.id}
                      onClick={() => setEditingDiscount({...editingDiscount, type: t.id as DiscountType})}
                      className={cn(
                        "p-4 rounded-lg border cursor-pointer transition-colors flex items-center justify-between",
                        editingDiscount.type === t.id ? "bg-[#fafafa]/10 border-[#fafafa]" : "bg-[var(--dash-bg)] border-[var(--dash-border)] hover:border-gray-600"
                      )}
                    >
                      <span className={cn("font-medium", editingDiscount.type === t.id ? "text-[#fafafa]" : "text-white")}>{t.label}</span>
                      {editingDiscount.type === t.id && <Check size={20} className="text-[#fafafa]" />}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-4">
                <h2 className="text-lg font-bold text-white mb-4">Step 3: Conditions</h2>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1.5">Minimum Order Amount (৳)</label>
                  <input 
                    type="number" 
                    value={editingDiscount.conditions.minOrderAmount || ''}
                    onChange={e => setEditingDiscount({...editingDiscount, conditions: {...editingDiscount.conditions, minOrderAmount: parseFloat(e.target.value) || undefined}})}
                    placeholder="e.g. 1000"
                    className="w-full bg-[var(--dash-bg)] border border-[var(--dash-border)] rounded-lg px-3 py-2.5 text-white focus:outline-none focus:border-[#fafafa]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1.5">Maximum Order Amount (৳) (Optional)</label>
                  <input 
                    type="number" 
                    value={editingDiscount.conditions.maxOrderAmount || ''}
                    onChange={e => setEditingDiscount({...editingDiscount, conditions: {...editingDiscount.conditions, maxOrderAmount: parseFloat(e.target.value) || undefined}})}
                    placeholder="e.g. 5000"
                    className="w-full bg-[var(--dash-bg)] border border-[var(--dash-border)] rounded-lg px-3 py-2.5 text-white focus:outline-none focus:border-[#fafafa]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1.5">Minimum Quantity</label>
                  <input 
                    type="number" 
                    value={editingDiscount.conditions.minQuantity || ''}
                    onChange={e => setEditingDiscount({...editingDiscount, conditions: {...editingDiscount.conditions, minQuantity: parseInt(e.target.value) || undefined}})}
                    placeholder="e.g. 2"
                    className="w-full bg-[var(--dash-bg)] border border-[var(--dash-border)] rounded-lg px-3 py-2.5 text-white focus:outline-none focus:border-[#fafafa]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1.5">Location</label>
                  <select 
                    value={editingDiscount.conditions.location || 'all'}
                    onChange={e => setEditingDiscount({...editingDiscount, conditions: {...editingDiscount.conditions, location: e.target.value as any}})}
                    className="w-full bg-[var(--dash-bg)] border border-[var(--dash-border)] rounded-lg px-3 py-2.5 text-white focus:outline-none focus:border-[#fafafa]"
                  >
                    <option value="all">Anywhere</option>
                    <option value="inside_dhaka">Inside Dhaka</option>
                    <option value="outside_dhaka">Outside Dhaka</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1.5">Specific Categories (Optional)</label>
                  <div className="max-h-40 overflow-y-auto bg-[var(--dash-bg)] border border-[var(--dash-border)] rounded-lg p-2 space-y-1">
                    {categories.map(cat => (
                      <label key={cat.id} className="flex items-center gap-2 p-2 hover:bg-[var(--dash-border)] rounded cursor-pointer transition-colors">
                        <input 
                          type="checkbox" 
                          checked={editingDiscount.conditions.selectedCategories?.includes(cat.name)}
                          onChange={e => {
                            const current = editingDiscount.conditions.selectedCategories || [];
                            const updated = e.target.checked 
                              ? [...current, cat.name]
                              : current.filter(c => c !== cat.name);
                            setEditingDiscount({...editingDiscount, conditions: {...editingDiscount.conditions, selectedCategories: updated.length > 0 ? updated : undefined}});
                          }}
                          className="w-4 h-4 rounded border-[var(--dash-border)] bg-[var(--dash-bg)] text-[#fafafa] focus:ring-[#fafafa]"
                        />
                        <span className="text-sm text-white">{cat.name}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1.5">Specific Products (Optional)</label>
                  <div className="max-h-40 overflow-y-auto bg-[var(--dash-bg)] border border-[var(--dash-border)] rounded-lg p-2 space-y-1">
                    {products.map(prod => (
                      <label key={prod.id} className="flex items-center gap-2 p-2 hover:bg-[var(--dash-border)] rounded cursor-pointer transition-colors">
                        <input 
                          type="checkbox" 
                          checked={editingDiscount.conditions.selectedProducts?.includes(prod.id)}
                          onChange={e => {
                            const current = editingDiscount.conditions.selectedProducts || [];
                            const updated = e.target.checked 
                              ? [...current, prod.id]
                              : current.filter(p => p !== prod.id);
                            setEditingDiscount({...editingDiscount, conditions: {...editingDiscount.conditions, selectedProducts: updated.length > 0 ? updated : undefined}});
                          }}
                          className="w-4 h-4 rounded border-[var(--dash-border)] bg-[var(--dash-bg)] text-[#fafafa] focus:ring-[#fafafa]"
                        />
                        <div className="flex items-center gap-2">
                          <img src={prod.image} alt="" className="w-6 h-6 rounded object-cover" />
                          <span className="text-sm text-white truncate max-w-[200px]">{prod.title}</span>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between p-3 bg-[var(--dash-bg)] rounded-lg border border-[var(--dash-border)]">
                  <span className="text-white font-medium">First Order Only</span>
                  <button 
                    onClick={() => setEditingDiscount({...editingDiscount, conditions: {...editingDiscount.conditions, firstOrderOnly: !editingDiscount.conditions.firstOrderOnly}})}
                    className={cn("w-12 h-6 rounded-full relative flex items-center px-1 transition-colors group", editingDiscount.conditions.firstOrderOnly ? "bg-[#fafafa]" : "bg-[var(--dash-border)]")}
                  >
                    <div className={cn("w-4 h-4 rounded-full transition-all duration-300 ease-[cubic-bezier(0.25,1,0.5,1)]", editingDiscount.conditions.firstOrderOnly  ? "bg-[var(--dash-card)] translate-x-6 group-active:w-6 group-active:translate-x-4" : "bg-white translate-x-0 group-active:w-6")}></div>
                  </button>
                </div>
              </div>
            )}

            {step === 4 && (
              <div className="space-y-4">
                <h2 className="text-lg font-bold text-white mb-4">Step 4: Discount Action</h2>
                
                {editingDiscount.type === 'percentage' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1.5">Discount Percentage (%)</label>
                    <input 
                      type="number" 
                      value={editingDiscount.action.percentage || ''}
                      onChange={e => setEditingDiscount({...editingDiscount, action: {...editingDiscount.action, percentage: parseFloat(e.target.value) || undefined}})}
                      placeholder="e.g. 10"
                      className="w-full bg-[var(--dash-bg)] border border-[var(--dash-border)] rounded-lg px-3 py-2.5 text-white focus:outline-none focus:border-[#fafafa]"
                    />
                  </div>
                )}

                {editingDiscount.type === 'fixed' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1.5">Fixed Amount (৳)</label>
                    <input 
                      type="number" 
                      value={editingDiscount.action.fixedAmount || ''}
                      onChange={e => setEditingDiscount({...editingDiscount, action: {...editingDiscount.action, fixedAmount: parseFloat(e.target.value) || undefined}})}
                      placeholder="e.g. 100"
                      className="w-full bg-[var(--dash-bg)] border border-[var(--dash-border)] rounded-lg px-3 py-2.5 text-white focus:outline-none focus:border-[#fafafa]"
                    />
                  </div>
                )}

                {editingDiscount.type === 'free_delivery' && (
                  <div className="p-4 bg-[var(--dash-bg)] border border-[#fafafa]/30 rounded-lg text-[#fafafa] text-center font-medium">
                    Delivery charge will be automatically set to {formatPrice(0)}
                  </div>
                )}

                {editingDiscount.type === 'buy_x_get_y' && (
                  <div className="flex items-center gap-4">
                    <div className="flex-1">
                      <label className="block text-sm font-medium text-gray-400 mb-1.5">Buy (X)</label>
                      <input 
                        type="number" 
                        value={editingDiscount.action.buyX || ''}
                        onChange={e => setEditingDiscount({...editingDiscount, action: {...editingDiscount.action, buyX: parseInt(e.target.value) || undefined}})}
                        placeholder="e.g. 2"
                        className="w-full bg-[var(--dash-bg)] border border-[var(--dash-border)] rounded-lg px-3 py-2.5 text-white focus:outline-none focus:border-[#fafafa]"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="block text-sm font-medium text-gray-400 mb-1.5">Get (Y) Free</label>
                      <input 
                        type="number" 
                        value={editingDiscount.action.getY || ''}
                        onChange={e => setEditingDiscount({...editingDiscount, action: {...editingDiscount.action, getY: parseInt(e.target.value) || undefined}})}
                        placeholder="e.g. 1"
                        className="w-full bg-[var(--dash-bg)] border border-[var(--dash-border)] rounded-lg px-3 py-2.5 text-white focus:outline-none focus:border-[#fafafa]"
                      />
                    </div>
                  </div>
                )}

                {editingDiscount.type === 'coupon' && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-1.5">Coupon Code</label>
                      <div className="flex gap-2">
                        <input 
                          type="text" 
                          value={editingDiscount.action.couponCode || ''}
                          onChange={e => setEditingDiscount({...editingDiscount, action: {...editingDiscount.action, couponCode: e.target.value.toUpperCase()}})}
                          placeholder="e.g. SUMMER50"
                          className="flex-1 bg-[var(--dash-bg)] border border-[var(--dash-border)] rounded-lg px-3 py-2.5 text-white focus:outline-none focus:border-[#fafafa] uppercase"
                        />
                        <button 
                          onClick={() => setEditingDiscount({...editingDiscount, action: {...editingDiscount.action, couponCode: Math.random().toString(36).substring(2, 8).toUpperCase()}})}
                          className="px-4 bg-[var(--dash-border)] text-white rounded-lg hover:bg-[#2a4339] transition-colors font-medium"
                        >
                          Generate
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-1.5">Discount Type for Coupon</label>
                      <select 
                        value={editingDiscount.action.percentage ? 'percentage' : 'fixed'}
                        onChange={e => {
                          if (e.target.value === 'percentage') {
                            setEditingDiscount({...editingDiscount, action: {...editingDiscount.action, fixedAmount: undefined, percentage: 10}});
                          } else {
                            setEditingDiscount({...editingDiscount, action: {...editingDiscount.action, percentage: undefined, fixedAmount: 100}});
                          }
                        }}
                        className="w-full bg-[var(--dash-bg)] border border-[var(--dash-border)] rounded-lg px-3 py-2.5 text-white focus:outline-none focus:border-[#fafafa]"
                      >
                        <option value="percentage">Percentage (%)</option>
                        <option value="fixed">Fixed Amount (৳)</option>
                      </select>
                    </div>
                    {editingDiscount.action.percentage ? (
                      <div>
                        <label className="block text-sm font-medium text-gray-400 mb-1.5">Percentage (%)</label>
                        <input 
                          type="number" 
                          value={editingDiscount.action.percentage || ''}
                          onChange={e => setEditingDiscount({...editingDiscount, action: {...editingDiscount.action, percentage: parseFloat(e.target.value) || undefined}})}
                          className="w-full bg-[var(--dash-bg)] border border-[var(--dash-border)] rounded-lg px-3 py-2.5 text-white focus:outline-none focus:border-[#fafafa]"
                        />
                      </div>
                    ) : (
                      <div>
                        <label className="block text-sm font-medium text-gray-400 mb-1.5">Fixed Amount (৳)</label>
                        <input 
                          type="number" 
                          value={editingDiscount.action.fixedAmount || ''}
                          onChange={e => setEditingDiscount({...editingDiscount, action: {...editingDiscount.action, fixedAmount: parseFloat(e.target.value) || undefined}})}
                          className="w-full bg-[var(--dash-bg)] border border-[var(--dash-border)] rounded-lg px-3 py-2.5 text-white focus:outline-none focus:border-[#fafafa]"
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {step === 5 && (
              <div className="space-y-4">
                <h2 className="text-lg font-bold text-white mb-4">Step 5: Limits</h2>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1.5">Max Usage (Global) (Optional)</label>
                  <input 
                    type="number" 
                    value={editingDiscount.limits.maxUsageGlobal || ''}
                    onChange={e => setEditingDiscount({...editingDiscount, limits: {...editingDiscount.limits, maxUsageGlobal: parseInt(e.target.value) || undefined}})}
                    placeholder="e.g. 100"
                    className="w-full bg-[var(--dash-bg)] border border-[var(--dash-border)] rounded-lg px-3 py-2.5 text-white focus:outline-none focus:border-[#fafafa]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1.5">Max Usage Per User (Optional)</label>
                  <input 
                    type="number" 
                    value={editingDiscount.limits.maxUsagePerUser || ''}
                    onChange={e => setEditingDiscount({...editingDiscount, limits: {...editingDiscount.limits, maxUsagePerUser: parseInt(e.target.value) || undefined}})}
                    placeholder="e.g. 1"
                    className="w-full bg-[var(--dash-bg)] border border-[var(--dash-border)] rounded-lg px-3 py-2.5 text-white focus:outline-none focus:border-[#fafafa]"
                  />
                </div>
                <div className="flex items-center justify-between p-3 bg-[var(--dash-bg)] rounded-lg border border-[var(--dash-border)]">
                  <span className="text-white font-medium">One-time Use Only</span>
                  <button 
                    onClick={() => setEditingDiscount({...editingDiscount, limits: {...editingDiscount.limits, oneTimeUse: !editingDiscount.limits.oneTimeUse}})}
                    className={cn("w-12 h-6 rounded-full relative flex items-center px-1 transition-colors group", editingDiscount.limits.oneTimeUse ? "bg-[#fafafa]" : "bg-[var(--dash-border)]")}
                  >
                    <div className={cn("w-4 h-4 rounded-full transition-all duration-300 ease-[cubic-bezier(0.25,1,0.5,1)]", editingDiscount.limits.oneTimeUse  ? "bg-[var(--dash-card)] translate-x-6 group-active:w-6 group-active:translate-x-4" : "bg-white translate-x-0 group-active:w-6")}></div>
                  </button>
                </div>
              </div>
            )}

            {step === 6 && (
              <div className="space-y-4">
                <h2 className="text-lg font-bold text-white mb-4">Step 6: Time Control</h2>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1.5">Start Date (Optional)</label>
                  <input 
                    type="datetime-local" 
                    value={editingDiscount.time.startDate || ''}
                    onChange={e => setEditingDiscount({...editingDiscount, time: {...editingDiscount.time, startDate: e.target.value}})}
                    className="w-full bg-[var(--dash-bg)] border border-[var(--dash-border)] rounded-lg px-3 py-2.5 text-white focus:outline-none focus:border-[#fafafa]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1.5">End Date (Optional)</label>
                  <input 
                    type="datetime-local" 
                    value={editingDiscount.time.endDate || ''}
                    onChange={e => setEditingDiscount({...editingDiscount, time: {...editingDiscount.time, endDate: e.target.value}})}
                    className="w-full bg-[var(--dash-bg)] border border-[var(--dash-border)] rounded-lg px-3 py-2.5 text-white focus:outline-none focus:border-[#fafafa]"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Bottom Navigation */}
        <div className="absolute bottom-0 left-0 right-0 p-4 bg-[var(--dash-bg)] border-t border-[var(--dash-border)] flex items-center justify-between z-20">
          <button 
            onClick={() => step > 1 ? setStep(step - 1) : setEditingDiscount(null)}
            className="px-6 py-2.5 rounded-lg font-medium text-white bg-[var(--dash-border)] hover:bg-[#2a4339] transition-colors"
          >
            {step === 1 ? 'Cancel' : 'Back'}
          </button>
          
          {step < 6 ? (
            <button 
              onClick={() => setStep(step + 1)}
              className="px-6 py-2.5 rounded-lg font-medium text-[var(--dash-bg)] bg-[#fafafa] hover:bg-[#e4e4e7] transition-colors flex items-center gap-2"
            >
              Next <ChevronRight size={18} />
            </button>
          ) : (
            <button 
              onClick={handleSaveDiscount}
              style={{ backgroundColor: websiteSettings.themeColors?.primary || 'var(--theme-primary, #ff4d6d)', color: '#ffffff' }}
              className="px-6 py-2.5 rounded-lg font-bold hover:brightness-95 active:scale-95 transition-all flex items-center gap-2 shadow-md cursor-pointer"
            >
              <Save size={18} /> Save Discount
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-[var(--dash-bg)] z-50 flex flex-col font-sans md:left-[240px]">
      <div className="flex items-center justify-between p-4 border-b border-[var(--dash-border)] bg-[var(--dash-bg)] sticky top-0 z-10 md:px-8 md:py-5">
        <button onClick={onClose} className="p-2 -ml-2 text-gray-400 hover:text-white transition-colors">
          <ChevronLeft size={24} />
        </button>
        <h1 className="text-xl font-bold text-white">Discounts</h1>
        <div className="w-10" />
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 md:p-8 max-w-3xl mx-auto w-full">
        <button 
          onClick={handleAdd}
          className="w-full py-4 rounded-xl border-2 border-dashed border-[var(--dash-border)] hover:border-[#fafafa]/50 text-gray-400 hover:text-[#fafafa] transition-colors flex flex-col items-center justify-center gap-2"
        >
          <Plus size={24} />
          <span className="font-medium">Create Discount</span>
        </button>

        {discounts.length === 0 ? (
          <div className="text-center py-10 text-gray-500">
            No discounts created yet.
          </div>
        ) : (
          <div className="space-y-3">
            {discounts.sort((a, b) => b.priority - a.priority).map(discount => (
              <div key={discount.id} className="bg-[var(--dash-card)] border border-[var(--dash-border)] rounded-xl p-4 shadow-lg">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                      {discount.name}
                      <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--dash-border)] text-gray-300 font-medium uppercase">
                        {discount.type.replace(/_/g, ' ')}
                      </span>
                    </h3>
                    <p className="text-sm text-gray-400 mt-1">
                      {discount.type === 'percentage' && `${discount.action.percentage}% off`}
                      {discount.type === 'fixed' && `${formatPrice(discount.action.fixedAmount || 0)} off`}
                      {discount.type === 'free_delivery' && 'Free Delivery'}
                      {discount.type === 'buy_x_get_y' && `Buy ${discount.action.buyX} Get ${discount.action.getY} Free`}
                      {discount.type === 'coupon' && `Code: ${discount.action.couponCode}`}
                    </p>
                  </div>
                  <button 
                    onClick={() => handleToggleStatus(discount.id)}
                    className={cn("w-12 h-6 rounded-full relative flex items-center px-1 transition-colors group", discount.status ? "bg-[#fafafa]" : "bg-[var(--dash-border)]")}
                  >
                    <div className={cn("w-4 h-4 rounded-full transition-all duration-300 ease-[cubic-bezier(0.25,1,0.5,1)]", discount.status  ? "bg-[var(--dash-card)] translate-x-6 group-active:w-6 group-active:translate-x-4" : "bg-white translate-x-0 group-active:w-6")}></div>
                  </button>
                </div>
                
                <div className="flex items-center justify-between mt-4 pt-4 border-t border-[var(--dash-border)]">
                  <div className="text-xs text-gray-500">
                    Priority: {discount.priority}
                  </div>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => handleEdit(discount)}
                      className="p-2 bg-[var(--dash-border)] text-white rounded-lg hover:bg-[#2a4339] transition-colors"
                    >
                      <Edit size={16} />
                    </button>
                    <button 
                      onClick={() => handleDelete(discount.id)}
                      className="p-2 bg-[#ff4d6d]/10 text-[#ff4d6d] rounded-lg hover:bg-[#ff4d6d]/20 transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
