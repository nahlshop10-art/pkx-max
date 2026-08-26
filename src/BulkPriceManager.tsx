import React, { useState, useMemo } from 'react';
import { motion } from 'motion/react';
import { X, CheckCircle2, ChevronLeft, SlidersHorizontal, BarChart3, Save } from 'lucide-react';
import { Product, Category } from './types';
import { cloudStore } from './lib/cloudStore';

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

  const applyAllChanges = () => {
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
          const currentBuyPrice = newP.buyPrice || 0; // Uses the newly updated buy price if it was updated above
          const newSellPrice = currentBuyPrice + profitValue;
          newP.price = Math.max(0, newSellPrice);
        }

        // Apply Stock
        if (hasStockChange) {
          const currentStock = newP.stock || 0;
          let newStock = currentStock;

          if (stockOperation === 'add') {
            newStock = stockValue; // Set exact
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
    showToast(`✅ Updated ${idsToUpdate.length} items successfully!`);
  };

  const totalProducts = products.length;
  const matchRatio = totalProducts > 0 ? filteredProducts.length / totalProducts : 0;

  return (
    <div className="fixed inset-0 z-[100] bg-[var(--dash-bg)] flex flex-col items-center overflow-y-auto md:left-[240px]">
      {/* Header */}
      <div className="w-full max-w-xl flex items-center justify-between p-4 md:px-8 md:py-5 sticky top-0 bg-[var(--dash-bg)]/90 backdrop-blur-md z-10 border-b border-[var(--dash-border)]">
        <button 
          onClick={onClose}
          className="flex items-center gap-1 text-gray-300 hover:text-white transition-colors"
        >
          <ChevronLeft size={20} />
          <span className="text-lg">Back</span>
        </button>
        <h2 className="text-lg font-bold text-white">Bulk Edit</h2>
        <button 
          onClick={onClose}
          className="p-1.5 bg-[var(--dash-card)] rounded-full text-gray-400 hover:text-white hover:bg-[var(--dash-border)] transition-all"
        >
          <X size={20} />
        </button>
      </div>

      {toastMessage && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[110] bg-emerald-500 text-white px-6 py-3 rounded-xl shadow-2xl animate-fade-in font-medium flex items-center gap-2 whitespace-nowrap">
          {toastMessage}
        </div>
      )}

      <div className="w-full max-w-xl p-4 space-y-6 pb-24">
        
        {/* Step 1: Select Scope */}
        <div className="bg-[var(--dash-card)]/80 border border-[var(--dash-border)] rounded-2xl p-5 shadow-lg">
          <h3 className="text-lg font-semibold text-white mb-4">Step 1: Select Scope</h3>
          
          <div className="grid grid-cols-2 gap-3 sm:gap-4 mb-5">
            <div>
              <label className="text-sm font-medium text-gray-300 mb-2 flex items-center gap-1">Select Supplier <SlidersHorizontal size={14}/></label>
              <select 
                value={selectedSupplier}
                onChange={(e) => setSelectedSupplier(e.target.value)}
                className="w-full bg-[var(--dash-border)]/50 border border-[#2a4d3e]/50 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-[#fafafa] transition-colors appearance-none cursor-pointer text-sm"
              >
                <option value="All">All Suppliers</option>
                <option value="None">No Supplier</option>
                {suppliers.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            
            <div>
              <label className="text-sm font-medium text-gray-300 mb-2 flex items-center gap-1">Select Category <SlidersHorizontal size={14}/></label>
              <select 
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full bg-[var(--dash-border)]/50 border border-[#2a4d3e]/50 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-[#fafafa] transition-colors appearance-none cursor-pointer text-sm"
              >
                <option value="All">All Categories</option>
                {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
              </select>
            </div>
          </div>

          <div className="bg-[var(--dash-border)]/30 border border-[#2a4d3e]/40 rounded-xl p-4 flex items-center gap-4">
            <div className="shrink-0 w-10 h-10 rounded-full border-2 border-white/20 flex items-center justify-center">
              <CheckCircle2 className="text-white" size={24} />
            </div>
            <div className="flex-1">
              <div className="text-white font-medium mb-1.5">Editing {filteredProducts.length} items</div>
              <div className="h-1.5 w-full bg-[var(--dash-border)] rounded-full overflow-hidden">
                <div 
                  className="h-full bg-white transition-all duration-500 ease-out"
                  style={{ width: `${Math.max(matchRatio * 100, 2)}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Step 2: Configure Changes */}
        <div className="bg-[var(--dash-card)]/80 border border-[var(--dash-border)] rounded-2xl p-5 shadow-lg space-y-5">
          <h3 className="text-lg font-semibold text-white mb-2">Step 2: Configure Changes</h3>
          
          <div className="bg-[var(--dash-border)]/20 border border-[#2a4d3e]/30 rounded-xl p-5 space-y-5">
            <h4 className="text-sm font-bold text-gray-200 flex items-center gap-2">
              <SlidersHorizontal size={16} className="text-gray-400" /> Pricing Controls
            </h4>

            {/* Buy Price */}
            <div className="space-y-2.5">
              <label className="text-sm text-gray-300">Update Buy Price</label>
              <div className="flex gap-2">
                <select 
                  value={buyPriceOperation}
                  onChange={(e: any) => setBuyPriceOperation(e.target.value)}
                  className="bg-[var(--dash-border)]/50 border border-[#2a4d3e]/50 rounded-lg px-2 sm:px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-[#fafafa] transition-colors cursor-pointer shrink-0"
                >
                  <option value="increase">Increase (+)</option>
                  <option value="decrease">Decrease (-)</option>
                </select>
                <select 
                  value={buyPriceChangeType}
                  onChange={(e: any) => setBuyPriceChangeType(e.target.value)}
                  className="bg-[var(--dash-border)]/50 border border-[#2a4d3e]/50 rounded-lg px-2 sm:px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-[#fafafa] transition-colors cursor-pointer shrink-0"
                >
                  <option value="amount">৳ Flat</option>
                  <option value="percent">% Pct</option>
                </select>
                <input 
                  type="number" 
                  min="0"
                  placeholder="Enter value..."
                  value={buyPriceChangeValue}
                  onChange={(e) => setBuyPriceChangeValue(e.target.value)}
                  className="w-full min-w-0 flex-1 bg-[var(--dash-border)]/50 border border-[#2a4d3e]/50 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#fafafa] transition-colors placeholder:text-gray-500"
                />
              </div>
            </div>

            <hr className="border-[#2a4d3e]/30" />

            {/* Sell Price */}
            <div className="space-y-2.5">
              <label className="text-sm text-gray-300 block">Set Sell Price</label>
              <div className="flex items-center gap-3">
                <div className="text-[11px] sm:text-xs text-gray-400 whitespace-nowrap shrink-0 leading-tight">
                  Calculated as: <br />
                  <span className="text-white font-medium">Buy Price + Profit</span>
                </div>
                <input 
                  type="number" 
                  placeholder="Enter profit amount (৳)"
                  value={sellPriceProfitValue}
                  onChange={(e) => setSellPriceProfitValue(e.target.value)}
                  className="w-full min-w-0 flex-1 bg-[var(--dash-border)]/50 border border-[#2a4d3e]/50 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#fafafa] transition-colors placeholder:text-gray-500"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Stock Updates */}
        <div className="bg-[var(--dash-card)]/80 border border-[var(--dash-border)] rounded-2xl p-5 shadow-lg space-y-4">
          <h4 className="text-sm font-bold text-gray-200 flex items-center gap-2">
            <BarChart3 size={16} className="text-gray-400" /> Stock Updates
          </h4>

          <div className="space-y-2.5">
            <label className="text-sm text-gray-300">Update Stock</label>
            <div className="flex gap-2">
              <select 
                value={stockOperation}
                onChange={(e: any) => setStockOperation(e.target.value)}
                className="bg-[var(--dash-border)]/50 border border-[#2a4d3e]/50 rounded-lg px-2 sm:px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-[#fafafa] transition-colors cursor-pointer shrink-0"
              >
                <option value="add">Set Exact Stock</option>
                <option value="increase">Increase (+)</option>
                <option value="decrease">Decrease (-)</option>
              </select>
              <input 
                type="number" 
                min="0"
                placeholder="Enter value..."
                value={stockChangeValue}
                onChange={(e) => setStockChangeValue(e.target.value)}
                className="w-full min-w-0 flex-1 bg-[var(--dash-border)]/50 border border-[#2a4d3e]/50 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#fafafa] transition-colors placeholder:text-gray-500"
              />
            </div>
          </div>
        </div>

        {/* Save Changes Button */}
        <button
          onClick={applyAllChanges}
          disabled={
            filteredProducts.length === 0 || 
            (!buyPriceChangeValue && !sellPriceProfitValue && !stockChangeValue)
          }
          style={{ backgroundColor: 'var(--theme-primary, #ff4d6d)', color: '#ffffff' }}
          className="w-full text-white font-semibold text-base rounded-2xl px-4 py-3.5 transition-all hover:brightness-95 active:scale-[0.99] shadow-lg disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2"
        >
          <Save size={18} />
          Save Changes
        </button>

      </div>
    </div>
  );
}
