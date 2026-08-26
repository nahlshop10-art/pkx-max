export async function onRequestPost(context: any) {
  const { request, env } = context;
  
  try {
    const data = await request.json();
    const { products, deletedIds, isStockOnly } = data;
    
    // Begin transaction or just run multiple statements
    const stmts: any[] = [];
    let count = 0;

    // Handle deletes
    if (deletedIds && Array.isArray(deletedIds) && deletedIds.length > 0 && !isStockOnly) {
        for (let i = 0; i < deletedIds.length; i += 25) {
            const chunkIds = deletedIds.slice(i, i + 25);
            const placeholders = chunkIds.map(() => '?').join(',');
            stmts.push(env.DB.prepare(`DELETE FROM products WHERE id IN (${placeholders})`).bind(...chunkIds));
            count += chunkIds.length;
        }
    }
    
    if (products && Array.isArray(products)) {
        // Optimize: Only fetch current products that are in the incoming payload to preserve selling price
        const productIds = products.map((p: any) => p.id);
        const currentProducts = new Map();
        
        for (let i = 0; i < productIds.length; i += 25) {
            const chunkIds = productIds.slice(i, i + 25);
            const placeholders = chunkIds.map(() => '?').join(',');
            const res = await env.DB.prepare(`SELECT id, data FROM products WHERE id IN (${placeholders})`).bind(...chunkIds).all();
            for (const r of (res.results || [])) {
                try {
                    currentProducts.set(String(r.id), JSON.parse(r.data));
                } catch (e) {}
            }
        }
        
        for (const p of products) {
            const strId = String(p.id);
            if (isStockOnly) {
                if (currentProducts.has(strId)) {
                    let current = currentProducts.get(strId);
                    current.stock = p.stock;
                    if (p.stockOutDate !== undefined) current.stockOutDate = p.stockOutDate;
                    if (p.isVisible !== undefined) current.isVisible = p.isVisible;
                    
                    if (current.variants && p.variants) {
                        current.variants = current.variants.map((cv: any) => {
                            const masterVariant = p.variants.find((mv: any) => mv.id === cv.id || (mv.name && mv.name === cv.name));
                            if (masterVariant && masterVariant.stock !== undefined) {
                                return { ...cv, stock: masterVariant.stock, isVisible: masterVariant.isVisible ?? cv.isVisible };
                            }
                            return cv;
                        });
                        const hasExplicitVariantStocks = current.variants.some((v: any) => v.stock !== undefined && v.stock !== null);
                        if (hasExplicitVariantStocks) {
                            const totalVariantStock = current.variants.reduce((acc: number, v: any) => acc + (Number(v.stock) || 0), 0);
                            current.stock = totalVariantStock;
                        } else if (p.stock !== undefined) {
                            current.stock = p.stock;
                        }
                    }
                    stmts.push(
                        env.DB.prepare('UPDATE products SET data = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
                        .bind(JSON.stringify(current), current.id || p.id)
                    );
                    count++;
                }
            } else {
                // Not just stock, sync all fields but preserve local overrides
                if (currentProducts.has(strId)) {
                    let current = currentProducts.get(strId);
                    
                    // Merge properties. P is the master product
                    let merged = { ...p };
                    // Preserve local price if autoPrice is disabled
                    if (current.autoPrice === false) {
                        merged.price = current.price;
                        merged.autoPrice = false;
                        merged.customPrice = current.customPrice;
                    }
                    
                    if (merged.variants && current.variants) {
                        merged.variants = merged.variants.map((mv: any) => {
                            const cv = current.variants.find((v: any) => v.id === mv.id);
                            if (cv && current.autoPrice === false) {
                                return { ...mv, price: cv.price };
                            }
                            return mv;
                        });
                    }
                    
                    stmts.push(
                        env.DB.prepare('UPDATE products SET data = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
                        .bind(JSON.stringify(merged), p.id)
                    );
                    count++;
                } else {
                    // New product
                    stmts.push(
                        env.DB.prepare('INSERT INTO products (id, data) VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET data = excluded.data, updated_at = CURRENT_TIMESTAMP')
                        .bind(p.id, JSON.stringify(p))
                    );
                    count++;
                }
            }
        }
    }
    
    // Batch execute statements in chunks of 25 (safe for Cloudflare D1 40-statement limit)
    if (stmts.length > 0) {
        for (let i = 0; i < stmts.length; i += 25) {
          const chunk = stmts.slice(i, i + 25);
          await env.DB.batch(chunk);
        }
    }
    
    // Optional category sync if provided
    if (data.categories && Array.isArray(data.categories) && data.categories.length > 0 && !isStockOnly) {
      try {
        const storeSettingsRes = await env.DB.prepare("SELECT value FROM settings WHERE key = 'websiteSettings'").first();
        if (storeSettingsRes && storeSettingsRes.value) {
          const storeSettings = JSON.parse(storeSettingsRes.value as string);
          if (!storeSettings.categories || storeSettings.categories.length === 0) {
            storeSettings.categories = data.categories;
            await env.DB.prepare("INSERT INTO settings (key, value) VALUES ('websiteSettings', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value")
              .bind(JSON.stringify(storeSettings)).run();
          }
        }
      } catch (e) {}
    }
    
    // Invalidate cache
    try {
      const cache = (caches as any).default;
      const url = new URL('/api/public_state', request.url);
      if (context.waitUntil) {
        context.waitUntil(cache.delete(new Request(url.toString())));
      } else {
        await cache.delete(new Request(url.toString()));
      }
    } catch (e) {}
    
    return new Response(JSON.stringify({ success: true, processed: count }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message || 'Internal sync error' }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
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
