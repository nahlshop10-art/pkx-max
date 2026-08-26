export async function onRequestPost({ request, env, waitUntil }: any) {
  try {
    const data = await request.json();
    const { key, value } = data; 
    
    if (!key || value === undefined) {
      return new Response('Invalid payload', { status: 400 });
    }

    let finalValue = value;
    if (key === 'adminUsers') {
      const currentRes = await env.DB.prepare('SELECT value FROM settings WHERE key = ?').bind('adminUsers').all();
      const currentUsers = currentRes.results.length > 0 ? JSON.parse(currentRes.results[0].value) : [];
      if (Array.isArray(value)) {
        finalValue = value.map((u: any) => {
          const existing = currentUsers.find((cu: any) => cu.email === u.email);
          if (existing && existing.passwordHash) {
            return { ...u, passwordHash: existing.passwordHash };
          }
          return u;
        });
      }
    }

    await env.DB.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP')
      .bind(key, JSON.stringify(finalValue))
      .run();
    
    // Invalidate public_state cache
    const cache = (caches as any).default;
    const url = new URL('/api/public_state', request.url);
    if (waitUntil) {
      waitUntil(cache.delete(new Request(url.toString())));
    } else {
      await cache.delete(new Request(url.toString()));
    }

    return Response.json({ success: true, key });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}
