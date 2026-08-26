import { getOriginBase } from './_domain';

export async function onRequestGet(context: any) {
  const { request, env } = context;
  
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
    }
    const token = authHeader.split(' ')[1];

    // Verify token
    const settingsRes = await env.DB.prepare("SELECT key, value FROM settings").all();
    let settings: any = {};
    for (const r of settingsRes.results) {
        settings[r.key] = JSON.parse(r.value);
    }
    
    const storeSettings = settings.websiteSettings || settings.store_settings || {};
    
    if (!storeSettings?.apiSync?.enabled || !storeSettings?.apiSync?.isMaster || storeSettings.apiSync.masterApiKey !== token) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
    }
    
    // Fetch products
    const url = new URL(request.url);
    const origin = url.origin;
    const originBase = getOriginBase(env, origin);
    
    const productsRes = await env.DB.prepare('SELECT id, data FROM products').all();
    const products = productsRes.results.map((r: any) => {
        const p = JSON.parse(r.data);
        if (p.image && p.image.startsWith('/')) p.image = originBase + p.image;
        if (p.images) p.images = p.images.map((img: string) => img.startsWith('/') ? originBase + img : img);
        return p;
    });
    
    return new Response(JSON.stringify({ 
      success: true, 
      products: products,
      categories: settings.settings?.categories || storeSettings?.categories || []
    }), { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
  }
}

export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Authorization',
    }
  });
}
