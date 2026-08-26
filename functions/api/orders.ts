export async function onRequestPost({ request, env }: any) {
  try {
    const data = await request.json();
    const { items, type, action } = data; // type: 'standard' | 'incomplete', action: 'upsert' | 'delete'
    
    if (!items || !Array.isArray(items) || !type) {
      return new Response('Invalid payload', { status: 400 });
    }

    if (action === 'delete') {
      const ids = items.map((i: any) => i.id);
      if (ids.length > 0) {
        for (let i = 0; i < ids.length; i += 50) {
          const chunk = ids.slice(i, i + 50);
          const placeholders = chunk.map(() => '?').join(',');
          await env.DB.prepare(`DELETE FROM orders WHERE id IN (${placeholders}) AND type = ?`).bind(...chunk, type).run();
        }
      }
      return Response.json({ success: true, deleted: ids.length });
    }

    if (action === 'sync_all') {
      await env.DB.prepare('DELETE FROM orders WHERE type = ?').bind(type).run();
      const stmts = items.map((o: any) => 
        env.DB.prepare('INSERT INTO orders (id, type, data) VALUES (?, ?, ?)').bind(o.id, type, JSON.stringify(o))
      );
      if (stmts.length > 0) {
        for (let i = 0; i < stmts.length; i += 50) {
          await env.DB.batch(stmts.slice(i, i + 50));
        }
      }
      return Response.json({ success: true, synced: items.length });
    }

    // Default: 'upsert'
    const stmts = items.map((o: any) => 
      env.DB.prepare('INSERT INTO orders (id, type, data) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET data = excluded.data, type = excluded.type, updated_at = CURRENT_TIMESTAMP').bind(o.id, type, JSON.stringify(o))
    );
    if (stmts.length > 0) {
        for (let i = 0; i < stmts.length; i += 50) {
          await env.DB.batch(stmts.slice(i, i + 50));
        }
    }
    
    return Response.json({ success: true, modified: items.length });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}
