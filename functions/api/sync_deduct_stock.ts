import { broadcastStockToRetails } from './_sync_broadcast';

export async function onRequestPost(context: any) {
  const { request, env } = context;
  
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
    }
    const token = authHeader.split(' ')[1];

    const data = await request.json();
    const { itemsToDeduct, retailUrl } = data; // Array of { id, variantId, variantIndex, qty }

    // Verify Master configuration
    const settingsRes = await env.DB.prepare("SELECT key, value FROM settings").all();
    let settings: any = {};
    for (const r of settingsRes.results) {
        settings[r.key] = JSON.parse(r.value);
    }
    const storeSettings = settings.websiteSettings || settings.store_settings || {};
    
    if (!storeSettings?.apiSync?.enabled || !storeSettings?.apiSync?.isMaster || storeSettings.apiSync.masterApiKey !== token) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
    }

    if (!itemsToDeduct || !Array.isArray(itemsToDeduct)) {
       return new Response(JSON.stringify({ error: 'Invalid payload' }), { status: 400 });
    }

    // Register the retail URL if provided
    if (retailUrl) {
      let registeredRetails = settings.registered_retails || [];
      if (!registeredRetails.includes(retailUrl)) {
        registeredRetails.push(retailUrl);
        await env.DB.prepare("INSERT INTO settings (key, value) VALUES ('registered_retails', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").bind(JSON.stringify(registeredRetails)).run();
      }
    }

    // Process stock deduction locally on Master
    const stmts: any[] = [];
    const productIds = Array.from(new Set(itemsToDeduct.map((i: any) => String(i.id || '')).filter(Boolean)));
    if (productIds.length === 0) {
      return Response.json({ success: true, updated: 0 });
    }
    const placeholders = productIds.map(() => '?').join(',');
    const productsRes = await env.DB.prepare(`SELECT id, data FROM products WHERE id IN (${placeholders})`).bind(...productIds).all();
    const currentProducts = new Map();
    for (const r of productsRes.results) {
        currentProducts.set(String(r.id), JSON.parse(r.data));
    }
    
    let updatedAny = false;
    const modifiedProducts: any[] = [];

    // Deduct stock (or restore if negative qty)
    for (const item of itemsToDeduct) {
        const product = currentProducts.get(String(item.id));
        if (product) {
            let pChanged = false;
            let targetVariantIdx = item.variantIndex;
            if ((targetVariantIdx === undefined || targetVariantIdx < 0) && item.variantId && Array.isArray(product.variants)) {
                targetVariantIdx = product.variants.findIndex((v: any) => v.id === item.variantId || v.name === item.variantName);
            }

            if (targetVariantIdx !== undefined && targetVariantIdx >= 0 && product.variants && product.variants[targetVariantIdx]) {
               const curVariantStock = product.variants[targetVariantIdx].stock !== undefined && product.variants[targetVariantIdx].stock !== null 
                  ? Number(product.variants[targetVariantIdx].stock) 
                  : Number(product.stock || 0);
               const newStock = Math.max(0, curVariantStock - item.qty);
               product.variants[targetVariantIdx].stock = newStock;
               if (newStock > 0) {
                 product.variants[targetVariantIdx].isVisible = true;
               }
               pChanged = true;
               
               const hasExplicitVariantStocks = product.variants.some((v: any) => v.stock !== undefined && v.stock !== null);
               if (hasExplicitVariantStocks) {
                 const totalVariantStock = product.variants.reduce((acc: number, v: any) => acc + Number(v.stock || 0), 0);
                 product.stock = totalVariantStock;
                 if (totalVariantStock === 0) {
                   product.stockOutDate = new Date().toISOString();
                 } else {
                   product.stockOutDate = undefined;
                   product.isVisible = true;
                 }
               } else {
                 const curStock = Number(product.stock || 0);
                 const mainStock = Math.max(0, curStock - item.qty);
                 product.stock = mainStock;
                 if (mainStock === 0) {
                   product.stockOutDate = new Date().toISOString();
                 } else {
                   product.stockOutDate = undefined;
                   product.isVisible = true;
                 }
               }
            } else {
               const curStock = Number(product.stock || 0);
               const newStock = Math.max(0, curStock - item.qty);
               product.stock = newStock;
               if (newStock === 0) {
                 product.stockOutDate = new Date().toISOString();
               } else {
                 product.stockOutDate = undefined;
                 product.isVisible = true;
               }
               pChanged = true;
            }
            if (pChanged) {
               stmts.push(
                 env.DB.prepare('UPDATE products SET data = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
                 .bind(JSON.stringify(product), product.id)
               );
               updatedAny = true;
               if (!modifiedProducts.some(p => p.id === product.id)) {
                 modifiedProducts.push(product);
               }
            }
        }
    }
    
    if (stmts.length > 0) {
        await env.DB.batch(stmts);
    }
    
    // Broadcast changes to connected retails
    if (updatedAny && modifiedProducts.length > 0) {
      await broadcastStockToRetails(env, request, modifiedProducts, context);

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

    return new Response(JSON.stringify({ success: true, updated: updatedAny }), { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
  }
}

export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    }
  });
}
