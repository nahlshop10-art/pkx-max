export async function onRequestPost({ request, env }: any) {
  try {
    const settingsRes = await env.DB.prepare('SELECT value FROM settings WHERE key = ?').bind('websiteSettings').first();
    if (!settingsRes) return Response.json({ success: true, message: 'no settings' });
    
    const settings = JSON.parse(settingsRes.value);
    const retentionDays = settings?.incompleteOrdersFeature?.retentionPeriodDays ?? 7; // Default 7 days
    
    if (retentionDays === 0) {
       return Response.json({ success: true, message: 'retention disabled' });
    }

    const cutoffTime = Date.now() - (retentionDays * 24 * 60 * 60 * 1000);

    const oldIncompleteRes = await env.DB.prepare('SELECT id, data FROM orders WHERE type = ?').bind('incomplete').all();
    const idsToDelete: string[] = [];
    const urlsToRelease: string[] = [];
    
    // Extracting urls logic same as frontend
    const extractProductUrls = (product: any) => {
      const urls: string[] = [];
      if (product?.image) urls.push(product.image);
      if (product?.images) urls.push(...product.images);
      if (product?.colors) urls.push(...product.colors.map((c: any) => c.image));
      if (product?.variants) urls.push(...product.variants.map((v: any) => v.image));
      return urls.filter((u: any) => u && typeof u === 'string' && (u.startsWith('http') || u.startsWith('/uploads')));
    };

    for (const record of oldIncompleteRes.results) {
       const order = JSON.parse(record.data);
       if (order.timestamp < cutoffTime) {
          idsToDelete.push(record.id);
          const items = order.items || order.cartItems || [];
          items.forEach((item: any) => {
             if (item.product) urlsToRelease.push(...extractProductUrls(item.product));
          });
       }
    }

    if (idsToDelete.length > 0) {
       for (let i = 0; i < idsToDelete.length; i += 50) {
           const chunk = idsToDelete.slice(i, i + 50);
           const placeholders = chunk.map(() => '?').join(',');
           await env.DB.prepare(`DELETE FROM orders WHERE id IN (${placeholders})`).bind(...chunk).run();
       }
       
       // Trigger GC via internal fetch or return urls for frontend to GC
       // However, we are in a worker. We can just invoke GC logic directly here!
       if (urlsToRelease.length > 0) {
          try {
            const promises = [];
            for (const url of Array.from(new Set(urlsToRelease)) as string[]) {
              const match = url.match(/(uploads\/.*)$/);
              if (match && match[1]) {
                const key = match[1];
                
                // Search in D1 using LIKE to avoid memory bloat
                const searchPattern = `%${key}%`;
                const productsMatch = await env.DB.prepare('SELECT id FROM products WHERE data LIKE ? LIMIT 1').bind(searchPattern).first();
                const ordersMatch = await env.DB.prepare('SELECT id FROM orders WHERE data LIKE ? LIMIT 1').bind(searchPattern).first();
                const settingsMatch = await env.DB.prepare('SELECT key FROM settings WHERE value LIKE ? LIMIT 1').bind(searchPattern).first();
                
                if (!productsMatch && !ordersMatch && !settingsMatch) {
                  if (env.BUCKET) {
                    promises.push(env.BUCKET.delete(key).catch(() => {}));
                  }
                }
              }
            }
            await Promise.all(promises);
          } catch(gcErr) {
             console.error('Inner GC failed', gcErr);
          }
       }
    }

    return Response.json({ success: true, deleted: idsToDelete.length });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}
