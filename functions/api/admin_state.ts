import { replaceUploadUrls } from './_domain';
export async function onRequestGet(context: any) {
  const { env } = context;
  try {
    // Ensure table exists for migration
    await env.DB.prepare('CREATE TABLE IF NOT EXISTS customers (id TEXT PRIMARY KEY, data TEXT, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)').run();

    // D1 Performance Optimization (Runs safely using IF NOT EXISTS)
    try {
        await env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_orders_id_int ON orders(cast(id as integer))').run();
        await env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_orders_updated_at ON orders(updated_at)').run();
    } catch (e) {}

    const settingsRes = await env.DB.prepare('SELECT value FROM settings WHERE key = ?').bind('adminUsers').all();
    const customersRes = await env.DB.prepare('SELECT data FROM customers ORDER BY updated_at DESC LIMIT 2000').all();
    const allSettingsRes = await env.DB.prepare('SELECT key, value FROM settings').all();

    // Standard orders are now fetched via paginated /api/admin_orders.ts!
    const orders: any[] = [];
        
    const incompleteOrdersRes = await env.DB.prepare("SELECT data FROM orders WHERE type = 'incomplete' ORDER BY cast(id as integer) DESC LIMIT 1000").all();
    const incompleteOrders = incompleteOrdersRes.results.map((r: any) => JSON.parse(r.data));

    const adminUsers = settingsRes.results.length > 0 ? JSON.parse(settingsRes.results[0].value) : null;
    const customers = customersRes.results.map((r: any) => JSON.parse(r.data));
    
    const settings: Record<string, any> = {};
    for (const r of allSettingsRes.results) {
       settings[r.key] = JSON.parse(r.value);
    }

    let responseBody = JSON.stringify({
      orders,
      incompleteOrders,
      adminUsers,
      customers,
      settings
    });
    
    responseBody = replaceUploadUrls(responseBody, env);

    return new Response(responseBody, { headers: { 'Content-Type': 'application/json' } });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
