import React, { useState, useMemo } from 'react';
import { ChevronLeft, SlidersHorizontal, ArrowUpRight, ArrowDownRight, CheckCircle2, Save, X, RefreshCw, Package, DollarSign, Layers } from 'lucide-react';
import { Product, Category } from './types';
import { cloudStore } from './lib/cloudStore';
import { cn } from './lib/utils';

interface BulkPriceManagerProps {
  products: Product[];
  setProducts: React.Dispatch<React.SetStateAction<Product[]>>;
  categories: Category[];
  suppliers: string[];
  onClose: () => void;
}

export default function BulkPriceManager({ products, setProducts, categories, suppliers, onClose }: BulkPriceManagerProps) {
  const [selectedSupplier, setSelectedSupplier] = useState<string>('All');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  
  // Controls
  const [buyPriceChangeType, setBuyPriceChangeType] = useState<'amount' | 'percent'>('amount');
  const [buyPriceChangeValue, setBuyPriceChangeValue] = useState<string>('');
  const [buyPriceOperation, setBuyPriceOperation] = useState<'increase' | 'decrease'>('increase');
  
  const [sellPriceProfitValue, setSellPriceProfitValue] = useState<string>('');

  const [stockChangeValue, setStockChangeValue] = useState<string>('');
  const [stockOperation, setStockOperation] = useState<'add' | 'increase' | 'decrease'>('add');
  
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isApplying, setIsApplying] = useState(false);

  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      if (selectedSupplier !== 'All' && p.supplier !== selectedSupplier) return false;
      if (selectedSupplier === 'None' && p.supplier) return false;
      if (selectedCategory !== 'All' && p.category?.trim()?.toLowerCase() !== selectedCategory.trim().toLowerCase()) return false;
      return true;
    });
  }, [products, selectedSupplier, selectedCategory]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const applyAllChanges = async () => {
    if (filteredProducts.length === 0) return;
    
    const buyValue = parseFloat(buyPriceChangeValue);
    const hasBuyChange = !isNaN(buyValue) && buyValue > 0;
    
    const profitValue = parseFloat(sellPriceProfitValue);
    const hasSellChange = !isNaN(profitValue);
    
    const stockValue = parseFloat(stockChangeValue);
    const hasStockChange = !isNaN(stockValue);

    if (!hasBuyChange && !hasSellChange && !hasStockChange) {
      showToast('⚠️ No changes configured. Please enter a value.');
      return;
    }

    setIsApplying(true);
    const idsToUpdate = filteredProducts.map(p => p.id);
    const updatedProducts: Product[] = [];

    setProducts(prev => {
      const newProducts = prev.map(p => {
        if (!idsToUpdate.includes(p.id)) return p;
        const newP = { ...p };

        // Apply Buy Price
        if (hasBuyChange) {
          const currentBuyPrice = newP.buyPrice || 0;
          let newBuyPrice = currentBuyPrice;
          
          if (buyPriceChangeType === 'amount') {
            newBuyPrice = buyPriceOperation === 'increase' ? currentBuyPrice + buyValue : currentBuyPrice - buyValue;
          } else {
            const amount = currentBuyPrice * (buyValue / 100);
            newBuyPrice = buyPriceOperation === 'increase' ? currentBuyPrice + amount : currentBuyPrice - amount;
          }
          newP.buyPrice = Math.max(0, newBuyPrice);
        }

        // Apply Sell Price
        if (hasSellChange) {
          const currentBuyPrice = newP.buyPrice || 0;
          const newSellPrice = currentBuyPrice + profitValue;
          newP.price = Math.max(0, newSellPrice);
        }

        // Apply Stock
        if (hasStockChange) {
          const currentStock = newP.stock || 0;
          let newStock = currentStock;

          if (stockOperation === 'add') {
            newStock = stockValue;
          } else if (stockOperation === 'increase') {
            newStock = currentStock + stockValue;
          } else if (stockOperation === 'decrease') {
            newStock = Math.max(0, currentStock - stockValue);
          }
          newP.stock = newStock;
        }

        updatedProducts.push(newP);
        return newP;
      });
      
      if (updatedProducts.length > 0) {
        cloudStore.upsertProducts(updatedProducts).catch(console.error);
      }
      return newProducts;
    });
    
    setBuyPriceChangeValue('');
    setSellPriceProfitValue('');
    setStockChangeValue('');
    setIsApplying(false);
    showToast(`✅ Successfully updated ${idsToUpdate.length} products!`);
  };

  return (
    <div className="fixed inset-0 z-[100] bg-[#070b14] text-[#e2e8f0] flex flex-col font-sans overflow-hidden md:left-[240px]">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-[120] bg-emerald-500 text-white px-5 py-2.5 rounded-xl shadow-2xl font-bold text-xs flex items-center gap-2 animate-in fade-in slide-in-from-top-2 duration-200">
          <CheckCircle2 size={16} /> {toastMessage}
        </div>
      )}

      {/* Top Bar */}
      <div className="flex items-center justify-between px-4 py-3.5 md:px-8 md:py-4 border-b border-[#1e293b]/70 bg-[#070b14]/90 backdrop-blur-md sticky top-0 z-20 shrink-0">
        <div className="flex items-center gap-3">
          <button 
            onClick={onClose} 
            className="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 active:scale-95 border border-white/10 flex items-center justify-center text-slate-300 hover:text-white transition-all shrink-0"
            title="Go back"
          >
            <ChevronLeft size={20} />
          </button>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 shrink-0 shadow-inner">
              <SlidersHorizontal size={20} />
            </div>
            <div>
              <h1 className="text-base md:text-lg font-bold text-white tracking-tight flex items-center gap-2">
                Bulk Edit Products
              </h1>
              <p className="text-[11px] text-slate-400 font-medium hidden sm:block">
                Batch adjust prices, margins, and inventory quantities
              </p>
            </div>
          </div>
        </div>

        <span className="text-xs font-semibold px-3 py-1.5 rounded-full bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
          {filteredProducts.length} / {products.length} Selected
        </span>
      </div>

      {/* Main Content */}
      <div 
        className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6 max-w-3xl mx-auto w-full pb-28 overscroll-y-contain custom-scrollbar"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        {/* Scope Card */}
        <div className="bg-[#0b1120] border border-[#1e293b]/70 rounded-2xl p-4 md:p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#1e293b]/50">
            <div className="flex items-center gap-2">
              <Layers size={16} className="text-cyan-400" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-300">1. Select Target Scope</h2>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-400 mb-1.5 block">Category Filter</label>
              <select
                value={selectedCategory}
                onChange={e => setSelectedCategory(e.target.value)}
                className="w-full bg-[#070b14] border border-[#1e293b] rounded-xl px-4 py-2.5 text-xs md:text-sm text-white focus:outline-none focus:border-cyan-500 transition-colors"
              >
                <option value="All">All Categories ({products.length})</option>
                {categories.map(c => (
                  <option key={c.id} value={c.name}>{c.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-400 mb-1.5 block">Supplier Filter</label>
              <select
                value={selectedSupplier}
                onChange={e => setSelectedSupplier(e.target.value)}
                className="w-full bg-[#070b14] border border-[#1e293b] rounded-xl px-4 py-2.5 text-xs md:text-sm text-white focus:outline-none focus:border-cyan-500 transition-colors"
              >
                <option value="All">All Suppliers</option>
                <option value="None">No Supplier Assigned</option>
                {suppliers.map((s, idx) => (
                  <option key={idx} value={s}>{s}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Buy Price Card */}
        <div className="bg-[#0b1120] border border-[#1e293b]/70 rounded-2xl p-4 md:p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#1e293b]/50">
            <div className="flex items-center gap-2">
              <DollarSign size={16} className="text-pink-400" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-300">2. Adjust Buy Price</h2>
            </div>
            <span className="text-[11px] text-slate-500">Optional</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-[11px] font-semibold text-slate-400 mb-1.5 block">Operation</label>
              <div className="flex rounded-xl bg-[#070b14] p-1 border border-[#1e293b]">
                <button
                  onClick={() => setBuyPriceOperation('increase')}
                  className={cn(
                    "flex-1 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1",
                    buyPriceOperation === 'increase' ? "bg-emerald-500 text-white shadow-sm" : "text-slate-400 hover:text-white"
                  )}
                >
                  <ArrowUpRight size={13} /> Increase
                </button>
                <button
                  onClick={() => setBuyPriceOperation('decrease')}
                  className={cn(
                    "flex-1 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1",
                    buyPriceOperation === 'decrease' ? "bg-rose-500 text-white shadow-sm" : "text-slate-400 hover:text-white"
                  )}
                >
                  <ArrowDownRight size={13} /> Decrease
                </button>
              </div>
            </div>

            <div>
              <label className="text-[11px] font-semibold text-slate-400 mb-1.5 block">Adjustment Type</label>
              <div className="flex rounded-xl bg-[#070b14] p-1 border border-[#1e293b]">
                <button
                  onClick={() => setBuyPriceChangeType('amount')}
                  className={cn(
                    "flex-1 py-1.5 rounded-lg text-xs font-bold transition-all",
                    buyPriceChangeType === 'amount' ? "bg-cyan-500 text-white shadow-sm" : "text-slate-400 hover:text-white"
                  )}
                >
                  Fixed (৳)
                </button>
                <button
                  onClick={() => setBuyPriceChangeType('percent')}
                  className={cn(
                    "flex-1 py-1.5 rounded-lg text-xs font-bold transition-all",
                    buyPriceChangeType === 'percent' ? "bg-cyan-500 text-white shadow-sm" : "text-slate-400 hover:text-white"
                  )}
                >
                  Percentage (%)
                </button>
              </div>
            </div>

            <div>
              <label className="text-[11px] font-semibold text-slate-400 mb-1.5 block">
                Value {buyPriceChangeType === 'amount' ? '(৳)' : '(%)'}
              </label>
              <input
                type="number"
                placeholder={buyPriceChangeType === 'amount' ? "e.g. 50" : "e.g. 10"}
                value={buyPriceChangeValue}
                onChange={e => setBuyPriceChangeValue(e.target.value)}
                className="w-full bg-[#070b14] border border-[#1e293b] rounded-xl px-4 py-2 text-xs md:text-sm text-white focus:outline-none focus:border-pink-500 transition-colors"
              />
            </div>
          </div>
        </div>

        {/* Sell Price & Margin Card */}
        <div className="bg-[#0b1120] border border-[#1e293b]/70 rounded-2xl p-4 md:p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#1e293b]/50">
            <div className="flex items-center gap-2">
              <DollarSign size={16} className="text-emerald-400" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-300">3. Set Profit Margin Over Buy Price</h2>
            </div>
            <span className="text-[11px] text-slate-500">Optional</span>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-400 mb-1.5 block">
              Profit Added to Buy Price (৳)
            </label>
            <div className="relative">
              <input
                type="number"
                placeholder="e.g. 150 (Formula: Sell Price = Buy Price + Profit)"
                value={sellPriceProfitValue}
                onChange={e => setSellPriceProfitValue(e.target.value)}
                className="w-full bg-[#070b14] border border-[#1e293b] rounded-xl px-4 py-2.5 text-xs md:text-sm text-white focus:outline-none focus:border-emerald-500 transition-colors placeholder:text-slate-600"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-slate-500 font-bold">
                ৳ / unit
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mt-1.5">
              Leave blank if you don't want to recompute retail selling prices.
            </p>
          </div>
        </div>

        {/* Inventory Stock Card */}
        <div className="bg-[#0b1120] border border-[#1e293b]/70 rounded-2xl p-4 md:p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#1e293b]/50">
            <div className="flex items-center gap-2">
              <Package size={16} className="text-purple-400" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-300">4. Inventory Stock Update</h2>
            </div>
            <span className="text-[11px] text-slate-500">Optional</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-[11px] font-semibold text-slate-400 mb-1.5 block">Stock Operation</label>
              <div className="flex rounded-xl bg-[#070b14] p-1 border border-[#1e293b]">
                <button
                  onClick={() => setStockOperation('add')}
                  className={cn(
                    "flex-1 py-1.5 rounded-lg text-xs font-bold transition-all",
                    stockOperation === 'add' ? "bg-purple-500 text-white shadow-sm" : "text-slate-400 hover:text-white"
                  )}
                >
                  Set Exact
                </button>
                <button
                  onClick={() => setStockOperation('increase')}
                  className={cn(
                    "flex-1 py-1.5 rounded-lg text-xs font-bold transition-all",
                    stockOperation === 'increase' ? "bg-purple-500 text-white shadow-sm" : "text-slate-400 hover:text-white"
                  )}
                >
                  + Add Stock
                </button>
                <button
                  onClick={() => setStockOperation('decrease')}
                  className={cn(
                    "flex-1 py-1.5 rounded-lg text-xs font-bold transition-all",
                    stockOperation === 'decrease' ? "bg-purple-500 text-white shadow-sm" : "text-slate-400 hover:text-white"
                  )}
                >
                  - Reduce
                </button>
              </div>
            </div>

            <div>
              <label className="text-[11px] font-semibold text-slate-400 mb-1.5 block">Quantity</label>
              <input
                type="number"
                placeholder="e.g. 50"
                value={stockChangeValue}
                onChange={e => setStockChangeValue(e.target.value)}
                className="w-full bg-[#070b14] border border-[#1e293b] rounded-xl px-4 py-2 text-xs md:text-sm text-white focus:outline-none focus:border-purple-500 transition-colors"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Sticky Action Footer */}
      <div className="sticky bottom-0 bg-[#070b14]/90 backdrop-blur-md border-t border-[#1e293b] p-3.5 md:p-4 flex items-center justify-between z-20 shrink-0">
        <button
          onClick={onClose}
          className="px-4 py-2.5 rounded-xl border border-slate-700 hover:bg-white/5 text-slate-300 font-semibold text-xs transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={applyAllChanges}
          disabled={isApplying || filteredProducts.length === 0}
          className="flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-xs md:text-sm text-white bg-cyan-500 hover:bg-cyan-600 active:scale-95 transition-all shadow-lg shadow-cyan-500/20 disabled:opacity-50 cursor-pointer"
        >
          {isApplying ? (
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <CheckCircle2 size={16} />
          )}
          Apply Changes to {filteredProducts.length} Items
        </button>
      </div>
    </div>
  );
}
