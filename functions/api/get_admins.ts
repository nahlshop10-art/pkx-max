export async function onRequestGet(context: any) {
  const { env } = context;
  try {
    const settingsRes = await env.DB.prepare('SELECT value FROM settings WHERE key = ?').bind('adminUsers').all();
    const adminUsers = settingsRes.results.length > 0 ? JSON.parse(settingsRes.results[0].value) : null;
    
    if (adminUsers) {
        adminUsers.forEach((u: any) => {
            delete u.passwordHash;
        });
    }

    return new Response(JSON.stringify({ adminUsers }), { headers: { 'Content-Type': 'application/json' } });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
