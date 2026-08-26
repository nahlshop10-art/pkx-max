export async function onRequestPost({ request, env }: any) {
  try {
    const { urlsToCheck } = await request.json();
    if (!urlsToCheck || !Array.isArray(urlsToCheck) || urlsToCheck.length === 0) {
      return Response.json({ success: true, deleted: 0 });
    }

    const promises = [];

    // 3. Check each URL
    for (const url of urlsToCheck) {
      if (!url || typeof url !== 'string') continue;
      
      // Look for the URL exactly in the JSON string
      const match = url.match(/(uploads\/.*)$/);
      if (match && match[1]) {
        const key = match[1];
        
        // Search in D1 using LIKE to avoid memory bloat
        const searchPattern = `%${key}%`;
        const productsMatch = await env.DB.prepare('SELECT id FROM products WHERE data LIKE ? LIMIT 1').bind(searchPattern).first();
        const ordersMatch = await env.DB.prepare('SELECT id FROM orders WHERE data LIKE ? LIMIT 1').bind(searchPattern).first();
        const settingsMatch = await env.DB.prepare('SELECT key FROM settings WHERE value LIKE ? LIMIT 1').bind(searchPattern).first();
        
        if (!productsMatch && !ordersMatch && !settingsMatch) {
          // If not found in DB, safe to delete!
          if (env.BUCKET) {
            promises.push(env.BUCKET.delete(key).then(() => key));
          }
        }
      }
    }

    const deletedKeys = await Promise.all(promises);
    return Response.json({ success: true, deleted: deletedKeys.length, deletedKeys });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
