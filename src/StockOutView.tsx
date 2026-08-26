import React, { useState, useMemo } from 'react';
import { motion } from 'motion/react';
import { ArrowLeft, Search, X } from 'lucide-react';
import { Product } from './types';
import { format } from 'date-fns';
import { useScrollLock } from './hooks/useScrollLock';

export default function StockOutView({ products, onClose }: { products: Product[], onClose: () => void }) {
  useScrollLock(true);
  const [query, setQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [isCategoryMenuOpen, setIsCategoryMenuOpen] = useState(false);
  const handleCategorySelect = (cat: string) => {
    setSelectedCategory(cat);
    setIsCategoryMenuOpen(false);
  };

  const stockOutProducts = useMemo(() => {
    return products
      .filter(p => p.stock === 0)
      .sort((a, b) => {
        const dateA = a.stockOutDate ? new Date(a.stockOutDate).getTime() : 0;
        const dateB = b.stockOutDate ? new Date(b.stockOutDate).getTime() : 0;
        return dateB - dateA;
      });
  }, [products]);

  const categories = useMemo(() => {
    const cats = new Set(stockOutProducts.map(p => p.category));
    return ['All', ...Array.from(cats)];
  }, [stockOutProducts]);

  const filteredProducts = useMemo(() => {
    let result = stockOutProducts;
    if (selectedCategory !== 'All') {
      result = result.filter(p => p.category?.trim()?.toLowerCase() === selectedCategory.trim().toLowerCase());
    }
    if (query) {
      const lowerQuery = query.toLowerCase();
      result = result.filter(p => 
        p.id.toLowerCase().includes(lowerQuery) || 
        p.title.toLowerCase().includes(lowerQuery)
      );
    }
    return result;
  }, [stockOutProducts, selectedCategory, query]);

  return (
    <motion.div 
      initial={{ x: '100%' }} 
      animate={{ x: 0 }} 
      exit={{ x: '100%' }} 
      transition={{ type: 'spring', damping: 25, stiffness: 200 }} 
      className="fixed inset-0 z-[100] bg-[#fdfbf7] flex flex-col font-sans"
    >
      <div className="flex items-center px-4 py-4 bg-[var(--theme-white)] border-b border-gray-100 sticky top-0 z-10">
        <button onClick={onClose} className="mr-4 text-[var(--theme-black)]">
          <ArrowLeft size={24} />
        </button>
        <div className="flex items-center gap-1 mx-auto">
          {/* Use dummy logo or text */}
          <span className="font-bold text-xl text-[var(--theme-black)] tracking-tight">Stockouts</span>
        </div>
        <div className="w-6"></div> {/* spacer */}
      </div>

      <div className="flex items-center justify-between px-4 py-3 bg-[#fdfbf7]">
        <h2 className="text-xl font-bold text-[var(--theme-black)]">Stockouts</h2>
        <div className="relative">
          <button 
            onClick={() => setIsCategoryMenuOpen(!isCategoryMenuOpen)}
            className="flex items-center gap-2 px-4 py-2 bg-[var(--theme-white)] border border-gray-200 rounded-lg text-sm font-medium text-gray-700 shadow-sm"
          >
            Categories
            <motion.svg 
              animate={{ rotate: isCategoryMenuOpen ? 180 : 0 }} 
              width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            >
              <polyline points="6 9 12 15 18 9"></polyline>
            </motion.svg>
          </button>
          
          {isCategoryMenuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setIsCategoryMenuOpen(false)}></div>
              <div className="absolute right-0 top-12 w-48 bg-[var(--theme-white)] border border-gray-100 rounded-xl shadow-xl z-20 overflow-hidden">
                {categories.map(cat => (
                  <button 
                    key={cat}
                    onClick={() => handleCategorySelect(cat)}
                    className={`w-full text-left px-4 py-3 text-sm hover:bg-gray-50 ${selectedCategory === cat ? 'text-[var(--theme-primary)] font-bold bg-pink-50/50' : 'text-gray-700'}`}
                  >
                    {cat === 'All' ? 'All Categories' : cat}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      <div className="px-4 pb-3 bg-[#fdfbf7]">
        <div className="relative w-full">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search size={18} className="text-gray-400" />
          </div>
          <input
            type="text"
            className="w-full h-12 pl-10 pr-10 border-[1.5px] border-[var(--theme-primary)] bg-[var(--theme-white)] rounded-full text-sm text-[var(--theme-black)] outline-none focus:shadow-md transition-shadow shadow-sm placeholder-gray-400"
            placeholder="Search by product code or title..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {query && (
            <button onClick={() => setQuery('')} className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600">
              <X size={18} />
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 bg-[#fdfbf7]">
        {filteredProducts.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-gray-500">
            <p>No stock out products found.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {filteredProducts.map(product => (
              <div key={product.id} className="relative bg-[var(--theme-white)] rounded-xl overflow-hidden border border-gray-100 shadow-sm flex flex-col">
                <div className="relative aspect-square w-full overflow-hidden bg-gray-50">
                  <img src={product.thumbnail || product.image} alt={product.title} className="absolute inset-0 w-full h-full object-cover" />
                  <div className="absolute top-0 left-0 bg-[var(--theme-primary)] text-[var(--theme-white)] text-[10px] font-bold px-2 py-1 flex items-center rounded-br-lg shadow-sm">
                    <X size={10} className="mr-1" /> stock out
                  </div>
                </div>
                <div className="p-3">
                  <div className="text-xs text-gray-500 mb-1 flex items-center justify-between">
                    <span>ID: <span className="font-bold text-gray-700">{product.id}</span></span>
                  </div>
                  {product.stockOutDate && (
                    <div className="text-[10px] text-gray-400">
                      Out since: {format(new Date(product.stockOutDate), 'MMM d, yyyy')}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}
