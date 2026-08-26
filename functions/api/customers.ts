export async function onRequestPost({ request, env }: any) {
  try {
    const { action, items } = await request.json();
    
    if (!items || !Array.isArray(items)) {
      return new Response('Invalid items', { status: 400 });
    }

    if (action === 'upsert' || action === 'sync_all') {
      const stmts = items.map((item: any) => {
        return env.DB.prepare('INSERT OR REPLACE INTO customers (id, data) VALUES (?, ?)')
                     .bind(item.id, JSON.stringify(item));
      });
      for (let i = 0; i < stmts.length; i += 50) {
        await env.DB.batch(stmts.slice(i, i + 50));
      }
    } else if (action === 'delete') {
      const ids = items.map((i: any) => i.id);
      for (let i = 0; i < ids.length; i += 50) {
        const chunk = ids.slice(i, i + 50);
        const placeholders = chunk.map(() => '?').join(',');
        await env.DB.prepare(`DELETE FROM customers WHERE id IN (${placeholders})`).bind(...chunk).run();
      }
    }

    return Response.json({ success: true });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
