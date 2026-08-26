import { replaceUploadUrls } from './_domain';
export async function onRequestPost({ request, env }: any) {
  try {
    const data = await request.json();
    const { orderIds } = data;
    
    if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
      return Response.json({ orders: [] });
    }

    const ordersRes = await env.DB.prepare(`
        SELECT o.id, o.data 
        FROM orders o 
        JOIN json_each(?) j ON o.id = j.value
    `).bind(JSON.stringify(orderIds)).all();

    const orders = ordersRes.results.map((r: any) => JSON.parse(r.data));

    let responseBody = JSON.stringify({ orders });
    responseBody = replaceUploadUrls(responseBody, env);
    return new Response(responseBody, { headers: { 'Content-Type': 'application/json' } });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}
