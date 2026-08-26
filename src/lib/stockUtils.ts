import { Product } from '../types';

export function getAvailableStock(p: any, variantId?: string): number {
  if (!p) return 0;
  if (variantId && p.variants && p.variants.length > 0) {
    const v = p.variants.find((variant: any) => variant.id === variantId);
    if (v && v.stock !== undefined && v.stock !== null) {
      return Math.max(0, Number(v.stock));
    }
  }
  if (p.hasVariants && p.variants && p.variants.length > 0) {
    const hasExplicitVariantStocks = p.variants.some((v: any) => v.stock !== undefined && v.stock !== null);
    if (hasExplicitVariantStocks) {
      return p.variants.reduce((acc: number, v: any) => acc + (v.stock !== undefined && v.stock !== null ? Math.max(0, Number(v.stock)) : 0), 0);
    }
  }
  if (p.stock !== undefined && p.stock !== null) {
    return Math.max(0, Number(p.stock));
  }
  return 0;
}

export function isProductInStock(p: Product): boolean {
  return getAvailableStock(p) > 0;
}

export function isOrderStockActive(order: any): boolean {
  if (!order) return false;
  if (order.status === 'Canceled' || order.status === 'Complete Return') return false;
  if (order.status === 'Returned' && order.stockReturned) return false;
  if (order.stockReturned) return false;
  return true;
}

export interface StockDiffItem {
  id: string; // product id
  variantId?: string;
  variantIndex?: number;
  qty: number; // positive = deduct from inventory, negative = restore back to inventory
}

export function adjustOrderStockDiff(
  products: any[],
  oldOrder: any,
  updatedOrder: any
): { updatedProducts: any[]; changedProducts: any[]; diffItems: StockDiffItem[] } {
  const wasActive = isOrderStockActive(oldOrder);
  const isNowActive = isOrderStockActive(updatedOrder);

  // Map: key (`${productId}___${variantId || ''}`) -> { productId, variantId, oldQty, newQty }
  const map = new Map<string, { productId: string; variantId?: string; oldQty: number; newQty: number }>();

  if (oldOrder && Array.isArray(oldOrder.items)) {
    oldOrder.items.forEach((item: any) => {
      const pId = String(item.product?.id || item.id || '');
      if (!pId) return;
      const vId = item.variantId || '';
      const key = `${pId}___${vId}`;
      const existing = map.get(key) || { productId: pId, variantId: item.variantId, oldQty: 0, newQty: 0 };
      existing.oldQty += Number(item.quantity) || 0;
      map.set(key, existing);
    });
  }

  if (updatedOrder && Array.isArray(updatedOrder.items)) {
    updatedOrder.items.forEach((item: any) => {
      const pId = String(item.product?.id || item.id || '');
      if (!pId) return;
      const vId = item.variantId || '';
      const key = `${pId}___${vId}`;
      const existing = map.get(key) || { productId: pId, variantId: item.variantId, oldQty: 0, newQty: 0 };
      existing.newQty += Number(item.quantity) || 0;
      map.set(key, existing);
    });
  }

  let updatedProducts = [...products];
  const changedProductIds = new Set<string>();
  const diffItems: StockDiffItem[] = [];

  map.forEach(({ productId, variantId, oldQty, newQty }) => {
    const effectiveOld = wasActive ? oldQty : 0;
    const effectiveNew = isNowActive ? newQty : 0;
    const delta = effectiveNew - effectiveOld; // delta > 0: need to deduct from stock. delta < 0: need to add back to stock

    if (delta === 0) return;

    const pIndex = updatedProducts.findIndex((p: any) => String(p.id) === String(productId));
    if (pIndex < 0) return;

    let p = { ...updatedProducts[pIndex] };
    let variantIndex: number | undefined = undefined;

    if (variantId && p.variants && p.variants.length > 0) {
      let variantFound = false;
      p.variants = p.variants.map((v: any, idx: number) => {
        if (v.id === variantId) {
          variantIndex = idx;
          variantFound = true;
          const currentStock = v.stock !== undefined && v.stock !== null ? Number(v.stock) : Number(p.stock || 0);
          const newStock = Math.max(0, currentStock - delta);
          return {
            ...v,
            stock: newStock,
            isVisible: newStock > 0 ? true : v.isVisible
          };
        }
        return v;
      });

      if (variantFound) {
        const hasExplicitVariantStocks = p.variants.some((v: any) => v.stock !== undefined && v.stock !== null);
        if (hasExplicitVariantStocks) {
          const totalVariantStock = p.variants.reduce((acc: number, v: any) => acc + Number(v.stock || 0), 0);
          p.stock = totalVariantStock;
          if (totalVariantStock === 0) {
            p.stockOutDate = new Date().toISOString();
          } else {
            p.isVisible = true;
            p.stockOutDate = undefined;
          }
        } else {
          const currentStock = p.stock !== undefined && p.stock !== null ? Number(p.stock) : 0;
          const newStock = Math.max(0, currentStock - delta);
          p.stock = newStock;
          if (newStock === 0) {
            p.stockOutDate = new Date().toISOString();
          } else {
            p.isVisible = true;
            p.stockOutDate = undefined;
          }
        }
      } else {
        const currentStock = p.stock !== undefined && p.stock !== null ? Number(p.stock) : 0;
        const newStock = Math.max(0, currentStock - delta);
        p.stock = newStock;
        if (newStock === 0) {
          p.stockOutDate = new Date().toISOString();
        } else {
          p.isVisible = true;
          p.stockOutDate = undefined;
        }
      }
    } else {
      const currentStock = p.stock !== undefined && p.stock !== null ? Number(p.stock) : 0;
      const newStock = Math.max(0, currentStock - delta);
      p.stock = newStock;
      if (newStock === 0) {
        p.stockOutDate = new Date().toISOString();
      } else {
        p.isVisible = true;
        p.stockOutDate = undefined;
      }
    }

    updatedProducts[pIndex] = p;
    changedProductIds.add(String(p.id));
    diffItems.push({ id: productId, variantId, variantIndex, qty: delta });
  });

  const changedProducts = updatedProducts.filter((p: any) => changedProductIds.has(String(p.id)));

  return { updatedProducts, changedProducts, diffItems };
}

