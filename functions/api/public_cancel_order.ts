import { restoreOrderStock } from '../../src/lib/stockUtils';
import { broadcastStockToRetails } from './_sync_broadcast';

export async function onRequestPost(context: any) {
  const { request, env } = context;

  try {
    const data = await request.json();
    const { orderId, customerPhone } = data;

    if (!orderId || !customerPhone) {
      return new Response(JSON.stringify({ error: 'Invalid payload' }), { status: 400 });
    }

    const orderRes = await env.DB.prepare("SELECT data FROM orders WHERE id = ? AND type = 'standard'").bind(orderId).first();
    if (!orderRes || !orderRes.data) {
        return new Response(JSON.stringify({ error: 'Order not found' }), { status: 404 });
    }

    const order = JSON.parse(orderRes.data);

    const normPhone = (p: string) => p ? p.replace(/\D/g, '') : '';
    if (normPhone(order.userInfo?.phone) !== normPhone(customerPhone) && normPhone(order.clientInfo?.phone) !== normPhone(customerPhone)) {
         return new Response(JSON.stringify({ error: 'Unauthorized order access' }), { status: 403 });
    }

    if (order.status !== 'Pending' && order.status !== 'Unpaid') {
        return new Response(JSON.stringify({ error: 'Cannot cancel processed order' }), { status: 400 });
    }

    order.status = 'Canceled';

    const stmts: any[] = [];
    
    stmts.push(
      env.DB.prepare('UPDATE orders SET data = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND type = ?')
      .bind(JSON.stringify(order), orderId, 'standard')
    );

    // Restore stock
    const productIds = order.items.map((i: any) => i.product.id);
    const productsRes = await env.DB.prepare(`
        SELECT p.id, p.data 
        FROM products p 
        JOIN json_each(?) j ON p.id = j.value
    `).bind(JSON.stringify(productIds)).all();
    const currentProducts = productsRes.results.map((r: any) => JSON.parse(r.data));
    
    const newProducts = restoreOrderStock(currentProducts, order);
    const changedProducts = newProducts.filter((p: any) => order.items.some((item: any) => item.product.id === p.id));

    if (changedProducts.length > 0) {
        const updates = changedProducts.map((p: any) => ({ id: p.id, data: JSON.stringify(p) }));
        stmts.push(
            env.DB.prepare(`
                UPDATE products 
                SET data = json_extract(j.value, '$.data'), 
                    updated_at = CURRENT_TIMESTAMP 
                FROM json_each(?) j 
                WHERE products.id = json_extract(j.value, '$.id')
            `).bind(JSON.stringify(updates))
        );
    }

    if (stmts.length > 0) {
      await env.DB.batch(stmts);
    }

    // Broadcast stock restoration to registered retail stores if acting as Master
    if (changedProducts && changedProducts.length > 0) {
      await broadcastStockToRetails(env, request, changedProducts, context);

      // Invalidate public_state cache
      try {
        const cache = (caches as any).default;
        const pubUrl = new URL('/api/public_state', request.url);
        if (context && typeof context.waitUntil === 'function') {
          context.waitUntil(cache.delete(new Request(pubUrl.toString())));
        } else {
          await cache.delete(new Request(pubUrl.toString()));
        }
      } catch (e) {}
    }

    return Response.json({ success: true });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}
