import React, { useState, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ChevronLeft, 
  Download, 
  FileText, 
  FolderArchive, 
  CheckCircle2, 
  AlertCircle, 
  Image as ImageIcon,
  DollarSign,
  FolderTree,
  Check,
  Sparkles,
  Layers,
  ArrowDownToLine,
  RefreshCw
} from 'lucide-react';
import JSZip from 'jszip';
import { Product, Category, WebsiteSettings } from '../types';

interface FbZipExportModalProps {
  onClose: () => void;
  products: Product[];
  categories: Category[];
  websiteSettings?: WebsiteSettings;
  themePrimary?: string;
}

// Exact dotted line divider specified in prompt: 10 light quadruple dash characters
const DIVIDER_LINE = '┈┈┈┈┈┈┈┈┈┈';

/**
 * Checks if a product is currently in-stock
 */
export function isProductInStock(product: Product): boolean {
  if (product.variants && product.variants.length > 0) {
    return product.variants.some((v: any) => {
      if (v.isVisible === false) return false;
      return (v.stock !== undefined && v.stock !== null) ? Number(v.stock) > 0 : true;
    });
  }
  return (product.stock !== undefined && product.stock !== null) ? Number(product.stock) > 0 : false;
}

/**
 * Generates the text.txt content according to FB Auto-Sender format specification
 */
export function generateProductCaption(
  product: Product,
  categories: Category[],
  moqDiscount: number = 5,
  fallbackCategory: string = 'GENERAL'
): string {
  let catName = fallbackCategory;
  if (product.category) {
    const foundCat = categories.find(
      c => c.id === product.category || c.name.toLowerCase() === product.category.toLowerCase()
    );
    catName = (foundCat?.name || product.category).trim();
  }
  if (!catName || catName.toLowerCase() === 'uncategorized') {
    catName = fallbackCategory;
  }
  const categoryUpper = catName.toUpperCase();

  const price = Math.round(Number(product.price) || 0);
  const moqPrice = Math.max(0, price - moqDiscount);

  return `${categoryUpper}\n${DIVIDER_LINE}\n${price} TK / PER PIECES \n${moqPrice} TK / MOQ-6\n${DIVIDER_LINE}`;
}

function getExtension(url: string, blob?: Blob): string {
  if (blob && blob.type) {
    if (blob.type.includes('png')) return '.png';
    if (blob.type.includes('webp')) return '.webp';
    if (blob.type.includes('jpeg') || blob.type.includes('jpg')) return '.jpg';
    if (blob.type.includes('gif')) return '.gif';
  }
  const cleanUrl = url.split('?')[0].split('#')[0];
  const match = cleanUrl.match(/\.(jpg|jpeg|png|webp|gif|avif)$/i);
  if (match) {
    return match[0].toLowerCase();
  }
  return '.webp';
}

