export async function onRequestPost(context: any) {
  const { request, env } = context;
  
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
    }
    const token = authHeader.split(' ')[1];

    const data = await request.json();
    const retailUrl = data.retailUrl;

    // Get settings to check if we are acting as master and if the token matches
    const settingsRes = await env.DB.prepare("SELECT key, value FROM settings").all();
    let settings: any = {};
    for (const r of settingsRes.results) {
        settings[r.key] = JSON.parse(r.value);
    }
    
    const storeSettings = settings.websiteSettings || settings.store_settings || {};
    
    if (!storeSettings?.apiSync?.enabled || !storeSettings?.apiSync?.isMaster) {
      return new Response(JSON.stringify({ error: 'Master sync is disabled on this server' }), { status: 403, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
    }
    
    if (storeSettings.apiSync.masterApiKey !== token) {
      return new Response(JSON.stringify({ error: 'Invalid API Key' }), { status: 401, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
    }
    
    // Register the retail URL
    if (retailUrl) {
      let registeredRetails = settings.registered_retails || [];
      if (!registeredRetails.includes(retailUrl)) {
        registeredRetails.push(retailUrl);
        await env.DB.prepare("INSERT INTO settings (key, value) VALUES ('registered_retails', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").bind(JSON.stringify(registeredRetails)).run();
      }
    }
    
    return new Response(JSON.stringify({ success: true, message: 'Connected successfully' }), { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
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
