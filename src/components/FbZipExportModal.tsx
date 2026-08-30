import React, { useState, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  Download, 
  FileText, 
  FolderArchive, 
  CheckCircle2, 
  AlertCircle, 
  Layers, 
  SlidersHorizontal,
  ChevronDown,
  Info,
  Sparkles,
  Image as ImageIcon
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
          setStatusMessage(`Packaging product ${completedProducts}/${total}: "${prod.title.slice(0, 24)}..."`);
        }));

        // Allow browser UI to update
        await new Promise(r => setTimeout(r, 10));
      }

      if (cancelRef.current) {
        setExportState('idle');
        return;
      }

      // Generate final ZIP file
      setStatusMessage('Compressing and generating high-res .ZIP package...');
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
    <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-md flex justify-center items-center p-3 sm:p-4 overflow-y-auto">
      <motion.div 
        initial={{ opacity: 0, scale: 0.96, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 10 }}
        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
        className="bg-[var(--dash-card)] border border-[var(--dash-border)]/80 rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] my-auto"
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-[var(--dash-border)]/60 flex justify-between items-center bg-[var(--dash-bg)]/60">
          <div className="flex items-center gap-3">
            <div 
              className="w-10 h-10 rounded-2xl flex items-center justify-center shadow-md shadow-black/20"
              style={{ backgroundColor: `${themePrimary}20`, color: themePrimary }}
            >
              <FolderArchive size={22} strokeWidth={2} />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
                Download FB Zip
                <span className="text-[11px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  In-Stock Only
                </span>
              </h2>
              <p className="text-xs text-gray-400">High-Res Images &amp; Captions for FB Messenger Auto-Sender</p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            disabled={exportState === 'exporting'}
            className="p-2 bg-[var(--dash-card)] rounded-xl border border-[var(--dash-border)] hover:bg-[var(--dash-border)] text-gray-400 hover:text-white transition-colors disabled:opacity-30 cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5 custom-scrollbar">
          
          {/* Status / Overview Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="bg-[var(--dash-bg)]/80 border border-emerald-500/30 rounded-2xl p-3.5 flex flex-col justify-between">
              <span className="text-xs font-medium text-emerald-400 flex items-center gap-1.5">
                <CheckCircle2 size={14} /> In-Stock
              </span>
              <div className="mt-2 flex items-baseline gap-1.5">
                <span className="text-2xl font-black text-white">{inStockProducts.length}</span>
                <span className="text-xs text-gray-400">products</span>
              </div>
            </div>

            <div className="bg-[var(--dash-bg)]/80 border border-[var(--dash-border)]/60 rounded-2xl p-3.5 flex flex-col justify-between">
              <span className="text-xs font-medium text-gray-400 flex items-center gap-1.5">
                <AlertCircle size={14} className="text-amber-400/80" /> Stock Out
              </span>
              <div className="mt-2 flex items-baseline gap-1.5">
                <span className="text-2xl font-black text-gray-300">{outOfStockCount}</span>
                <span className="text-xs text-gray-500">skipped</span>
              </div>
            </div>

            <div className="col-span-2 sm:col-span-1 bg-[var(--dash-bg)]/80 border border-blue-500/30 rounded-2xl p-3.5 flex flex-col justify-between">
              <span className="text-xs font-medium text-blue-400 flex items-center gap-1.5">
                <ImageIcon size={14} /> High-Res Pics
              </span>
              <div className="mt-2 flex items-baseline gap-1.5">
                <span className="text-2xl font-black text-white">~{estimatedImagesCount}</span>
                <span className="text-xs text-gray-400">images</span>
              </div>
            </div>
          </div>

          {/* Exporting Progress View */}
          {exportState === 'exporting' && (
            <div className="bg-[var(--dash-bg)] border border-[var(--dash-border)] rounded-2xl p-6 flex flex-col items-center justify-center text-center space-y-4">
              <div 
                className="w-14 h-14 rounded-full border-4 border-t-transparent animate-spin flex items-center justify-center"
                style={{ borderColor: `${themePrimary}30`, borderTopColor: themePrimary }}
              />
              <div className="space-y-1 max-w-md">
                <h3 className="text-base font-bold text-white">Downloading Images &amp; Packaging Dataset</h3>
                <p className="text-xs text-gray-400 truncate">{statusMessage}</p>
              </div>

              {/* Progress Bar */}
              <div className="w-full max-w-md space-y-1.5">
                <div className="flex justify-between text-xs font-mono text-gray-400">
                  <span>Progress</span>
                  <span className="font-bold text-white">{progressPercent}%</span>
                </div>
                <div className="w-full h-2.5 bg-black/40 rounded-full overflow-hidden border border-white/5">
                  <motion.div 
                    className="h-full rounded-full transition-all duration-300"
                    style={{ 
                      width: `${progressPercent}%`,
                      backgroundColor: themePrimary 
                    }}
                  />
                </div>
              </div>

              <button
                onClick={handleCancel}
                className="text-xs text-gray-400 hover:text-white px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 transition-colors mt-2"
              >
                Cancel Export
              </button>
            </div>
          )}

          {/* Success View */}
          {exportState === 'success' && (
            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-6 flex flex-col items-center justify-center text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                <CheckCircle2 size={28} />
              </div>
              <h3 className="text-lg font-bold text-white">Export Completed Successfully!</h3>
              <p className="text-xs text-emerald-300 max-w-md">
                Downloaded <span className="font-bold">{exportedCount} in-stock products</span> with <span className="font-bold">{totalImagesExported} high-resolution images</span> formatted for Facebook Messenger auto-sender.
              </p>
              <div className="pt-2 flex gap-3">
                <button
                  onClick={() => setExportState('idle')}
                  className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-semibold transition-colors"
                >
                  Export Again
                </button>
                <button
                  onClick={onClose}
                  style={{ backgroundColor: themePrimary }}
                  className="px-5 py-2 rounded-xl text-white text-xs font-bold shadow-md hover:brightness-110 transition-all"
                >
                  Done
                </button>
              </div>
            </div>
          )}

          {/* Error View */}
          {exportState === 'error' && (
            <div className="bg-rose-500/10 border border-rose-500/30 rounded-2xl p-5 flex items-start gap-3">
              <AlertCircle size={20} className="text-rose-400 shrink-0 mt-0.5" />
              <div className="space-y-1 flex-1">
                <h4 className="text-sm font-bold text-rose-300">Export Failed</h4>
                <p className="text-xs text-rose-400/90">{errorMessage}</p>
                <button
                  onClick={() => setExportState('idle')}
                  className="mt-2 text-xs font-semibold text-white underline hover:no-underline"
                >
                  Try Again
                </button>
              </div>
            </div>
          )}

          {/* Configuration & Controls Section (Idle State) */}
          {exportState === 'idle' && (
            <>
              {/* Max Pictures Limit Control (Requested by user) */}
              <div className="bg-[var(--dash-bg)]/90 border border-blue-500/30 rounded-2xl p-4 space-y-3 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <ImageIcon size={18} className="text-blue-400" />
                    <div>
                      <h4 className="text-xs font-bold text-white uppercase tracking-wider">Max Pictures per Product</h4>
                      <p className="text-[11px] text-gray-400">If a product has multiple gallery styles, limits how many images to export per folder.</p>
                    </div>
                  </div>

                  {/* Quick Preset Buttons */}
                  <div className="flex items-center gap-1.5 self-start sm:self-auto">
                    {[1, 2, 3, 5, 0].map((count) => (
                      <button
                        key={count}
                        type="button"
                        onClick={() => setMaxImagesPerProduct(count)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                          maxImagesPerProduct === count 
                            ? 'bg-blue-500 text-white shadow-sm' 
                            : 'bg-white/5 hover:bg-white/10 text-gray-300'
                        }`}
                      >
                        {count === 0 ? 'All' : count}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-3 pt-1">
                  <div className="flex-1">
                    <input 
                      type="number"
                      min="1"
                      max="50"
                      value={maxImagesPerProduct === 0 ? '' : maxImagesPerProduct}
                      onChange={(e) => {
                        const val = e.target.value === '' ? 0 : parseInt(e.target.value);
                        setMaxImagesPerProduct(isNaN(val) ? 0 : Math.max(0, val));
                      }}
                      placeholder="0 = Download all pictures"
                      className="w-full bg-[var(--dash-card)] text-white border border-[var(--dash-border)] rounded-xl px-3.5 py-2 font-mono text-xs focus:border-blue-500 outline-none"
                    />
                  </div>
                  <span className="text-xs text-blue-300/80 font-mono shrink-0">
                    {maxImagesPerProduct === 0 
                      ? 'Downloading all uploaded photos' 
                      : `Saving up to ${maxImagesPerProduct} high-res photos per product`}
                  </span>
                </div>
              </div>

              {/* Live Caption & Folder Preview Box */}
              <div className="bg-[var(--dash-bg)]/90 border border-[var(--dash-border)]/80 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileText size={16} className="text-cyan-400" />
                    <span className="text-xs font-bold text-white uppercase tracking-wider">Live text.txt Caption Preview</span>
                  </div>
                  
                  {inStockProducts.length > 1 && (
                    <select
                      value={selectedPreviewIndex}
                      onChange={(e) => setSelectedPreviewIndex(Number(e.target.value))}
                      className="text-[11px] bg-[var(--dash-card)] text-gray-300 border border-[var(--dash-border)] rounded-lg px-2 py-1 outline-none max-w-[180px] truncate"
                    >
                      {inStockProducts.slice(0, 20).map((p, idx) => (
                        <option key={p.id || idx} value={idx}>
                          {idx + 1}. {p.title}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                {sampleProduct ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    {/* Left: Raw text.txt representation */}
                    <div className="bg-black/50 border border-white/10 rounded-xl p-3 font-mono text-xs text-emerald-300 whitespace-pre-wrap leading-relaxed shadow-inner select-all">
                      {sampleCaption}
                    </div>

                    {/* Right: Explanatory Breakdown */}
                    <div className="space-y-2 text-xs text-gray-400 flex flex-col justify-center bg-white/[0.02] border border-white/5 rounded-xl p-3">
                      <div className="flex justify-between items-center pb-1.5 border-b border-white/5">
                        <span>Category (Uppercase):</span>
                        <span className="font-bold text-white font-mono">
                          {sampleProduct.category ? sampleProduct.category.toUpperCase() : fallbackCategory}
                        </span>
                      </div>
                      <div className="flex justify-between items-center pb-1.5 border-b border-white/5">
                        <span>Per Piece Price:</span>
                        <span className="font-bold text-cyan-300 font-mono">
                          {Math.round(Number(sampleProduct.price) || 0)} TK
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span>MOQ-6 Price ({moqDiscount} TK off):</span>
                        <span className="font-bold text-amber-300 font-mono">
                          {Math.max(0, Math.round(Number(sampleProduct.price) || 0) - moqDiscount)} TK
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-4 text-xs text-gray-400">
                    No in-stock products available for preview.
                  </div>
                )}
              </div>

              {/* Archive Hierarchy Specs */}
              <div className="bg-[var(--dash-bg)]/40 border border-white/5 rounded-2xl p-4">
                <h4 className="text-xs font-semibold text-gray-300 mb-2 flex items-center gap-1.5">
                  <Info size={14} className="text-blue-400" />
                  Dataset Archive Structure
                </h4>
                <div className="font-mono text-[11px] text-gray-400 space-y-1 pl-1">
                  <div>📁 <span className="text-gray-200">export_dataset/</span></div>
                  <div className="pl-4">├── 📁 <span className="text-cyan-300">1/</span> (Product 1)</div>
                  <div className="pl-8">├── 🖼️ <span className="text-amber-200">image_1.webp</span> (Original High-Res)</div>
                  {maxImagesPerProduct !== 1 && (
                    <div className="pl-8">├── 🖼️ <span className="text-amber-200">image_2.webp</span> (Gallery Photo)</div>
                  )}
                  <div className="pl-8">└── 📄 <span className="text-emerald-300">text.txt</span> (Formatted caption)</div>
                  <div className="pl-4">├── 📁 <span className="text-cyan-300">2/</span> (Product 2)</div>
                  <div className="pl-8">└── ...</div>
                </div>
              </div>

              {/* Advanced Settings Accordion */}
              <div className="border border-[var(--dash-border)]/60 rounded-2xl overflow-hidden bg-[var(--dash-bg)]/50">
                <button
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className="w-full p-3.5 flex items-center justify-between text-xs font-semibold text-gray-300 hover:text-white transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <SlidersHorizontal size={14} className="text-pink-400" />
                    Customise Pricing &amp; Structure
                  </span>
                  <ChevronDown 
                    size={16} 
                    className={`text-gray-500 transition-transform duration-200 ${showAdvanced ? 'rotate-180' : ''}`} 
                  />
                </button>

                <AnimatePresence>
                  {showAdvanced && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="border-t border-[var(--dash-border)]/40 p-4 space-y-3.5 bg-[var(--dash-card)]/40 text-xs"
                    >
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <label className="text-gray-300 font-medium">MOQ-6 Discount Amount (TK)</label>
                          <input 
                            type="number"
                            min="0"
                            max="500"
                            value={moqDiscount}
                            onChange={(e) => setMoqDiscount(Math.max(0, parseInt(e.target.value) || 0))}
                            className="w-full bg-[var(--dash-bg)] text-white border border-[var(--dash-border)] rounded-xl px-3 py-2 font-mono text-xs focus:border-pink-500 outline-none"
                          />
                          <p className="text-[10px] text-gray-400">Deducted from selling price for MOQ-6 caption (Default: 5 TK).</p>
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-gray-300 font-medium">Fallback Category Name</label>
                          <input 
                            type="text"
                            value={fallbackCategory}
                            onChange={(e) => setFallbackCategory(e.target.value.toUpperCase())}
                            className="w-full bg-[var(--dash-bg)] text-white border border-[var(--dash-border)] rounded-xl px-3 py-2 uppercase font-mono text-xs focus:border-pink-500 outline-none"
                            placeholder="GENERAL"
                          />
                          <p className="text-[10px] text-gray-400">Used if a product has no category assigned (Default: GENERAL).</p>
                        </div>
                      </div>

                      <div className="space-y-1.5 pt-2 border-t border-white/5">
                        <label className="text-gray-300 font-medium">Folder Numbering Format</label>
                        <div className="flex gap-3">
                          <label className="flex items-center gap-2 cursor-pointer text-gray-300">
                            <input 
                              type="radio" 
                              name="folderNaming" 
                              checked={folderNaming === 'sequential'} 
                              onChange={() => setFolderNaming('sequential')}
                              className="accent-pink-500"
                            />
                            <span>Sequential Numbers (1, 2, 3...)</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer text-gray-300">
                            <input 
                              type="radio" 
                              name="folderNaming" 
                              checked={folderNaming === 'productId'} 
                              onChange={() => setFolderNaming('productId')}
                              className="accent-pink-500"
                            />
                            <span>Product IDs (e.g. P001, P002...)</span>
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

        {/* Footer Action Bar */}
        <div className="p-4 border-t border-[var(--dash-border)]/60 bg-[var(--dash-bg)]/80 flex items-center gap-3">
          <button 
            onClick={onClose}
            disabled={exportState === 'exporting'}
            className="px-4 py-3 rounded-2xl border border-[var(--dash-border)] text-gray-300 hover:text-white font-medium hover:bg-[var(--dash-border)] transition-colors text-xs sm:text-sm disabled:opacity-40"
          >
            Close
          </button>

          {exportState !== 'exporting' && exportState !== 'success' && (
            <button 
              onClick={handleStartExport}
              disabled={inStockProducts.length === 0}
              style={{ backgroundColor: themePrimary, color: '#ffffff' }}
              className="flex-1 py-3 px-5 rounded-2xl font-bold text-xs sm:text-sm hover:brightness-110 active:scale-[0.99] transition-all shadow-lg flex items-center justify-center gap-2.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Download size={18} strokeWidth={2.2} />
              <span>Download Fb Zip ({inStockProducts.length} In-Stock Products)</span>
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
}
