import React, { useState, useMemo } from 'react';
import { ChevronLeft, Download, Check, MessageCircle, Calendar, Copy, MapPin, Clock, Tag, FileText, Activity, Phone, MoreVertical, X, User, Settings, Save } from 'lucide-react';
import { format, subDays, isAfter, isBefore, startOfDay, endOfDay, isToday, isYesterday } from 'date-fns';
import { WebsiteSettings, IncompleteOrder, Order } from './types';
import { cn, formatPrice, formatWhatsAppPhone } from './lib/utils';
import { cloudStore } from './lib/cloudStore';

interface Props {
  websiteSettings: WebsiteSettings;
  setWebsiteSettings: React.Dispatch<React.SetStateAction<WebsiteSettings>>;
  incompleteOrders: IncompleteOrder[];
  orders?: Order[];
  setIncompleteOrders?: React.Dispatch<React.SetStateAction<any[]>>;
  setOrders?: React.Dispatch<React.SetStateAction<any[]>>;
  onClose: () => void;
}



export default function IncompleteOrdersManager({ websiteSettings, setWebsiteSettings, incompleteOrders, orders = [], setIncompleteOrders, setOrders, onClose }: Props) {
  const [enabled, setEnabled] = useState(websiteSettings.incompleteOrdersFeature?.enabled ?? false);
  const [inactivityTimerMinutes, setInactivityTimerMinutes] = useState(websiteSettings.incompleteOrdersFeature?.inactivityTimerMinutes?.toString() || '5');
  const [duplicateControlValue, setDuplicateControlValue] = useState(websiteSettings.incompleteOrdersFeature?.duplicateControlValue?.toString() || '1');
  const [duplicateControlUnit, setDuplicateControlUnit] = useState<'minutes' | 'hours' | 'days'>(websiteSettings.incompleteOrdersFeature?.duplicateControlUnit || 'days');
  const [whatsappMessage, setWhatsappMessage] = useState(websiteSettings.incompleteOrdersFeature?.whatsappMessage || 'Hello, you started an order but didn\'t complete it. Need help to finish your purchase?');
  const [retentionPeriodDays, setRetentionPeriodDays] = useState(websiteSettings.incompleteOrdersFeature?.retentionPeriodDays?.toString() || '7');

  const [dateFilter, setDateFilter] = useState<'1' | '3' | '7' | '15' | '25' | '40' | '60' | '90' | '180' | 'ALL' | 'CUSTOM'>('ALL');
  const [customStartDate, setCustomStartDate] = useState(format(startOfDay(new Date()), 'yyyy-MM-dd'));
  const [customEndDate, setCustomEndDate] = useState(format(endOfDay(new Date()), 'yyyy-MM-dd'));

  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set());
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);

  const handleSave = async () => {
    const updatedSettings = {
      ...websiteSettings,
      incompleteOrdersFeature: {
        enabled,
        inactivityTimerMinutes: parseInt(inactivityTimerMinutes) || 5,
        duplicateControlValue: parseInt(duplicateControlValue) || 1,
        duplicateControlUnit,
        whatsappMessage,
        retentionPeriodDays: parseInt(retentionPeriodDays) || 0
      }
    };
    setWebsiteSettings(updatedSettings);
    await cloudStore.saveSetting('websiteSettings', updatedSettings);
  };

  const filteredOrders = useMemo(() => {
    return incompleteOrders.filter(o => {
      const orderDate = new Date(o.timestamp);
      
      if (dateFilter === 'ALL') return true;
      if (dateFilter === 'CUSTOM') {
        const start = startOfDay(new Date(customStartDate));
        const end = endOfDay(new Date(customEndDate));
        return isAfter(orderDate, start) && isBefore(orderDate, end);
      }

      const days = parseInt(dateFilter);
      const cutoff = subDays(new Date(), days);
      return isAfter(orderDate, cutoff);
    }).sort((a, b) => b.timestamp - a.timestamp);
  }, [incompleteOrders, dateFilter, customStartDate, customEndDate]);

  const toggleSelection = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const newSelection = new Set(selectedOrders);
    if (newSelection.has(id)) {
      newSelection.delete(id);
    } else {
      newSelection.add(id);
    }
    setSelectedOrders(newSelection);
  };

  const selectAll = () => {
    if (selectedOrders.size === filteredOrders.length) {
      setSelectedOrders(new Set());
    } else {
      setSelectedOrders(new Set(filteredOrders.map(o => o.id)));
    }
  };

  const toggleContacted = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (setIncompleteOrders) {
      setIncompleteOrders(prev => {
        const updated = prev.map(o => o.id === id ? { ...o, contacted: !o.contacted, contactedAt: !o.contacted ? Date.now() : undefined } : o);
        const changedItem = updated.find(o => o.id === id);
        if (changedItem) cloudStore.upsertOrder(changedItem, 'incomplete').catch(console.error);
        return updated;
      });
    }
  };

  const generateCSVData = (ordersToExport: IncompleteOrder[]) => {
    const headers = ['Phone', 'Name', 'Location', 'Time', 'Status', 'Contacted'];
    const rows = ordersToExport.map(o => [
      formatWhatsAppPhone(o.phone),
      o.name || '',
      o.location || '',
      format(o.timestamp, 'yyyy-MM-dd HH:mm:ss'),
      o.status || 'Hot',
      o.contacted ? 'Yes' : 'No'
    ]);
    return [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
  };

  const handleDownload = async (formatType: 'csv' | 'excel') => {
    const ordersToExport = filteredOrders.filter(o => selectedOrders.size === 0 || selectedOrders.has(o.id));
    if (ordersToExport.length === 0) return;

    if (formatType === 'csv') {
      const csvContent = generateCSVData(ordersToExport);
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `incomplete_orders_${format(new Date(), 'yyyy-MM-dd')}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else {
      const XLSX = await import('xlsx');
      const wsData = ordersToExport.map(o => ({
        Phone: formatWhatsAppPhone(o.phone),
        Name: o.name || '',
        Location: o.location || '',
        Time: format(o.timestamp, 'yyyy-MM-dd HH:mm:ss'),
        Status: o.status || 'Hot',
        Contacted: o.contacted ? 'Yes' : 'No'
      }));
      const ws = XLSX.utils.json_to_sheet(wsData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Incomplete Orders");
      XLSX.writeFile(wb, `incomplete_orders_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
    }
  };

  const openWhatsApp = (phone: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const cleanPhone = formatWhatsAppPhone(phone);
    const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(whatsappMessage)}`;
    window.open(url, '_blank');
  };

  const createOrderFromIncompleteAction = (incomplete: IncompleteOrder) => {
    const subtotal = incomplete.cartItems?.reduce((sum, item) => sum + ((item.variantPrice ?? item.product.price) * item.quantity), 0) || 0;
    
    let nextId = Math.floor(100 + Math.random() * 900).toString();
    if (orders.length > 0) {
      const parsedIds = orders.map(o => parseInt(o.id.replace(/\D/g, ''))).filter(id => !isNaN(id));
      if (parsedIds.length > 0) {
        nextId = (Math.max(...parsedIds) + 1).toString();
      }
    }

    const newOrder: Order = {
      id: nextId,
      date: format(new Date(), 'EEEE, MM/dd/yyyy, hh:mm a'),
      status: 'Pending',
      items: incomplete.cartItems || [],
      userInfo: {
        name: incomplete.name || "Unknown",
        phone: formatWhatsAppPhone(incomplete.phone),
        address: incomplete.location || ""
      },
      deliveryCharge: 0,
      subtotal: subtotal,
      total: subtotal,
      discount: 0
    };
    
    cloudStore.upsertOrder(newOrder, 'standard').catch(console.error);
    cloudStore.deleteOrder(incomplete, 'incomplete').catch(console.error);
    
    if (setOrders) {
      setOrders(prev => [newOrder, ...prev]);
    }
    if (setIncompleteOrders) {
      setIncompleteOrders(prev => prev.filter(o => o.id !== incomplete.id));
    }
    setExpandedOrderId(null);
  };

  const formatDisplayDate = (timestamp: number) => {
    const d = new Date(timestamp);
    if (isToday(d)) {
      return `Today, ${format(d, 'h:mm a')}`;
    }
    if (isYesterday(d)) {
      return `Yesterday, ${format(d, 'h:mm a')}`;
    }
    return format(d, 'MMM d, h:mm a');
  };

  const dayFilterOptions = ['1', '3', '7', '15', '25', '40', '60', '90', '180'] as const;

  return (
    <div className="fixed inset-0 z-[100] bg-[var(--dash-bg)] text-[#e2e8f0] flex flex-col font-sans overflow-hidden md:left-[240px]">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-[var(--dash-border)] bg-[var(--dash-card)] shrink-0 md:px-8 md:py-5">
        <div className="flex items-center gap-2">
          <button 
            onClick={showSettings ? () => setShowSettings(false) : onClose} 
            className="p-2 -ml-2 text-white hover:text-[#fafafa] transition-colors rounded-full hover:bg-white/5"
          >
            <ChevronLeft size={24} />
          </button>
          <h1 className="text-xl font-bold text-white tracking-wide truncate">
            {showSettings ? 'Settings Detail' : 'Incomplete Orders'}
          </h1>
        </div>
        {!showSettings ? (
          <button 
            onClick={() => setShowSettings(true)} 
            className="flex items-center gap-2 bg-[var(--dash-border)] text-[#fafafa] px-4 md:px-5 py-2 rounded-xl font-bold hover:bg-[#254639] transition-colors border border-[#fafafa]/20 shadow-sm"
          >
            <Settings size={16} /> Detail
          </button>
        ) : (
          <button 
            onClick={() => { handleSave(); setShowSettings(false); }} 
            style={{ backgroundColor: websiteSettings.themeColors?.primary || 'var(--theme-primary, #ff4d6d)', color: '#ffffff' }}
            className="flex items-center gap-2 px-4 md:px-5 py-2 rounded-xl font-bold text-xs md:text-sm hover:brightness-95 active:scale-95 transition-all shadow-md cursor-pointer"
          >
            <Save size={16} />
            Save
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto w-full">
        {showSettings ? (
          <div className="px-4 py-6 md:p-8 space-y-4 max-w-3xl mx-auto w-full pb-20">
            {/* Tracking System Card */}
          <div className="bg-[var(--dash-card)] rounded-2xl p-5 border border-[var(--dash-border)] shadow-md flex justify-between items-center">
            <div>
              <h2 className="text-base font-semibold text-white mb-1">Tracking System</h2>
              <p className="text-sm text-gray-400">Monitor customers who start checkout but abandon their cart.</p>
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

          {/* Conditional Settings */}
          {enabled && (
            <>
              {/* Inactivity Timer */}
              <div className="bg-[var(--dash-card)] rounded-2xl p-5 border border-[var(--dash-border)] shadow-md">
                <h3 className="text-base font-semibold text-white mb-3">Inactivity Timer</h3>
                <div className="flex bg-[var(--dash-bg)] rounded-xl border border-[#fafafa] focus-within:ring-1 focus-within:ring-[#fafafa] overflow-hidden transition-all">
                  <input 
                    type="number" 
                    value={inactivityTimerMinutes} 
                    onChange={e => setInactivityTimerMinutes(e.target.value)} 
                    className="w-full bg-transparent p-3.5 text-white focus:outline-none"
                  />
                  <div className="flex items-center px-4 text-sm text-gray-400 font-medium">
                    Minutes
                  </div>
                </div>
                <p className="text-[13px] text-gray-500 mt-2">Time before an incomplete checkout is recorded.</p>
              </div>

              {/* Duplicate Control */}
              <div className="bg-[var(--dash-card)] rounded-2xl p-5 border border-[var(--dash-border)] shadow-md">
                <h3 className="text-base font-semibold text-white mb-3">Duplicate Control</h3>
                <div className="flex bg-[var(--dash-bg)] rounded-xl border border-[#fafafa] focus-within:ring-1 focus-within:ring-[#fafafa] overflow-hidden transition-all">
                  <input 
                    type="number" 
                    value={duplicateControlValue} 
                    onChange={e => setDuplicateControlValue(e.target.value)} 
                    className="w-full bg-transparent p-3.5 text-white focus:outline-none"
                  />
                  <select 
                    value={duplicateControlUnit}
                    onChange={e => setDuplicateControlUnit(e.target.value as any)}
                    className="bg-transparent p-3 text-gray-400 focus:outline-none appearance-none outline-none pr-4 font-medium text-sm border-none"
                  >
                    <option value="minutes">Minutes</option>
                    <option value="hours">Hours</option>
                    <option value="days">Days</option>
                  </select>
                </div>
                <p className="text-[13px] text-gray-500 mt-2">Timeframe to merge repeated attempts into one record.</p>
              </div>

              {/* WhatsApp Message */}
              <div className="bg-[var(--dash-card)] rounded-2xl p-5 border border-[var(--dash-border)] shadow-md">
                <h3 className="text-base font-semibold text-white mb-3">WhatsApp Default Message</h3>
                <div className="bg-[var(--dash-bg)] rounded-xl border border-[#fafafa] focus-within:ring-1 focus-within:ring-[#fafafa] overflow-hidden transition-all">
                  <textarea 
                    value={whatsappMessage} 
                    onChange={e => setWhatsappMessage(e.target.value)} 
                    rows={4}
                    className="w-full bg-transparent p-4 text-white focus:outline-none resize-none leading-relaxed"
                  />
                </div>
              </div>

              {/* Data Retention */}
              <div className="bg-[var(--dash-card)] rounded-2xl p-5 border border-[var(--dash-border)] shadow-md">
                <h3 className="text-base font-semibold text-white mb-3 flex items-center justify-between">
                  <span>Data Retention</span>
                  <span className="text-[10px] font-bold bg-[var(--dash-border)] text-[#fafafa] px-2 py-0.5 rounded-full uppercase tracking-widest">Cleanup</span>
                </h3>
                <div className="flex bg-[var(--dash-bg)] rounded-xl border border-[#fafafa] focus-within:ring-1 focus-within:ring-[#fafafa] overflow-hidden transition-all">
                  <select 
                    value={retentionPeriodDays}
                    onChange={e => setRetentionPeriodDays(e.target.value)}
                    className="w-full bg-transparent p-3.5 text-white focus:outline-none appearance-none font-medium text-sm border-none"
                  >
                    <option value="0" className="text-[var(--dash-bg)]">No Expiration (Keep Forever)</option>
                    <option value="1" className="text-[var(--dash-bg)]">1 Day</option>
                    <option value="7" className="text-[var(--dash-bg)]">7 Days</option>
                    <option value="30" className="text-[var(--dash-bg)]">1 Month</option>
                    <option value="60" className="text-[var(--dash-bg)]">2 Months</option>
                  </select>
                </div>
                <p className="text-[13px] text-gray-500 mt-2">Automatically delete non-converted history to save D1 space.</p>
              </div>
            </>
          )}

          </div>
        ) : (
          <div className="px-4 py-6 md:p-8 space-y-6 max-w-3xl mx-auto w-full pb-20">
            {/* Filters Section */}
            <div className="space-y-6">
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide -mx-4 px-4 md:mx-0 md:px-0">
            {dayFilterOptions.map(days => (
              <button 
                key={days} 
                onClick={() => setDateFilter(days)}
                className={cn(
                  "shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-colors border",
                  dateFilter === days 
                    ? "bg-[#fafafa] text-[var(--dash-bg)] border-[#fafafa]" 
                    : "bg-transparent text-gray-300 border-[var(--dash-border)] hover:border-gray-500"
                )}
              >
                {days} Day{days !== '1' ? 's' : ''}
              </button>
            ))}
            <button 
              onClick={() => setDateFilter('ALL')}
              className={cn(
                "shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-colors border",
                dateFilter === 'ALL' 
                  ? "bg-[#fafafa] text-[var(--dash-bg)] border-[#fafafa]" 
                  : "bg-transparent text-gray-300 border-[var(--dash-border)] hover:border-gray-500"
              )}
            >
              All Time
            </button>
            <button 
              onClick={() => setDateFilter('CUSTOM')}
              className={cn(
                "shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-colors border flex items-center gap-1.5",
                dateFilter === 'CUSTOM' 
                  ? "bg-[#fafafa] text-[var(--dash-bg)] border-[#fafafa]" 
                  : "bg-transparent text-gray-300 border-[var(--dash-border)] hover:border-gray-500"
              )}
            >
              <Calendar size={14} /> Custom
            </button>
          </div>

          {dateFilter === 'CUSTOM' && (
            <div className="flex flex-wrap items-center gap-4 bg-[var(--dash-card)] p-4 rounded-xl border border-[var(--dash-border)]">
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-gray-400">From</span>
                <input 
                  type="date" 
                  value={customStartDate} 
                  onChange={e => setCustomStartDate(e.target.value)} 
                  className="bg-[var(--dash-bg)] border border-[var(--dash-border)] text-sm text-white rounded-lg px-3 py-2 focus:outline-none focus:border-[#fafafa]" 
                />
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-gray-400">To</span>
                <input 
                  type="date" 
                  value={customEndDate} 
                  onChange={e => setCustomEndDate(e.target.value)} 
                  className="bg-[var(--dash-bg)] border border-[var(--dash-border)] text-sm text-white rounded-lg px-3 py-2 focus:outline-none focus:border-[#fafafa]" 
                />
              </div>
            </div>
          )}

          {/* List Header Actions */}
          <div className="flex items-center justify-between mt-2">
            <span className="text-[15px] font-medium text-white">
              {filteredOrders.length} Records Found
            </span>

            <div className="flex items-center gap-4">
              {filteredOrders.length > 0 && selectedOrders.size > 0 && (
                 <div className="flex items-center gap-2">
                   <button onClick={() => handleDownload('csv')} className="text-xs font-semibold uppercase tracking-wide text-gray-400 hover:text-[#fafafa] flex items-center gap-1"><Download size={14} /> CSV</button>
                   <span className="text-[var(--dash-border)]">|</span>
                   <button onClick={() => handleDownload('excel')} className="text-xs font-semibold uppercase tracking-wide text-gray-400 hover:text-[#fafafa] flex items-center gap-1"><Download size={14} /> Excel</button>
                 </div>
              )}

              <label className="flex items-center gap-2.5 cursor-pointer group">
                <div 
                  className={cn(
                    "w-5 h-5 rounded-[4px] border flex items-center justify-center transition-colors shadow-sm",
                    filteredOrders.length > 0 && selectedOrders.size === filteredOrders.length 
                      ? "bg-[var(--dash-bg)] border-white" 
                      : "bg-[var(--dash-bg)] border-gray-400 group-hover:border-white"
                  )}
                >
                  {filteredOrders.length > 0 && selectedOrders.size === filteredOrders.length && <div className="w-2.5 h-2.5 rounded-[1px] bg-white" />}
                </div>
                <span className="text-[15px] font-medium text-white group-hover:text-white transition-colors select-none">
                  Select All
                </span>
                {/* Hidden actual checkbox for accessibility if needed, but above custom div is styled for it */}
                <input 
                  type="checkbox" 
                  className="hidden" 
                  checked={filteredOrders.length > 0 && selectedOrders.size === filteredOrders.length}
                  onChange={selectAll}
                />
              </label>
            </div>
          </div>
        </div>

        {/* Data List */}
        {filteredOrders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-4 bg-[var(--dash-card)] rounded-2xl border border-[var(--dash-border)] border-dashed">
            <div className="bg-[var(--dash-bg)] p-4 rounded-full mb-4">
              <Calendar size={24} className="text-gray-500" />
            </div>
            <p className="text-gray-300 font-medium text-lg">No records found</p>
            <p className="text-sm text-gray-500 mt-1">Try adjusting your date filters</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredOrders.map(order => {
              const formattedName = order.name ? (order.name.length > 12 ? `${order.name.slice(0, 12)}...` : order.name) : 'Unknown';
              const isSelected = selectedOrders.has(order.id);
              const isExpanded = expandedOrderId === order.id;

              return (
                <div 
                  key={order.id} 
                  className={cn("bg-[var(--dash-card)] border p-4 rounded-2xl shadow-sm transition-colors", order.contacted ? "border-gray-600/50 opacity-75" : "border-[var(--dash-border)]")}
                >
                  <div className="flex flex-col gap-3">
                    <div className="flex items-start justify-between gap-4">
                      {/* Checkbox & Basic Info Container */}
                      <div className="flex items-start gap-4 flex-1 min-w-0">
                        {/* Checkbox */}
                        <div 
                          className={cn(
                            "w-[24px] h-[24px] rounded border flex-shrink-0 flex items-center justify-center transition-colors cursor-pointer mt-0.5",
                            isSelected ? "bg-transparent border-white" : "bg-transparent border-gray-400 hover:border-gray-300"
                          )}
                          onClick={(e) => toggleSelection(order.id, e)}
                        >
                          {isSelected && <div className="w-3.5 h-3.5 bg-white rounded-sm" />}
                        </div>

                        {/* Basic Info */}
                        <div className="flex-1 min-w-0 flex flex-col justify-center">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-[15px] font-bold text-white truncate">{formattedName}</span>
                            <span className="text-gray-500 shrink-0">•</span>
                            <span className="text-[14px] font-medium text-white truncate">{formatWhatsAppPhone(order.phone)}</span>
                          </div>
                          <div className="text-[13px] text-gray-400 flex items-center gap-2 flex-wrap">
                            <span>{formatDisplayDate(order.timestamp)}</span>
                            {order.contacted && (
                              <>
                                <span>•</span>
                                <span className="text-[#fafafa] flex items-center gap-1 bg-[#fafafa]/10 px-1.5 py-0.5 rounded text-xs"><Check size={12} /> Contacted</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Detail Button */}
                      <div className="shrink-0 mt-0.5">
                        <button 
                          onClick={(e) => { e.stopPropagation(); setExpandedOrderId(order.id); }}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors bg-[var(--dash-border)] text-[#fafafa] hover:bg-[#254639] shadow-sm border border-[#fafafa]/20 flex items-center gap-1.5"
                        >
                          <Settings size={14} /> Detail
                        </button>
                      </div>
                    </div>

                    <div className="flex justify-end ml-[40px] -mt-3">
                       <button 
                        onClick={(e) => openWhatsApp(order.phone, e)}
                        className="shrink-0 bg-[#25D366] text-white w-10 h-10 rounded-full flex items-center justify-center hover:bg-[#1ebe5d] transition-colors shadow-sm focus:ring-2 focus:ring-[#25D366] focus:outline-none"
                        title="WhatsApp"
                      >
                        <MessageCircle size={20} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
          </div>
        )}
      </div>

      {expandedOrderId && (
        <DetailOverlay 
          orderId={expandedOrderId} 
          orders={incompleteOrders} 
          onClose={() => setExpandedOrderId(null)}
          toggleContacted={toggleContacted}
          openWhatsApp={openWhatsApp}
          createOrderAction={createOrderFromIncompleteAction}
        />
      )}
    </div>
  );
}

interface DetailOverlayProps {
  orderId: string;
  orders: IncompleteOrder[];
  onClose: () => void;
  toggleContacted: (id: string, e?: React.MouseEvent) => void;
  openWhatsApp: (phone: string, e?: React.MouseEvent) => void;
  createOrderAction: (order: IncompleteOrder) => void;
}

function DetailOverlay({ orderId, orders, onClose, toggleContacted, openWhatsApp, createOrderAction }: DetailOverlayProps) {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  
  const order = orders.find(o => o.id === orderId);
  if (!order) return null;

  const totalQty = order.cartItems?.reduce((sum, item) => sum + item.quantity, 0) || 0;
  const totalPrice = order.cartItems?.reduce((sum, item) => sum + ((item.variantPrice ?? item.product.price) * item.quantity), 0) || 0;



  return (
    <div className="fixed inset-0 z-[110] bg-[var(--dash-bg)] text-[#e2e8f0] flex flex-col font-sans overflow-hidden animate-in slide-in-from-bottom-[10%] duration-300 md:left-[240px]">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-[var(--dash-border)] bg-[var(--dash-card)] shrink-0 md:px-8 md:py-5">
        <button onClick={onClose} className="p-2 -ml-2 text-white hover:text-[#fafafa] transition-colors rounded-full hover:bg-white/5">
          <ChevronLeft size={24} />
        </button>
        <h1 className="text-lg font-bold text-white tracking-wide">Customer Details</h1>
        <button className="p-2 -mr-2 text-gray-400 hover:text-white transition-colors rounded-full hover:bg-white/5">
          <MoreVertical size={24} />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4 max-w-3xl mx-auto w-full pb-6">
        
        {/* Customer Info Card */}
        <div className="bg-[var(--dash-card)] border border-[var(--dash-border)] rounded-2xl p-4 shadow-sm relative overflow-hidden">
          <div className="flex items-center gap-2 text-sm font-medium text-[#fafafa] mb-4">
             <User size={16} /> Customer Information
          </div>

          <div className="flex items-start gap-4 relative">
            {/* Avatar Initial */}
            <div className="w-14 h-14 rounded-full bg-[var(--dash-border)] text-[#fafafa] flex items-center justify-center text-xl font-bold shrink-0">
              {order.name ? order.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : 'U'}
            </div>
            <div className="flex-1 min-w-0 pr-12">
              <h2 className="text-lg font-bold text-white mb-2 truncate">{order.name || 'Unknown'}</h2>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-[13px] text-gray-300">
                  <Phone size={14} className="text-gray-500 shrink-0" />
                  <span className="font-medium truncate">{formatWhatsAppPhone(order.phone)}</span>
                  <button onClick={() => navigator.clipboard.writeText(formatWhatsAppPhone(order.phone))} className="text-[#fafafa] hover:text-[#e4e4e7] rounded-sm transition-colors"><Copy size={14} /></button>
                </div>
                <div className="flex items-center gap-2 text-[13px] text-gray-300">
                  <MapPin size={14} className="text-gray-500 shrink-0" />
                  <span className="truncate">{order.location || 'Not provided'}</span>
                </div>
                <div className="flex items-center gap-2 text-[13px] text-gray-300">
                  <Clock size={14} className="text-gray-500 shrink-0" />
                  <span className="truncate">Added on: {format(order.timestamp, 'dd MMM yyyy, hh:mm a')}</span>
                </div>
              </div>
            </div>
            
            {/* WhatsApp icon on the right */}
            <button 
              onClick={(e) => openWhatsApp(order.phone, e)}
              className="absolute right-0 top-1/2 -translate-y-1/2 bg-[#25D366] text-white w-10 h-10 rounded-full flex items-center justify-center hover:bg-[#1ebe5d] shadow-md shadow-[#25D366]/20 transition-transform active:scale-95"
            >
              <MessageCircle size={20} className="fill-current" />
            </button>
          </div>

          {/* Quick Action Buttons */}
          <div className="grid grid-cols-2 gap-3 mt-6">
             <button 
               onClick={(e) => toggleContacted(order.id, e)}
               className={cn("flex items-center justify-center gap-2 py-3 rounded-[14px] text-[13px] font-semibold transition-colors border shadow-sm", order.contacted ? "bg-[var(--dash-border)] text-gray-300 border-[var(--dash-border)]" : "bg-[var(--dash-card)] border-[#fafafa] text-[#fafafa]")}
             >
               <Check size={16} className={cn(order.contacted && "text-[#fafafa]")} /> {order.contacted ? 'Contacted' : 'Mark as Contacted'}
             </button>
             <button 
               onClick={() => createOrderAction(order)}
               className="flex items-center justify-center gap-2 py-3 rounded-[14px] text-[13px] font-semibold text-[#fafafa] border border-[var(--dash-border)] bg-[var(--dash-border)]/50 hover:bg-[var(--dash-border)] transition-colors shadow-sm"
             >
               Create Order
             </button>
          </div>
        </div>

        {/* Cart Items Card */}
        <div className="bg-[var(--dash-card)] border border-[var(--dash-border)] rounded-2xl p-4 shadow-sm">
          <div className="flex items-center gap-2 text-sm font-medium text-[#fafafa] mb-4">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>
            Cart Items ({order.cartItems?.length || 0})
          </div>

          <div className="space-y-0 divide-y divide-[var(--dash-border)]">
            {order.cartItems?.map((item, idx) => (
              <div key={idx} className="flex gap-4 py-4 first:pt-2 last:pb-4">
                <div 
                  className="w-[72px] h-[72px] rounded-lg bg-white overflow-hidden shrink-0 border border-gray-200 shadow-sm relative cursor-pointer"
                  onClick={() => setSelectedImage(item.product.thumbnail || item.product.image)}
                >
                  <img src={item.product.thumbnail || item.product.image} alt={item.product.title} className="w-full h-full object-cover" />
                </div>
                <div className="flex-1 min-w-0 flex flex-col justify-center">
                  <p className="text-[14px] text-white font-medium line-clamp-2 leading-snug mb-1">{item.product.title}</p>
                  <div className="text-[12px] text-gray-400 mb-0.5">{item.variantName || 'Default'}</div>
                  <div className="text-[13px] text-gray-300">
                    {formatPrice(item.variantPrice ?? item.product.price)} × {item.quantity}
                  </div>
                </div>
                <div className="shrink-0 flex items-center justify-end text-[15px] font-semibold text-[#fafafa]">
                  {formatPrice((item.variantPrice ?? item.product.price) * item.quantity)}
                </div>
              </div>
            ))}
            {(!order.cartItems || order.cartItems.length === 0) && (
              <div className="text-gray-500 text-sm py-4">No specific cart items captured.</div>
            )}
          </div>

          {/* Summary */}
          <div className="mt-4 bg-[var(--dash-bg)] rounded-xl p-4 grid grid-cols-3 gap-2 border border-[var(--dash-border)] divide-x divide-[var(--dash-border)]">
            <div className="flex flex-col items-center justify-center text-center px-2">
              <span className="text-[11px] text-gray-400 font-medium mb-1.5 ">Total Items</span>
              <span className="text-white font-bold text-lg leading-none">{order.cartItems?.length || 0}</span>
            </div>
            <div className="flex flex-col items-center justify-center text-center px-2">
              <span className="text-[11px] text-gray-400 font-medium mb-1.5 ">Total Quantity</span>
              <span className="text-white font-bold text-lg leading-none">{totalQty}</span>
            </div>
            <div className="flex flex-col items-center justify-center text-center px-2">
              <span className="text-[11px] text-gray-400 font-medium mb-1.5 ">Total Price</span>
              <span className="text-[#fafafa] font-bold text-[22px] leading-none tracking-tight">{formatPrice(totalPrice)}</span>
            </div>
          </div>
        </div>

        {/* Notes (Admin Only) */}
        <details className="bg-[var(--dash-card)] border border-[var(--dash-border)] rounded-2xl p-4 shadow-sm group cursor-pointer [&::-webkit-details-marker]:hidden">
          <summary className="flex items-center justify-between list-none">
            <div className="flex items-center gap-2 text-sm font-medium text-gray-300">
              <FileText size={16} /> Notes (Admin Only)
            </div>
            <ChevronLeft size={16} className="text-gray-500 group-open:-rotate-90 transition-transform" />
          </summary>
          <div className="mt-3 text-[13px] text-gray-400 leading-relaxed pt-2 border-t border-[var(--dash-border)]">
            Customer might need follow-up. Add any custom notes here.
          </div>
        </details>

        {/* Activity Timeline */}
        <details className="bg-[var(--dash-card)] border border-[var(--dash-border)] rounded-2xl p-4 shadow-sm group cursor-pointer [&::-webkit-details-marker]:hidden" open>
          <summary className="flex items-center justify-between list-none mb-4">
            <div className="flex items-center gap-2 text-sm font-medium text-gray-300">
              <Activity size={16} /> Activity Timeline
            </div>
            <ChevronLeft size={16} className="text-gray-500 group-open:-rotate-90 transition-transform" />
          </summary>
          
          <div className="relative pl-6 space-y-6 before:absolute before:inset-y-0 before:left-2.5 before:w-px before:bg-[var(--dash-border)]">
             <div className="relative">
               <div className="absolute w-2.5 h-2.5 bg-[#fafafa] rounded-full -left-[1.2rem] top-1 ring-4 ring-[var(--dash-card)]" />
               <h4 className="text-[13px] font-semibold text-white">Order created</h4>
               <p className="text-[11px] text-gray-500 mt-0.5">{format(order.timestamp, 'dd MMM yyyy, hh:mm a')}</p>
             </div>
             
             <div className="relative">
               <div className={cn("absolute w-2.5 h-2.5 rounded-full -left-[1.2rem] top-1 ring-4 ring-[var(--dash-card)]", order.contacted ? "bg-[#fafafa]" : "bg-[var(--dash-border)]")} />
               <h4 className={cn("text-[13px] font-semibold", order.contacted ? "text-white" : "text-gray-500")}>{order.contacted ? 'Contacted' : 'Not contacted yet'}</h4>
               {order.contactedAt && <p className="text-[11px] text-gray-500 mt-0.5">{format(order.contactedAt, 'dd MMM yyyy, hh:mm a')}</p>}
             </div>
          </div>
        </details>

      </div>

      {/* Image Preview Modal */}
      {selectedImage && (
        <div 
          className="fixed inset-0 z-[120] bg-[var(--dash-bg)]/90 flex flex-col items-center justify-center animate-in fade-in duration-200"
          onClick={() => setSelectedImage(null)}
        >
          <button 
            className="absolute top-4 right-4 p-2 text-white/70 hover:text-white bg-[var(--dash-bg)]/50 rounded-full transition-colors"
            onClick={(e) => { e.stopPropagation(); setSelectedImage(null); }}
          >
            <X size={24} />
          </button>
          <img 
            src={selectedImage} 
            alt="Preview" 
            className="max-w-[90vw] max-h-[80vh] object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}

