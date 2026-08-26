export async function onRequestPost(context: any) {
  const { request, env } = context;
  try {
    const order = await request.json();

    if (!order || !order.id || !order.phone) {
      return new Response(JSON.stringify({ error: 'Invalid payload' }), { status: 400 });
    }

    // Insert or update incomplete order
    await env.DB.prepare('INSERT INTO orders (id, type, data) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET data = excluded.data, updated_at = CURRENT_TIMESTAMP')
      .bind(order.id, 'incomplete', JSON.stringify(order))
      .run();

    return Response.json({ success: true, order });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}
