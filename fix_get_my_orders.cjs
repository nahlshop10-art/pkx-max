const fs = require('fs');
const content = fs.readFileSync('functions/api/get_my_orders.ts', 'utf8');
const replacement = `    let responseBody = JSON.stringify({ orders });
    let customDomain = env.R2_PUBLIC_DOMAIN || 'cdn.flixomart.store';
    customDomain = customDomain.replace(/^https?:\\/\\//, '').replace(/\\/$/, '');
    if (customDomain) {
      responseBody = responseBody.replace(/"\\/uploads\\//g, '"https://' + customDomain + '/uploads/');
    }
    return new Response(responseBody, { headers: { 'Content-Type': 'application/json' } });`;
const target = "    return Response.json({ orders });";
fs.writeFileSync('functions/api/get_my_orders.ts', content.replace(target, replacement));
