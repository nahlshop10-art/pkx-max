export async function onRequestPost(context: any) {
  const { request, env, waitUntil } = context;
  try {
    const data = await request.json();
    const { message } = data;

    if (!message) {
      return new Response('Message is required', { status: 400 });
    }

    const settingsRes = await env.DB.prepare('SELECT value FROM settings WHERE key = ?').bind('websiteSettings').first();
    const storeSettings = settingsRes && settingsRes.value ? JSON.parse(settingsRes.value) : {};

    const telegram = storeSettings.telegramNotification;
    if (!telegram || !telegram.enabled || !telegram.botToken || !telegram.chatId) {
      return Response.json({ success: false, error: 'Telegram notification not configured' });
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    const sendTask = fetch(`https://api.telegram.org/bot${telegram.botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: telegram.chatId,
        text: message
      }),
      signal: controller.signal
    }).finally(() => clearTimeout(timeoutId));

    if (waitUntil && typeof waitUntil === 'function') {
      waitUntil(sendTask.catch(() => {}));
      return Response.json({ success: true, queued: true });
    } else {
      const res = await sendTask;
      if (!res.ok) {
        const err = await res.text();
        return Response.json({ success: false, error: err }, { status: res.status });
      }
      return Response.json({ success: true });
    }
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}