export function restoreOrderStock(products: any[], order: any): any[] {
  let updatedProducts = [...products];

  order.items.forEach((item: any) => {
    const productIndex = updatedProducts.findIndex((p: any) => String(p.id) === String(item.product?.id || item.id));
    if (productIndex >= 0) {
      let newProduct = { ...updatedProducts[productIndex] };
      let changed = false;

      // 1. Restore Variant Stock if it's a variant item
      if (item.variantId && newProduct.variants && newProduct.variants.length > 0) {
        let variantFound = false;
        newProduct.variants = newProduct.variants.map((v: any) => {
          if (v.id === item.variantId) {
            variantFound = true;
            changed = true;
            const currentStock = v.stock !== undefined && v.stock !== null ? Number(v.stock) : Number(newProduct.stock || 0);
            const newStock = currentStock + item.quantity;
            return { 
              ...v, 
              stock: newStock,
              isVisible: newStock > 0 ? true : v.isVisible 
            };
          }
          return v;
        });
        
        if (variantFound) {
          const hasExplicitVariantStocks = newProduct.variants.some((v: any) => v.stock !== undefined && v.stock !== null);
          if (hasExplicitVariantStocks) {
            const totalVariantStock = newProduct.variants.reduce((acc: number, v: any) => acc + (Number(v.stock) || 0), 0);
            newProduct.stock = totalVariantStock;
            if (totalVariantStock > 0) {
              newProduct.isVisible = true;
              newProduct.stockOutDate = undefined;
            }
          } else {
            const newStock = Number(newProduct.stock || 0) + item.quantity;
            newProduct.stock = newStock;
            if (newStock > 0) {
              newProduct.isVisible = true;
              newProduct.stockOutDate = undefined;
            }
          }
        } else {
          if (newProduct.stock !== undefined && newProduct.stock !== null) {
            changed = true;
            const newStock = Number(newProduct.stock) + item.quantity;
            newProduct.stock = newStock;
            if (newStock > 0) {
              newProduct.isVisible = true;
              newProduct.stockOutDate = undefined;
            }
          }
        }
      } else {
        // 2. Restore Main Product Stock (for non-variant items)
        if (newProduct.stock !== undefined && newProduct.stock !== null) {
          changed = true;
          const newStock = Number(newProduct.stock) + item.quantity;
          newProduct.stock = newStock;
          if (newStock > 0) {
              newProduct.isVisible = true;
              newProduct.stockOutDate = undefined;
          }
        }
      }

      if (changed) {
        updatedProducts[productIndex] = newProduct;
      }
    }
  });

  return updatedProducts;
}

