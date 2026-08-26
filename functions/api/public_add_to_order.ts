import { broadcastStockToRetails, notifyMasterOfStockDeduction } from './_sync_broadcast';

export async function onRequestPost(context: any) {
  const { request, env } = context;

  try {
    const data = await request.json();
    const { orderId, newItems, customerPhone } = data;

    if (!orderId || !newItems || !Array.isArray(newItems) || !customerPhone) {
      return new Response(JSON.stringify({ error: 'Invalid payload' }), { status: 400 });
    }

    // 1. Fetch the existing order
    const orderRes = await env.DB.prepare("SELECT data FROM orders WHERE id = ? AND type = 'standard'").bind(orderId).first();
    if (!orderRes || !orderRes.data) {
        return new Response(JSON.stringify({ error: 'Order not found' }), { status: 404 });
    }

    const order = JSON.parse(orderRes.data);

    // 2. Verify ownership via phone number (normalize to ignore spaces, dashes, +88)
    const normPhone = (p: string) => {
      if (!p) return '';
      const digits = String(p).replace(/\D/g, '');
      return digits.startsWith('880') ? digits.slice(2) : digits;
    };

    const existingPhone = normPhone(order.userInfo?.phone || order.clientInfo?.phone || '');
    const reqPhone = normPhone(customerPhone);

    if (existingPhone && reqPhone && existingPhone !== reqPhone) {
      return new Response(JSON.stringify({ error: 'Unauthorized order access' }), { status: 403 });
    }

    // 3. Prevent modifying non-pending orders
    if (order.status !== 'Pending' && order.status !== 'Unpaid') {
        return new Response(JSON.stringify({ error: 'Cannot modify processed order' }), { status: 400 });
    }

    const updatedOrder = data.updatedOrder;
    if (!updatedOrder || updatedOrder.id !== orderId) {
        return new Response(JSON.stringify({ error: 'Invalid order data' }), { status: 400 });
    }

    if (Array.isArray(updatedOrder.items)) {
      updatedOrder.items = updatedOrder.items.map((item: any) => {
        if (!item) return item;
        const p = item.product || {};
        return {
          id: item.id || p.id || '',
          product: {
            id: p.id || item.id || '',
            title: p.title || '',
            price: Number(p.price) || 0,
            buyPrice: p.buyPrice !== undefined ? Number(p.buyPrice) : undefined,
            image: p.thumbnail || p.image || '',
            thumbnail: p.thumbnail || p.image || '',
            category: p.category || '',
            supplier: p.supplier || '',
            material: p.material || '',
            variants: p.variants && item.variantId ? p.variants.filter((v: any) => v.id === item.variantId) : undefined
          },
          quantity: Number(item.quantity) || 1,
          color: item.color,
          variantId: item.variantId,
          variantName: item.variantName,
          variantPrice: item.variantPrice !== undefined ? Number(item.variantPrice) : undefined,
          variantBuyPrice: item.variantBuyPrice !== undefined ? Number(item.variantBuyPrice) : undefined,
          selectedOption: item.selectedOption
        };
      });
    }

    const stmts: any[] = [];
    
    stmts.push(
      env.DB.prepare('UPDATE orders SET data = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND type = ?')
      .bind(JSON.stringify(updatedOrder), orderId, 'standard')
    );

    // 4. Update changed products in D1
    const { changedProducts } = data;
    if (changedProducts && Array.isArray(changedProducts) && changedProducts.length > 0) {
        for (const p of changedProducts) {
            stmts.push(
                env.DB.prepare('UPDATE products SET data = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
                .bind(JSON.stringify(p), String(p.id))
            );
        }
    }

    if (stmts.length > 0) {
      const BATCH_SIZE = 40;
      for (let i = 0; i < stmts.length; i += BATCH_SIZE) {
        const batchChunk = stmts.slice(i, i + BATCH_SIZE);
        await env.DB.batch(batchChunk);
      }
    }

    // 5. If this is a connected Retail site, notify Master store to deduct stock
    const itemsToDeduct = (newItems || []).map((item: any) => {
      let variantIndex;
      if (item.variantId && item.product?.variants) {
        variantIndex = item.product.variants.findIndex((v: any) => v.id === item.variantId || v.name === item.variantName);
      }
      return {
        id: item.product?.id || item.id,
        variantId: item.variantId,
        variantName: item.variantName,
        variantIndex,
        qty: Number(item.quantity || 0)
      };
    });

    if (itemsToDeduct.length > 0) {
      await notifyMasterOfStockDeduction(env, request, itemsToDeduct, context);
    }

    // 6. If this is Master, broadcast stock changes to connected retail websites
    if (changedProducts && changedProducts.length > 0) {
      await broadcastStockToRetails(env, request, changedProducts, context);
    }

    // 7. Invalidate public_state cache so that refreshed pages immediately show new stock
    try {
      const cache = (caches as any).default;
      const pubUrl = new URL('/api/public_state', request.url);
      if (context && typeof context.waitUntil === 'function') {
        context.waitUntil(cache.delete(new Request(pubUrl.toString())));
      } else {
        await cache.delete(new Request(pubUrl.toString()));
      }
    } catch (e) {}

    return Response.json({ success: true, order: updatedOrder });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}
