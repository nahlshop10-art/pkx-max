const fs = require('fs');
let content = fs.readFileSync('functions/api/admin_orders.ts', 'utf8');
const replacement = `    let responseBody = JSON.stringify({ 
       orders: paginatedOrders, 
       totalCount: totalFiltered, 
       stats 
    });
    
    let customDomain = env.R2_PUBLIC_DOMAIN || 'cdn.flixomart.store';
    customDomain = customDomain.replace(/^https?:\\/\\//, '').replace(/\\/$/, '');
    if (customDomain) {
      responseBody = responseBody.replace(/"\\/uploads\\//g, '"https://' + customDomain + '/uploads/');
    }

    return new Response(responseBody, { headers: { 'Content-Type': 'application/json' } });`;
const targetLines = [
    "    return new Response(JSON.stringify({",
    "       orders: paginatedOrders,",
    "       totalCount: totalFiltered,",
    "       stats",
    "    }), { headers: { 'Content-Type': 'application/json' } });"
].join('\n');
content = content.replace(targetLines, replacement);
fs.writeFileSync('functions/api/admin_orders.ts', content);