async function fetchHighResImageBlob(url: string): Promise<{ blob: Blob; ext: string } | null> {
  if (!url) return null;

  try {
    if (url.startsWith('data:image/')) {
      const parts = url.split(',');
      const mime = parts[0].match(/:(.*?);/)?.[1] || 'image/webp';
      const bstr = atob(parts[1]);
      let n = bstr.length;
      const u8arr = new Uint8Array(n);
      while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
      }
      const blob = new Blob([u8arr], { type: mime });
      return { blob, ext: getExtension(url, blob) };
    }

    const proxyEndpoint = `/api/proxy_image?url=${encodeURIComponent(url)}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);

    try {
      const proxyRes = await fetch(proxyEndpoint, { signal: controller.signal });
      clearTimeout(timeoutId);
      if (proxyRes.ok) {
        const blob = await proxyRes.blob();
        if (blob && blob.size > 0) {
          return { blob, ext: getExtension(url, blob) };
        }
      }
    } catch (proxyErr) {
      console.warn('Proxy fetch fallback to direct fetch', proxyErr);
    }

    const directRes = await fetch(url, { mode: 'cors' });
    if (directRes.ok) {
      const blob = await directRes.blob();
      if (blob && blob.size > 0) {
        return { blob, ext: getExtension(url, blob) };
      }
    }
  } catch (e) {
    try {
      const blob = await new Promise<Blob | null>((resolve) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          try {
            const canvas = document.createElement('canvas');
            canvas.width = img.naturalWidth || img.width;
            canvas.height = img.naturalHeight || img.height;
            const ctx = canvas.getContext('2d');
            if (!ctx) return resolve(null);
            ctx.drawImage(img, 0, 0);
            canvas.toBlob((b) => resolve(b), 'image/webp', 0.95);
          } catch {
            resolve(null);
          }
        };
        img.onerror = () => resolve(null);
        img.src = url;
      });

      if (blob && blob.size > 0) {
        return { blob, ext: '.webp' };
      }
    } catch {
      // Ignored
    }
  }

  return null;
}

export default function FbZipExportModal({ 
  onClose, 
  products, 
  categories, 
  websiteSettings,
  themePrimary = '#ff4d6d' 
}: FbZipExportModalProps) {
  const primaryColor = websiteSettings?.themeColors?.primary || themePrimary || '#ff4d6d';

  const [moqDiscount, setMoqDiscount] = useState<number>(5);
  const [fallbackCategory, setFallbackCategory] = useState<string>('GENERAL');
  const [folderNaming, setFolderNaming] = useState<'sequential' | 'productId'>('sequential');
  const [maxImagesPerProduct, setMaxImagesPerProduct] = useState<number>(3);
  const [customImageLimit, setCustomImageLimit] = useState<string>('3');
  const [isCustomMode, setIsCustomMode] = useState<boolean>(false);
  const [selectedPreviewIndex, setSelectedPreviewIndex] = useState<number>(0);

  const [exportState, setExportState] = useState<'idle' | 'exporting' | 'success' | 'error'>('idle');
  const [progressPercent, setProgressPercent] = useState<number>(0);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [exportedCount, setExportedCount] = useState<number>(0);
  const [totalImagesExported, setTotalImagesExported] = useState<number>(0);
  const [errorMessage, setErrorMessage] = useState<string>('');

  const cancelRef = useRef<boolean>(false);

  // Filter in-stock products
  const { inStockProducts, outOfStockCount } = useMemo(() => {
    const inStock: Product[] = [];
    let outCount = 0;

    for (const p of products) {
      if (isProductInStock(p)) {
        inStock.push(p);
      } else {
        outCount++;
      }
    }

    return { inStockProducts: inStock, outOfStockCount: outCount };
  }, [products]);

  // Preview product calculation
  const sampleProduct = inStockProducts[selectedPreviewIndex] || inStockProducts[0];
  const sampleCaption = useMemo(() => {
    if (!sampleProduct) return '';
    return generateProductCaption(sampleProduct, categories, moqDiscount, fallbackCategory);
  }, [sampleProduct, categories, moqDiscount, fallbackCategory]);

  // Estimate total images
  const estimatedImagesCount = useMemo(() => {
    let count = 0;
    for (const p of inStockProducts) {
      let prodImgCount = 0;
      if (p.image) prodImgCount++;
      if (Array.isArray(p.images)) {
        for (const img of p.images) {
          if (img && img !== p.image) prodImgCount++;
        }
      }
      if (prodImgCount === 0 && p.thumbnail) prodImgCount++;
      const limited = maxImagesPerProduct > 0 ? Math.min(prodImgCount, maxImagesPerProduct) : prodImgCount;
      count += limited;
    }
    return count;
  }, [inStockProducts, maxImagesPerProduct]);

  const handleSelectPreset = (count: number) => {
    setIsCustomMode(false);
    setMaxImagesPerProduct(count);
  };

  const handleCustomChange = (val: string) => {
    setCustomImageLimit(val);
    const parsed = parseInt(val, 10);
    if (!isNaN(parsed) && parsed > 0) {
      setMaxImagesPerProduct(Math.min(50, parsed));
    } else if (val === '0') {
      setMaxImagesPerProduct(0);
    }
  };

  const handleStartExport = async () => {
    if (inStockProducts.length === 0) {
      alert('No in-stock products found to export.');
      return;
    }

    cancelRef.current = false;
    setExportState('exporting');
    setProgressPercent(0);
    setStatusMessage('Preparing ZIP file...');
    setErrorMessage('');

    try {
      const zip = new JSZip();
      const datasetFolder = zip.folder('export_dataset') || zip;
      
      const total = inStockProducts.length;
      let totalImages = 0;
      let completedProducts = 0;

      const CONCURRENCY = 4;
      for (let i = 0; i < total; i += CONCURRENCY) {
        if (cancelRef.current) {
          setExportState('idle');
          return;
        }

        const batch = inStockProducts.slice(i, i + CONCURRENCY);
        
        await Promise.all(batch.map(async (prod, batchOffset) => {
          const productIndex = i + batchOffset;
          const folderName = folderNaming === 'sequential' 
            ? `${productIndex + 1}` 
            : `${prod.id || productIndex + 1}`;

          const folder = datasetFolder.folder(folderName);
          if (!folder) return;

          // 1. Write text.txt
          const caption = generateProductCaption(prod, categories, moqDiscount, fallbackCategory);
          folder.file('text.txt', caption);

          // 2. Collect high-res photos
          const highResImgUrls: string[] = [];
          if (prod.image && !prod.image.includes('thumb_')) {
            highResImgUrls.push(prod.image);
          }
          if (Array.isArray(prod.images)) {
            for (const img of prod.images) {
              if (img && !img.includes('thumb_') && !highResImgUrls.includes(img)) {
                highResImgUrls.push(img);
              }
            }
          }
          if (highResImgUrls.length === 0 && prod.image) {
            highResImgUrls.push(prod.image);
          }
          if (highResImgUrls.length === 0 && prod.thumbnail) {
            highResImgUrls.push(prod.thumbnail);
          }

          const selectedImgUrls = maxImagesPerProduct > 0 
            ? highResImgUrls.slice(0, maxImagesPerProduct)
            : highResImgUrls;

          // 3. Download image blobs
          let imgSeq = 1;
          for (const url of selectedImgUrls) {
            if (cancelRef.current) return;
            const res = await fetchHighResImageBlob(url);
            if (res && res.blob) {
              const filename = `image_${imgSeq}${res.ext}`;
              folder.file(filename, res.blob);
              totalImages++;
              imgSeq++;
            }
          }

          completedProducts++;
          const pct = Math.round((completedProducts / total) * 90);
          setProgressPercent(pct);
          setStatusMessage(`Packaging product ${completedProducts} of ${total}: "${prod.title.slice(0, 22)}..."`);
        }));

        await new Promise(r => setTimeout(r, 10));
      }

      if (cancelRef.current) {
        setExportState('idle');
        return;
      }

      setStatusMessage('Creating high-resolution ZIP package...');
      setProgressPercent(95);

      const zipBlob = await zip.generateAsync(
        { 
          type: 'blob', 
          compression: 'DEFLATE', 
          compressionOptions: { level: 6 } 
        }, 
        (metadata) => {
          setProgressPercent(95 + Math.round(metadata.percent * 0.05));
        }
      );

      const timestamp = new Date().toISOString().slice(0, 10);
      const downloadUrl = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `fb_instock_dataset_${timestamp}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(downloadUrl);

      setExportedCount(completedProducts);
      setTotalImagesExported(totalImages);
      setProgressPercent(100);
      setExportState('success');
    } catch (err: any) {
      console.error('FB ZIP Export error:', err);
      setErrorMessage(err?.message || 'An error occurred during ZIP creation.');
      setExportState('error');
    }
  };

  const handleCancel = () => {
    cancelRef.current = true;
    setExportState('idle');
  };

  return (
    <div className="fixed inset-0 z-[100] bg-[var(--dash-bg)] text-[#e2e8f0] flex flex-col font-sans overflow-hidden md:left-[240px]">
      
      {/* Full-Screen Top Navigation Bar */}
      <div className="flex items-center justify-between p-4 border-b border-[var(--dash-border)] bg-[var(--dash-card)] shrink-0 md:px-8 md:py-4">
        <div className="flex items-center gap-2">
          <button 
            onClick={onClose} 
            className="p-2 -ml-2 text-white hover:text-gray-300 transition-colors rounded-full hover:bg-white/5 cursor-pointer"
          >
            <ChevronLeft size={24} />
          </button>
          <div className="flex items-center gap-2.5">
            <div 
              className="w-8 h-8 rounded-lg flex items-center justify-center shadow-sm"
              style={{ backgroundColor: `${primaryColor}20`, color: primaryColor }}
            >
              <FolderArchive size={18} strokeWidth={2.2} />
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-bold text-white tracking-wide flex items-center gap-2">
                Download FB Zip
                <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">
                  In-Stock
                </span>
              </h1>
            </div>
          </div>
        </div>

        {/* Top Header Action Button */}
        <button 
          onClick={handleStartExport}
          disabled={exportState === 'exporting' || inStockProducts.length === 0}
          style={{ backgroundColor: primaryColor, color: '#ffffff' }}
          className="flex items-center gap-2 px-4 sm:px-5 py-2 sm:py-2.5 rounded-xl font-bold text-xs sm:text-sm hover:brightness-105 active:scale-95 transition-all shadow-md cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {exportState === 'exporting' ? (
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <Download size={16} strokeWidth={2.5} />
          )}
          <span>{exportState === 'exporting' ? 'Exporting...' : 'Download ZIP'}</span>
        </button>
      </div>

      {/* Main Full-Screen Scrollable Content */}
      <div className="flex-1 overflow-y-auto px-4 py-5 md:p-8 space-y-6 max-w-3xl mx-auto w-full pb-28 custom-scrollbar">

        {/* Export Progress Notification (Visible during active export) */}
        {exportState === 'exporting' && (
          <div className="bg-[var(--dash-card)] rounded-2xl p-5 md:p-6 border border-blue-500/40 shadow-lg space-y-4 animate-in fade-in">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center">
                  <RefreshCw size={16} className="animate-spin" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Downloading Images &amp; Building ZIP</h3>
                  <p className="text-xs text-gray-400 truncate max-w-xs sm:max-w-md">{statusMessage}</p>
                </div>
              </div>
              <span className="font-mono text-sm font-bold text-blue-400">{progressPercent}%</span>
            </div>

            <div className="w-full h-2.5 bg-black/40 rounded-full overflow-hidden border border-white/5">
              <motion.div 
                className="h-full rounded-full bg-blue-500 transition-all duration-200"
                style={{ width: `${progressPercent}%` }}
              />
            </div>

            <div className="flex justify-end">
              <button
                onClick={handleCancel}
                className="text-xs text-gray-400 hover:text-white px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
              >
                Cancel Export
              </button>
            </div>
          </div>
        )}

        {/* Export Success Notification */}
        {exportState === 'success' && (
          <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-5 md:p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3 text-center sm:text-left">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                <CheckCircle2 size={22} />
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-bold text-white">ZIP Archive Downloaded Successfully!</h3>
                <p className="text-xs text-emerald-300">
                  Exported {exportedCount} in-stock products with {totalImagesExported} high-resolution photos and captions.
                </p>
              </div>
            </div>
            <button
              onClick={() => setExportState('idle')}
              className="px-4 py-2 rounded-xl bg-white/10 text-white text-xs font-semibold hover:bg-white/15 transition-colors shrink-0"
            >
              Export Again
            </button>
          </div>
        )}

        {/* Export Error Notification */}
        {exportState === 'error' && (
          <div className="bg-rose-500/10 border border-rose-500/30 rounded-2xl p-4 flex items-start gap-3">
            <AlertCircle size={20} className="text-rose-400 shrink-0 mt-0.5" />
            <div className="space-y-1 flex-1">
              <h4 className="text-sm font-bold text-rose-300">Export Failed</h4>
              <p className="text-xs text-rose-400/90">{errorMessage}</p>
              <button
                onClick={() => setExportState('idle')}
                className="mt-1 text-xs font-semibold text-white underline"
              >
                Try Again
              </button>
            </div>
          </div>
        )}

        {/* Section 1: Stock Status & Overview Cards */}
        <div className="grid grid-cols-3 gap-3 md:gap-4">
          <div className="bg-[var(--dash-card)] rounded-2xl p-4 border border-[var(--dash-border)] shadow-sm flex flex-col justify-between">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400 uppercase tracking-wide">
              <CheckCircle2 size={14} /> In-Stock
            </div>
            <div className="mt-3">
              <div className="text-2xl sm:text-3xl font-black text-white">{inStockProducts.length}</div>
              <div className="text-[11px] text-gray-400 mt-0.5">Ready to export</div>
            </div>
          </div>

          <div className="bg-[var(--dash-card)] rounded-2xl p-4 border border-[var(--dash-border)] shadow-sm flex flex-col justify-between">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wide">
              <AlertCircle size={14} className="text-amber-400/80" /> Stock Out
            </div>
            <div className="mt-3">
              <div className="text-2xl sm:text-3xl font-black text-gray-300">{outOfStockCount}</div>
              <div className="text-[11px] text-gray-500 mt-0.5">Auto-skipped</div>
            </div>
          </div>

          <div className="bg-[var(--dash-card)] rounded-2xl p-4 border border-[var(--dash-border)] shadow-sm flex flex-col justify-between">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-blue-400 uppercase tracking-wide">
              <ImageIcon size={14} /> High-Res Pics
            </div>
            <div className="mt-3">
              <div className="text-2xl sm:text-3xl font-black text-blue-300">~{estimatedImagesCount}</div>
              <div className="text-[11px] text-gray-400 mt-0.5">Images total</div>
            </div>
          </div>
        </div>

        {/* Section 2: Photo Export Settings (Max Photos per Product) */}
        <div className="bg-[var(--dash-card)] rounded-2xl p-5 md:p-6 border border-[var(--dash-border)] shadow-md space-y-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center shrink-0">
                <ImageIcon size={20} />
              </div>
              <div>
                <h2 className="text-sm sm:text-base font-bold text-white">Photos per Product</h2>
                <p className="text-xs text-gray-400 mt-0.5">
                  Limit how many gallery photos to include per product folder.
                </p>
              </div>
            </div>
            <span className="text-xs font-mono text-blue-400 font-bold bg-blue-500/10 px-2.5 py-1 rounded-lg border border-blue-500/20 shrink-0">
              {maxImagesPerProduct === 0 ? 'All Photos' : `${maxImagesPerProduct} Max`}
            </span>
          </div>

          {/* Segmented Preset Selector */}
          <div className="space-y-3 pt-1">
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {[
                { label: '1 Photo', val: 1 },
                { label: '2 Photos', val: 2 },
                { label: '3 Photos', val: 3 },
                { label: '5 Photos', val: 5 },
                { label: 'All Photos', val: 0 },
                { label: 'Custom', val: -1 }
              ].map((item) => {
                const isSelected = item.val === -1 ? isCustomMode : (!isCustomMode && maxImagesPerProduct === item.val);
                return (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => {
                      if (item.val === -1) {
                        setIsCustomMode(true);
                      } else {
                        handleSelectPreset(item.val);
                      }
                    }}
                    className={`py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center cursor-pointer border ${
                      isSelected
                        ? 'bg-blue-600 text-white border-blue-500 shadow-md'
                        : 'bg-[var(--dash-bg)] text-gray-300 border-[var(--dash-border)] hover:bg-white/5'
                    }`}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>

            {/* Custom Input Field (Shown when Custom is selected) */}
            {isCustomMode && (
              <div className="bg-[var(--dash-bg)] border border-blue-500/30 rounded-xl p-3 flex items-center gap-3 animate-in fade-in">
                <span className="text-xs text-gray-300 font-medium">Custom Quantity:</span>
                <input 
                  type="number"
                  inputMode="numeric"
                  min="1"
                  max="50"
                  value={customImageLimit}
                  onChange={(e) => handleCustomChange(e.target.value)}
                  placeholder="e.g. 4"
                  className="w-20 bg-[var(--dash-card)] text-white text-center font-bold border border-[var(--dash-border)] rounded-lg py-1.5 text-xs outline-none focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-xs text-gray-400">photos max per product</span>
              </div>
            )}

            <div className="flex items-center gap-1.5 text-[11px] text-gray-400 pt-1">
              <CheckCircle2 size={13} className="text-blue-400" />
              <span>All images are exported in original full resolution (no compression/blur).</span>
            </div>
          </div>
        </div>

        {/* Section 3: Caption & Pricing Format (text.txt) */}
        <div className="bg-[var(--dash-card)] rounded-2xl p-5 md:p-6 border border-[var(--dash-border)] shadow-md space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0">
              <FileText size={20} />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-white">FB Caption &amp; Price Rules</h2>
              <p className="text-xs text-gray-400 mt-0.5">
                Formatted specifically for FB Messenger Auto-Sender app.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-300">MOQ-6 Discount Amount (TK)</label>
              <div className="relative">
                <input 
                  type="number"
                  inputMode="numeric"
                  min="0"
                  max="500"
                  value={moqDiscount}
                  onChange={(e) => setMoqDiscount(Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-full bg-[var(--dash-bg)] text-white border border-[var(--dash-border)] rounded-xl px-3.5 py-2.5 font-mono text-xs focus:ring-2 focus:ring-emerald-500 outline-none"
                />
                <span className="absolute right-3 top-2.5 text-xs text-gray-400">TK OFF</span>
              </div>
              <p className="text-[11px] text-gray-500">Deducted from selling price for MOQ-6 caption (Default: 5 TK).</p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-300">Fallback Category Name</label>
              <input 
                type="text"
                value={fallbackCategory}
                onChange={(e) => setFallbackCategory(e.target.value.toUpperCase())}
                className="w-full bg-[var(--dash-bg)] text-white border border-[var(--dash-border)] rounded-xl px-3.5 py-2.5 uppercase font-mono text-xs focus:ring-2 focus:ring-emerald-500 outline-none"
                placeholder="GENERAL"
              />
              <p className="text-[11px] text-gray-500">Used if a product has no category (Default: GENERAL).</p>
            </div>
          </div>

          {/* Live Caption Code Preview */}
          <div className="bg-[var(--dash-bg)] border border-[var(--dash-border)] rounded-xl p-4 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-gray-300 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles size={13} className="text-emerald-400" />
                Live text.txt Preview
              </span>
              {inStockProducts.length > 1 && (
                <select
                  value={selectedPreviewIndex}
                  onChange={(e) => setSelectedPreviewIndex(Number(e.target.value))}
                  className="text-xs bg-[var(--dash-card)] text-gray-200 border border-[var(--dash-border)] rounded-lg px-2.5 py-1 outline-none max-w-[200px] truncate"
                >
                  {inStockProducts.slice(0, 20).map((p, idx) => (
                    <option key={p.id || idx} value={idx}>
                      {idx + 1}. {p.title}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div className="bg-black/60 border border-white/10 rounded-xl p-3.5 font-mono text-xs text-emerald-300 whitespace-pre-wrap leading-relaxed shadow-inner">
              {sampleCaption || 'No in-stock products available for preview.'}
            </div>
          </div>
        </div>

        {/* Section 4: Folder Organization & Structure */}
        <div className="bg-[var(--dash-card)] rounded-2xl p-5 md:p-6 border border-[var(--dash-border)] shadow-md space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-pink-500/10 text-pink-400 flex items-center justify-center shrink-0">
              <FolderTree size={20} />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-white">ZIP Folder Structure</h2>
              <p className="text-xs text-gray-400 mt-0.5">
                Choose how product subfolders inside the ZIP archive should be named.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <label 
              onClick={() => setFolderNaming('sequential')}
              className={`p-3.5 rounded-xl border cursor-pointer flex items-center gap-3 transition-all ${
                folderNaming === 'sequential' 
                  ? 'bg-pink-500/10 border-pink-500 text-white' 
                  : 'bg-[var(--dash-bg)] border-[var(--dash-border)] text-gray-300 hover:bg-white/5'
              }`}
            >
              <input 
                type="radio" 
                name="folderNaming" 
                checked={folderNaming === 'sequential'} 
                onChange={() => setFolderNaming('sequential')}
                className="accent-pink-500"
              />
              <div>
                <div className="text-xs font-bold">Sequential Numbers (1, 2, 3...)</div>
                <div className="text-[11px] text-gray-400 mt-0.5">Recommended for FB Auto-Sender</div>
              </div>
            </label>

            <label 
              onClick={() => setFolderNaming('productId')}
              className={`p-3.5 rounded-xl border cursor-pointer flex items-center gap-3 transition-all ${
                folderNaming === 'productId' 
                  ? 'bg-pink-500/10 border-pink-500 text-white' 
                  : 'bg-[var(--dash-bg)] border-[var(--dash-border)] text-gray-300 hover:bg-white/5'
              }`}
            >
              <input 
                type="radio" 
                name="folderNaming" 
                checked={folderNaming === 'productId'} 
                onChange={() => setFolderNaming('productId')}
                className="accent-pink-500"
              />
              <div>
                <div className="text-xs font-bold">Product IDs (P001, P002...)</div>
                <div className="text-[11px] text-gray-400 mt-0.5">Uses your internal product SKU/ID</div>
              </div>
            </label>
          </div>

          {/* Directory Visual Tree */}
          <div className="bg-[var(--dash-bg)] border border-[var(--dash-border)] rounded-xl p-3.5 font-mono text-xs text-gray-400 space-y-1">
            <div>📁 <span className="text-white">export_dataset/</span></div>
            <div className="pl-4">├── 📁 <span className="text-cyan-300">{folderNaming === 'sequential' ? '1/' : 'P001/'}</span> (Product 1)</div>
            <div className="pl-8">├── 🖼️ <span className="text-amber-200">image_1.webp</span> (Original High-Res)</div>
            {maxImagesPerProduct !== 1 && (
              <div className="pl-8">├── 🖼️ <span className="text-amber-200">image_2.webp</span> (Gallery Photo)</div>
            )}
            <div className="pl-8">└── 📄 <span className="text-emerald-300">text.txt</span> (Formatted caption)</div>
            <div className="pl-4">├── 📁 <span className="text-cyan-300">{folderNaming === 'sequential' ? '2/' : 'P002/'}</span> (Product 2)</div>
            <div className="pl-8">└── ...</div>
          </div>
        </div>

      </div>

      {/* Floating Bottom Action Bar for Mobile & Desktop */}
      <div className="fixed bottom-0 left-0 right-0 md:left-[240px] p-4 bg-[var(--dash-card)] border-t border-[var(--dash-border)] flex items-center justify-between gap-3 z-[110] shadow-2xl pb-[max(1rem,env(safe-area-inset-bottom))]">
        <button 
          onClick={onClose}
          disabled={exportState === 'exporting'}
          className="px-5 py-3 rounded-xl border border-[var(--dash-border)] text-gray-300 hover:text-white font-semibold hover:bg-white/5 transition-colors text-xs sm:text-sm disabled:opacity-40 cursor-pointer"
        >
          Back
        </button>

        <button 
          onClick={handleStartExport}
          disabled={exportState === 'exporting' || inStockProducts.length === 0}
          style={{ backgroundColor: primaryColor, color: '#ffffff' }}
          className="flex-1 max-w-md py-3 px-6 rounded-xl font-bold text-xs sm:text-sm hover:brightness-105 active:scale-98 transition-all shadow-lg flex items-center justify-center gap-2.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {exportState === 'exporting' ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              <span>Exporting {progressPercent}%...</span>
            </>
          ) : (
            <>
              <Download size={18} strokeWidth={2.2} />
              <span>Download FB Zip ({inStockProducts.length} In-Stock Products)</span>
            </>
          )}
        </button>
      </div>

    </div>
  );
}
