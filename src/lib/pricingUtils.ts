import { CartItem, GlobalQtyRules } from '../types';

export function calculateItemDiscount(item: CartItem, productTotalQty: number, globalRules?: GlobalQtyRules): number {
  let rules = item.variantId ? item.product.variants?.find(v => v.id === item.variantId)?.qtyRules : null;
  if (!rules || rules.length === 0) {
    rules = item.product.qtyRules;
  }
  
  let bestDiscount = 0;
  if (rules && rules.length > 0) {
    const applicableRules = rules.filter(r => r.quantity <= productTotalQty).sort((a, b) => b.quantity - a.quantity);
    if (applicableRules.length > 0) {
      bestDiscount = applicableRules[0].price;
    }
  }
  
  // If product has rules but none matched, or product has no rules, fallback to global
  // Wait, "Ignore default when matched". So if matched, we use bestDiscount.
  if (bestDiscount > 0) {
    return bestDiscount;
  }
  
  if (globalRules?.enabled && productTotalQty >= globalRules.minQuantity) {
    return globalRules.discountPerPiece;
  }
  
  return 0;
}

export function getCartTotal(cart: CartItem[], globalRules?: GlobalQtyRules): { 
  total: number, 
  itemDiscounts: Record<string, number> 
} {
  const productQuantities = cart.reduce((acc, item) => {
    acc[item.product.id] = (acc[item.product.id] || 0) + item.quantity;
    return acc;
  }, {} as Record<string, number>);

  let total = 0;
  const itemDiscounts: Record<string, number> = {};

  cart.forEach(item => {
    const productTotalQty = productQuantities[item.product.id] || 0;
    const discountPerPiece = calculateItemDiscount(item, productTotalQty, globalRules);
    itemDiscounts[item.id] = discountPerPiece;
    
    const basePrice = item.variantPrice ?? item.product.price;
    const finalPrice = Math.max(0, basePrice - discountPerPiece);
    total += finalPrice * item.quantity;
  });

  return { total, itemDiscounts };
}
