import React, { forwardRef } from 'react';
import { CircleUserRound, Phone, MapPin, MessageSquareText } from 'lucide-react';
import { Order, WebsiteSettings } from '../types';
import { formatPrice } from '../lib/utils';
import { getCartTotal } from '../lib/pricingUtils';

interface ReceiptProps {
  order: Order;
  settings?: WebsiteSettings;
}

export const Receipt = forwardRef<HTMLDivElement, ReceiptProps>(({ order, settings }, ref) => {
  const totalItemCount = order.items?.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0) || 0;

  const { total: subtotal, itemDiscounts } = React.useMemo(
    () => getCartTotal(order.items || [], settings?.qtyRules),
    [order.items, settings?.qtyRules]
  );
  
  const deliveryCharge = Number(order.deliveryCharge) || 0;
  const discountAmount = Number(order.discount) || 0;
  
  // Total = subtotal + delivery charge - discount
  const total = subtotal + deliveryCharge - discountAmount;

  // Compute dynamic grid layout classes
  const getGridClass = (count: number) => {
    if (count === 1) return 'grid-cols-1 max-w-[45%] mx-auto';
    if (count === 2) return 'grid-cols-2';
    if (count === 3) return 'grid-cols-3';
    if (count === 4) return 'grid-cols-4';
    if (count === 5) return 'grid-cols-5';
    return 'grid-cols-6';
  };

  return (
    <div className="fixed left-[-9999px] top-0 pointer-events-none z-[-100]">
      <div 
        ref={ref} 
        className="bg-[#f2f2f2] text-[var(--theme-black)] w-full max-w-[800px] p-8 box-border relative mx-auto"
        style={{ fontFamily: "'Inter', sans-serif" }}
      >
        <div className="flex justify-center mb-8">
          {settings?.logoUrl ? (
            <img src={settings.logoUrl} alt="Logo" className="h-[50px] object-contain" crossOrigin="anonymous" />
          ) : (
            <div className="h-[50px]"></div>
          )}
        </div>

        <div className="flex justify-between items-start mb-8 text-base">
          <div className="flex flex-col gap-2.5">
            <div className="flex items-center gap-3">
              <CircleUserRound size={22} className="text-[var(--theme-black)]" strokeWidth={2} />
              <span className="font-bold text-[22px] tracking-tight leading-none text-[var(--theme-black)]">{order.userInfo.name}</span>
            </div>
            <div className="flex items-center gap-3">
              <Phone size={21} className="text-[var(--theme-black)]" strokeWidth={2} />
              <span className="font-semibold text-[20px] leading-none text-[var(--theme-black)]">{order.userInfo.phone}</span>
            </div>
            <div className="flex items-start gap-3 max-w-[380px]">
              <MapPin size={22} className="text-[var(--theme-black)] flex-shrink-0 mt-0.5" strokeWidth={2} />
              <span className="font-semibold text-xl leading-snug text-[var(--theme-black)] max-w-[320px]">{order.userInfo.address}</span>
            </div>
            {order.userInfo.customerNote && (
              <div className="flex items-start gap-3 max-w-[380px]">
                <MessageSquareText size={22} className="text-[var(--theme-black)] flex-shrink-0 mt-0.5" strokeWidth={2} />
                <span className="font-medium text-[19px] leading-snug text-[#4b5563] max-w-[320px] italic">"{order.userInfo.customerNote}"</span>
              </div>
            )}
          </div>
          
          <div className="flex flex-col items-end gap-1.5 text-right">
            <div className="text-[28px] font-black text-[var(--theme-black)] tracking-tight mb-0.5">Order ID #{order.id}</div>
            <div className="text-[#84878a] font-semibold text-[17px]">{order.date}</div>
            {settings?.shopPhone && (
              <div className="text-[#84878a] font-semibold text-[17px] mt-0.5 tracking-wider underline decoration-gray-400 underline-offset-4">
                {settings.shopPhone}
              </div>
            )}
          </div>
        </div>

        <div className="relative flex py-4 items-center mb-8">
          <div className="flex-grow border-t-[1.5px] border-[#d1d5db]"></div>
          <span className="flex-shrink-0 mx-4 text-[#6b7280] font-semibold text-[20px]">
            Items: <span className="text-[var(--theme-black)] font-black tracking-tight">{order.items.length}</span> / Quantity: <span className="text-[var(--theme-black)] font-black tracking-tight">{totalItemCount}</span>
          </span>
          <div className="flex-grow border-t-[1.5px] border-[#d1d5db]"></div>
        </div>

        {/* Responsive dynamic grid depending on item count */}
        <div className={`grid ${getGridClass(order.items.length)} gap-x-[12px] gap-y-5 mb-10`}>
          {order.items.map((item, idx) => (
            <div key={`${item.product.id}-${idx}`} className="flex flex-col bg-[#ebe8e3] rounded-xl p-[7px] pb-2 shadow-none border border-[var(--theme-black)]/[0.04] relative">
              <div className="relative w-full bg-transparent mb-[6px] pt-[100%] rounded-lg">
                <img src={item.product.image} alt={item.product.title} className="absolute inset-0 w-full h-full object-cover rounded-[8px]" />
                <div className="absolute -top-2.5 -right-2.5 bg-[var(--theme-primary)] text-[#ffffff] text-[15px] font-bold w-[26px] h-[26px] flex items-center justify-center rounded-full shadow-none border-[2.5px] border-[#ebe8e3] z-10">
                  {item.quantity}
                </div>
              </div>
              <div className="text-center font-bold text-[var(--theme-black)] text-[16px] tracking-tight">
                {itemDiscounts[item.id] ? (
                  <>
                    <span className="line-through text-gray-400 text-xs mr-1 block">{formatPrice(item.variantPrice ?? item.product.price)}</span>
                    <span className="text-emerald-600 block leading-tight">{formatPrice(Math.max(0, (item.variantPrice ?? item.product.price) - itemDiscounts[item.id]))}</span>
                  </>
                ) : (
                  formatPrice(item.variantPrice ?? item.product.price)
                )}
              </div>
            </div>
          ))}
        </div>

        <div className={`flex ${settings?.receiptQrCodeUrl ? 'justify-between' : 'justify-end'} items-end mt-12 pt-2`}>
          {settings?.receiptQrCodeUrl && (
            <div className="pb-1">
              <img src={settings.receiptQrCodeUrl} className="w-[105px] h-[105px] object-contain shadow-none border border-[var(--theme-black)]/[0.08] rounded-sm bg-[#ffffff] p-1" alt="QR Code" />
            </div>
          )}

          <div className="w-[340px] rounded-lg overflow-hidden border border-[#d6d4ce] shadow-none">
            <div className="flex justify-between items-center px-4 py-3 bg-[#e8e6df] border-b border-[#dad7d1]">
              <span className="font-bold text-[#374151] text-lg">Subtotal</span>
              <span className="font-bold text-[var(--theme-black)] text-lg tracking-tight">{formatPrice(subtotal)}</span>
            </div>
            {discountAmount > 0 ? (
              <div className="flex justify-between items-center px-4 py-3 bg-[#e8e6df] border-b border-[#dad7d1]">
                <span className="font-bold text-[#374151] text-lg">Discount</span>
                <span className="font-bold text-[var(--theme-black)] text-lg tracking-tight">- {formatPrice(discountAmount)}</span>
              </div>
            ) : null}
            <div className="flex justify-between items-center px-4 py-3 bg-[#e8e6df]">
              <span className="font-bold text-[#374151] text-lg">Delivery Charge</span>
              <span className="font-bold text-[var(--theme-black)] text-lg tracking-tight">+ {formatPrice(deliveryCharge)}</span>
            </div>
            <div className="flex justify-between items-center px-4 py-[14px] bg-[var(--theme-black)] text-[#ffffff] outline outline-[1px] outline-black">
              <span className="font-bold text-xl">Total</span>
              <span className="font-bold text-xl tracking-tight">{formatPrice(total)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});
