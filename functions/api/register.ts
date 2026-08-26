export async function onRequestPost(context: any) {
  const { request, env } = context;
  try {
    const { email, password } = await request.json();
    const settingsRes = await env.DB.prepare('SELECT value FROM settings WHERE key = ?').bind('adminUsers').all();
    const adminUsers = settingsRes.results.length > 0 ? JSON.parse(settingsRes.results[0].value) : [];
    
    if (adminUsers.some((u: any) => u.email.trim() === email.trim())) {
        return new Response(JSON.stringify({ success: false, error: 'Email already exists.' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }
    
    const newUser = {
        id: Date.now().toString(),
        email: email.trim(),
        passwordHash: password,
        isApproved: false,
        createdAt: new Date().toISOString()
    };
    
    adminUsers.push(newUser);
    await env.DB.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
        .bind('adminUsers', JSON.stringify(adminUsers)).run();
        
    const safeUser = { ...newUser };
    delete (safeUser as any).passwordHash;
        
    return new Response(JSON.stringify({ success: true, user: safeUser }), { headers: { 'Content-Type': 'application/json' } });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
