import React, { useState, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  Download, 
  FileText, 
  FolderArchive, 
  CheckCircle2, 
  AlertCircle, 
  SlidersHorizontal,
  ChevronDown,
  Info,
  Sparkles,
  Image as ImageIcon,
  Eye,
  Settings2
} from 'lucide-react';
import JSZip from 'jszip';
import { Product, Category } from '../types';

interface FbZipExportModalProps {
  onClose: () => void;
  products: Product[];
  categories: Category[];
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
  // 1. Primary category name converted to UPPERCASE
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

  // 2. Selling price
  const price = Math.round(Number(product.price) || 0);

  // 3. MOQ-6 Price (Price - discount)
  const moqPrice = Math.max(0, price - moqDiscount);

  // Exact format:
  // {CATEGORY_NAME_IN_UPPERCASE}
  // ┈┈┈┈┈┈┈┈┈┈
  // {PRICE} TK / PER PIECES 
  // {MOQ_PRICE} TK / MOQ-6
  // ┈┈┈┈┈┈┈┈┈┈
  return `${categoryUpper}\n${DIVIDER_LINE}\n${price} TK / PER PIECES \n${moqPrice} TK / MOQ-6\n${DIVIDER_LINE}`;
}

/**
 * Helper to get extension from URL or Blob mime
 */
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

/**
 * Fetch original high-res image via internal CORS proxy or direct
 */