export function deductOrderStock(products: any[], order: any): any[] {
  let updatedProducts = [...products];

  order.items.forEach((item: any) => {
    const productIndex = updatedProducts.findIndex((p: any) => String(p.id) === String(item.product?.id || item.id));
    if (productIndex >= 0) {
      let newProduct = { ...updatedProducts[productIndex] };
      let changed = false;

      if (item.variantId && newProduct.variants && newProduct.variants.length > 0) {
        let variantFound = false;
        newProduct.variants = newProduct.variants.map((v: any) => {
          if (v.id === item.variantId) {
            variantFound = true;
            changed = true;
            const currentStock = v.stock !== undefined && v.stock !== null ? Number(v.stock) : Number(newProduct.stock || 0);
            const newStock = Math.max(0, currentStock - item.quantity);
            return {
              ...v,
              stock: newStock,
              isVisible: newStock > 0 ? true : v.isVisible
            };
          }
          return v;
        });
        
        if (variantFound) {
          const hasExplicitVariantStocks = newProduct.variants.some((v: any) => v.stock !== undefined && v.stock !== null);
          if (hasExplicitVariantStocks) {
            const totalVariantStock = newProduct.variants.reduce((acc: number, v: any) => acc + (Number(v.stock) || 0), 0);
            newProduct.stock = totalVariantStock;
            if (totalVariantStock === 0) {
              newProduct.stockOutDate = new Date().toISOString();
            } else {
              newProduct.stockOutDate = undefined;
              newProduct.isVisible = true;
            }
          } else {
            const newStock = Math.max(0, Number(newProduct.stock || 0) - item.quantity);
            newProduct.stock = newStock;
            if (newStock === 0) {
              newProduct.stockOutDate = new Date().toISOString();
            } else {
              newProduct.stockOutDate = undefined;
              newProduct.isVisible = true;
            }
          }
        } else {
          if (newProduct.stock !== undefined && newProduct.stock !== null) {
            changed = true;
            newProduct.stock = Math.max(0, Number(newProduct.stock) - item.quantity);
            if (newProduct.stock === 0) {
              newProduct.stockOutDate = new Date().toISOString();
            } else {
              newProduct.stockOutDate = undefined;
              newProduct.isVisible = true;
            }
          }
        }
      } else {
        if (newProduct.stock !== undefined && newProduct.stock !== null) {
          changed = true;
          newProduct.stock = Math.max(0, Number(newProduct.stock) - item.quantity);
          if (newProduct.stock === 0) {
            newProduct.stockOutDate = new Date().toISOString();
          } else {
            newProduct.stockOutDate = undefined;
            newProduct.isVisible = true;
          }
        }
      }

      if (changed) {
        updatedProducts[productIndex] = newProduct;
      }
    }
  });

  return updatedProducts;
}

export function notifyMasterStockSync(order: any, websiteSettings: any, isRestore = false) {
  if (websiteSettings?.apiSync?.enabled && !websiteSettings?.apiSync?.isMaster && websiteSettings?.apiSync?.connectedMasterUrl) {
     const itemsToDeduct = (order.items || []).map((item: any) => {
         let variantIndex;
         if (item.variantId && item.product?.variants) {
             variantIndex = item.product.variants.findIndex((v: any) => v.id === item.variantId || v.name === item.variantName);
         }
         // If restore, pass negative qty to add stock back
         const qty = isRestore ? -Number(item.quantity || 0) : Number(item.quantity || 0);
         return { 
           id: item.product?.id || item.id, 
           variantId: item.variantId,
           variantName: item.variantName,
           variantIndex, 
           qty 
         };
     });
     
     const dbUrl = websiteSettings.apiSync.connectedMasterUrl.trim().replace(/\/$/, "");
     fetch(`${dbUrl}/api/sync_deduct_stock`, {
        method: 'POST',
        headers: {
           'Content-Type': 'application/json',
           'Authorization': `Bearer ${websiteSettings.apiSync.connectedMasterApiKey}`
        },
        body: JSON.stringify({ itemsToDeduct, retailUrl: window.location.origin })
     }).catch(console.error);
  }
}

export function notifyMasterStockSyncDiff(diffItems: StockDiffItem[], websiteSettings: any) {
  if (!diffItems || diffItems.length === 0) return;
  if (websiteSettings?.apiSync?.enabled && !websiteSettings?.apiSync?.isMaster && websiteSettings?.apiSync?.connectedMasterUrl) {
     const itemsToDeduct = diffItems.map((item) => ({
         id: item.id,
         variantId: item.variantId,
         variantIndex: item.variantIndex,
         qty: item.qty // positive = deduct on master, negative = restore on master
     }));
     
     const dbUrl = websiteSettings.apiSync.connectedMasterUrl.trim().replace(/\/$/, "");
     fetch(`${dbUrl}/api/sync_deduct_stock`, {
        method: 'POST',
        headers: {
           'Content-Type': 'application/json',
           'Authorization': `Bearer ${websiteSettings.apiSync.connectedMasterApiKey}`
        },
        body: JSON.stringify({ itemsToDeduct, retailUrl: window.location.origin })
     }).catch(console.error);
  }
}

