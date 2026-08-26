import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronLeft, Search, User, UserX, ShieldAlert, Check, X, Phone, ShoppingCart, Activity, MessageCircle, Calendar, IndianRupee, Clock } from 'lucide-react';
import { Order, WebsiteSettings } from './types';
import { cn, normalizePhone, formatPrice, formatWhatsAppPhone, formatShortTimeAgo, useScrollRestore } from './lib/utils';
import { DatePicker } from './components/DatePicker';

interface CustomersManagerProps {
  orders: Order[];
  setOrders?: any;
  customers?: any[];
  setCustomers?: any;
  websiteSettings: WebsiteSettings;
  setWebsiteSettings: React.Dispatch<React.SetStateAction<WebsiteSettings>>;
  onClose: () => void;
  isOwner?: boolean;
}

interface CustomerStats {
  phone: string;
  name: string;
  totalOrders: number;
  cancelledOrders: number;
  successRate: number;
  completedOrders: number;
  totalSpent: number;
  isBlocked: boolean;
  statusText: string;
  rank?: number;
  lastOrderTime: number;
}

type DateFilterType = 'All Time' | 'Today' | 'Last 7 Days' | 'Last 30 Days' | 'Custom';
type SortByType = 'orders' | 'low_orders' | 'spent';

export default function CustomersManager({ orders, setOrders, customers = [], setCustomers, websiteSettings, setWebsiteSettings, onClose, isOwner = false }: CustomersManagerProps) {
  const [activeTab, setActiveTab] = useState<'Analytics' | 'Blocked' | 'Settings'>('Analytics');
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState<DateFilterType>('All Time');
  const [customFromDate, setCustomFromDate] = useState<Date | null>(null);
  const [customToDate, setCustomToDate] = useState<Date | null>(null);
  const [sortBy, setSortBy] = useState<SortByType>('spent');

  const [selectedPhones, setSelectedPhones] = useState<string[]>([]);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const scrollRef = useScrollRestore(`customers-${activeTab}`);

  const handleDeleteCustomers = async () => {
    if (!isOwner || selectedPhones.length === 0) return;
    setIsDeleting(true);
    try {
      // 1. Delete from customers table
      const customersToDelete = customers.filter(c => selectedPhones.includes(normalizePhone(c.phone)));
      if (customersToDelete.length > 0) {
        await fetch('/api/customers', { 
           method: 'POST', 
           headers: { 'Content-Type': 'application/json' }, 
           body: JSON.stringify({ action: 'delete', items: customersToDelete }) 
        });
      }
      
      // 2. Delete all standard orders of these customers
      const ordersToDelete = orders.filter(o => selectedPhones.includes(normalizePhone(o.userInfo.phone)));
      if (ordersToDelete.length > 0) {
        await fetch('/api/orders', { 
           method: 'POST', 
           headers: { 'Content-Type': 'application/json' }, 
           body: JSON.stringify({ action: 'delete', items: ordersToDelete, type: 'standard' }) 
        });
      }

      // 3. Update local state
      if (setCustomers) {
         setCustomers(customers.filter(c => !selectedPhones.includes(normalizePhone(c.phone))));
      }
      if (setOrders) {
         setOrders(orders.filter(o => !selectedPhones.includes(normalizePhone(o.userInfo.phone))));
      }

      setSelectedPhones([]);
      setShowDeleteConfirm(false);
    } catch (e) {
      console.error(e);
      alert('Failed to delete customers permanently.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSelectAll = () => {
    if (selectedPhones.length === sortedCustomers.length) {
      setSelectedPhones([]);
    } else {
      setSelectedPhones(sortedCustomers.map(c => normalizePhone(c.phone)));
    }
  };

  const toggleSelection = (phone: string) => {
    const normPhone = normalizePhone(phone);
    if (selectedPhones.includes(normPhone)) {
      setSelectedPhones(selectedPhones.filter(p => p !== normPhone));
    } else {
      setSelectedPhones([...selectedPhones, normPhone]);
    }
  };

  const customerSettings = websiteSettings.customers || { systemEnabled: true, autoBlockEnabled: false, maxCancelLimit: 3, blockedPhones: [], whatsappMessage: 'Hello {name}, thank you for ordering from our store.' };
  const blockedPhones = customerSettings.blockedPhones || [];
  const systemEnabled = customerSettings.systemEnabled ?? true;

  // Filter Orders by Date
  const filteredOrders = useMemo(() => {
    if (dateFilter === 'All Time') return orders;
    
    const now = Date.now();
    const today = new Date(now).setHours(0, 0, 0, 0);
    
    return orders.filter(order => {
      const orderDate = new Date(order.date).getTime();
      
      switch (dateFilter) {
        case 'Today':
          return orderDate >= today;
        case 'Last 7 Days':
          return orderDate >= now - (7 * 24 * 60 * 60 * 1000);
        case 'Last 30 Days':
          return orderDate >= now - (30 * 24 * 60 * 60 * 1000);
        case 'Custom':
          if (customFromDate && customToDate) {
            // Set fromDate to start of day and toDate to end of day
            const startOfDay = new Date(customFromDate).setHours(0, 0, 0, 0);
            const endOfDay = new Date(customToDate).setHours(23, 59, 59, 999);
            return orderDate >= startOfDay && orderDate <= endOfDay;
          }
          return true;
        default:
          return true;
      }
    });
  }, [orders, dateFilter, customFromDate, customToDate]);

  // Computed Stats
  const rawCustomers = useMemo(() => {
    // Determine absolute last order time globally for every customer
    const globalLastOrderTimes = new Map<string, number>();
    orders.forEach(order => {
      const normPhone = normalizePhone(order.userInfo.phone);
      if (!normPhone) return;
      const t = new Date(order.date).getTime();
      const currentLabel = globalLastOrderTimes.get(normPhone) || 0;
      if (t > currentLabel) {
        globalLastOrderTimes.set(normPhone, t);
      }
    });

    const map = new Map<string, { displayPhone: string, name: string, total: number, cancelled: number, completed: number, spent: number, lastOrderTime: number }>();
    
    // 1. Initialize map from permanent customers database
    customers.forEach(cust => {
      const normPhone = normalizePhone(cust.phone);
      if (!normPhone) return;
      map.set(normPhone, {
         displayPhone: cust.phone,
         name: cust.name,
         total: 0,
         cancelled: 0,
         completed: 0,
         spent: 0,
         lastOrderTime: cust.lastSeenAt || 0
      });
    });

    // 2. Overlay dynamic filter stats
    filteredOrders.forEach(order => {
      const normPhone = normalizePhone(order.userInfo.phone);
      if (!normPhone) return;

      if (!map.has(normPhone)) {
        map.set(normPhone, { displayPhone: order.userInfo.phone, name: order.userInfo.name, total: 0, cancelled: 0, completed: 0, spent: 0, lastOrderTime: globalLastOrderTimes.get(normPhone) || 0 });
      }
      const data = map.get(normPhone)!;
      data.total += 1;

      if (order.status === 'Canceled' || order.status === 'Returned' || order.status === 'Complete Return') {
        data.cancelled += 1;
      }
      if (order.status === 'Completed') {
        data.completed += 1;
        data.spent += order.total;
      }
      // If the order has a more recent name, maybe keep it but prefer DB if we want
      if (order.date && new Date(order.date).getTime() >= data.lastOrderTime) {
         data.name = order.userInfo.name;
         data.lastOrderTime = new Date(order.date).getTime();
      }
    });
    
    return Array.from(map.entries()).map(([normPhone, data]) => {
      const isBlocked = blockedPhones.some(p => normalizePhone(p) === normPhone);
      // Success rate based on resolved orders (completed + cancelled).
      const resolved = data.completed + data.cancelled;
      const successRate = resolved > 0 ? Math.round((data.completed / resolved) * 100) : (data.completed > 0 ? 100 : 0);
      
      return {
        phone: data.displayPhone,
        name: data.name,
        totalOrders: data.total,
        cancelledOrders: data.cancelled,
        completedOrders: data.completed,
        totalSpent: data.spent,
        successRate,
        isBlocked,
        statusText: isBlocked ? 'Blocked' : 'Active',
        lastOrderTime: data.lastOrderTime
      } as CustomerStats;
    });
  }, [orders, filteredOrders, blockedPhones, customers]);

  const sortedCustomers = useMemo(() => {
    let sorted = [...rawCustomers];
    
    // Sort logic
    if (sortBy === 'spent') {
      sorted.sort((a, b) => b.totalSpent - a.totalSpent);
    } else if (sortBy === 'low_orders') {
      sorted.sort((a, b) => {
        if (a.totalOrders !== b.totalOrders) {
          return a.totalOrders - b.totalOrders;
        }
        // If tied, sort by latest order time (descending) so more recent is prioritized slightly, or maybe least spent?
        // Usually, secondary by lowest spent or something. Let's just do by totalSpent ascending.
        return a.totalSpent - b.totalSpent;
      });
    } else {
      sorted.sort((a, b) => b.totalOrders - a.totalOrders);
    }

    // Assign ranks
    sorted.forEach((c, index) => {
      c.rank = index + 1;
    });

    if (searchQuery) {
      const query = searchQuery.toLowerCase().replace(/#/g, '');
      sorted = sorted.filter(c => 
        normalizePhone(c.phone).includes(query) || 
        c.phone.includes(query) ||
        c.name.toLowerCase().includes(query) ||
        // Order ID search checking
        orders.some(o => normalizePhone(o.userInfo.phone) === normalizePhone(c.phone) && o.id.toLowerCase().replace(/#/g, '').includes(query))
      );
    }
    return sorted;
  }, [rawCustomers, searchQuery, orders, sortBy]);

  const handleBlockToggle = (phone: string, isBlocked: boolean) => {
    const normPhone = normalizePhone(phone);
    const updatedBlocked = isBlocked 
      ? blockedPhones.filter(p => normalizePhone(p) !== normPhone)
      : [...blockedPhones, normPhone];
    
    setWebsiteSettings(prev => ({
      ...prev,
      customers: {
        ...customerSettings,
        blockedPhones: updatedBlocked
      }
    }));
  };

  const handleSettingsUpdate = (updates: Partial<typeof customerSettings>) => {
    setWebsiteSettings(prev => ({
      ...prev,
      customers: {
        ...customerSettings,
        ...updates
      }
    }));
  };

  const handleWhatsApp = (customer: CustomerStats) => {
    const phoneNum = formatWhatsAppPhone(customer.phone);
    
    let msgTemplate = customerSettings.whatsappMessage || 'Hello {name}, thank you for ordering from our store.';
    msgTemplate = msgTemplate
      .replace(/{name}/g, customer.name)
      .replace(/{phone}/g, customer.phone)
      .replace(/{total_orders}/g, customer.totalOrders.toString())
      .replace(/{total_spent}/g, formatPrice(customer.totalSpent));
      
    const text = encodeURIComponent(msgTemplate);
    const url = `https://wa.me/${phoneNum}?text=${text}`;
    window.open(url, '_blank');
  };

  return (
    <div className="fixed inset-0 z-[100] bg-[var(--dash-bg)] text-[#e2e8f0] flex flex-col font-sans overflow-hidden md:left-[240px]">
      {/* Top Bar */}
      <div className="flex items-center justify-between px-4 md:px-8 py-4 md:py-5 bg-[var(--dash-bg)]">
        <button onClick={onClose} className="p-2 -ml-2 text-gray-400 hover:text-white">
          <ChevronLeft size={24} />
        </button>
        <h1 className="text-xl font-bold text-white absolute left-1/2 -translate-x-1/2">Customers</h1>
        <div className="w-10"></div>
      </div>

      <div className="flex px-4 gap-2 mb-4">
        {['Analytics', 'Blocked', 'Settings'].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab as any)}
            className={cn(
              "flex-1 py-2 text-sm font-medium rounded-xl transition-colors",
              activeTab === tab ? "bg-[#fafafa] text-[var(--dash-bg)]" : "bg-[var(--dash-card)] text-gray-400 border border-[var(--dash-border)]"
            )}
          >
            {tab}
          </button>
        ))}
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 pb-20 md:px-8 max-w-6xl mx-auto w-full">
        {activeTab === 'Analytics' && (
          <div className="flex flex-col gap-4">
            
            {/* Filter and Sort Controls */}
            <div className="bg-[var(--dash-card)] border border-[var(--dash-border)] rounded-xl p-3 flex flex-col gap-3">
              <div className="flex gap-2 overflow-x-auto no-scrollbar">
                {['All Time', 'Today', 'Last 7 Days', 'Last 30 Days', 'Custom'].map(filter => (
                  <button
                    key={filter}
                    onClick={() => setDateFilter(filter as DateFilterType)}
                    className={cn(
                      "px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors border",
                      dateFilter === filter 
                        ? "bg-[#fafafa]/10 text-[#fafafa] border-[#fafafa]/30" 
                        : "bg-[var(--dash-bg)] text-gray-400 border-transparent hover:border-[var(--dash-border)]"
                    )}
                  >
                    {filter}
                  </button>
                ))}
              </div>
              
              {dateFilter === 'Custom' && (
                <div className="flex items-center gap-2">
                  <div className="flex-1">
                    <DatePicker 
                      label="From" 
                      value={customFromDate} 
                      onChange={setCustomFromDate} 
                    />
                  </div>
                  <div className="flex-1">
                    <DatePicker 
                      label="To" 
                      value={customToDate} 
                      onChange={setCustomToDate} 
                    />
                  </div>
                </div>
              )}
              
              <div className="flex items-center gap-2 pt-2 border-t border-[var(--dash-border)]">
                <span className="text-xs text-gray-500 font-medium uppercase tracking-wider">Sort By:</span>
                <button
                  onClick={() => setSortBy('spent')}
                  className={cn(
                    "px-3 py-1 text-xs rounded-md transition-colors",
                    sortBy === 'spent' ? "bg-[var(--dash-border)] text-white" : "text-gray-400 hover:text-gray-200"
                  )}
                >
                  Most Spent
                </button>
                <button
                  onClick={() => setSortBy('orders')}
                  className={cn(
                    "px-3 py-1 text-xs rounded-md transition-colors",
                    sortBy === 'orders' ? "bg-[var(--dash-border)] text-white" : "text-gray-400 hover:text-gray-200"
                  )}
                >
                  Most Orders
                </button>
                <button
                  onClick={() => setSortBy('low_orders')}
                  className={cn(
                    "px-3 py-1 text-xs rounded-md transition-colors",
                    sortBy === 'low_orders' ? "bg-[var(--dash-border)] text-white" : "text-gray-400 hover:text-gray-200"
                  )}
                >
                  Low Orders
                </button>
              </div>
            </div>

            <div className="relative">
              <input 
                type="text" 
                placeholder="Search phone, name, order ID..." 
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full h-12 bg-white border-[1.5px] border-[var(--theme-primary)] rounded-full px-4 pl-10 text-sm outline-none text-[var(--dash-bg)] shadow-sm placeholder-gray-400 focus:shadow-md transition-shadow"
              />
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            </div>

            {/* Bulk Selection Bar */}
            <div className="flex items-center justify-between border-b border-[var(--dash-border)] pb-2 mb-2">
              <button onClick={handleSelectAll} className="text-sm font-medium text-[#fafafa] flex items-center gap-2 hover:opacity-80 transition-opacity">
                <div className={cn(
                  "w-5 h-5 rounded flex items-center justify-center border transition-colors",
                  selectedPhones.length === sortedCustomers.length && sortedCustomers.length > 0 
                    ? "bg-[#fafafa] border-[#fafafa] text-[var(--dash-bg)]" 
                    : "border-gray-500 text-transparent"
                )}>
                  <Check size={14} className={selectedPhones.length === sortedCustomers.length && sortedCustomers.length > 0 ? "opacity-100" : "opacity-0"} />
                </div>
                {selectedPhones.length > 0 ? `${selectedPhones.length} Selected` : 'Select All'}
              </button>
              
              {selectedPhones.length > 0 && (
                <div className="flex items-center gap-4">
                  <button onClick={() => setSelectedPhones([])} className="text-sm text-gray-400 hover:text-white transition-colors">
                    Clear Selection
                  </button>
                  {isOwner && (
                    <button 
                      onClick={() => setShowDeleteConfirm(true)}
                      className="text-sm text-red-500 hover:text-red-400 font-medium transition-colors"
                    >
                      Delete
                    </button>
                  )}
                </div>
              )}
            </div>

            <div className="flex flex-col gap-3">
              {sortedCustomers.map(customer => {
                const normPhone = normalizePhone(customer.phone);
                const isSelected = selectedPhones.includes(normPhone);
                
                return (
                <div key={customer.phone} className={cn(
                  "bg-[var(--dash-card)] shadow-lg border border-[var(--dash-border)] rounded-xl p-4 flex flex-col gap-3 relative overflow-hidden transition-all",
                  isSelected ? "border-[var(--theme-primary)] ring-1 ring-[var(--theme-primary)]" : ""
                )}>
                  <div className="absolute -top-6 -right-6 text-[80px] font-black text-white/[0.02] pointer-events-none select-none">
                    #{customer.rank}
                  </div>
                  
                  <div className="flex justify-between items-start z-10 relative">
                    <div className="flex gap-3">
                      <div className="mt-1">
                        <button 
                          onClick={() => toggleSelection(customer.phone)}
                          className={cn(
                            "w-5 h-5 rounded flex items-center justify-center border transition-colors",
                            isSelected 
                              ? "bg-[var(--theme-primary)] border-[var(--theme-primary)] text-white" 
                              : "border-gray-500 text-transparent"
                          )}
                        >
                          <Check size={14} className={isSelected ? "opacity-100" : "opacity-0"} />
                        </button>
                      </div>
                      <div>
                        <div className="font-bold text-white flex items-center gap-2 text-lg cursor-pointer" onClick={() => toggleSelection(customer.phone)}>
                          <span className="text-[#fafafa]">#{customer.rank}</span> {customer.name}
                          {customer.isBlocked && <ShieldAlert size={14} className="text-red-500" />}
                        </div>
                        <div className="text-sm text-gray-400 flex items-center gap-1 mt-1 cursor-pointer" onClick={() => toggleSelection(customer.phone)}>
                          <Phone size={12} /> {formatWhatsAppPhone(customer.phone)}
                          <span className="mx-1 text-gray-600">•</span>
                          <Clock size={12} /> {formatShortTimeAgo(customer.lastOrderTime)}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button 
                         onClick={() => handleWhatsApp(customer)}
                         className="flex items-center justify-center p-2 rounded-full bg-[#25D366]/10 text-[#25D366] hover:bg-[#25D366]/20 transition-colors"
                         title="Send WhatsApp Message"
                      >
                         <MessageCircle size={18} />
                      </button>
                      <button 
                        onClick={() => handleBlockToggle(customer.phone, customer.isBlocked)}
                        className={cn(
                          "text-xs px-3 py-1 rounded-full border transition-colors",
                          customer.isBlocked 
                            ? "bg-[var(--dash-card)] text-white border-[var(--dash-border)] hover:bg-[var(--dash-border)]" 
                            : "bg-red-500/10 text-red-500 border-red-500/20 hover:bg-red-500/20"
                        )}
                      >
                        {customer.isBlocked ? 'Unblock' : 'Block'}
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-4 gap-2 z-10 relative">
                    <div className="bg-[var(--dash-bg)] p-2 rounded-lg flex flex-col items-center border border-[var(--dash-border)]/50 shadow-sm">
                      <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Spent</div>
                      <div className="font-bold text-white flex items-center gap-1 text-sm">
                        {formatPrice(customer.totalSpent)}
                      </div>
                    </div>
                    <div className="bg-[var(--dash-bg)] p-2 rounded-lg flex flex-col items-center border border-[var(--dash-border)]/50 shadow-sm">
                      <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Orders</div>
                      <div className="font-bold text-[#fafafa] flex items-center gap-1 text-sm">
                        <ShoppingCart size={12} /> {customer.totalOrders}
                      </div>
                    </div>
                    <div className="bg-[var(--dash-bg)] p-2 rounded-lg flex flex-col items-center border border-[var(--dash-border)]/50 shadow-sm">
                      <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Cancelled</div>
                      <div className="font-bold text-red-500 flex items-center gap-1 text-sm">
                        <X size={12} /> {customer.cancelledOrders}
                      </div>
                    </div>
                    <div className="bg-[var(--dash-bg)] p-2 rounded-lg flex flex-col items-center border border-[var(--dash-border)]/50 shadow-sm">
                      <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Success</div>
                      <div className="font-bold text-yellow-500 flex items-center gap-1 text-sm">
                        <Activity size={12} /> {customer.successRate}%
                      </div>
                    </div>
                  </div>
                </div>
                );
              })}
              {sortedCustomers.length === 0 && (
                <div className="text-center text-gray-500 mt-10">No customers found</div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'Blocked' && (
          <div className="flex flex-col gap-3">
            {sortedCustomers.filter(c => c.isBlocked).map(customer => (
                <div key={customer.phone} className="bg-[var(--dash-card)] border border-red-500/30 rounded-xl p-4 flex flex-col gap-3 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-16 h-16 bg-red-500/10 rounded-bl-[100px] -z-0"></div>
                  <div className="flex justify-between items-start relative z-10">
                    <div>
                      <div className="font-bold text-red-400 flex items-center gap-2">
                        {customer.name}
                      </div>
                      <div className="text-sm text-gray-400 flex items-center gap-1">
                        <Phone size={12} /> {formatWhatsAppPhone(customer.phone)}
                        <span className="mx-1 text-gray-600">•</span>
                        <Clock size={12} /> {formatShortTimeAgo(customer.lastOrderTime)}
                      </div>
                    </div>
                    <button 
                      onClick={() => handleBlockToggle(customer.phone, true)}
                      className="text-xs px-3 py-1 bg-[var(--dash-border)] text-white rounded-full border border-gray-600 hover:bg-[var(--dash-border)] transition-colors"
                    >
                      Unblock
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2 relative z-10">
                    <div className="bg-[var(--dash-bg)] p-2 rounded-lg flex flex-col items-center border border-[var(--dash-border)]">
                      <div className="text-xs text-gray-500 mb-1">Total Cancelled</div>
                      <div className="font-bold text-red-500 text-lg">
                        {customer.cancelledOrders}
                      </div>
                    </div>
                    <div className="bg-[var(--dash-bg)] p-2 rounded-lg flex flex-col items-center border border-[var(--dash-border)]">
                      <div className="text-xs text-gray-500 mb-1">Success Rate</div>
                      <div className="font-bold text-gray-400 text-lg">
                        {customer.successRate}%
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              {sortedCustomers.filter(c => c.isBlocked).length === 0 && (
                <div className="text-center text-gray-500 mt-10">No blocked customers</div>
              )}
          </div>
        )}

        {activeTab === 'Settings' && (
          <div className="flex flex-col gap-4">
            <div className="bg-[var(--dash-card)] border border-[var(--dash-border)] rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <User size={20} className="text-[#fafafa]" />
                  <div className="font-medium text-white text-lg">Customer System</div>
                </div>
                <button 
                  onClick={() => handleSettingsUpdate({ systemEnabled: !systemEnabled })}
                  className={cn("w-12 h-6 rounded-full relative flex items-center px-1 transition-colors group", systemEnabled ? "bg-[#fafafa]" : "bg-[var(--dash-border)]")}
                >
                  <div className={cn("w-4 h-4 rounded-full transition-all duration-300 ease-[cubic-bezier(0.25,1,0.5,1)]", systemEnabled  ? "bg-[var(--dash-card)] translate-x-6 group-active:w-6 group-active:translate-x-4" : "bg-white translate-x-0 group-active:w-6")}></div>
                </button>
              </div>
              <p className="text-xs text-gray-400">Master toggle to enable or disable all block features.</p>
            </div>

            <div className={cn("transition-opacity", !systemEnabled && "opacity-50 pointer-events-none")}>
              <div className="bg-[var(--dash-card)] border border-[var(--dash-border)] rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <ShieldAlert size={20} className="text-[#fafafa]" />
                    <div className="font-medium text-white text-lg">Auto Block System</div>
                  </div>
                  <button 
                    onClick={() => handleSettingsUpdate({ autoBlockEnabled: !customerSettings.autoBlockEnabled })}
                    className={cn("w-12 h-6 rounded-full relative flex items-center px-1 transition-colors group", customerSettings.autoBlockEnabled ? "bg-[#fafafa]" : "bg-[var(--dash-border)]")}
                  >
                    <div className={cn("w-4 h-4 rounded-full transition-all duration-300 ease-[cubic-bezier(0.25,1,0.5,1)]", customerSettings.autoBlockEnabled  ? "bg-[var(--dash-card)] translate-x-6 group-active:w-6 group-active:translate-x-4" : "bg-white translate-x-0 group-active:w-6")}></div>
                  </button>
                </div>
                <p className="text-xs text-gray-400 mb-4">Automatically block customers who cancel too many orders.</p>

                <div className={cn("flex flex-col gap-2 transition-opacity", !customerSettings.autoBlockEnabled && "opacity-50 pointer-events-none")}>
                  <label className="text-sm text-gray-300">Max Cancellations Allowed</label>
                  <div className="flex items-center gap-3 bg-[var(--dash-bg)] border border-[var(--dash-border)] rounded-lg p-1">
                    <button 
                      onClick={() => handleSettingsUpdate({ maxCancelLimit: Math.max(1, customerSettings.maxCancelLimit - 1) })}
                      className="w-10 h-10 flex items-center justify-center text-white bg-[var(--dash-card)] rounded-md"
                    >-</button>
                    <div className="flex-1 text-center font-bold text-white text-lg">
                      {customerSettings.maxCancelLimit}
                    </div>
                    <button 
                      onClick={() => handleSettingsUpdate({ maxCancelLimit: customerSettings.maxCancelLimit + 1 })}
                      className="w-10 h-10 flex items-center justify-center text-white bg-[var(--dash-card)] rounded-md"
                    >+</button>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-[var(--dash-card)] border border-[var(--dash-border)] rounded-xl p-4">
              <div className="flex items-center gap-3 mb-4">
                <MessageCircle size={20} className="text-[#25D366]" />
                <div className="font-medium text-white text-lg">WhatsApp Message</div>
              </div>
              <p className="text-xs text-gray-400 mb-4">Customize the default message sent when you click the WhatsApp button on a customer's card.</p>
              
              <div className="flex flex-col gap-2">
                <label className="text-sm text-gray-300">Message Template</label>
                <textarea 
                  value={customerSettings.whatsappMessage || ''}
                  onChange={(e) => handleSettingsUpdate({ whatsappMessage: e.target.value })}
                  placeholder="Hello {name}, thank you for ordering from our store."
                  rows={4}
                  className="w-full bg-[var(--dash-bg)] border border-[var(--dash-border)] rounded-lg p-3 text-sm text-white focus:outline-none focus:border-[#fafafa] transition-colors resize-none"
                />
                <div className="bg-[var(--dash-border)]/50 rounded-lg p-3 mt-2">
                  <div className="text-xs font-medium text-gray-300 mb-2">Available Variables:</div>
                  <div className="flex flex-wrap gap-2 text-xs text-gray-400 font-mono">
                    <span className="bg-[var(--dash-bg)] px-2 py-1 rounded select-all cursor-pointer hover:text-[#fafafa]">{"{name}"}</span>
                    <span className="bg-[var(--dash-bg)] px-2 py-1 rounded select-all cursor-pointer hover:text-[#fafafa]">{"{phone}"}</span>
                    <span className="bg-[var(--dash-bg)] px-2 py-1 rounded select-all cursor-pointer hover:text-[#fafafa]">{"{total_orders}"}</span>
                    <span className="bg-[var(--dash-bg)] px-2 py-1 rounded select-all cursor-pointer hover:text-[#fafafa]">{"{total_spent}"}</span>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="bg-[var(--dash-card)] border border-[var(--dash-border)] rounded-xl p-4">
               <h3 className="text-white font-medium mb-2">How Silent Block Works</h3>
               <ul className="text-xs text-gray-400 space-y-2 list-disc pl-4">
                 <li>When a blocked customer tries to place an order, it appears completely normal to them.</li>
                 <li>They will not see any errors or "blocked" messages.</li>
                 <li>The order is completely discarded and will not appear in your Dashboard.</li>
               </ul>
            </div>
          </div>
        )}
      </div>

      <AnimatePresence>
        {showDeleteConfirm && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[110]"
              onClick={() => setShowDeleteConfirm(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[calc(100%-32px)] max-w-[400px] bg-[var(--dash-card)] border border-[var(--dash-border)] rounded-2xl shadow-xl z-[120] p-6 lg:left-[calc(50%+120px)]"
            >
              <h2 className="text-xl font-bold text-white mb-2">Delete Customer Data?</h2>
              <p className="text-sm text-gray-400 mb-6 leading-relaxed">
                This action cannot be undone. All selected customer information will be permanently removed.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={isDeleting}
                  className="flex-1 py-3 bg-[var(--dash-bg)] text-white font-medium rounded-xl border border-[var(--dash-border)] hover:bg-[var(--dash-border)] transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteCustomers}
                  disabled={isDeleting}
                  className="flex-1 py-3 bg-red-500 text-white font-semibold rounded-xl hover:bg-red-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isDeleting ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : 'Delete Permanently'}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