async function fetchHighResImageBlob(url: string): Promise<{ blob: Blob; ext: string } | null> {
  if (!url) return null;

  try {
    // 1. Handle base64 data URI
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

    // 2. Fetch via internal server proxy (/api/proxy_image) to bypass CORS and get original full-res file
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
      console.warn('Proxy fetch failed, attempting direct fetch...', proxyErr);
    }

    // 3. Fallback: direct fetch
    const directRes = await fetch(url, { mode: 'cors' });
    if (directRes.ok) {
      const blob = await directRes.blob();
      if (blob && blob.size > 0) {
        return { blob, ext: getExtension(url, blob) };
      }
    }
  } catch (e) {
    // 4. Ultimate fallback: Canvas drawing
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
  themePrimary = '#ff4d6d' 
}: FbZipExportModalProps) {
  const [moqDiscount, setMoqDiscount] = useState<number>(5);
  const [fallbackCategory, setFallbackCategory] = useState<string>('GENERAL');
  const [folderNaming, setFolderNaming] = useState<'sequential' | 'productId'>('sequential');
  const [maxImagesPerProduct, setMaxImagesPerProduct] = useState<number>(3);
  const [isCustomCount, setIsCustomCount] = useState<boolean>(false);
  const [showPreview, setShowPreview] = useState<boolean>(false);
  const [showAdvanced, setShowAdvanced] = useState<boolean>(false);
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

  const handleStartExport = async () => {
    if (inStockProducts.length === 0) {
      alert('No in-stock products found to export.');
      return;
    }

    cancelRef.current = false;
    setExportState('exporting');
    setProgressPercent(0);
    setStatusMessage('Initializing ZIP archive...');
    setErrorMessage('');

    try {
      const zip = new JSZip();
      const datasetFolder = zip.folder('export_dataset') || zip;
      
      const total = inStockProducts.length;
      let totalImages = 0;
      let completedProducts = 0;

      // Process in batches of 4 products to maintain responsive UI
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

          // 1. Generate formatted caption (text.txt)
          const caption = generateProductCaption(prod, categories, moqDiscount, fallbackCategory);
          folder.file('text.txt', caption);

          // 2. Collect ORIGINAL high-resolution image URLs (avoid thumbnails for max quality)
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
          // Fallback if main image was not present
          if (highResImgUrls.length === 0 && prod.image) {
            highResImgUrls.push(prod.image);
          }
          if (highResImgUrls.length === 0 && prod.thumbnail) {
            highResImgUrls.push(prod.thumbnail);
          }

          // Apply Max Images Per Product limiter
          const selectedImgUrls = maxImagesPerProduct > 0 
            ? highResImgUrls.slice(0, maxImagesPerProduct)
            : highResImgUrls;

          // 3. Download product images in original high quality
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
          setStatusMessage(`Packaging ${completedProducts}/${total}: "${prod.title.slice(0, 20)}..."`);
        }));

        // Allow browser UI to update
        await new Promise(r => setTimeout(r, 10));
      }

      if (cancelRef.current) {
        setExportState('idle');
        return;
      }

      // Generate final ZIP file
      setStatusMessage('Packaging and finalizing ZIP...');
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

      // Trigger automatic download
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
    <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto">
      <motion.div 
        initial={{ opacity: 0, y: 20, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.98 }}
        transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
        className="bg-[#10141d] border border-white/10 rounded-t-3xl sm:rounded-3xl w-full sm:max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[92dvh] sm:max-h-[85vh]"
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-white/10 flex justify-between items-center bg-[#151a24]">
          <div className="flex items-center gap-3">
            <div 
              className="w-9 h-9 rounded-xl flex items-center justify-center shadow-inner shrink-0"
              style={{ backgroundColor: `${themePrimary}25`, color: themePrimary }}
            >
              <FolderArchive size={19} strokeWidth={2.2} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
                  Download FB Zip
                </h2>
                <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-md bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
                  In-Stock
                </span>
              </div>
              <p className="text-[11px] text-gray-400">High-Res images &amp; captions for Auto-Sender</p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            disabled={exportState === 'exporting'}
            className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-gray-400 hover:text-white transition-colors disabled:opacity-30 cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 custom-scrollbar">
          
          {/* Compact 1-Line Status Metric Strip */}
          <div className="grid grid-cols-3 gap-2 bg-[#151a24] border border-white/5 rounded-2xl p-2.5 sm:p-3 text-center">
            <div className="flex flex-col">
              <span className="text-[10px] uppercase font-semibold text-emerald-400 flex items-center justify-center gap-1">
                <CheckCircle2 size={11} /> In-Stock
              </span>
              <span className="text-lg font-black text-white mt-0.5">{inStockProducts.length}</span>
            </div>

            <div className="flex flex-col border-x border-white/5">
              <span className="text-[10px] uppercase font-semibold text-gray-400 flex items-center justify-center gap-1">
                <AlertCircle size={11} /> Stock-Out
              </span>
              <span className="text-lg font-black text-gray-400 mt-0.5">{outOfStockCount}</span>
            </div>

            <div className="flex flex-col">
              <span className="text-[10px] uppercase font-semibold text-blue-400 flex items-center justify-center gap-1">
                <ImageIcon size={11} /> Photos
              </span>
              <span className="text-lg font-black text-blue-300 mt-0.5">~{estimatedImagesCount}</span>
            </div>
          </div>

          {/* Exporting Progress View */}
          {exportState === 'exporting' && (
            <div className="bg-[#151a24] border border-white/10 rounded-2xl p-5 flex flex-col items-center justify-center text-center space-y-3.5">
              <div 
                className="w-12 h-12 rounded-full border-3 border-t-transparent animate-spin flex items-center justify-center"
                style={{ borderColor: `${themePrimary}30`, borderTopColor: themePrimary }}
              />
              <div className="space-y-1 max-w-xs">
                <h3 className="text-sm font-bold text-white">Downloading Images &amp; Packaging</h3>
                <p className="text-[11px] text-gray-400 truncate">{statusMessage}</p>
              </div>

              {/* Progress Bar */}
              <div className="w-full max-w-xs space-y-1">
                <div className="flex justify-between text-[11px] font-mono text-gray-400">
                  <span>Progress</span>
                  <span className="font-bold text-white">{progressPercent}%</span>
                </div>
                <div className="w-full h-2 bg-black/60 rounded-full overflow-hidden border border-white/5">
                  <motion.div 
                    className="h-full rounded-full transition-all duration-200"
                    style={{ 
                      width: `${progressPercent}%`,
                      backgroundColor: themePrimary 
                    }}
                  />
                </div>
              </div>

              <button
                onClick={handleCancel}
                className="text-xs text-gray-400 hover:text-white px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 transition-colors mt-1"
              >
                Cancel
              </button>
            </div>
          )}

          {/* Success View */}
          {exportState === 'success' && (
            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-5 flex flex-col items-center justify-center text-center space-y-2.5">
              <div className="w-10 h-10 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                <CheckCircle2 size={24} />
              </div>
              <h3 className="text-base font-bold text-white">Download Ready!</h3>
              <p className="text-xs text-emerald-300">
                Downloaded <strong className="text-white">{exportedCount} products</strong> with <strong className="text-white">{totalImagesExported} high-res images</strong> and captions.
              </p>
              <div className="pt-2 flex gap-2 w-full">
                <button
                  onClick={() => setExportState('idle')}
                  className="flex-1 py-2.5 rounded-xl bg-white/10 text-white text-xs font-semibold hover:bg-white/15 transition-colors"
                >
                  Export Again
                </button>
                <button
                  onClick={onClose}
                  style={{ backgroundColor: themePrimary }}
                  className="flex-1 py-2.5 rounded-xl text-white text-xs font-bold shadow-md hover:brightness-110 transition-all"
                >
                  Done
                </button>
              </div>
            </div>
          )}

          {/* Error View */}
          {exportState === 'error' && (
            <div className="bg-rose-500/10 border border-rose-500/30 rounded-2xl p-4 flex items-start gap-3">
              <AlertCircle size={18} className="text-rose-400 shrink-0 mt-0.5" />
              <div className="space-y-1 flex-1">
                <h4 className="text-xs font-bold text-rose-300">Export Failed</h4>
                <p className="text-[11px] text-rose-400/90">{errorMessage}</p>
                <button
                  onClick={() => setExportState('idle')}
                  className="mt-1 text-xs font-semibold text-white underline"
                >
                  Try Again
                </button>
              </div>
            </div>
          )}

          {/* Controls Section (Idle State) */}
          {exportState === 'idle' && (
            <>
              {/* Max Pictures Limit Control (Touch friendly segmented buttons) */}
              <div className="bg-[#151a24] border border-white/10 rounded-2xl p-3.5 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <ImageIcon size={15} className="text-blue-400" />
                    <span className="text-xs font-bold text-white">Photos per Product</span>
                  </div>
                  <span className="text-[11px] font-mono text-blue-300/90 font-medium">
                    {maxImagesPerProduct === 0 ? 'All Photos' : `Max ${maxImagesPerProduct} Photos`}
                  </span>
                </div>

                {/* Segmented Pill Selector with 44px Touch Targets */}
                <div className="grid grid-cols-5 gap-1.5 p-1 bg-black/40 rounded-xl border border-white/5">
                  {[1, 2, 3, 5, 0].map((count) => {
                    const isSelected = !isCustomCount && maxImagesPerProduct === count;
                    return (
                      <button
                        key={count}
                        type="button"
                        onClick={() => {
                          setIsCustomCount(false);
                          setMaxImagesPerProduct(count);
                        }}
                        className={`h-9 rounded-lg text-xs font-bold transition-all flex items-center justify-center cursor-pointer ${
                          isSelected
                            ? 'bg-blue-600 text-white shadow-sm'
                            : 'text-gray-400 hover:text-white hover:bg-white/5'
                        }`}
                      >
                        {count === 0 ? 'All' : count}
                      </button>
                    );
                  })}
                </div>

                {/* Custom Count Toggle / Input */}
                <div className="flex items-center justify-between pt-0.5">
                  <button
                    type="button"
                    onClick={() => setIsCustomCount(!isCustomCount)}
                    className="text-[11px] text-gray-400 hover:text-blue-300 flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    <span>{isCustomCount ? '▼ Hide custom limit' : '✎ Set custom number'}</span>
                  </button>

                  <span className="text-[10px] text-gray-500">
                    {maxImagesPerProduct === 0 
                      ? 'Exports every uploaded image' 
                      : `Exports top ${maxImagesPerProduct} pictures + caption`}
                  </span>
                </div>

                {isCustomCount && (
                  <div className="pt-1 flex items-center gap-2">
                    <input 
                      type="number"
                      inputMode="numeric"
                      min="1"
                      max="50"
                      value={maxImagesPerProduct === 0 ? '' : maxImagesPerProduct}
                      onChange={(e) => {
                        const val = parseInt(e.target.value);
                        setMaxImagesPerProduct(isNaN(val) ? 1 : Math.max(1, Math.min(50, val)));
                      }}
                      placeholder="e.g. 4"
                      className="w-24 bg-black/50 text-white text-center font-bold border border-blue-500/50 rounded-xl py-1.5 text-xs outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <span className="text-[11px] text-gray-300">photos maximum per folder</span>
                  </div>
                )}
              </div>

              {/* Collapsible Live text.txt Caption Preview */}
              <div className="border border-white/10 rounded-2xl overflow-hidden bg-[#151a24]">
                <button
                  type="button"
                  onClick={() => setShowPreview(!showPreview)}
                  className="w-full p-3 sm:p-3.5 flex items-center justify-between text-xs font-semibold text-gray-200 hover:text-white transition-colors cursor-pointer"
                >
                  <span className="flex items-center gap-2">
                    <FileText size={15} className="text-cyan-400" />
                    <span>Caption Preview (text.txt)</span>
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-cyan-400 bg-cyan-400/10 px-2 py-0.5 rounded-full border border-cyan-400/20">
                      {showPreview ? 'Hide' : 'View'}
                    </span>
                    <ChevronDown 
                      size={14} 
                      className={`text-gray-400 transition-transform duration-200 ${showPreview ? 'rotate-180' : ''}`} 
                    />
                  </div>
                </button>

                <AnimatePresence>
                  {showPreview && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="border-t border-white/5 p-3.5 space-y-2.5 bg-black/20"
                    >
                      {inStockProducts.length > 1 && (
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] text-gray-400 shrink-0">Sample:</span>
                          <select
                            value={selectedPreviewIndex}
                            onChange={(e) => setSelectedPreviewIndex(Number(e.target.value))}
                            className="flex-1 text-xs bg-[#10141d] text-gray-200 border border-white/10 rounded-lg px-2 py-1 outline-none truncate"
                          >
                            {inStockProducts.slice(0, 20).map((p, idx) => (
                              <option key={p.id || idx} value={idx}>
                                {idx + 1}. {p.title}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      {sampleProduct ? (
                        <div className="bg-black/60 border border-white/10 rounded-xl p-3 font-mono text-xs text-emerald-300 whitespace-pre-wrap leading-relaxed shadow-inner">
                          {sampleCaption}
                        </div>
                      ) : (
                        <div className="text-center py-2 text-xs text-gray-400">
                          No in-stock products available.
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Advanced Options Accordion (Pricing discount & category) */}
              <div className="border border-white/10 rounded-2xl overflow-hidden bg-[#151a24]">
                <button
                  type="button"
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className="w-full p-3 sm:p-3.5 flex items-center justify-between text-xs font-semibold text-gray-300 hover:text-white transition-colors cursor-pointer"
                >
                  <span className="flex items-center gap-2">
                    <Settings2 size={15} className="text-pink-400" />
                    <span>Pricing &amp; Folder Options</span>
                  </span>
                  <ChevronDown 
                    size={14} 
                    className={`text-gray-400 transition-transform duration-200 ${showAdvanced ? 'rotate-180' : ''}`} 
                  />
                </button>

                <AnimatePresence>
                  {showAdvanced && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="border-t border-white/5 p-3.5 space-y-3 bg-black/20 text-xs"
                    >
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-gray-300 font-medium">MOQ-6 Discount (TK)</label>
                          <input 
                            type="number"
                            inputMode="numeric"
                            min="0"
                            value={moqDiscount}
                            onChange={(e) => setMoqDiscount(Math.max(0, parseInt(e.target.value) || 0))}
                            className="w-full bg-[#10141d] text-white border border-white/10 rounded-xl px-3 py-1.5 font-mono text-xs focus:border-pink-500 outline-none"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-gray-300 font-medium">Fallback Category</label>
                          <input 
                            type="text"
                            value={fallbackCategory}
                            onChange={(e) => setFallbackCategory(e.target.value.toUpperCase())}
                            className="w-full bg-[#10141d] text-white border border-white/10 rounded-xl px-3 py-1.5 uppercase font-mono text-xs focus:border-pink-500 outline-none"
                            placeholder="GENERAL"
                          />
                        </div>
                      </div>

                      <div className="space-y-1.5 pt-1">
                        <label className="text-gray-300 font-medium">Folder Numbering</label>
                        <div className="flex gap-4">
                          <label className="flex items-center gap-1.5 cursor-pointer text-gray-300 text-xs">
                            <input 
                              type="radio" 
                              name="folderNaming" 
                              checked={folderNaming === 'sequential'} 
                              onChange={() => setFolderNaming('sequential')}
                              className="accent-pink-500"
                            />
                            <span>1, 2, 3...</span>
                          </label>
                          <label className="flex items-center gap-1.5 cursor-pointer text-gray-300 text-xs">
                            <input 
                              type="radio" 
                              name="folderNaming" 
                              checked={folderNaming === 'productId'} 
                              onChange={() => setFolderNaming('productId')}
                              className="accent-pink-500"
                            />
                            <span>Product ID (P001...)</span>
                          </label>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </>
          )}

        </div>

        {/* Footer Action Bar with Mobile-First High Touch Targets */}
        <div className="p-3.5 sm:p-4 border-t border-white/10 bg-[#151a24] flex items-center gap-2.5 pb-[max(0.875rem,env(safe-area-inset-bottom))]">
          <button 
            onClick={onClose}
            disabled={exportState === 'exporting'}
            className="h-11 sm:h-12 px-4 rounded-xl border border-white/10 text-gray-300 hover:text-white font-semibold hover:bg-white/5 transition-colors text-xs sm:text-sm disabled:opacity-40 cursor-pointer"
          >
            Close
          </button>

          {exportState !== 'exporting' && exportState !== 'success' && (
            <button 
              onClick={handleStartExport}
              disabled={inStockProducts.length === 0}
              style={{ backgroundColor: themePrimary }}
              className="flex-1 h-11 sm:h-12 px-4 rounded-xl font-bold text-xs sm:text-sm text-white hover:brightness-110 active:scale-[0.99] transition-all shadow-lg flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Download size={16} strokeWidth={2.2} />
              <span className="truncate">Download FB Zip ({inStockProducts.length})</span>
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
}
