import { getOriginBase } from './_domain';
export async function onRequestPost(context: any) {
  const { request, env } = context;
  try {
    const data = await request.json();
    const { items, action } = data; // items: array of products, action: 'upsert' | 'delete' | 'sync_all'
    
    if (!items || !Array.isArray(items)) {
      return new Response('Invalid items payload', { status: 400 });
    }

    if (action === 'delete') {
      const ids = items.map((i: any) => i.id);
      if (ids.length > 0) {
        // D1 limit per query is 100 parameters, batching might be needed for thousands, but usually fine for simple deletes
        for (let i = 0; i < ids.length; i += 50) {
          const chunkIds = ids.slice(i, i + 50);
          const placeholders = chunkIds.map(() => '?').join(',');
          await env.DB.prepare(`DELETE FROM products WHERE id IN (${placeholders})`).bind(...chunkIds).run();
        }
        
        // Broadcast deletes to connected retails
        try {
            const settingsRes = await env.DB.prepare("SELECT value FROM settings WHERE key = 'registered_retails'").first();
            const storeSettingsRes = await env.DB.prepare("SELECT value FROM settings WHERE key = 'websiteSettings'").first();
            const storeSettings = storeSettingsRes && storeSettingsRes.value ? JSON.parse(storeSettingsRes.value) : {};
            const masterApiKey = storeSettings?.apiSync?.masterApiKey || '';
            
            if (settingsRes && settingsRes.value) {
                const retails = JSON.parse(settingsRes.value);
                if (retails && retails.length > 0) {
                    const broadcastData = JSON.stringify({ deletedIds: ids });
                    await Promise.all(retails.map((retailUrl: string) => 
                        fetch(`${retailUrl}/api/sync_apply`, {
                            method: 'POST',
                            headers: { 
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${masterApiKey}`
                            },
                            body: broadcastData
                        }).catch(() => {})
                    ));
                }
            }
        } catch (e) {}
      }
      return Response.json({ success: true, deleted: ids.length });
    }
    
    if (action === 'sync_all') {
      // Overwrite all products (e.g. from ZIP import)
      await env.DB.prepare('DELETE FROM products').run();
      // Insert in batches
      const stmts = items.map((p: any) => 
        env.DB.prepare('INSERT INTO products (id, data) VALUES (?, ?)').bind(p.id, JSON.stringify(p))
      );
      if (stmts.length > 0) {
        for (let i = 0; i < stmts.length; i += 50) {
          const chunk = stmts.slice(i, i + 50);
          await env.DB.batch(chunk);
        }
      }
      return Response.json({ success: true, synced: items.length });
    }

    // Default: 'upsert'
    const stmts = items.map((p: any) => 
      env.DB.prepare('INSERT INTO products (id, data) VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET data = excluded.data, updated_at = CURRENT_TIMESTAMP').bind(p.id, JSON.stringify(p))
    );
    if (stmts.length > 0) {
        // D1 batch size limit is typically 100
        for (let i = 0; i < stmts.length; i += 50) {
          const chunk = stmts.slice(i, i + 50);
          await env.DB.batch(chunk);
        }
    }
    
    // Broadcast changes to connected retails
    try {
        const settingsRes = await env.DB.prepare("SELECT value FROM settings WHERE key = 'registered_retails'").first();
        const storeSettingsRes = await env.DB.prepare("SELECT value FROM settings WHERE key = 'websiteSettings'").first();
        const storeSettings = storeSettingsRes && storeSettingsRes.value ? JSON.parse(storeSettingsRes.value) : {};
        const masterApiKey = storeSettings?.apiSync?.masterApiKey || '';

        if (settingsRes && settingsRes.value) {
            const retails = JSON.parse(settingsRes.value);
            if (retails && retails.length > 0) {
                const url = new URL(request.url);
                const origin = url.origin;
                const originBase = getOriginBase(env, origin);
                
                const broadcastProducts = items.map((p: any) => {
                    const pCopy = { ...p };
                    if (pCopy.image && pCopy.image.startsWith('/')) pCopy.image = originBase + pCopy.image;
                    if (pCopy.images) pCopy.images = pCopy.images.map((img: string) => img.startsWith('/') ? originBase + img : img);
                    return pCopy;
                });
                const broadcastData = JSON.stringify({ products: broadcastProducts, isStockOnly: true });
                await Promise.all(retails.map((retailUrl: string) => 
                    fetch(`${retailUrl}/api/sync_apply`, {
                        method: 'POST',
                        headers: { 
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${masterApiKey}`
                        },
                        body: broadcastData
                    }).catch(() => {})
                ));
            }
        }
    } catch (e) {}
    
    // Invalidate public_state cache
    const cache = (caches as any).default;
    const url = new URL('/api/public_state', request.url);
    if (context.waitUntil) {
      context.waitUntil(cache.delete(new Request(url.toString())));
    } else {
      await cache.delete(new Request(url.toString()));
    }

    return Response.json({ success: true, modified: items.length });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}
