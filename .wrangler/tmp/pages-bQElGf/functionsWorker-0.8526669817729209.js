var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// api/_domain.ts
function getCustomDomain(env) {
  let customDomain = env.R2_PUBLIC_DOMAIN || "pub-e5254e3b24604306b8ea63f93412de76.r2.dev";
  return customDomain.replace(/^https?:\/\//, "").replace(/\/$/, "");
}
__name(getCustomDomain, "getCustomDomain");
function replaceUploadUrls(responseBody, env) {
  const customDomain = getCustomDomain(env);
  if (customDomain) {
    return responseBody.replace(/"\/uploads\//g, `"https://${customDomain}/uploads/`);
  }
  return responseBody;
}
__name(replaceUploadUrls, "replaceUploadUrls");
function getOriginBase(env, requestOrigin) {
  const customDomain = getCustomDomain(env);
  return customDomain ? `https://${customDomain}` : requestOrigin;
}
__name(getOriginBase, "getOriginBase");

// api/admin_orders.ts
async function onRequestGet(context) {
  const { request, env } = context;
  try {
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get("page") || "1");
    const limit = parseInt(url.searchParams.get("limit") || "50");
    const search = url.searchParams.get("search") || "";
    const statusFilter = url.searchParams.get("status") || "All";
    const startDate = url.searchParams.get("startDate") || "";
    const endDate = url.searchParams.get("endDate") || "";
    let statsQuery = `
      SELECT 
        json_extract(data, '$.status') as status, 
        json_extract(data, '$.date') as date, 
        json_extract(data, '$.subtotal') as subtotal, 
        json_extract(data, '$.discount') as discount, 
        json_extract(data, '$.profit') as profit, 
        json_extract(data, '$.returnCost') as returnCost,
        json_extract(data, '$.extraCosts') as extraCosts,
        json_extract(data, '$.items') as items
      FROM orders WHERE type = 'standard'
    `;
    const statsParams = [];
    let start = startDate ? new Date(startDate) : null;
    let end = endDate ? new Date(endDate) : null;
    if (start && end) {
      const startStr = start.toISOString().replace("T", " ").substring(0, 19);
      const endStr = end.toISOString().replace("T", " ").substring(0, 19);
      statsQuery += ` AND updated_at >= ? AND updated_at <= ?`;
      statsParams.push(startStr, endStr);
    }
    const statsRes = await env.DB.prepare(statsQuery).bind(...statsParams).all();
    let stats = {
      totalOrders: 0,
      completedOrders: 0,
      canceledOrders: 0,
      totalSellAmount: 0,
      completedSellAmount: 0,
      totalProfitAmount: 0,
      completedProfitAmount: 0,
      totalReturnedCost: 0,
      totalQuantity: 0,
      uniqueItemIds: [],
      productSales: {},
      salesData: {}
    };
    for (const o of statsRes.results) {
      const datePart = o.date ? String(o.date).split(", ")[1] : null;
      let orderDate = null;
      if (datePart) {
        const [month, day2, year2] = datePart.split("/");
        orderDate = new Date(Number(year2), Number(month) - 1, Number(day2));
      }
      if (start && end && orderDate) {
        if (orderDate < start || orderDate > end) {
          continue;
        }
      }
      stats.totalOrders++;
      if (o.status === "Completed") stats.completedOrders++;
      if (o.status === "Canceled") stats.canceledOrders++;
      let subtotal = (Number(o.subtotal) || 0) - (Number(o.discount) || 0);
      stats.totalSellAmount += subtotal;
      if (o.status === "Completed") stats.completedSellAmount += subtotal;
      let profit = o.profit !== null ? Number(o.profit) : void 0;
      if (profit === void 0) {
        let orderCost = 0;
        if (o.items) {
          try {
            const items = JSON.parse(String(o.items));
            orderCost = items.reduce((cost, item) => cost + (item.variantBuyPrice ?? (item.product?.buyPrice || Math.floor((item.variantPrice ?? item.product?.price) * 0.4))) * item.quantity, 0);
          } catch (e) {
          }
        }
        profit = subtotal - orderCost - (Number(o.extraCosts) || 0) - (Number(o.returnCost) || 0);
      }
      stats.totalProfitAmount += profit;
      if (o.status === "Completed") stats.completedProfitAmount += profit;
      if (o.returnCost && Number(o.returnCost) > 0) {
        stats.totalReturnedCost += Number(o.returnCost);
      }
      if (o.items) {
        try {
          const items = JSON.parse(String(o.items));
          if (Array.isArray(items)) {
            items.forEach((item) => {
              stats.totalQuantity += item.quantity || 1;
              if (item.product && item.product.id) {
                if (!stats.uniqueItemIds.includes(item.product.id)) {
                  stats.uniqueItemIds.push(item.product.id);
                }
                if (o.status !== "Canceled" && o.status !== "Returned" && o.status !== "Complete Return") {
                  stats.productSales[item.product.id] = (stats.productSales[item.product.id] || 0) + (item.quantity || 1);
                }
              }
            });
          }
        } catch (e) {
        }
      }
      if (datePart) {
        const [month, day2, year2] = datePart.split("/");
        const formattedDate = `${year2}-${month.padStart(2, "0")}-${day2.padStart(2, "0")}`;
        if (!stats.salesData[formattedDate]) {
          stats.salesData[formattedDate] = { total: 0, profit: 0, count: 0 };
        }
        stats.salesData[formattedDate].total += subtotal;
        stats.salesData[formattedDate].profit += profit;
        stats.salesData[formattedDate].count += 1;
      }
    }
    let listQuery = `SELECT data FROM orders WHERE type = 'standard'`;
    const params = [];
    if (search) {
      const cleanSearch = search.replace(/#/g, "");
      listQuery += ` AND (json_extract(data, '$.id') LIKE ? OR json_extract(data, '$.userInfo.phone') LIKE ? OR json_extract(data, '$.userInfo.name') LIKE ?)`;
      params.push(`%${cleanSearch}%`, `%${search}%`, `%${search}%`);
    }
    if (statusFilter !== "All") {
      listQuery += ` AND json_extract(data, '$.status') = ?`;
      params.push(statusFilter);
    }
    const countQuery = listQuery.replace("SELECT data FROM orders", "SELECT COUNT(*) as total FROM orders");
    const countRes = await env.DB.prepare(countQuery).bind(...params).first();
    const totalFiltered = countRes ? countRes.total : 0;
    listQuery += ` ORDER BY cast(id as integer) DESC LIMIT ? OFFSET ?`;
    params.push(limit, (page - 1) * limit);
    const paginatedOrdersRes = await env.DB.prepare(listQuery).bind(...params).all();
    const paginatedOrders = paginatedOrdersRes.results.map((r) => JSON.parse(r.data));
    let responseBody = JSON.stringify({
      orders: paginatedOrders,
      totalCount: totalFiltered,
      stats
    });
    responseBody = replaceUploadUrls(responseBody, env);
    return new Response(responseBody, { headers: { "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
}
__name(onRequestGet, "onRequestGet");

// api/admin_state.ts
async function onRequestGet2(context) {
  const { env } = context;
  try {
    const productsRes = await env.DB.prepare("SELECT id, data FROM products LIMIT 5000").all();
    const settingsRes = await env.DB.prepare("SELECT value FROM settings WHERE key = ?").bind("adminUsers").all();
    const customersRes = await env.DB.prepare("SELECT data FROM customers ORDER BY updated_at DESC LIMIT 2000").all();
    const allSettingsRes = await env.DB.prepare("SELECT key, value FROM settings").all();
    const orders = [];
    const incompleteOrdersRes = await env.DB.prepare("SELECT data FROM orders WHERE type = 'incomplete' ORDER BY cast(id as integer) DESC LIMIT 1000").all();
    const incompleteOrders = incompleteOrdersRes.results.map((r) => JSON.parse(r.data));
    const products = productsRes.results.map((r) => JSON.parse(r.data));
    const adminUsers = settingsRes.results.length > 0 ? JSON.parse(settingsRes.results[0].value) : null;
    const customers = customersRes.results.map((r) => JSON.parse(r.data));
    const settings = {};
    for (const r of allSettingsRes.results) {
      settings[r.key] = JSON.parse(r.value);
    }
    let responseBody = JSON.stringify({
      products,
      orders,
      incompleteOrders,
      adminUsers,
      customers,
      settings
    });
    responseBody = replaceUploadUrls(responseBody, env);
    return new Response(responseBody, { headers: { "Content-Type": "application/json" } });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
}
__name(onRequestGet2, "onRequestGet");

// api/customers.ts
async function onRequestPost({ request, env }) {
  try {
    const { action, items } = await request.json();
    if (!items || !Array.isArray(items)) {
      return new Response("Invalid items", { status: 400 });
    }
    if (action === "upsert" || action === "sync_all") {
      const stmts = items.map((item) => {
        return env.DB.prepare("INSERT OR REPLACE INTO customers (id, data) VALUES (?, ?)").bind(item.id, JSON.stringify(item));
      });
      for (let i = 0; i < stmts.length; i += 50) {
        await env.DB.batch(stmts.slice(i, i + 50));
      }
    } else if (action === "delete") {
      const ids = items.map((i) => i.id);
      for (let i = 0; i < ids.length; i += 50) {
        const chunk = ids.slice(i, i + 50);
        const placeholders = chunk.map(() => "?").join(",");
        await env.DB.prepare(`DELETE FROM customers WHERE id IN (${placeholders})`).bind(...chunk).run();
      }
    }
    return Response.json({ success: true });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
}
__name(onRequestPost, "onRequestPost");

// api/facebook.ts
async function onRequestPost2({ request, env }) {
  try {
    const data = await request.json();
    const settingsRow = await env.DB.prepare(
      "SELECT value FROM settings WHERE key = ?"
    ).bind("marketingSettings").first();
    if (!settingsRow)
      return new Response(
        JSON.stringify({ success: false, reason: "No marketing settings" }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    const settings = JSON.parse(settingsRow.value);
    const pixelSettings = settings.metaPixel;
    if (!pixelSettings || !pixelSettings.enabled || !pixelSettings.pixelId || !pixelSettings.accessToken) {
      return new Response(
        JSON.stringify({
          success: false,
          reason: "Meta pixel server tracking not configured"
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }
    const inputEvents = data.events && Array.isArray(data.events) ? data.events : [data];
    const clientIp = request.headers.get("cf-connecting-ip") || request.headers.get("x-real-ip") || request.headers.get("x-forwarded-for") || "127.0.0.1";
    const fbDataArray = inputEvents.map((ev) => {
      const user_data = {
        ...ev.user_data,
        client_ip_address: clientIp
      };
      return {
        ...ev,
        user_data
      };
    });
    const payload = {
      data: fbDataArray
    };
    if (pixelSettings.testCode) {
      payload.test_event_code = pixelSettings.testCode;
    }
    const url = `https://graph.facebook.com/v19.0/${pixelSettings.pixelId}/events?access_token=${pixelSettings.accessToken}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6e3);
    let response;
    try {
      response = await fetch(
        url,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(payload),
          signal: controller.signal
        }
      );
    } finally {
      clearTimeout(timeoutId);
    }
    const responseData = await response.json();
    return new Response(JSON.stringify(responseData), {
      status: response.status,
      headers: { "Content-Type": "application/json" }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
__name(onRequestPost2, "onRequestPost");

// api/ga4.ts
async function onRequestPost3({ request, env }) {
  try {
    const data = await request.json();
    const settingsRow = await env.DB.prepare(
      "SELECT value FROM settings WHERE key = ?"
    ).bind("marketingSettings").first();
    if (!settingsRow)
      return new Response(
        JSON.stringify({ success: false, reason: "No marketing settings" }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    const settings = JSON.parse(settingsRow.value);
    const pixelSettings = settings.ga4;
    if (!pixelSettings || !pixelSettings.enabled || !pixelSettings.measurementId || !pixelSettings.apiSecret) {
      return new Response(
        JSON.stringify({
          success: false,
          reason: "GA4 server tracking not configured"
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }
    const payload = {
      client_id: data.client_id,
      events: data.events
    };
    if (data.user_data) {
      payload.user_data = data.user_data;
    }
    const url = `https://www.google-analytics.com/mp/collect?measurement_id=${pixelSettings.measurementId}&api_secret=${pixelSettings.apiSecret}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6e3);
    let response;
    try {
      response = await fetch(
        url,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(payload),
          signal: controller.signal
        }
      );
    } finally {
      clearTimeout(timeoutId);
    }
    let responseData = {};
    try {
      responseData = await response.json();
    } catch (e) {
      responseData = { success: true };
    }
    return new Response(JSON.stringify(responseData), {
      status: response.status,
      headers: { "Content-Type": "application/json" }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
__name(onRequestPost3, "onRequestPost");

// api/gc.ts
async function onRequestPost4({ request, env }) {
  try {
    const { urlsToCheck } = await request.json();
    if (!urlsToCheck || !Array.isArray(urlsToCheck) || urlsToCheck.length === 0) {
      return Response.json({ success: true, deleted: 0 });
    }
    const promises = [];
    for (const url of urlsToCheck) {
      if (!url || typeof url !== "string") continue;
      const match2 = url.match(/(uploads\/.*)$/);
      if (match2 && match2[1]) {
        const key = match2[1];
        const searchPattern = `%${key}%`;
        const productsMatch = await env.DB.prepare("SELECT id FROM products WHERE data LIKE ? LIMIT 1").bind(searchPattern).first();
        const ordersMatch = await env.DB.prepare("SELECT id FROM orders WHERE data LIKE ? LIMIT 1").bind(searchPattern).first();
        const settingsMatch = await env.DB.prepare("SELECT key FROM settings WHERE value LIKE ? LIMIT 1").bind(searchPattern).first();
        if (!productsMatch && !ordersMatch && !settingsMatch) {
          if (env.BUCKET) {
            promises.push(env.BUCKET.delete(key).then(() => key));
          }
        }
      }
    }
    const deletedKeys = await Promise.all(promises);
    return Response.json({ success: true, deleted: deletedKeys.length, deletedKeys });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
}
__name(onRequestPost4, "onRequestPost");

// api/get_admins.ts
async function onRequestGet3(context) {
  const { env } = context;
  try {
    const settingsRes = await env.DB.prepare("SELECT value FROM settings WHERE key = ?").bind("adminUsers").all();
    const adminUsers = settingsRes.results.length > 0 ? JSON.parse(settingsRes.results[0].value) : null;
    if (adminUsers) {
      adminUsers.forEach((u) => {
        delete u.passwordHash;
      });
    }
    return new Response(JSON.stringify({ adminUsers }), { headers: { "Content-Type": "application/json" } });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
}
__name(onRequestGet3, "onRequestGet");

// api/get_my_orders.ts
async function onRequestPost5({ request, env }) {
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
    const orders = ordersRes.results.map((r) => JSON.parse(r.data));
    let responseBody = JSON.stringify({ orders });
    responseBody = replaceUploadUrls(responseBody, env);
    return new Response(responseBody, { headers: { "Content-Type": "application/json" } });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}
__name(onRequestPost5, "onRequestPost");

// ../node_modules/jose/dist/webapi/lib/buffer_utils.js
var encoder = new TextEncoder();
var decoder = new TextDecoder();
var MAX_INT32 = 2 ** 32;
function concat(...buffers) {
  const size = buffers.reduce((acc, { length }) => acc + length, 0);
  const buf = new Uint8Array(size);
  let i = 0;
  for (const buffer of buffers) {
    buf.set(buffer, i);
    i += buffer.length;
  }
  return buf;
}
__name(concat, "concat");
function encode(string) {
  const bytes = new Uint8Array(string.length);
  for (let i = 0; i < string.length; i++) {
    const code = string.charCodeAt(i);
    if (code > 127) {
      throw new TypeError("non-ASCII string encountered in encode()");
    }
    bytes[i] = code;
  }
  return bytes;
}
__name(encode, "encode");

// ../node_modules/jose/dist/webapi/lib/base64.js
function encodeBase64(input) {
  if (Uint8Array.prototype.toBase64) {
    return input.toBase64();
  }
  const CHUNK_SIZE = 32768;
  const arr = [];
  for (let i = 0; i < input.length; i += CHUNK_SIZE) {
    arr.push(String.fromCharCode.apply(null, input.subarray(i, i + CHUNK_SIZE)));
  }
  return btoa(arr.join(""));
}
__name(encodeBase64, "encodeBase64");
function decodeBase64(encoded) {
  if (Uint8Array.fromBase64) {
    return Uint8Array.fromBase64(encoded);
  }
  const binary = atob(encoded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}
__name(decodeBase64, "decodeBase64");

// ../node_modules/jose/dist/webapi/util/base64url.js
function decode(input) {
  if (Uint8Array.fromBase64) {
    return Uint8Array.fromBase64(typeof input === "string" ? input : decoder.decode(input), {
      alphabet: "base64url"
    });
  }
  let encoded = input;
  if (encoded instanceof Uint8Array) {
    encoded = decoder.decode(encoded);
  }
  encoded = encoded.replace(/-/g, "+").replace(/_/g, "/");
  try {
    return decodeBase64(encoded);
  } catch {
    throw new TypeError("The input to be decoded is not correctly encoded.");
  }
}
__name(decode, "decode");
function encode2(input) {
  let unencoded = input;
  if (typeof unencoded === "string") {
    unencoded = encoder.encode(unencoded);
  }
  if (Uint8Array.prototype.toBase64) {
    return unencoded.toBase64({ alphabet: "base64url", omitPadding: true });
  }
  return encodeBase64(unencoded).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}
__name(encode2, "encode");

// ../node_modules/jose/dist/webapi/lib/crypto_key.js
var unusable = /* @__PURE__ */ __name((name, prop = "algorithm.name") => new TypeError(`CryptoKey does not support this operation, its ${prop} must be ${name}`), "unusable");
var isAlgorithm = /* @__PURE__ */ __name((algorithm, name) => algorithm.name === name, "isAlgorithm");
function getHashLength(hash) {
  return parseInt(hash.name.slice(4), 10);
}
__name(getHashLength, "getHashLength");
function checkHashLength(algorithm, expected) {
  const actual = getHashLength(algorithm.hash);
  if (actual !== expected)
    throw unusable(`SHA-${expected}`, "algorithm.hash");
}
__name(checkHashLength, "checkHashLength");
function getNamedCurve(alg) {
  switch (alg) {
    case "ES256":
      return "P-256";
    case "ES384":
      return "P-384";
    case "ES512":
      return "P-521";
    default:
      throw new Error("unreachable");
  }
}
__name(getNamedCurve, "getNamedCurve");
function checkUsage(key, usage) {
  if (usage && !key.usages.includes(usage)) {
    throw new TypeError(`CryptoKey does not support this operation, its usages must include ${usage}.`);
  }
}
__name(checkUsage, "checkUsage");
function checkSigCryptoKey(key, alg, usage) {
  switch (alg) {
    case "HS256":
    case "HS384":
    case "HS512": {
      if (!isAlgorithm(key.algorithm, "HMAC"))
        throw unusable("HMAC");
      checkHashLength(key.algorithm, parseInt(alg.slice(2), 10));
      break;
    }
    case "RS256":
    case "RS384":
    case "RS512": {
      if (!isAlgorithm(key.algorithm, "RSASSA-PKCS1-v1_5"))
        throw unusable("RSASSA-PKCS1-v1_5");
      checkHashLength(key.algorithm, parseInt(alg.slice(2), 10));
      break;
    }
    case "PS256":
    case "PS384":
    case "PS512": {
      if (!isAlgorithm(key.algorithm, "RSA-PSS"))
        throw unusable("RSA-PSS");
      checkHashLength(key.algorithm, parseInt(alg.slice(2), 10));
      break;
    }
    case "Ed25519":
    case "EdDSA": {
      if (!isAlgorithm(key.algorithm, "Ed25519"))
        throw unusable("Ed25519");
      break;
    }
    case "ML-DSA-44":
    case "ML-DSA-65":
    case "ML-DSA-87": {
      if (!isAlgorithm(key.algorithm, alg))
        throw unusable(alg);
      break;
    }
    case "ES256":
    case "ES384":
    case "ES512": {
      if (!isAlgorithm(key.algorithm, "ECDSA"))
        throw unusable("ECDSA");
      const expected = getNamedCurve(alg);
      const actual = key.algorithm.namedCurve;
      if (actual !== expected)
        throw unusable(expected, "algorithm.namedCurve");
      break;
    }
    default:
      throw new TypeError("CryptoKey does not support this operation");
  }
  checkUsage(key, usage);
}
__name(checkSigCryptoKey, "checkSigCryptoKey");

// ../node_modules/jose/dist/webapi/lib/invalid_key_input.js
function message(msg, actual, ...types) {
  types = types.filter(Boolean);
  if (types.length > 2) {
    const last = types.pop();
    msg += `one of type ${types.join(", ")}, or ${last}.`;
  } else if (types.length === 2) {
    msg += `one of type ${types[0]} or ${types[1]}.`;
  } else {
    msg += `of type ${types[0]}.`;
  }
  if (actual == null) {
    msg += ` Received ${actual}`;
  } else if (typeof actual === "function" && actual.name) {
    msg += ` Received function ${actual.name}`;
  } else if (typeof actual === "object" && actual != null) {
    if (actual.constructor?.name) {
      msg += ` Received an instance of ${actual.constructor.name}`;
    }
  }
  return msg;
}
__name(message, "message");
var invalidKeyInput = /* @__PURE__ */ __name((actual, ...types) => message("Key must be ", actual, ...types), "invalidKeyInput");
var withAlg = /* @__PURE__ */ __name((alg, actual, ...types) => message(`Key for the ${alg} algorithm must be `, actual, ...types), "withAlg");

// ../node_modules/jose/dist/webapi/util/errors.js
var JOSEError = class extends Error {
  static {
    __name(this, "JOSEError");
  }
  static code = "ERR_JOSE_GENERIC";
  code = "ERR_JOSE_GENERIC";
  constructor(message2, options) {
    super(message2, options);
    this.name = this.constructor.name;
    Error.captureStackTrace?.(this, this.constructor);
  }
};
var JWTClaimValidationFailed = class extends JOSEError {
  static {
    __name(this, "JWTClaimValidationFailed");
  }
  static code = "ERR_JWT_CLAIM_VALIDATION_FAILED";
  code = "ERR_JWT_CLAIM_VALIDATION_FAILED";
  claim;
  reason;
  payload;
  constructor(message2, payload, claim = "unspecified", reason = "unspecified") {
    super(message2, { cause: { claim, reason, payload } });
    this.claim = claim;
    this.reason = reason;
    this.payload = payload;
  }
};
var JWTExpired = class extends JOSEError {
  static {
    __name(this, "JWTExpired");
  }
  static code = "ERR_JWT_EXPIRED";
  code = "ERR_JWT_EXPIRED";
  claim;
  reason;
  payload;
  constructor(message2, payload, claim = "unspecified", reason = "unspecified") {
    super(message2, { cause: { claim, reason, payload } });
    this.claim = claim;
    this.reason = reason;
    this.payload = payload;
  }
};
var JOSEAlgNotAllowed = class extends JOSEError {
  static {
    __name(this, "JOSEAlgNotAllowed");
  }
  static code = "ERR_JOSE_ALG_NOT_ALLOWED";
  code = "ERR_JOSE_ALG_NOT_ALLOWED";
};
var JOSENotSupported = class extends JOSEError {
  static {
    __name(this, "JOSENotSupported");
  }
  static code = "ERR_JOSE_NOT_SUPPORTED";
  code = "ERR_JOSE_NOT_SUPPORTED";
};
var JWSInvalid = class extends JOSEError {
  static {
    __name(this, "JWSInvalid");
  }
  static code = "ERR_JWS_INVALID";
  code = "ERR_JWS_INVALID";
};
var JWTInvalid = class extends JOSEError {
  static {
    __name(this, "JWTInvalid");
  }
  static code = "ERR_JWT_INVALID";
  code = "ERR_JWT_INVALID";
};
var JWSSignatureVerificationFailed = class extends JOSEError {
  static {
    __name(this, "JWSSignatureVerificationFailed");
  }
  static code = "ERR_JWS_SIGNATURE_VERIFICATION_FAILED";
  code = "ERR_JWS_SIGNATURE_VERIFICATION_FAILED";
  constructor(message2 = "signature verification failed", options) {
    super(message2, options);
  }
};

// ../node_modules/jose/dist/webapi/lib/is_key_like.js
var isCryptoKey = /* @__PURE__ */ __name((key) => {
  if (key?.[Symbol.toStringTag] === "CryptoKey")
    return true;
  try {
    return key instanceof CryptoKey;
  } catch {
    return false;
  }
}, "isCryptoKey");
var isKeyObject = /* @__PURE__ */ __name((key) => key?.[Symbol.toStringTag] === "KeyObject", "isKeyObject");
var isKeyLike = /* @__PURE__ */ __name((key) => isCryptoKey(key) || isKeyObject(key), "isKeyLike");

// ../node_modules/jose/dist/webapi/lib/helpers.js
function assertNotSet(value, name) {
  if (value) {
    throw new TypeError(`${name} can only be called once`);
  }
}
__name(assertNotSet, "assertNotSet");
function decodeBase64url(value, label, ErrorClass) {
  try {
    return decode(value);
  } catch {
    throw new ErrorClass(`Failed to base64url decode the ${label}`);
  }
}
__name(decodeBase64url, "decodeBase64url");

// ../node_modules/jose/dist/webapi/lib/type_checks.js
var isObjectLike = /* @__PURE__ */ __name((value) => typeof value === "object" && value !== null, "isObjectLike");
function isObject(input) {
  if (!isObjectLike(input) || Object.prototype.toString.call(input) !== "[object Object]") {
    return false;
  }
  if (Object.getPrototypeOf(input) === null) {
    return true;
  }
  let proto = input;
  while (Object.getPrototypeOf(proto) !== null) {
    proto = Object.getPrototypeOf(proto);
  }
  return Object.getPrototypeOf(input) === proto;
}
__name(isObject, "isObject");
function isDisjoint(...headers) {
  const sources = headers.filter(Boolean);
  if (sources.length === 0 || sources.length === 1) {
    return true;
  }
  let acc;
  for (const header of sources) {
    const parameters = Object.keys(header);
    if (!acc || acc.size === 0) {
      acc = new Set(parameters);
      continue;
    }
    for (const parameter of parameters) {
      if (acc.has(parameter)) {
        return false;
      }
      acc.add(parameter);
    }
  }
  return true;
}
__name(isDisjoint, "isDisjoint");
var isJWK = /* @__PURE__ */ __name((key) => isObject(key) && typeof key.kty === "string", "isJWK");
var isPrivateJWK = /* @__PURE__ */ __name((key) => key.kty !== "oct" && (key.kty === "AKP" && typeof key.priv === "string" || typeof key.d === "string"), "isPrivateJWK");
var isPublicJWK = /* @__PURE__ */ __name((key) => key.kty !== "oct" && key.d === void 0 && key.priv === void 0, "isPublicJWK");
var isSecretJWK = /* @__PURE__ */ __name((key) => key.kty === "oct" && typeof key.k === "string", "isSecretJWK");

// ../node_modules/jose/dist/webapi/lib/signing.js
function checkKeyLength(alg, key) {
  if (alg.startsWith("RS") || alg.startsWith("PS")) {
    const { modulusLength } = key.algorithm;
    if (typeof modulusLength !== "number" || modulusLength < 2048) {
      throw new TypeError(`${alg} requires key modulusLength to be 2048 bits or larger`);
    }
  }
}
__name(checkKeyLength, "checkKeyLength");
function subtleAlgorithm(alg, algorithm) {
  const hash = `SHA-${alg.slice(-3)}`;
  switch (alg) {
    case "HS256":
    case "HS384":
    case "HS512":
      return { hash, name: "HMAC" };
    case "PS256":
    case "PS384":
    case "PS512":
      return { hash, name: "RSA-PSS", saltLength: parseInt(alg.slice(-3), 10) >> 3 };
    case "RS256":
    case "RS384":
    case "RS512":
      return { hash, name: "RSASSA-PKCS1-v1_5" };
    case "ES256":
    case "ES384":
    case "ES512":
      return { hash, name: "ECDSA", namedCurve: algorithm.namedCurve };
    case "Ed25519":
    case "EdDSA":
      return { name: "Ed25519" };
    case "ML-DSA-44":
    case "ML-DSA-65":
    case "ML-DSA-87":
      return { name: alg };
    default:
      throw new JOSENotSupported(`alg ${alg} is not supported either by JOSE or your javascript runtime`);
  }
}
__name(subtleAlgorithm, "subtleAlgorithm");
async function getSigKey(alg, key, usage) {
  if (key instanceof Uint8Array) {
    if (!alg.startsWith("HS")) {
      throw new TypeError(invalidKeyInput(key, "CryptoKey", "KeyObject", "JSON Web Key"));
    }
    return crypto.subtle.importKey("raw", key, { hash: `SHA-${alg.slice(-3)}`, name: "HMAC" }, false, [usage]);
  }
  checkSigCryptoKey(key, alg, usage);
  return key;
}
__name(getSigKey, "getSigKey");
async function sign(alg, key, data) {
  const cryptoKey = await getSigKey(alg, key, "sign");
  checkKeyLength(alg, cryptoKey);
  const signature = await crypto.subtle.sign(subtleAlgorithm(alg, cryptoKey.algorithm), cryptoKey, data);
  return new Uint8Array(signature);
}
__name(sign, "sign");
async function verify(alg, key, signature, data) {
  const cryptoKey = await getSigKey(alg, key, "verify");
  checkKeyLength(alg, cryptoKey);
  const algorithm = subtleAlgorithm(alg, cryptoKey.algorithm);
  try {
    return await crypto.subtle.verify(algorithm, cryptoKey, signature, data);
  } catch {
    return false;
  }
}
__name(verify, "verify");

// ../node_modules/jose/dist/webapi/lib/jwk_to_key.js
var unsupportedAlg = 'Invalid or unsupported JWK "alg" (Algorithm) Parameter value';
function subtleMapping(jwk) {
  let algorithm;
  let keyUsages;
  switch (jwk.kty) {
    case "AKP": {
      switch (jwk.alg) {
        case "ML-DSA-44":
        case "ML-DSA-65":
        case "ML-DSA-87":
          algorithm = { name: jwk.alg };
          keyUsages = jwk.priv ? ["sign"] : ["verify"];
          break;
        default:
          throw new JOSENotSupported(unsupportedAlg);
      }
      break;
    }
    case "RSA": {
      switch (jwk.alg) {
        case "PS256":
        case "PS384":
        case "PS512":
          algorithm = { name: "RSA-PSS", hash: `SHA-${jwk.alg.slice(-3)}` };
          keyUsages = jwk.d ? ["sign"] : ["verify"];
          break;
        case "RS256":
        case "RS384":
        case "RS512":
          algorithm = { name: "RSASSA-PKCS1-v1_5", hash: `SHA-${jwk.alg.slice(-3)}` };
          keyUsages = jwk.d ? ["sign"] : ["verify"];
          break;
        case "RSA-OAEP":
        case "RSA-OAEP-256":
        case "RSA-OAEP-384":
        case "RSA-OAEP-512":
          algorithm = {
            name: "RSA-OAEP",
            hash: `SHA-${parseInt(jwk.alg.slice(-3), 10) || 1}`
          };
          keyUsages = jwk.d ? ["decrypt", "unwrapKey"] : ["encrypt", "wrapKey"];
          break;
        default:
          throw new JOSENotSupported(unsupportedAlg);
      }
      break;
    }
    case "EC": {
      switch (jwk.alg) {
        case "ES256":
        case "ES384":
        case "ES512":
          algorithm = {
            name: "ECDSA",
            namedCurve: { ES256: "P-256", ES384: "P-384", ES512: "P-521" }[jwk.alg]
          };
          keyUsages = jwk.d ? ["sign"] : ["verify"];
          break;
        case "ECDH-ES":
        case "ECDH-ES+A128KW":
        case "ECDH-ES+A192KW":
        case "ECDH-ES+A256KW":
          algorithm = { name: "ECDH", namedCurve: jwk.crv };
          keyUsages = jwk.d ? ["deriveBits"] : [];
          break;
        default:
          throw new JOSENotSupported(unsupportedAlg);
      }
      break;
    }
    case "OKP": {
      switch (jwk.alg) {
        case "Ed25519":
        case "EdDSA":
          algorithm = { name: "Ed25519" };
          keyUsages = jwk.d ? ["sign"] : ["verify"];
          break;
        case "ECDH-ES":
        case "ECDH-ES+A128KW":
        case "ECDH-ES+A192KW":
        case "ECDH-ES+A256KW":
          algorithm = { name: jwk.crv };
          keyUsages = jwk.d ? ["deriveBits"] : [];
          break;
        default:
          throw new JOSENotSupported(unsupportedAlg);
      }
      break;
    }
    default:
      throw new JOSENotSupported('Invalid or unsupported JWK "kty" (Key Type) Parameter value');
  }
  return { algorithm, keyUsages };
}
__name(subtleMapping, "subtleMapping");
async function jwkToKey(jwk) {
  if (!jwk.alg) {
    throw new TypeError('"alg" argument is required when "jwk.alg" is not present');
  }
  const { algorithm, keyUsages } = subtleMapping(jwk);
  const keyData = { ...jwk };
  if (keyData.kty !== "AKP") {
    delete keyData.alg;
  }
  delete keyData.use;
  return crypto.subtle.importKey("jwk", keyData, algorithm, jwk.ext ?? (jwk.d || jwk.priv ? false : true), jwk.key_ops ?? keyUsages);
}
__name(jwkToKey, "jwkToKey");

// ../node_modules/jose/dist/webapi/lib/normalize_key.js
var unusableForAlg = "given KeyObject instance cannot be used for this algorithm";
var cache;
var handleJWK = /* @__PURE__ */ __name(async (key, jwk, alg, freeze = false) => {
  cache ||= /* @__PURE__ */ new WeakMap();
  let cached = cache.get(key);
  if (cached?.[alg]) {
    return cached[alg];
  }
  const cryptoKey = await jwkToKey({ ...jwk, alg });
  if (freeze)
    Object.freeze(key);
  if (!cached) {
    cache.set(key, { [alg]: cryptoKey });
  } else {
    cached[alg] = cryptoKey;
  }
  return cryptoKey;
}, "handleJWK");
var handleKeyObject = /* @__PURE__ */ __name((keyObject, alg) => {
  cache ||= /* @__PURE__ */ new WeakMap();
  let cached = cache.get(keyObject);
  if (cached?.[alg]) {
    return cached[alg];
  }
  const isPublic = keyObject.type === "public";
  const extractable = isPublic ? true : false;
  let cryptoKey;
  if (keyObject.asymmetricKeyType === "x25519") {
    switch (alg) {
      case "ECDH-ES":
      case "ECDH-ES+A128KW":
      case "ECDH-ES+A192KW":
      case "ECDH-ES+A256KW":
        break;
      default:
        throw new TypeError(unusableForAlg);
    }
    cryptoKey = keyObject.toCryptoKey(keyObject.asymmetricKeyType, extractable, isPublic ? [] : ["deriveBits"]);
  }
  if (keyObject.asymmetricKeyType === "ed25519") {
    if (alg !== "EdDSA" && alg !== "Ed25519") {
      throw new TypeError(unusableForAlg);
    }
    cryptoKey = keyObject.toCryptoKey(keyObject.asymmetricKeyType, extractable, [
      isPublic ? "verify" : "sign"
    ]);
  }
  switch (keyObject.asymmetricKeyType) {
    case "ml-dsa-44":
    case "ml-dsa-65":
    case "ml-dsa-87": {
      if (alg !== keyObject.asymmetricKeyType.toUpperCase()) {
        throw new TypeError(unusableForAlg);
      }
      cryptoKey = keyObject.toCryptoKey(keyObject.asymmetricKeyType, extractable, [
        isPublic ? "verify" : "sign"
      ]);
    }
  }
  if (keyObject.asymmetricKeyType === "rsa") {
    let hash;
    switch (alg) {
      case "RSA-OAEP":
        hash = "SHA-1";
        break;
      case "RS256":
      case "PS256":
      case "RSA-OAEP-256":
        hash = "SHA-256";
        break;
      case "RS384":
      case "PS384":
      case "RSA-OAEP-384":
        hash = "SHA-384";
        break;
      case "RS512":
      case "PS512":
      case "RSA-OAEP-512":
        hash = "SHA-512";
        break;
      default:
        throw new TypeError(unusableForAlg);
    }
    if (alg.startsWith("RSA-OAEP")) {
      return keyObject.toCryptoKey({
        name: "RSA-OAEP",
        hash
      }, extractable, isPublic ? ["encrypt"] : ["decrypt"]);
    }
    cryptoKey = keyObject.toCryptoKey({
      name: alg.startsWith("PS") ? "RSA-PSS" : "RSASSA-PKCS1-v1_5",
      hash
    }, extractable, [isPublic ? "verify" : "sign"]);
  }
  if (keyObject.asymmetricKeyType === "ec") {
    const nist = /* @__PURE__ */ new Map([
      ["prime256v1", "P-256"],
      ["secp384r1", "P-384"],
      ["secp521r1", "P-521"]
    ]);
    const namedCurve = nist.get(keyObject.asymmetricKeyDetails?.namedCurve);
    if (!namedCurve) {
      throw new TypeError(unusableForAlg);
    }
    const expectedCurve = { ES256: "P-256", ES384: "P-384", ES512: "P-521" };
    if (expectedCurve[alg] && namedCurve === expectedCurve[alg]) {
      cryptoKey = keyObject.toCryptoKey({
        name: "ECDSA",
        namedCurve
      }, extractable, [isPublic ? "verify" : "sign"]);
    }
    if (alg.startsWith("ECDH-ES")) {
      cryptoKey = keyObject.toCryptoKey({
        name: "ECDH",
        namedCurve
      }, extractable, isPublic ? [] : ["deriveBits"]);
    }
  }
  if (!cryptoKey) {
    throw new TypeError(unusableForAlg);
  }
  if (!cached) {
    cache.set(keyObject, { [alg]: cryptoKey });
  } else {
    cached[alg] = cryptoKey;
  }
  return cryptoKey;
}, "handleKeyObject");
async function normalizeKey(key, alg) {
  if (key instanceof Uint8Array) {
    return key;
  }
  if (isCryptoKey(key)) {
    return key;
  }
  if (isKeyObject(key)) {
    if (key.type === "secret") {
      return key.export();
    }
    if ("toCryptoKey" in key && typeof key.toCryptoKey === "function") {
      try {
        return handleKeyObject(key, alg);
      } catch (err) {
        if (err instanceof TypeError) {
          throw err;
        }
      }
    }
    let jwk = key.export({ format: "jwk" });
    return handleJWK(key, jwk, alg);
  }
  if (isJWK(key)) {
    if (key.k) {
      return decode(key.k);
    }
    return handleJWK(key, key, alg, true);
  }
  throw new Error("unreachable");
}
__name(normalizeKey, "normalizeKey");

// ../node_modules/jose/dist/webapi/lib/validate_crit.js
function validateCrit(Err, recognizedDefault, recognizedOption, protectedHeader, joseHeader) {
  if (joseHeader.crit !== void 0 && protectedHeader?.crit === void 0) {
    throw new Err('"crit" (Critical) Header Parameter MUST be integrity protected');
  }
  if (!protectedHeader || protectedHeader.crit === void 0) {
    return /* @__PURE__ */ new Set();
  }
  if (!Array.isArray(protectedHeader.crit) || protectedHeader.crit.length === 0 || protectedHeader.crit.some((input) => typeof input !== "string" || input.length === 0)) {
    throw new Err('"crit" (Critical) Header Parameter MUST be an array of non-empty strings when present');
  }
  let recognized;
  if (recognizedOption !== void 0) {
    recognized = new Map([...Object.entries(recognizedOption), ...recognizedDefault.entries()]);
  } else {
    recognized = recognizedDefault;
  }
  for (const parameter of protectedHeader.crit) {
    if (!recognized.has(parameter)) {
      throw new JOSENotSupported(`Extension Header Parameter "${parameter}" is not recognized`);
    }
    if (joseHeader[parameter] === void 0) {
      throw new Err(`Extension Header Parameter "${parameter}" is missing`);
    }
    if (recognized.get(parameter) && protectedHeader[parameter] === void 0) {
      throw new Err(`Extension Header Parameter "${parameter}" MUST be integrity protected`);
    }
  }
  return new Set(protectedHeader.crit);
}
__name(validateCrit, "validateCrit");

// ../node_modules/jose/dist/webapi/lib/validate_algorithms.js
function validateAlgorithms(option, algorithms) {
  if (algorithms !== void 0 && (!Array.isArray(algorithms) || algorithms.some((s) => typeof s !== "string"))) {
    throw new TypeError(`"${option}" option must be an array of strings`);
  }
  if (!algorithms) {
    return void 0;
  }
  return new Set(algorithms);
}
__name(validateAlgorithms, "validateAlgorithms");

// ../node_modules/jose/dist/webapi/lib/check_key_type.js
var tag = /* @__PURE__ */ __name((key) => key?.[Symbol.toStringTag], "tag");
var jwkMatchesOp = /* @__PURE__ */ __name((alg, key, usage) => {
  if (key.use !== void 0) {
    let expected;
    switch (usage) {
      case "sign":
      case "verify":
        expected = "sig";
        break;
      case "encrypt":
      case "decrypt":
        expected = "enc";
        break;
    }
    if (key.use !== expected) {
      throw new TypeError(`Invalid key for this operation, its "use" must be "${expected}" when present`);
    }
  }
  if (key.alg !== void 0 && key.alg !== alg) {
    throw new TypeError(`Invalid key for this operation, its "alg" must be "${alg}" when present`);
  }
  if (Array.isArray(key.key_ops)) {
    let expectedKeyOp;
    switch (true) {
      case (usage === "sign" || usage === "verify"):
      case alg === "dir":
      case alg.includes("CBC-HS"):
        expectedKeyOp = usage;
        break;
      case alg.startsWith("PBES2"):
        expectedKeyOp = "deriveBits";
        break;
      case /^A\d{3}(?:GCM)?(?:KW)?$/.test(alg):
        if (!alg.includes("GCM") && alg.endsWith("KW")) {
          expectedKeyOp = usage === "encrypt" ? "wrapKey" : "unwrapKey";
        } else {
          expectedKeyOp = usage;
        }
        break;
      case (usage === "encrypt" && alg.startsWith("RSA")):
        expectedKeyOp = "wrapKey";
        break;
      case usage === "decrypt":
        expectedKeyOp = alg.startsWith("RSA") ? "unwrapKey" : "deriveBits";
        break;
    }
    if (expectedKeyOp && key.key_ops?.includes?.(expectedKeyOp) === false) {
      throw new TypeError(`Invalid key for this operation, its "key_ops" must include "${expectedKeyOp}" when present`);
    }
  }
  return true;
}, "jwkMatchesOp");
var symmetricTypeCheck = /* @__PURE__ */ __name((alg, key, usage) => {
  if (key instanceof Uint8Array)
    return;
  if (isJWK(key)) {
    if (isSecretJWK(key) && jwkMatchesOp(alg, key, usage))
      return;
    throw new TypeError(`JSON Web Key for symmetric algorithms must have JWK "kty" (Key Type) equal to "oct" and the JWK "k" (Key Value) present`);
  }
  if (!isKeyLike(key)) {
    throw new TypeError(withAlg(alg, key, "CryptoKey", "KeyObject", "JSON Web Key", "Uint8Array"));
  }
  if (key.type !== "secret") {
    throw new TypeError(`${tag(key)} instances for symmetric algorithms must be of type "secret"`);
  }
}, "symmetricTypeCheck");
var asymmetricTypeCheck = /* @__PURE__ */ __name((alg, key, usage) => {
  if (isJWK(key)) {
    switch (usage) {
      case "decrypt":
      case "sign":
        if (isPrivateJWK(key) && jwkMatchesOp(alg, key, usage))
          return;
        throw new TypeError(`JSON Web Key for this operation must be a private JWK`);
      case "encrypt":
      case "verify":
        if (isPublicJWK(key) && jwkMatchesOp(alg, key, usage))
          return;
        throw new TypeError(`JSON Web Key for this operation must be a public JWK`);
    }
  }
  if (!isKeyLike(key)) {
    throw new TypeError(withAlg(alg, key, "CryptoKey", "KeyObject", "JSON Web Key"));
  }
  if (key.type === "secret") {
    throw new TypeError(`${tag(key)} instances for asymmetric algorithms must not be of type "secret"`);
  }
  if (key.type === "public") {
    switch (usage) {
      case "sign":
        throw new TypeError(`${tag(key)} instances for asymmetric algorithm signing must be of type "private"`);
      case "decrypt":
        throw new TypeError(`${tag(key)} instances for asymmetric algorithm decryption must be of type "private"`);
    }
  }
  if (key.type === "private") {
    switch (usage) {
      case "verify":
        throw new TypeError(`${tag(key)} instances for asymmetric algorithm verifying must be of type "public"`);
      case "encrypt":
        throw new TypeError(`${tag(key)} instances for asymmetric algorithm encryption must be of type "public"`);
    }
  }
}, "asymmetricTypeCheck");
function checkKeyType(alg, key, usage) {
  switch (alg.substring(0, 2)) {
    case "A1":
    case "A2":
    case "di":
    case "HS":
    case "PB":
      symmetricTypeCheck(alg, key, usage);
      break;
    default:
      asymmetricTypeCheck(alg, key, usage);
  }
}
__name(checkKeyType, "checkKeyType");

// ../node_modules/jose/dist/webapi/jws/flattened/verify.js
async function flattenedVerify(jws, key, options) {
  if (!isObject(jws)) {
    throw new JWSInvalid("Flattened JWS must be an object");
  }
  if (jws.protected === void 0 && jws.header === void 0) {
    throw new JWSInvalid('Flattened JWS must have either of the "protected" or "header" members');
  }
  if (jws.protected !== void 0 && typeof jws.protected !== "string") {
    throw new JWSInvalid("JWS Protected Header incorrect type");
  }
  if (jws.payload === void 0) {
    throw new JWSInvalid("JWS Payload missing");
  }
  if (typeof jws.signature !== "string") {
    throw new JWSInvalid("JWS Signature missing or incorrect type");
  }
  if (jws.header !== void 0 && !isObject(jws.header)) {
    throw new JWSInvalid("JWS Unprotected Header incorrect type");
  }
  let parsedProt = {};
  if (jws.protected) {
    try {
      const protectedHeader = decode(jws.protected);
      parsedProt = JSON.parse(decoder.decode(protectedHeader));
    } catch {
      throw new JWSInvalid("JWS Protected Header is invalid");
    }
  }
  if (!isDisjoint(parsedProt, jws.header)) {
    throw new JWSInvalid("JWS Protected and JWS Unprotected Header Parameter names must be disjoint");
  }
  const joseHeader = {
    ...parsedProt,
    ...jws.header
  };
  const extensions = validateCrit(JWSInvalid, /* @__PURE__ */ new Map([["b64", true]]), options?.crit, parsedProt, joseHeader);
  let b64 = true;
  if (extensions.has("b64")) {
    b64 = parsedProt.b64;
    if (typeof b64 !== "boolean") {
      throw new JWSInvalid('The "b64" (base64url-encode payload) Header Parameter must be a boolean');
    }
  }
  const { alg } = joseHeader;
  if (typeof alg !== "string" || !alg) {
    throw new JWSInvalid('JWS "alg" (Algorithm) Header Parameter missing or invalid');
  }
  const algorithms = options && validateAlgorithms("algorithms", options.algorithms);
  if (algorithms && !algorithms.has(alg)) {
    throw new JOSEAlgNotAllowed('"alg" (Algorithm) Header Parameter value not allowed');
  }
  if (b64) {
    if (typeof jws.payload !== "string") {
      throw new JWSInvalid("JWS Payload must be a string");
    }
  } else if (typeof jws.payload !== "string" && !(jws.payload instanceof Uint8Array)) {
    throw new JWSInvalid("JWS Payload must be a string or an Uint8Array instance");
  }
  let resolvedKey = false;
  if (typeof key === "function") {
    key = await key(parsedProt, jws);
    resolvedKey = true;
  }
  checkKeyType(alg, key, "verify");
  const data = concat(jws.protected !== void 0 ? encode(jws.protected) : new Uint8Array(), encode("."), typeof jws.payload === "string" ? b64 ? encode(jws.payload) : encoder.encode(jws.payload) : jws.payload);
  const signature = decodeBase64url(jws.signature, "signature", JWSInvalid);
  const k = await normalizeKey(key, alg);
  const verified = await verify(alg, k, signature, data);
  if (!verified) {
    throw new JWSSignatureVerificationFailed();
  }
  let payload;
  if (b64) {
    payload = decodeBase64url(jws.payload, "payload", JWSInvalid);
  } else if (typeof jws.payload === "string") {
    payload = encoder.encode(jws.payload);
  } else {
    payload = jws.payload;
  }
  const result = { payload };
  if (jws.protected !== void 0) {
    result.protectedHeader = parsedProt;
  }
  if (jws.header !== void 0) {
    result.unprotectedHeader = jws.header;
  }
  if (resolvedKey) {
    return { ...result, key: k };
  }
  return result;
}
__name(flattenedVerify, "flattenedVerify");

// ../node_modules/jose/dist/webapi/jws/compact/verify.js
async function compactVerify(jws, key, options) {
  if (jws instanceof Uint8Array) {
    jws = decoder.decode(jws);
  }
  if (typeof jws !== "string") {
    throw new JWSInvalid("Compact JWS must be a string or Uint8Array");
  }
  const { 0: protectedHeader, 1: payload, 2: signature, length } = jws.split(".");
  if (length !== 3) {
    throw new JWSInvalid("Invalid Compact JWS");
  }
  const verified = await flattenedVerify({ payload, protected: protectedHeader, signature }, key, options);
  const result = { payload: verified.payload, protectedHeader: verified.protectedHeader };
  if (typeof key === "function") {
    return { ...result, key: verified.key };
  }
  return result;
}
__name(compactVerify, "compactVerify");

// ../node_modules/jose/dist/webapi/lib/jwt_claims_set.js
var epoch = /* @__PURE__ */ __name((date) => Math.floor(date.getTime() / 1e3), "epoch");
var minute = 60;
var hour = minute * 60;
var day = hour * 24;
var week = day * 7;
var year = day * 365.25;
var REGEX = /^(\+|\-)? ?(\d+|\d+\.\d+) ?(seconds?|secs?|s|minutes?|mins?|m|hours?|hrs?|h|days?|d|weeks?|w|years?|yrs?|y)(?: (ago|from now))?$/i;
function secs(str) {
  const matched = REGEX.exec(str);
  if (!matched || matched[4] && matched[1]) {
    throw new TypeError("Invalid time period format");
  }
  const value = parseFloat(matched[2]);
  const unit = matched[3].toLowerCase();
  let numericDate;
  switch (unit) {
    case "sec":
    case "secs":
    case "second":
    case "seconds":
    case "s":
      numericDate = Math.round(value);
      break;
    case "minute":
    case "minutes":
    case "min":
    case "mins":
    case "m":
      numericDate = Math.round(value * minute);
      break;
    case "hour":
    case "hours":
    case "hr":
    case "hrs":
    case "h":
      numericDate = Math.round(value * hour);
      break;
    case "day":
    case "days":
    case "d":
      numericDate = Math.round(value * day);
      break;
    case "week":
    case "weeks":
    case "w":
      numericDate = Math.round(value * week);
      break;
    default:
      numericDate = Math.round(value * year);
      break;
  }
  if (matched[1] === "-" || matched[4] === "ago") {
    return -numericDate;
  }
  return numericDate;
}
__name(secs, "secs");
function validateInput(label, input) {
  if (!Number.isFinite(input)) {
    throw new TypeError(`Invalid ${label} input`);
  }
  return input;
}
__name(validateInput, "validateInput");
var normalizeTyp = /* @__PURE__ */ __name((value) => {
  if (value.includes("/")) {
    return value.toLowerCase();
  }
  return `application/${value.toLowerCase()}`;
}, "normalizeTyp");
var checkAudiencePresence = /* @__PURE__ */ __name((audPayload, audOption) => {
  if (typeof audPayload === "string") {
    return audOption.includes(audPayload);
  }
  if (Array.isArray(audPayload)) {
    return audOption.some(Set.prototype.has.bind(new Set(audPayload)));
  }
  return false;
}, "checkAudiencePresence");
function validateClaimsSet(protectedHeader, encodedPayload, options = {}) {
  let payload;
  try {
    payload = JSON.parse(decoder.decode(encodedPayload));
  } catch {
  }
  if (!isObject(payload)) {
    throw new JWTInvalid("JWT Claims Set must be a top-level JSON object");
  }
  const { typ } = options;
  if (typ && (typeof protectedHeader.typ !== "string" || normalizeTyp(protectedHeader.typ) !== normalizeTyp(typ))) {
    throw new JWTClaimValidationFailed('unexpected "typ" JWT header value', payload, "typ", "check_failed");
  }
  const { requiredClaims = [], issuer, subject, audience, maxTokenAge } = options;
  const presenceCheck = [...requiredClaims];
  if (maxTokenAge !== void 0)
    presenceCheck.push("iat");
  if (audience !== void 0)
    presenceCheck.push("aud");
  if (subject !== void 0)
    presenceCheck.push("sub");
  if (issuer !== void 0)
    presenceCheck.push("iss");
  for (const claim of new Set(presenceCheck.reverse())) {
    if (!(claim in payload)) {
      throw new JWTClaimValidationFailed(`missing required "${claim}" claim`, payload, claim, "missing");
    }
  }
  if (issuer && !(Array.isArray(issuer) ? issuer : [issuer]).includes(payload.iss)) {
    throw new JWTClaimValidationFailed('unexpected "iss" claim value', payload, "iss", "check_failed");
  }
  if (subject && payload.sub !== subject) {
    throw new JWTClaimValidationFailed('unexpected "sub" claim value', payload, "sub", "check_failed");
  }
  if (audience && !checkAudiencePresence(payload.aud, typeof audience === "string" ? [audience] : audience)) {
    throw new JWTClaimValidationFailed('unexpected "aud" claim value', payload, "aud", "check_failed");
  }
  let tolerance;
  switch (typeof options.clockTolerance) {
    case "string":
      tolerance = secs(options.clockTolerance);
      break;
    case "number":
      tolerance = options.clockTolerance;
      break;
    case "undefined":
      tolerance = 0;
      break;
    default:
      throw new TypeError("Invalid clockTolerance option type");
  }
  const { currentDate } = options;
  const now = epoch(currentDate || /* @__PURE__ */ new Date());
  if ((payload.iat !== void 0 || maxTokenAge) && typeof payload.iat !== "number") {
    throw new JWTClaimValidationFailed('"iat" claim must be a number', payload, "iat", "invalid");
  }
  if (payload.nbf !== void 0) {
    if (typeof payload.nbf !== "number") {
      throw new JWTClaimValidationFailed('"nbf" claim must be a number', payload, "nbf", "invalid");
    }
    if (payload.nbf > now + tolerance) {
      throw new JWTClaimValidationFailed('"nbf" claim timestamp check failed', payload, "nbf", "check_failed");
    }
  }
  if (payload.exp !== void 0) {
    if (typeof payload.exp !== "number") {
      throw new JWTClaimValidationFailed('"exp" claim must be a number', payload, "exp", "invalid");
    }
    if (payload.exp <= now - tolerance) {
      throw new JWTExpired('"exp" claim timestamp check failed', payload, "exp", "check_failed");
    }
  }
  if (maxTokenAge) {
    const age = now - payload.iat;
    const max = typeof maxTokenAge === "number" ? maxTokenAge : secs(maxTokenAge);
    if (age - tolerance > max) {
      throw new JWTExpired('"iat" claim timestamp check failed (too far in the past)', payload, "iat", "check_failed");
    }
    if (age < 0 - tolerance) {
      throw new JWTClaimValidationFailed('"iat" claim timestamp check failed (it should be in the past)', payload, "iat", "check_failed");
    }
  }
  return payload;
}
__name(validateClaimsSet, "validateClaimsSet");
var JWTClaimsBuilder = class {
  static {
    __name(this, "JWTClaimsBuilder");
  }
  #payload;
  constructor(payload) {
    if (!isObject(payload)) {
      throw new TypeError("JWT Claims Set MUST be an object");
    }
    this.#payload = structuredClone(payload);
  }
  data() {
    return encoder.encode(JSON.stringify(this.#payload));
  }
  get iss() {
    return this.#payload.iss;
  }
  set iss(value) {
    this.#payload.iss = value;
  }
  get sub() {
    return this.#payload.sub;
  }
  set sub(value) {
    this.#payload.sub = value;
  }
  get aud() {
    return this.#payload.aud;
  }
  set aud(value) {
    this.#payload.aud = value;
  }
  set jti(value) {
    this.#payload.jti = value;
  }
  set nbf(value) {
    if (typeof value === "number") {
      this.#payload.nbf = validateInput("setNotBefore", value);
    } else if (value instanceof Date) {
      this.#payload.nbf = validateInput("setNotBefore", epoch(value));
    } else {
      this.#payload.nbf = epoch(/* @__PURE__ */ new Date()) + secs(value);
    }
  }
  set exp(value) {
    if (typeof value === "number") {
      this.#payload.exp = validateInput("setExpirationTime", value);
    } else if (value instanceof Date) {
      this.#payload.exp = validateInput("setExpirationTime", epoch(value));
    } else {
      this.#payload.exp = epoch(/* @__PURE__ */ new Date()) + secs(value);
    }
  }
  set iat(value) {
    if (value === void 0) {
      this.#payload.iat = epoch(/* @__PURE__ */ new Date());
    } else if (value instanceof Date) {
      this.#payload.iat = validateInput("setIssuedAt", epoch(value));
    } else if (typeof value === "string") {
      this.#payload.iat = validateInput("setIssuedAt", epoch(/* @__PURE__ */ new Date()) + secs(value));
    } else {
      this.#payload.iat = validateInput("setIssuedAt", value);
    }
  }
};

// ../node_modules/jose/dist/webapi/jwt/verify.js
async function jwtVerify(jwt, key, options) {
  const verified = await compactVerify(jwt, key, options);
  if (verified.protectedHeader.crit?.includes("b64") && verified.protectedHeader.b64 === false) {
    throw new JWTInvalid("JWTs MUST NOT use unencoded payload");
  }
  const payload = validateClaimsSet(verified.protectedHeader, verified.payload, options);
  const result = { payload, protectedHeader: verified.protectedHeader };
  if (typeof key === "function") {
    return { ...result, key: verified.key };
  }
  return result;
}
__name(jwtVerify, "jwtVerify");

// ../node_modules/jose/dist/webapi/jws/flattened/sign.js
var FlattenedSign = class {
  static {
    __name(this, "FlattenedSign");
  }
  #payload;
  #protectedHeader;
  #unprotectedHeader;
  constructor(payload) {
    if (!(payload instanceof Uint8Array)) {
      throw new TypeError("payload must be an instance of Uint8Array");
    }
    this.#payload = payload;
  }
  setProtectedHeader(protectedHeader) {
    assertNotSet(this.#protectedHeader, "setProtectedHeader");
    this.#protectedHeader = protectedHeader;
    return this;
  }
  setUnprotectedHeader(unprotectedHeader) {
    assertNotSet(this.#unprotectedHeader, "setUnprotectedHeader");
    this.#unprotectedHeader = unprotectedHeader;
    return this;
  }
  async sign(key, options) {
    if (!this.#protectedHeader && !this.#unprotectedHeader) {
      throw new JWSInvalid("either setProtectedHeader or setUnprotectedHeader must be called before #sign()");
    }
    if (!isDisjoint(this.#protectedHeader, this.#unprotectedHeader)) {
      throw new JWSInvalid("JWS Protected and JWS Unprotected Header Parameter names must be disjoint");
    }
    const joseHeader = {
      ...this.#protectedHeader,
      ...this.#unprotectedHeader
    };
    const extensions = validateCrit(JWSInvalid, /* @__PURE__ */ new Map([["b64", true]]), options?.crit, this.#protectedHeader, joseHeader);
    let b64 = true;
    if (extensions.has("b64")) {
      b64 = this.#protectedHeader.b64;
      if (typeof b64 !== "boolean") {
        throw new JWSInvalid('The "b64" (base64url-encode payload) Header Parameter must be a boolean');
      }
    }
    const { alg } = joseHeader;
    if (typeof alg !== "string" || !alg) {
      throw new JWSInvalid('JWS "alg" (Algorithm) Header Parameter missing or invalid');
    }
    checkKeyType(alg, key, "sign");
    let payloadS;
    let payloadB;
    if (b64) {
      payloadS = encode2(this.#payload);
      payloadB = encode(payloadS);
    } else {
      payloadB = this.#payload;
      payloadS = "";
    }
    let protectedHeaderString;
    let protectedHeaderBytes;
    if (this.#protectedHeader) {
      protectedHeaderString = encode2(JSON.stringify(this.#protectedHeader));
      protectedHeaderBytes = encode(protectedHeaderString);
    } else {
      protectedHeaderString = "";
      protectedHeaderBytes = new Uint8Array();
    }
    const data = concat(protectedHeaderBytes, encode("."), payloadB);
    const k = await normalizeKey(key, alg);
    const signature = await sign(alg, k, data);
    const jws = {
      signature: encode2(signature),
      payload: payloadS
    };
    if (this.#unprotectedHeader) {
      jws.header = this.#unprotectedHeader;
    }
    if (this.#protectedHeader) {
      jws.protected = protectedHeaderString;
    }
    return jws;
  }
};

// ../node_modules/jose/dist/webapi/jws/compact/sign.js
var CompactSign = class {
  static {
    __name(this, "CompactSign");
  }
  #flattened;
  constructor(payload) {
    this.#flattened = new FlattenedSign(payload);
  }
  setProtectedHeader(protectedHeader) {
    this.#flattened.setProtectedHeader(protectedHeader);
    return this;
  }
  async sign(key, options) {
    const jws = await this.#flattened.sign(key, options);
    if (jws.payload === void 0) {
      throw new TypeError("use the flattened module for creating JWS with b64: false");
    }
    return `${jws.protected}.${jws.payload}.${jws.signature}`;
  }
};

// ../node_modules/jose/dist/webapi/jwt/sign.js
var SignJWT = class {
  static {
    __name(this, "SignJWT");
  }
  #protectedHeader;
  #jwt;
  constructor(payload = {}) {
    this.#jwt = new JWTClaimsBuilder(payload);
  }
  setIssuer(issuer) {
    this.#jwt.iss = issuer;
    return this;
  }
  setSubject(subject) {
    this.#jwt.sub = subject;
    return this;
  }
  setAudience(audience) {
    this.#jwt.aud = audience;
    return this;
  }
  setJti(jwtId) {
    this.#jwt.jti = jwtId;
    return this;
  }
  setNotBefore(input) {
    this.#jwt.nbf = input;
    return this;
  }
  setExpirationTime(input) {
    this.#jwt.exp = input;
    return this;
  }
  setIssuedAt(input) {
    this.#jwt.iat = input;
    return this;
  }
  setProtectedHeader(protectedHeader) {
    this.#protectedHeader = protectedHeader;
    return this;
  }
  async sign(key, options) {
    const sig = new CompactSign(this.#jwt.data());
    sig.setProtectedHeader(this.#protectedHeader);
    if (Array.isArray(this.#protectedHeader?.crit) && this.#protectedHeader.crit.includes("b64") && this.#protectedHeader.b64 === false) {
      throw new JWTInvalid("JWTs MUST NOT use unencoded payload");
    }
    return sig.sign(key, options);
  }
};

// api/login.ts
async function onRequestPost6(context) {
  const { request, env } = context;
  try {
    const { email, password } = await request.json();
    const settingsRes = await env.DB.prepare("SELECT value FROM settings WHERE key = ?").bind("adminUsers").all();
    let adminUsers = settingsRes.results.length > 0 ? JSON.parse(settingsRes.results[0].value) : [];
    let user = adminUsers.find((u) => u.email.trim() === email.trim() && u.passwordHash === password);
    if (!user && email.trim() === "max@gmail.com" && password === "1234") {
      const existingUser = adminUsers.find((u) => u.email.trim() === "max@gmail.com");
      if (!existingUser) {
        user = {
          id: Date.now().toString(),
          email: "max@gmail.com",
          passwordHash: "1234",
          isApproved: true,
          createdAt: (/* @__PURE__ */ new Date()).toISOString()
        };
        adminUsers.push(user);
        await env.DB.prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").bind("adminUsers", JSON.stringify(adminUsers)).run();
      } else {
        existingUser.passwordHash = "1234";
        existingUser.isApproved = true;
        user = existingUser;
        await env.DB.prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").bind("adminUsers", JSON.stringify(adminUsers)).run();
      }
    }
    if (user && !user.isApproved && user.email === "max@gmail.com") {
      user.isApproved = true;
      await env.DB.prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").bind("adminUsers", JSON.stringify(adminUsers)).run();
    }
    if (user && user.isApproved) {
      const secret = new TextEncoder().encode(env.JWT_SECRET || "default_secret_change_in_production");
      const token = await new SignJWT({ email: user.email }).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("7d").sign(secret);
      const headers = new Headers();
      headers.set("Set-Cookie", `admin_token=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${7 * 24 * 60 * 60}`);
      headers.set("Content-Type", "application/json");
      return new Response(JSON.stringify({ success: true, user }), { headers });
    } else if (user && !user.isApproved) {
      return new Response(JSON.stringify({ success: false, error: "Account not approved yet." }), { status: 401, headers: { "Content-Type": "application/json" } });
    }
    return new Response(JSON.stringify({ success: false, error: "Invalid email or password." }), { status: 401, headers: { "Content-Type": "application/json" } });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
}
__name(onRequestPost6, "onRequestPost");

// api/logout.ts
async function onRequestPost7() {
  return new Response(JSON.stringify({ success: true }), {
    headers: {
      "Set-Cookie": "admin_token=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0",
      "Content-Type": "application/json"
    }
  });
}
__name(onRequestPost7, "onRequestPost");

// api/orders.ts
async function onRequestPost8({ request, env }) {
  try {
    const data = await request.json();
    const { items, type, action } = data;
    if (!items || !Array.isArray(items) || !type) {
      return new Response("Invalid payload", { status: 400 });
    }
    if (action === "delete") {
      const ids = items.map((i) => i.id);
      if (ids.length > 0) {
        for (let i = 0; i < ids.length; i += 50) {
          const chunk = ids.slice(i, i + 50);
          const placeholders = chunk.map(() => "?").join(",");
          await env.DB.prepare(`DELETE FROM orders WHERE id IN (${placeholders}) AND type = ?`).bind(...chunk, type).run();
        }
      }
      return Response.json({ success: true, deleted: ids.length });
    }
    if (action === "sync_all") {
      await env.DB.prepare("DELETE FROM orders WHERE type = ?").bind(type).run();
      const stmts2 = items.map(
        (o) => env.DB.prepare("INSERT INTO orders (id, type, data) VALUES (?, ?, ?)").bind(o.id, type, JSON.stringify(o))
      );
      if (stmts2.length > 0) {
        for (let i = 0; i < stmts2.length; i += 50) {
          await env.DB.batch(stmts2.slice(i, i + 50));
        }
      }
      return Response.json({ success: true, synced: items.length });
    }
    const stmts = items.map(
      (o) => env.DB.prepare("INSERT INTO orders (id, type, data) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET data = excluded.data, type = excluded.type, updated_at = CURRENT_TIMESTAMP").bind(o.id, type, JSON.stringify(o))
    );
    if (stmts.length > 0) {
      for (let i = 0; i < stmts.length; i += 50) {
        await env.DB.batch(stmts.slice(i, i + 50));
      }
    }
    return Response.json({ success: true, modified: items.length });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}
__name(onRequestPost8, "onRequestPost");

// api/products.ts
async function onRequestPost9(context) {
  const { request, env } = context;
  try {
    const data = await request.json();
    const { items, action } = data;
    if (!items || !Array.isArray(items)) {
      return new Response("Invalid items payload", { status: 400 });
    }
    if (action === "delete") {
      const ids = items.map((i) => i.id);
      if (ids.length > 0) {
        for (let i = 0; i < ids.length; i += 50) {
          const chunkIds = ids.slice(i, i + 50);
          const placeholders = chunkIds.map(() => "?").join(",");
          await env.DB.prepare(`DELETE FROM products WHERE id IN (${placeholders})`).bind(...chunkIds).run();
        }
        try {
          const settingsRes = await env.DB.prepare("SELECT value FROM settings WHERE key = 'registered_retails'").first();
          const storeSettingsRes = await env.DB.prepare("SELECT value FROM settings WHERE key = 'websiteSettings'").first();
          const storeSettings = storeSettingsRes && storeSettingsRes.value ? JSON.parse(storeSettingsRes.value) : {};
          const masterApiKey = storeSettings?.apiSync?.masterApiKey || "";
          if (settingsRes && settingsRes.value) {
            const retails = JSON.parse(settingsRes.value);
            if (retails && retails.length > 0) {
              const broadcastData = JSON.stringify({ deletedIds: ids });
              await Promise.all(retails.map(
                (retailUrl) => fetch(`${retailUrl}/api/sync_apply`, {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${masterApiKey}`
                  },
                  body: broadcastData
                }).catch(() => {
                })
              ));
            }
          }
        } catch (e) {
        }
      }
      return Response.json({ success: true, deleted: ids.length });
    }
    if (action === "sync_all") {
      await env.DB.prepare("DELETE FROM products").run();
      const stmts2 = items.map(
        (p) => env.DB.prepare("INSERT INTO products (id, data) VALUES (?, ?)").bind(p.id, JSON.stringify(p))
      );
      if (stmts2.length > 0) {
        for (let i = 0; i < stmts2.length; i += 50) {
          const chunk = stmts2.slice(i, i + 50);
          await env.DB.batch(chunk);
        }
      }
      return Response.json({ success: true, synced: items.length });
    }
    const stmts = items.map(
      (p) => env.DB.prepare("INSERT INTO products (id, data) VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET data = excluded.data, updated_at = CURRENT_TIMESTAMP").bind(p.id, JSON.stringify(p))
    );
    if (stmts.length > 0) {
      for (let i = 0; i < stmts.length; i += 50) {
        const chunk = stmts.slice(i, i + 50);
        await env.DB.batch(chunk);
      }
    }
    try {
      const settingsRes = await env.DB.prepare("SELECT value FROM settings WHERE key = 'registered_retails'").first();
      const storeSettingsRes = await env.DB.prepare("SELECT value FROM settings WHERE key = 'websiteSettings'").first();
      const storeSettings = storeSettingsRes && storeSettingsRes.value ? JSON.parse(storeSettingsRes.value) : {};
      const masterApiKey = storeSettings?.apiSync?.masterApiKey || "";
      if (settingsRes && settingsRes.value) {
        const retails = JSON.parse(settingsRes.value);
        if (retails && retails.length > 0) {
          const url2 = new URL(request.url);
          const origin = url2.origin;
          const originBase = getOriginBase(env, origin);
          const broadcastProducts = items.map((p) => {
            const pCopy = { ...p };
            if (pCopy.image && pCopy.image.startsWith("/")) pCopy.image = originBase + pCopy.image;
            if (pCopy.images) pCopy.images = pCopy.images.map((img) => img.startsWith("/") ? originBase + img : img);
            return pCopy;
          });
          const broadcastData = JSON.stringify({ products: broadcastProducts, isStockOnly: true });
          await Promise.all(retails.map(
            (retailUrl) => fetch(`${retailUrl}/api/sync_apply`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${masterApiKey}`
              },
              body: broadcastData
            }).catch(() => {
            })
          ));
        }
      }
    } catch (e) {
    }
    const cache2 = caches.default;
    const url = new URL("/api/public_state", request.url);
    if (context.waitUntil) {
      context.waitUntil(cache2.delete(new Request(url.toString())));
    } else {
      await cache2.delete(new Request(url.toString()));
    }
    return Response.json({ success: true, modified: items.length });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}
__name(onRequestPost9, "onRequestPost");

// api/proxy_image.ts
async function onRequestGet4({ request, env }) {
  const urlObj = new URL(request.url);
  const targetUrl = urlObj.searchParams.get("url");
  if (!targetUrl) {
    return new Response(JSON.stringify({ error: "Missing url parameter" }), {
      status: 400,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      }
    });
  }
  if (targetUrl.includes("/uploads/")) {
    const key = "uploads/" + targetUrl.split("/uploads/")[1].split("?")[0];
    if (env.BUCKET) {
      try {
        const object = await env.BUCKET.get(key);
        if (object) {
          const headers = new Headers();
          if (object.httpMetadata?.contentType) {
            headers.set("Content-Type", object.httpMetadata.contentType);
          } else {
            headers.set("Content-Type", key.endsWith(".png") ? "image/png" : "image/webp");
          }
          headers.set("Access-Control-Allow-Origin", "*");
          headers.set("Access-Control-Allow-Methods", "GET, OPTIONS");
          headers.set("Cache-Control", "public, max-age=31536000, immutable");
          if (object.httpEtag) {
            headers.set("ETag", object.httpEtag);
          }
          return new Response(object.body, { headers });
        }
      } catch (e) {
        console.error("R2 read error in proxy_image:", e);
      }
    }
  }
  try {
    const res = await fetch(targetUrl);
    if (res.ok) {
      const headers = new Headers(res.headers);
      headers.set("Access-Control-Allow-Origin", "*");
      headers.set("Access-Control-Allow-Methods", "GET, OPTIONS");
      headers.set("Cache-Control", "public, max-age=31536000, immutable");
      const cType = headers.get("Content-Type");
      if (!cType || cType.includes("text/html")) {
        const ext = targetUrl.split("?")[0].split(".").pop()?.toLowerCase();
        if (ext === "webp") headers.set("Content-Type", "image/webp");
        else if (ext === "png") headers.set("Content-Type", "image/png");
        else if (ext === "jpg" || ext === "jpeg") headers.set("Content-Type", "image/jpeg");
      }
      return new Response(res.body, { status: res.status, headers });
    }
    return new Response("Remote image not found", {
      status: res.status,
      headers: { "Access-Control-Allow-Origin": "*" }
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e?.message || "Proxy fetch failed" }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      }
    });
  }
}
__name(onRequestGet4, "onRequestGet");
async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "*"
    }
  });
}
__name(onRequestOptions, "onRequestOptions");

// api/_sync_broadcast.ts
async function broadcastStockToRetails(env, request, changedProducts, context) {
  if (!changedProducts || !Array.isArray(changedProducts) || changedProducts.length === 0) {
    return;
  }
  const broadcastTask = /* @__PURE__ */ __name(async () => {
    try {
      const [settingsRes, storeSettingsRes] = await Promise.all([
        env.DB.prepare("SELECT value FROM settings WHERE key = 'registered_retails'").first(),
        env.DB.prepare("SELECT value FROM settings WHERE key = 'websiteSettings'").first()
      ]);
      if (!settingsRes || !settingsRes.value) return;
      let retails = [];
      try {
        retails = JSON.parse(settingsRes.value);
      } catch (e) {
        return;
      }
      if (!Array.isArray(retails) || retails.length === 0) return;
      let storeSettings = {};
      try {
        if (storeSettingsRes && storeSettingsRes.value) {
          storeSettings = JSON.parse(storeSettingsRes.value);
        }
      } catch (e) {
      }
      if (storeSettings?.apiSync?.enabled === false || storeSettings?.apiSync?.isMaster === false) {
        return;
      }
      const masterApiKey = storeSettings?.apiSync?.masterApiKey || "";
      const url = new URL(request.url);
      const originBase = getOriginBase(env, url.origin);
      const broadcastProducts = changedProducts.map((p) => {
        const pCopy = { ...p };
        if (pCopy.image && pCopy.image.startsWith("/")) pCopy.image = originBase + pCopy.image;
        if (pCopy.images) pCopy.images = pCopy.images.map((img) => img.startsWith("/") ? originBase + img : img);
        return pCopy;
      });
      const broadcastData = JSON.stringify({ products: broadcastProducts, isStockOnly: true });
      await Promise.allSettled(retails.map(async (retailUrl) => {
        if (!retailUrl || typeof retailUrl !== "string") return;
        const cleanUrl = retailUrl.trim().replace(/\/$/, "");
        if (!cleanUrl.startsWith("http://") && !cleanUrl.startsWith("https://")) return;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 6e3);
        try {
          await fetch(`${cleanUrl}/api/sync_apply`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${masterApiKey}`
            },
            body: broadcastData,
            signal: controller.signal
          });
        } catch (err) {
        } finally {
          clearTimeout(timeoutId);
        }
      }));
    } catch (e) {
      console.error("Error broadcasting stock update to retails:", e);
    }
  }, "broadcastTask");
  if (context && typeof context.waitUntil === "function") {
    context.waitUntil(broadcastTask());
  } else {
    await broadcastTask();
  }
}
__name(broadcastStockToRetails, "broadcastStockToRetails");
async function notifyMasterOfStockDeduction(env, request, itemsToDeduct, context) {
  if (!itemsToDeduct || !Array.isArray(itemsToDeduct) || itemsToDeduct.length === 0) {
    return;
  }
  const syncTask = /* @__PURE__ */ __name(async () => {
    try {
      const storeSettingsRes = await env.DB.prepare("SELECT value FROM settings WHERE key = 'websiteSettings'").first();
      if (!storeSettingsRes || !storeSettingsRes.value) return;
      let storeSettings = {};
      try {
        storeSettings = JSON.parse(storeSettingsRes.value);
      } catch (e) {
        return;
      }
      if (!storeSettings?.apiSync?.enabled || storeSettings?.apiSync?.isMaster || !storeSettings?.apiSync?.connectedMasterUrl || !storeSettings?.apiSync?.connectedMasterApiKey) {
        return;
      }
      const masterUrl = storeSettings.apiSync.connectedMasterUrl.trim().replace(/\/$/, "");
      const apiKey = storeSettings.apiSync.connectedMasterApiKey;
      const url = new URL(request.url);
      const retailOrigin = url.origin;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6e3);
      try {
        await fetch(`${masterUrl}/api/sync_deduct_stock`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            itemsToDeduct,
            retailUrl: retailOrigin
          }),
          signal: controller.signal
        });
      } catch (err) {
        console.error("Error notifying master store of stock deduction:", err);
      } finally {
        clearTimeout(timeoutId);
      }
    } catch (e) {
      console.error("Error in notifyMasterOfStockDeduction:", e);
    }
  }, "syncTask");
  if (context && typeof context.waitUntil === "function") {
    context.waitUntil(syncTask());
  } else {
    await syncTask();
  }
}
__name(notifyMasterOfStockDeduction, "notifyMasterOfStockDeduction");

// api/public_add_to_order.ts
async function onRequestPost10(context) {
  const { request, env } = context;
  try {
    const data = await request.json();
    const { orderId, newItems, customerPhone } = data;
    if (!orderId || !newItems || !Array.isArray(newItems) || !customerPhone) {
      return new Response(JSON.stringify({ error: "Invalid payload" }), { status: 400 });
    }
    const orderRes = await env.DB.prepare("SELECT data FROM orders WHERE id = ? AND type = 'standard'").bind(orderId).first();
    if (!orderRes || !orderRes.data) {
      return new Response(JSON.stringify({ error: "Order not found" }), { status: 404 });
    }
    const order = JSON.parse(orderRes.data);
    const normPhone = /* @__PURE__ */ __name((p) => {
      if (!p) return "";
      const digits = String(p).replace(/\D/g, "");
      return digits.startsWith("880") ? digits.slice(2) : digits;
    }, "normPhone");
    const existingPhone = normPhone(order.userInfo?.phone || order.clientInfo?.phone || "");
    const reqPhone = normPhone(customerPhone);
    if (existingPhone && reqPhone && existingPhone !== reqPhone) {
      return new Response(JSON.stringify({ error: "Unauthorized order access" }), { status: 403 });
    }
    if (order.status !== "Pending" && order.status !== "Unpaid") {
      return new Response(JSON.stringify({ error: "Cannot modify processed order" }), { status: 400 });
    }
    const updatedOrder = data.updatedOrder;
    if (!updatedOrder || updatedOrder.id !== orderId) {
      return new Response(JSON.stringify({ error: "Invalid order data" }), { status: 400 });
    }
    if (Array.isArray(updatedOrder.items)) {
      updatedOrder.items = updatedOrder.items.map((item) => {
        if (!item) return item;
        const p = item.product || {};
        return {
          id: item.id || p.id || "",
          product: {
            id: p.id || item.id || "",
            title: p.title || "",
            price: Number(p.price) || 0,
            buyPrice: p.buyPrice !== void 0 ? Number(p.buyPrice) : void 0,
            image: p.thumbnail || p.image || "",
            thumbnail: p.thumbnail || p.image || "",
            category: p.category || "",
            supplier: p.supplier || "",
            material: p.material || "",
            variants: p.variants && item.variantId ? p.variants.filter((v) => v.id === item.variantId) : void 0
          },
          quantity: Number(item.quantity) || 1,
          color: item.color,
          variantId: item.variantId,
          variantName: item.variantName,
          variantPrice: item.variantPrice !== void 0 ? Number(item.variantPrice) : void 0,
          variantBuyPrice: item.variantBuyPrice !== void 0 ? Number(item.variantBuyPrice) : void 0,
          selectedOption: item.selectedOption
        };
      });
    }
    const stmts = [];
    stmts.push(
      env.DB.prepare("UPDATE orders SET data = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND type = ?").bind(JSON.stringify(updatedOrder), orderId, "standard")
    );
    const { changedProducts } = data;
    if (changedProducts && Array.isArray(changedProducts) && changedProducts.length > 0) {
      for (const p of changedProducts) {
        stmts.push(
          env.DB.prepare("UPDATE products SET data = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(JSON.stringify(p), String(p.id))
        );
      }
    }
    if (stmts.length > 0) {
      const BATCH_SIZE = 40;
      for (let i = 0; i < stmts.length; i += BATCH_SIZE) {
        const batchChunk = stmts.slice(i, i + BATCH_SIZE);
        await env.DB.batch(batchChunk);
      }
    }
    const itemsToDeduct = (newItems || []).map((item) => {
      let variantIndex;
      if (item.variantId && item.product?.variants) {
        variantIndex = item.product.variants.findIndex((v) => v.id === item.variantId || v.name === item.variantName);
      }
      return {
        id: item.product?.id || item.id,
        variantId: item.variantId,
        variantName: item.variantName,
        variantIndex,
        qty: Number(item.quantity || 0)
      };
    });
    if (itemsToDeduct.length > 0) {
      await notifyMasterOfStockDeduction(env, request, itemsToDeduct, context);
    }
    if (changedProducts && changedProducts.length > 0) {
      await broadcastStockToRetails(env, request, changedProducts, context);
    }
    try {
      const cache2 = caches.default;
      const pubUrl = new URL("/api/public_state", request.url);
      if (context && typeof context.waitUntil === "function") {
        context.waitUntil(cache2.delete(new Request(pubUrl.toString())));
      } else {
        await cache2.delete(new Request(pubUrl.toString()));
      }
    } catch (e) {
    }
    return Response.json({ success: true, order: updatedOrder });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}
__name(onRequestPost10, "onRequestPost");

// ../src/lib/stockUtils.ts
function getAvailableStock(p, variantId) {
  if (!p) return 0;
  if (variantId && p.variants && p.variants.length > 0) {
    const v = p.variants.find((variant) => variant.id === variantId);
    if (v && v.stock !== void 0 && v.stock !== null) {
      return Math.max(0, Number(v.stock));
    }
  }
  if (p.hasVariants && p.variants && p.variants.length > 0) {
    const hasExplicitVariantStocks = p.variants.some((v) => v.stock !== void 0 && v.stock !== null);
    if (hasExplicitVariantStocks) {
      return p.variants.reduce((acc, v) => acc + (v.stock !== void 0 && v.stock !== null ? Math.max(0, Number(v.stock)) : 0), 0);
    }
  }
  if (p.stock !== void 0 && p.stock !== null) {
    return Math.max(0, Number(p.stock));
  }
  return 0;
}
__name(getAvailableStock, "getAvailableStock");
function restoreOrderStock(products, order) {
  let updatedProducts = [...products];
  order.items.forEach((item) => {
    const productIndex = updatedProducts.findIndex((p) => String(p.id) === String(item.product?.id || item.id));
    if (productIndex >= 0) {
      let newProduct = { ...updatedProducts[productIndex] };
      let changed = false;
      if (item.variantId && newProduct.variants && newProduct.variants.length > 0) {
        let variantFound = false;
        newProduct.variants = newProduct.variants.map((v) => {
          if (v.id === item.variantId) {
            variantFound = true;
            changed = true;
            const currentStock = v.stock !== void 0 && v.stock !== null ? Number(v.stock) : Number(newProduct.stock || 0);
            const newStock = currentStock + item.quantity;
            return {
              ...v,
              stock: newStock,
              isVisible: newStock > 0 ? true : v.isVisible
            };
          }
          return v;
        });
        if (variantFound) {
          const hasExplicitVariantStocks = newProduct.variants.some((v) => v.stock !== void 0 && v.stock !== null);
          if (hasExplicitVariantStocks) {
            const totalVariantStock = newProduct.variants.reduce((acc, v) => acc + (Number(v.stock) || 0), 0);
            newProduct.stock = totalVariantStock;
            if (totalVariantStock > 0) {
              newProduct.isVisible = true;
              newProduct.stockOutDate = void 0;
            }
          } else {
            const newStock = Number(newProduct.stock || 0) + item.quantity;
            newProduct.stock = newStock;
            if (newStock > 0) {
              newProduct.isVisible = true;
              newProduct.stockOutDate = void 0;
            }
          }
        } else {
          if (newProduct.stock !== void 0 && newProduct.stock !== null) {
            changed = true;
            const newStock = Number(newProduct.stock) + item.quantity;
            newProduct.stock = newStock;
            if (newStock > 0) {
              newProduct.isVisible = true;
              newProduct.stockOutDate = void 0;
            }
          }
        }
      } else {
        if (newProduct.stock !== void 0 && newProduct.stock !== null) {
          changed = true;
          const newStock = Number(newProduct.stock) + item.quantity;
          newProduct.stock = newStock;
          if (newStock > 0) {
            newProduct.isVisible = true;
            newProduct.stockOutDate = void 0;
          }
        }
      }
      if (changed) {
        updatedProducts[productIndex] = newProduct;
      }
    }
  });
  return updatedProducts;
}
__name(restoreOrderStock, "restoreOrderStock");
function deductOrderStock(products, order) {
  let updatedProducts = [...products];
  order.items.forEach((item) => {
    const productIndex = updatedProducts.findIndex((p) => String(p.id) === String(item.product?.id || item.id));
    if (productIndex >= 0) {
      let newProduct = { ...updatedProducts[productIndex] };
      let changed = false;
      if (item.variantId && newProduct.variants && newProduct.variants.length > 0) {
        let variantFound = false;
        newProduct.variants = newProduct.variants.map((v) => {
          if (v.id === item.variantId) {
            variantFound = true;
            changed = true;
            const currentStock = v.stock !== void 0 && v.stock !== null ? Number(v.stock) : Number(newProduct.stock || 0);
            const newStock = Math.max(0, currentStock - item.quantity);
            return {
              ...v,
              stock: newStock,
              isVisible: newStock > 0 ? true : v.isVisible
            };
          }
          return v;
        });
        if (variantFound) {
          const hasExplicitVariantStocks = newProduct.variants.some((v) => v.stock !== void 0 && v.stock !== null);
          if (hasExplicitVariantStocks) {
            const totalVariantStock = newProduct.variants.reduce((acc, v) => acc + (Number(v.stock) || 0), 0);
            newProduct.stock = totalVariantStock;
            if (totalVariantStock === 0) {
              newProduct.stockOutDate = (/* @__PURE__ */ new Date()).toISOString();
            } else {
              newProduct.stockOutDate = void 0;
              newProduct.isVisible = true;
            }
          } else {
            const newStock = Math.max(0, Number(newProduct.stock || 0) - item.quantity);
            newProduct.stock = newStock;
            if (newStock === 0) {
              newProduct.stockOutDate = (/* @__PURE__ */ new Date()).toISOString();
            } else {
              newProduct.stockOutDate = void 0;
              newProduct.isVisible = true;
            }
          }
        } else {
          if (newProduct.stock !== void 0 && newProduct.stock !== null) {
            changed = true;
            newProduct.stock = Math.max(0, Number(newProduct.stock) - item.quantity);
            if (newProduct.stock === 0) {
              newProduct.stockOutDate = (/* @__PURE__ */ new Date()).toISOString();
            } else {
              newProduct.stockOutDate = void 0;
              newProduct.isVisible = true;
            }
          }
        }
      } else {
        if (newProduct.stock !== void 0 && newProduct.stock !== null) {
          changed = true;
          newProduct.stock = Math.max(0, Number(newProduct.stock) - item.quantity);
          if (newProduct.stock === 0) {
            newProduct.stockOutDate = (/* @__PURE__ */ new Date()).toISOString();
          } else {
            newProduct.stockOutDate = void 0;
            newProduct.isVisible = true;
          }
        }
      }
      if (changed) {
        updatedProducts[productIndex] = newProduct;
      }
    }
  });
  return updatedProducts;
}
__name(deductOrderStock, "deductOrderStock");

// api/public_cancel_order.ts
async function onRequestPost11(context) {
  const { request, env } = context;
  try {
    const data = await request.json();
    const { orderId, customerPhone } = data;
    if (!orderId || !customerPhone) {
      return new Response(JSON.stringify({ error: "Invalid payload" }), { status: 400 });
    }
    const orderRes = await env.DB.prepare("SELECT data FROM orders WHERE id = ? AND type = 'standard'").bind(orderId).first();
    if (!orderRes || !orderRes.data) {
      return new Response(JSON.stringify({ error: "Order not found" }), { status: 404 });
    }
    const order = JSON.parse(orderRes.data);
    const normPhone = /* @__PURE__ */ __name((p) => p ? p.replace(/\D/g, "") : "", "normPhone");
    if (normPhone(order.userInfo?.phone) !== normPhone(customerPhone) && normPhone(order.clientInfo?.phone) !== normPhone(customerPhone)) {
      return new Response(JSON.stringify({ error: "Unauthorized order access" }), { status: 403 });
    }
    if (order.status !== "Pending" && order.status !== "Unpaid") {
      return new Response(JSON.stringify({ error: "Cannot cancel processed order" }), { status: 400 });
    }
    order.status = "Canceled";
    const stmts = [];
    stmts.push(
      env.DB.prepare("UPDATE orders SET data = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND type = ?").bind(JSON.stringify(order), orderId, "standard")
    );
    const productIds = order.items.map((i) => i.product.id);
    const productsRes = await env.DB.prepare(`
        SELECT p.id, p.data 
        FROM products p 
        JOIN json_each(?) j ON p.id = j.value
    `).bind(JSON.stringify(productIds)).all();
    const currentProducts = productsRes.results.map((r) => JSON.parse(r.data));
    const newProducts = restoreOrderStock(currentProducts, order);
    const changedProducts = newProducts.filter((p) => order.items.some((item) => item.product.id === p.id));
    if (changedProducts.length > 0) {
      const updates = changedProducts.map((p) => ({ id: p.id, data: JSON.stringify(p) }));
      stmts.push(
        env.DB.prepare(`
                UPDATE products 
                SET data = json_extract(j.value, '$.data'), 
                    updated_at = CURRENT_TIMESTAMP 
                FROM json_each(?) j 
                WHERE products.id = json_extract(j.value, '$.id')
            `).bind(JSON.stringify(updates))
      );
    }
    if (stmts.length > 0) {
      await env.DB.batch(stmts);
    }
    if (changedProducts && changedProducts.length > 0) {
      await broadcastStockToRetails(env, request, changedProducts, context);
      try {
        const cache2 = caches.default;
        const pubUrl = new URL("/api/public_state", request.url);
        if (context && typeof context.waitUntil === "function") {
          context.waitUntil(cache2.delete(new Request(pubUrl.toString())));
        } else {
          await cache2.delete(new Request(pubUrl.toString()));
        }
      } catch (e) {
      }
    }
    return Response.json({ success: true });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}
__name(onRequestPost11, "onRequestPost");

// api/public_checkout.ts
function sanitizeOrderItem(item) {
  if (!item) return item;
  const p = item.product || {};
  return {
    id: item.id || p.id || "",
    product: {
      id: p.id || item.id || "",
      title: p.title || "",
      price: Number(p.price) || 0,
      buyPrice: p.buyPrice !== void 0 ? Number(p.buyPrice) : void 0,
      image: p.thumbnail || p.image || "",
      thumbnail: p.thumbnail || p.image || "",
      category: p.category || "",
      supplier: p.supplier || "",
      material: p.material || "",
      variants: p.variants && item.variantId ? p.variants.filter((v) => v.id === item.variantId) : void 0
    },
    quantity: Number(item.quantity) || 1,
    color: item.color,
    variantId: item.variantId,
    variantName: item.variantName,
    variantPrice: item.variantPrice !== void 0 ? Number(item.variantPrice) : void 0,
    variantBuyPrice: item.variantBuyPrice !== void 0 ? Number(item.variantBuyPrice) : void 0,
    selectedOption: item.selectedOption
  };
}
__name(sanitizeOrderItem, "sanitizeOrderItem");
async function onRequestPost12(context) {
  const { request, env } = context;
  try {
    const data = await request.json();
    const { order, customer, incompletePhone, discountId } = data;
    if (!order || !order.items || !Array.isArray(order.items)) {
      return new Response(JSON.stringify({ error: "Invalid payload" }), { status: 400 });
    }
    const maxRes = await env.DB.prepare("SELECT MAX(cast(id as integer)) as maxId FROM orders WHERE type = 'standard'").first();
    let nextId = Math.floor(100 + Math.random() * 900).toString();
    if (maxRes && maxRes.maxId) {
      nextId = (maxRes.maxId + 1).toString();
    }
    order.id = nextId;
    order.items = order.items.map(sanitizeOrderItem);
    const stmts = [];
    stmts.push(
      env.DB.prepare("INSERT INTO orders (id, type, data) VALUES (?, ?, ?)").bind(order.id, "standard", JSON.stringify(order))
    );
    if (customer && customer.id) {
      stmts.push(
        env.DB.prepare("INSERT INTO customers (id, data) VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET data = excluded.data, updated_at = CURRENT_TIMESTAMP").bind(customer.id, JSON.stringify(customer))
      );
    }
    const productIds = Array.from(new Set(order.items.map((i) => String(i.product?.id || i.id || "")).filter(Boolean)));
    let changedProducts = [];
    if (productIds.length > 0) {
      const CHUNK_SIZE = 30;
      const currentProducts = [];
      for (let i = 0; i < productIds.length; i += CHUNK_SIZE) {
        const chunk = productIds.slice(i, i + CHUNK_SIZE);
        const placeholders = chunk.map(() => "?").join(",");
        const productsRes = await env.DB.prepare(`SELECT id, data FROM products WHERE id IN (${placeholders})`).bind(...chunk).all();
        if (productsRes && productsRes.results) {
          currentProducts.push(...productsRes.results.map((r) => JSON.parse(r.data)));
        }
      }
      for (const item of order.items) {
        const pId = String(item.product?.id || item.id || "");
        const currentProd = currentProducts.find((p) => String(p.id) === pId);
        if (currentProd) {
          const availableStock = getAvailableStock(currentProd, item.variantId);
          if (availableStock <= 0) {
            return new Response(JSON.stringify({
              error: `"${currentProd.title || "Product"}" is out of stock.`
            }), { status: 400 });
          }
          if (item.quantity > availableStock) {
            return new Response(JSON.stringify({
              error: `Only ${availableStock} items available for "${currentProd.title || "Product"}". You ordered ${item.quantity}.`
            }), { status: 400 });
          }
        }
      }
      const newProducts = deductOrderStock(currentProducts, order);
      changedProducts = newProducts.filter((p) => order.items.some((item) => String(item.product?.id || item.id) === String(p.id)));
      if (changedProducts.length > 0) {
        for (const p of changedProducts) {
          stmts.push(
            env.DB.prepare("UPDATE products SET data = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(JSON.stringify(p), String(p.id))
          );
        }
      }
    }
    if (incompletePhone) {
      stmts.push(
        env.DB.prepare("DELETE FROM orders WHERE type = 'incomplete' AND json_extract(data, '$.phone') = ?").bind(incompletePhone)
      );
    }
    if (discountId) {
      const settingsRes = await env.DB.prepare("SELECT value FROM settings WHERE key = 'websiteSettings'").first();
      if (settingsRes && settingsRes.value) {
        let websiteSettings = JSON.parse(settingsRes.value);
        if (websiteSettings.discounts) {
          websiteSettings.discounts = websiteSettings.discounts.map((d) => {
            if (d.id === discountId) {
              return {
                ...d,
                limits: {
                  ...d.limits,
                  currentUsageGlobal: (d.limits.currentUsageGlobal || 0) + 1
                }
              };
            }
            return d;
          });
          stmts.push(
            env.DB.prepare("UPDATE settings SET value = ?, updated_at = CURRENT_TIMESTAMP WHERE key = 'websiteSettings'").bind(JSON.stringify(websiteSettings))
          );
        }
      }
    }
    if (stmts.length > 0) {
      const BATCH_SIZE = 40;
      for (let i = 0; i < stmts.length; i += BATCH_SIZE) {
        const batchChunk = stmts.slice(i, i + BATCH_SIZE);
        await env.DB.batch(batchChunk);
      }
    }
    const itemsToDeduct = (order.items || []).map((item) => {
      let variantIndex;
      if (item.variantId && item.product?.variants) {
        variantIndex = item.product.variants.findIndex((v) => v.id === item.variantId || v.name === item.variantName);
      }
      return {
        id: item.product?.id || item.id,
        variantId: item.variantId,
        variantName: item.variantName,
        variantIndex,
        qty: Number(item.quantity || 0)
      };
    });
    if (itemsToDeduct.length > 0) {
      if (context && typeof context.waitUntil === "function") {
        context.waitUntil(notifyMasterOfStockDeduction(env, request, itemsToDeduct, context));
      } else {
        await notifyMasterOfStockDeduction(env, request, itemsToDeduct, context);
      }
    }
    if (changedProducts && changedProducts.length > 0) {
      if (context && typeof context.waitUntil === "function") {
        context.waitUntil(broadcastStockToRetails(env, request, changedProducts, context));
      } else {
        await broadcastStockToRetails(env, request, changedProducts, context);
      }
      try {
        const cache2 = caches.default;
        const pubUrl = new URL("/api/public_state", request.url);
        if (context && typeof context.waitUntil === "function") {
          context.waitUntil(cache2.delete(new Request(pubUrl.toString())));
        } else {
          await cache2.delete(new Request(pubUrl.toString()));
        }
      } catch (e) {
      }
    }
    return Response.json({ success: true, order });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message || "Internal error" }), { status: 500 });
  }
}
__name(onRequestPost12, "onRequestPost");

// api/public_incomplete_order.ts
async function onRequestPost13(context) {
  const { request, env } = context;
  try {
    const order = await request.json();
    if (!order || !order.id || !order.phone) {
      return new Response(JSON.stringify({ error: "Invalid payload" }), { status: 400 });
    }
    await env.DB.prepare("INSERT INTO orders (id, type, data) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET data = excluded.data, updated_at = CURRENT_TIMESTAMP").bind(order.id, "incomplete", JSON.stringify(order)).run();
    return Response.json({ success: true, order });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}
__name(onRequestPost13, "onRequestPost");

// api/public_state.ts
async function onRequestGet5(context) {
  const { request, env, waitUntil } = context;
  const cache2 = caches.default;
  const cacheKey = new Request(new URL("/api/public_state", request.url).toString());
  try {
    let response = await cache2.match(cacheKey);
    if (response) {
      return response;
    }
    const productsRes = await env.DB.prepare("SELECT id, data FROM products LIMIT 5000").all();
    const settingsRes = await env.DB.prepare("SELECT key, value FROM settings").all();
    const products = productsRes.results.map((r) => {
      const p = JSON.parse(r.data);
      delete p.buyPrice;
      delete p.autoPrice;
      delete p.supplier;
      delete p.stockOutDate;
      if (p.variants) {
        p.variants.forEach((v) => delete v.buyPrice);
      }
      return p;
    });
    const settings = {};
    for (const r of settingsRes.results) {
      if (r.key === "adminUsers" || r.key === "courierSettings" || r.key === "priceCalculatorSettings" || r.key === "registered_retails" || r.key === "telegramNotification") {
        continue;
      }
      let value = JSON.parse(r.value);
      if (r.key === "marketingSettings") {
        if (value?.tiktokPixel?.accessToken) delete value.tiktokPixel.accessToken;
        if (value?.metaPixel?.accessToken) delete value.metaPixel.accessToken;
        if (value?.ga4?.apiSecret) delete value.ga4.apiSecret;
      }
      if (r.key === "websiteSettings" || r.key === "website") {
        if (value?.telegramNotification) {
          delete value.telegramNotification.botToken;
          delete value.telegramNotification.chatId;
        }
        if (value?.suppliers) {
          delete value.suppliers;
        }
        if (value?.apiSync) {
          delete value.apiSync.masterApiKey;
          delete value.apiSync.connectedWebsites;
          delete value.apiSync.apiActivityLogs;
        }
        if (value?.apiSettings) {
          delete value.apiSettings.masterApiKey;
          delete value.apiSettings.connectedWebsites;
          delete value.apiSettings.apiActivityLogs;
          delete value.apiSettings.retailApiKey;
        }
      }
      settings[r.key] = value;
    }
    let responseBody = JSON.stringify({ products, settings });
    responseBody = replaceUploadUrls(responseBody, env);
    response = new Response(responseBody, {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=15, s-maxage=60, stale-while-revalidate=120"
      }
    });
    if (waitUntil && typeof waitUntil === "function") {
      waitUntil(cache2.put(cacheKey, response.clone()));
    }
    return response;
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
}
__name(onRequestGet5, "onRequestGet");

// api/register.ts
async function onRequestPost14(context) {
  const { request, env } = context;
  try {
    const { email, password } = await request.json();
    const settingsRes = await env.DB.prepare("SELECT value FROM settings WHERE key = ?").bind("adminUsers").all();
    const adminUsers = settingsRes.results.length > 0 ? JSON.parse(settingsRes.results[0].value) : [];
    if (adminUsers.some((u) => u.email.trim() === email.trim())) {
      return new Response(JSON.stringify({ success: false, error: "Email already exists." }), { status: 400, headers: { "Content-Type": "application/json" } });
    }
    const newUser = {
      id: Date.now().toString(),
      email: email.trim(),
      passwordHash: password,
      isApproved: false,
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    adminUsers.push(newUser);
    await env.DB.prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").bind("adminUsers", JSON.stringify(adminUsers)).run();
    const safeUser = { ...newUser };
    delete safeUser.passwordHash;
    return new Response(JSON.stringify({ success: true, user: safeUser }), { headers: { "Content-Type": "application/json" } });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
}
__name(onRequestPost14, "onRequestPost");

// api/run_retention_cleanup.ts
async function onRequestPost15({ request, env }) {
  try {
    const settingsRes = await env.DB.prepare("SELECT value FROM settings WHERE key = ?").bind("websiteSettings").first();
    if (!settingsRes) return Response.json({ success: true, message: "no settings" });
    const settings = JSON.parse(settingsRes.value);
    const retentionDays = settings?.incompleteOrdersFeature?.retentionPeriodDays ?? 7;
    if (retentionDays === 0) {
      return Response.json({ success: true, message: "retention disabled" });
    }
    const cutoffTime = Date.now() - retentionDays * 24 * 60 * 60 * 1e3;
    const oldIncompleteRes = await env.DB.prepare("SELECT id, data FROM orders WHERE type = ?").bind("incomplete").all();
    const idsToDelete = [];
    const urlsToRelease = [];
    const extractProductUrls = /* @__PURE__ */ __name((product) => {
      const urls = [];
      if (product?.image) urls.push(product.image);
      if (product?.images) urls.push(...product.images);
      if (product?.colors) urls.push(...product.colors.map((c) => c.image));
      if (product?.variants) urls.push(...product.variants.map((v) => v.image));
      return urls.filter((u) => u && typeof u === "string" && (u.startsWith("http") || u.startsWith("/uploads")));
    }, "extractProductUrls");
    for (const record of oldIncompleteRes.results) {
      const order = JSON.parse(record.data);
      if (order.timestamp < cutoffTime) {
        idsToDelete.push(record.id);
        const items = order.items || order.cartItems || [];
        items.forEach((item) => {
          if (item.product) urlsToRelease.push(...extractProductUrls(item.product));
        });
      }
    }
    if (idsToDelete.length > 0) {
      for (let i = 0; i < idsToDelete.length; i += 50) {
        const chunk = idsToDelete.slice(i, i + 50);
        const placeholders = chunk.map(() => "?").join(",");
        await env.DB.prepare(`DELETE FROM orders WHERE id IN (${placeholders})`).bind(...chunk).run();
      }
      if (urlsToRelease.length > 0) {
        try {
          const promises = [];
          for (const url of Array.from(new Set(urlsToRelease))) {
            const match2 = url.match(/(uploads\/.*)$/);
            if (match2 && match2[1]) {
              const key = match2[1];
              const searchPattern = `%${key}%`;
              const productsMatch = await env.DB.prepare("SELECT id FROM products WHERE data LIKE ? LIMIT 1").bind(searchPattern).first();
              const ordersMatch = await env.DB.prepare("SELECT id FROM orders WHERE data LIKE ? LIMIT 1").bind(searchPattern).first();
              const settingsMatch = await env.DB.prepare("SELECT key FROM settings WHERE value LIKE ? LIMIT 1").bind(searchPattern).first();
              if (!productsMatch && !ordersMatch && !settingsMatch) {
                if (env.BUCKET) {
                  promises.push(env.BUCKET.delete(key).catch(() => {
                  }));
                }
              }
            }
          }
          await Promise.all(promises);
        } catch (gcErr) {
          console.error("Inner GC failed", gcErr);
        }
      }
    }
    return Response.json({ success: true, deleted: idsToDelete.length });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}
__name(onRequestPost15, "onRequestPost");

// api/send_telegram.ts
async function onRequestPost16(context) {
  const { request, env, waitUntil } = context;
  try {
    const data = await request.json();
    const { message: message2 } = data;
    if (!message2) {
      return new Response("Message is required", { status: 400 });
    }
    const settingsRes = await env.DB.prepare("SELECT value FROM settings WHERE key = ?").bind("websiteSettings").first();
    const storeSettings = settingsRes && settingsRes.value ? JSON.parse(settingsRes.value) : {};
    const telegram = storeSettings.telegramNotification;
    if (!telegram || !telegram.enabled || !telegram.botToken || !telegram.chatId) {
      return Response.json({ success: false, error: "Telegram notification not configured" });
    }
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6e3);
    const sendTask = fetch(`https://api.telegram.org/bot${telegram.botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: telegram.chatId,
        text: message2
      }),
      signal: controller.signal
    }).finally(() => clearTimeout(timeoutId));
    if (waitUntil && typeof waitUntil === "function") {
      waitUntil(sendTask.catch(() => {
      }));
      return Response.json({ success: true, queued: true });
    } else {
      const res = await sendTask;
      if (!res.ok) {
        const err = await res.text();
        return Response.json({ success: false, error: err }, { status: res.status });
      }
      return Response.json({ success: true });
    }
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}
__name(onRequestPost16, "onRequestPost");

// api/settings.ts
async function onRequestPost17({ request, env, waitUntil }) {
  try {
    const data = await request.json();
    const { key, value } = data;
    if (!key || value === void 0) {
      return new Response("Invalid payload", { status: 400 });
    }
    let finalValue = value;
    if (key === "adminUsers") {
      const currentRes = await env.DB.prepare("SELECT value FROM settings WHERE key = ?").bind("adminUsers").all();
      const currentUsers = currentRes.results.length > 0 ? JSON.parse(currentRes.results[0].value) : [];
      if (Array.isArray(value)) {
        finalValue = value.map((u) => {
          const existing = currentUsers.find((cu) => cu.email === u.email);
          if (existing && existing.passwordHash) {
            return { ...u, passwordHash: existing.passwordHash };
          }
          return u;
        });
      }
    }
    await env.DB.prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP").bind(key, JSON.stringify(finalValue)).run();
    const cache2 = caches.default;
    const url = new URL("/api/public_state", request.url);
    if (waitUntil) {
      waitUntil(cache2.delete(new Request(url.toString())));
    } else {
      await cache2.delete(new Request(url.toString()));
    }
    return Response.json({ success: true, key });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}
__name(onRequestPost17, "onRequestPost");

// api/sync_apply.ts
async function onRequestPost18(context) {
  const { request, env } = context;
  try {
    const data = await request.json();
    const { products, deletedIds, isStockOnly } = data;
    const stmts = [];
    let count = 0;
    if (deletedIds && Array.isArray(deletedIds) && deletedIds.length > 0 && !isStockOnly) {
      for (let i = 0; i < deletedIds.length; i += 25) {
        const chunkIds = deletedIds.slice(i, i + 25);
        const placeholders = chunkIds.map(() => "?").join(",");
        stmts.push(env.DB.prepare(`DELETE FROM products WHERE id IN (${placeholders})`).bind(...chunkIds));
        count += chunkIds.length;
      }
    }
    if (products && Array.isArray(products)) {
      const productIds = products.map((p) => p.id);
      const currentProducts = /* @__PURE__ */ new Map();
      for (let i = 0; i < productIds.length; i += 25) {
        const chunkIds = productIds.slice(i, i + 25);
        const placeholders = chunkIds.map(() => "?").join(",");
        const res = await env.DB.prepare(`SELECT id, data FROM products WHERE id IN (${placeholders})`).bind(...chunkIds).all();
        for (const r of res.results || []) {
          try {
            currentProducts.set(String(r.id), JSON.parse(r.data));
          } catch (e) {
          }
        }
      }
      for (const p of products) {
        const strId = String(p.id);
        if (isStockOnly) {
          if (currentProducts.has(strId)) {
            let current = currentProducts.get(strId);
            current.stock = p.stock;
            if (p.stockOutDate !== void 0) current.stockOutDate = p.stockOutDate;
            if (p.isVisible !== void 0) current.isVisible = p.isVisible;
            if (current.variants && p.variants) {
              current.variants = current.variants.map((cv) => {
                const masterVariant = p.variants.find((mv) => mv.id === cv.id || mv.name && mv.name === cv.name);
                if (masterVariant && masterVariant.stock !== void 0) {
                  return { ...cv, stock: masterVariant.stock, isVisible: masterVariant.isVisible ?? cv.isVisible };
                }
                return cv;
              });
              const hasExplicitVariantStocks = current.variants.some((v) => v.stock !== void 0 && v.stock !== null);
              if (hasExplicitVariantStocks) {
                const totalVariantStock = current.variants.reduce((acc, v) => acc + (Number(v.stock) || 0), 0);
                current.stock = totalVariantStock;
              } else if (p.stock !== void 0) {
                current.stock = p.stock;
              }
            }
            stmts.push(
              env.DB.prepare("UPDATE products SET data = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(JSON.stringify(current), current.id || p.id)
            );
            count++;
          }
        } else {
          if (currentProducts.has(strId)) {
            let current = currentProducts.get(strId);
            let merged = { ...p };
            if (current.autoPrice === false) {
              merged.price = current.price;
              merged.autoPrice = false;
              merged.customPrice = current.customPrice;
            }
            if (merged.variants && current.variants) {
              merged.variants = merged.variants.map((mv) => {
                const cv = current.variants.find((v) => v.id === mv.id);
                if (cv && current.autoPrice === false) {
                  return { ...mv, price: cv.price };
                }
                return mv;
              });
            }
            stmts.push(
              env.DB.prepare("UPDATE products SET data = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(JSON.stringify(merged), p.id)
            );
            count++;
          } else {
            stmts.push(
              env.DB.prepare("INSERT INTO products (id, data) VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET data = excluded.data, updated_at = CURRENT_TIMESTAMP").bind(p.id, JSON.stringify(p))
            );
            count++;
          }
        }
      }
    }
    if (stmts.length > 0) {
      for (let i = 0; i < stmts.length; i += 25) {
        const chunk = stmts.slice(i, i + 25);
        await env.DB.batch(chunk);
      }
    }
    if (data.categories && Array.isArray(data.categories) && data.categories.length > 0 && !isStockOnly) {
      try {
        const storeSettingsRes = await env.DB.prepare("SELECT value FROM settings WHERE key = 'websiteSettings'").first();
        if (storeSettingsRes && storeSettingsRes.value) {
          const storeSettings = JSON.parse(storeSettingsRes.value);
          if (!storeSettings.categories || storeSettings.categories.length === 0) {
            storeSettings.categories = data.categories;
            await env.DB.prepare("INSERT INTO settings (key, value) VALUES ('websiteSettings', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").bind(JSON.stringify(storeSettings)).run();
          }
        }
      } catch (e) {
      }
    }
    try {
      const cache2 = caches.default;
      const url = new URL("/api/public_state", request.url);
      if (context.waitUntil) {
        context.waitUntil(cache2.delete(new Request(url.toString())));
      } else {
        await cache2.delete(new Request(url.toString()));
      }
    } catch (e) {
    }
    return new Response(JSON.stringify({ success: true, processed: count }), {
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message || "Internal sync error" }), {
      status: 500,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
    });
  }
}
__name(onRequestPost18, "onRequestPost");
async function onRequestOptions2() {
  return new Response(null, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Authorization, Content-Type"
    }
  });
}
__name(onRequestOptions2, "onRequestOptions");

// api/sync_check.ts
async function onRequestPost19(context) {
  const { request, env } = context;
  try {
    const authHeader = request.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } });
    }
    const token = authHeader.split(" ")[1];
    const data = await request.json();
    const retailUrl = data.retailUrl;
    const settingsRes = await env.DB.prepare("SELECT key, value FROM settings").all();
    let settings = {};
    for (const r of settingsRes.results) {
      settings[r.key] = JSON.parse(r.value);
    }
    const storeSettings = settings.websiteSettings || settings.store_settings || {};
    if (!storeSettings?.apiSync?.enabled || !storeSettings?.apiSync?.isMaster) {
      return new Response(JSON.stringify({ error: "Master sync is disabled on this server" }), { status: 403, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } });
    }
    if (storeSettings.apiSync.masterApiKey !== token) {
      return new Response(JSON.stringify({ error: "Invalid API Key" }), { status: 401, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } });
    }
    if (retailUrl) {
      let registeredRetails = settings.registered_retails || [];
      if (!registeredRetails.includes(retailUrl)) {
        registeredRetails.push(retailUrl);
        await env.DB.prepare("INSERT INTO settings (key, value) VALUES ('registered_retails', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").bind(JSON.stringify(registeredRetails)).run();
      }
    }
    return new Response(JSON.stringify({ success: true, message: "Connected successfully" }), { headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } });
  }
}
__name(onRequestPost19, "onRequestPost");
async function onRequestOptions3() {
  return new Response(null, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Authorization, Content-Type"
    }
  });
}
__name(onRequestOptions3, "onRequestOptions");

// api/sync_data.ts
async function onRequestGet6(context) {
  const { request, env } = context;
  try {
    const authHeader = request.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } });
    }
    const token = authHeader.split(" ")[1];
    const settingsRes = await env.DB.prepare("SELECT key, value FROM settings").all();
    let settings = {};
    for (const r of settingsRes.results) {
      settings[r.key] = JSON.parse(r.value);
    }
    const storeSettings = settings.websiteSettings || settings.store_settings || {};
    if (!storeSettings?.apiSync?.enabled || !storeSettings?.apiSync?.isMaster || storeSettings.apiSync.masterApiKey !== token) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } });
    }
    const url = new URL(request.url);
    const origin = url.origin;
    const originBase = getOriginBase(env, origin);
    const productsRes = await env.DB.prepare("SELECT id, data FROM products").all();
    const products = productsRes.results.map((r) => {
      const p = JSON.parse(r.data);
      if (p.image && p.image.startsWith("/")) p.image = originBase + p.image;
      if (p.images) p.images = p.images.map((img) => img.startsWith("/") ? originBase + img : img);
      return p;
    });
    return new Response(JSON.stringify({
      success: true,
      products,
      categories: settings.settings?.categories || storeSettings?.categories || []
    }), { headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } });
  }
}
__name(onRequestGet6, "onRequestGet");
async function onRequestOptions4() {
  return new Response(null, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Authorization"
    }
  });
}
__name(onRequestOptions4, "onRequestOptions");

// api/sync_deduct_stock.ts
async function onRequestPost20(context) {
  const { request, env } = context;
  try {
    const authHeader = request.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } });
    }
    const token = authHeader.split(" ")[1];
    const data = await request.json();
    const { itemsToDeduct, retailUrl } = data;
    const settingsRes = await env.DB.prepare("SELECT key, value FROM settings").all();
    let settings = {};
    for (const r of settingsRes.results) {
      settings[r.key] = JSON.parse(r.value);
    }
    const storeSettings = settings.websiteSettings || settings.store_settings || {};
    if (!storeSettings?.apiSync?.enabled || !storeSettings?.apiSync?.isMaster || storeSettings.apiSync.masterApiKey !== token) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } });
    }
    if (!itemsToDeduct || !Array.isArray(itemsToDeduct)) {
      return new Response(JSON.stringify({ error: "Invalid payload" }), { status: 400 });
    }
    if (retailUrl) {
      let registeredRetails = settings.registered_retails || [];
      if (!registeredRetails.includes(retailUrl)) {
        registeredRetails.push(retailUrl);
        await env.DB.prepare("INSERT INTO settings (key, value) VALUES ('registered_retails', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").bind(JSON.stringify(registeredRetails)).run();
      }
    }
    const stmts = [];
    const productIds = Array.from(new Set(itemsToDeduct.map((i) => String(i.id || "")).filter(Boolean)));
    if (productIds.length === 0) {
      return Response.json({ success: true, updated: 0 });
    }
    const placeholders = productIds.map(() => "?").join(",");
    const productsRes = await env.DB.prepare(`SELECT id, data FROM products WHERE id IN (${placeholders})`).bind(...productIds).all();
    const currentProducts = /* @__PURE__ */ new Map();
    for (const r of productsRes.results) {
      currentProducts.set(String(r.id), JSON.parse(r.data));
    }
    let updatedAny = false;
    const modifiedProducts = [];
    for (const item of itemsToDeduct) {
      const product = currentProducts.get(String(item.id));
      if (product) {
        let pChanged = false;
        let targetVariantIdx = item.variantIndex;
        if ((targetVariantIdx === void 0 || targetVariantIdx < 0) && item.variantId && Array.isArray(product.variants)) {
          targetVariantIdx = product.variants.findIndex((v) => v.id === item.variantId || v.name === item.variantName);
        }
        if (targetVariantIdx !== void 0 && targetVariantIdx >= 0 && product.variants && product.variants[targetVariantIdx]) {
          const curVariantStock = product.variants[targetVariantIdx].stock !== void 0 && product.variants[targetVariantIdx].stock !== null ? Number(product.variants[targetVariantIdx].stock) : Number(product.stock || 0);
          const newStock = Math.max(0, curVariantStock - item.qty);
          product.variants[targetVariantIdx].stock = newStock;
          if (newStock > 0) {
            product.variants[targetVariantIdx].isVisible = true;
          }
          pChanged = true;
          const hasExplicitVariantStocks = product.variants.some((v) => v.stock !== void 0 && v.stock !== null);
          if (hasExplicitVariantStocks) {
            const totalVariantStock = product.variants.reduce((acc, v) => acc + Number(v.stock || 0), 0);
            product.stock = totalVariantStock;
            if (totalVariantStock === 0) {
              product.stockOutDate = (/* @__PURE__ */ new Date()).toISOString();
            } else {
              product.stockOutDate = void 0;
              product.isVisible = true;
            }
          } else {
            const curStock = Number(product.stock || 0);
            const mainStock = Math.max(0, curStock - item.qty);
            product.stock = mainStock;
            if (mainStock === 0) {
              product.stockOutDate = (/* @__PURE__ */ new Date()).toISOString();
            } else {
              product.stockOutDate = void 0;
              product.isVisible = true;
            }
          }
        } else {
          const curStock = Number(product.stock || 0);
          const newStock = Math.max(0, curStock - item.qty);
          product.stock = newStock;
          if (newStock === 0) {
            product.stockOutDate = (/* @__PURE__ */ new Date()).toISOString();
          } else {
            product.stockOutDate = void 0;
            product.isVisible = true;
          }
          pChanged = true;
        }
        if (pChanged) {
          stmts.push(
            env.DB.prepare("UPDATE products SET data = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(JSON.stringify(product), product.id)
          );
          updatedAny = true;
          if (!modifiedProducts.some((p) => p.id === product.id)) {
            modifiedProducts.push(product);
          }
        }
      }
    }
    if (stmts.length > 0) {
      await env.DB.batch(stmts);
    }
    if (updatedAny && modifiedProducts.length > 0) {
      await broadcastStockToRetails(env, request, modifiedProducts, context);
      try {
        const cache2 = caches.default;
        const pubUrl = new URL("/api/public_state", request.url);
        if (context && typeof context.waitUntil === "function") {
          context.waitUntil(cache2.delete(new Request(pubUrl.toString())));
        } else {
          await cache2.delete(new Request(pubUrl.toString()));
        }
      } catch (e) {
      }
    }
    return new Response(JSON.stringify({ success: true, updated: updatedAny }), { headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } });
  }
}
__name(onRequestPost20, "onRequestPost");
async function onRequestOptions5() {
  return new Response(null, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Authorization, Content-Type"
    }
  });
}
__name(onRequestOptions5, "onRequestOptions");

// api/tiktok.ts
async function onRequestPost21({ request, env }) {
  try {
    const data = await request.json();
    const settingsRow = await env.DB.prepare(
      "SELECT value FROM settings WHERE key = ?"
    ).bind("marketingSettings").first();
    if (!settingsRow)
      return new Response(
        JSON.stringify({ success: false, reason: "No marketing settings" }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    const settings = JSON.parse(settingsRow.value);
    const pixelSettings = settings.tiktokPixel;
    if (!pixelSettings || !pixelSettings.enabled || !pixelSettings.pixelId || !pixelSettings.accessToken) {
      return new Response(
        JSON.stringify({
          success: false,
          reason: "TikTok pixel server tracking not configured"
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }
    const currentTimestamp = Math.floor(Date.now() / 1e3);
    const inputEvents = data.events && Array.isArray(data.events) ? data.events : [data];
    const tiktokDataArray = inputEvents.map((ev) => {
      const {
        eventName,
        eventData,
        userData = {},
        eventId,
        url,
        referrer,
        userAgent
      } = ev;
      const userPayload = {};
      if (userData.ttp) userPayload.ttp = userData.ttp;
      if (userData.ttclid) userPayload.ttclid = userData.ttclid;
      if (userData.ph) userPayload.phone_number = userData.ph;
      if (userData.em) userPayload.email = userData.em;
      if (userData.external_id) userPayload.external_id = userData.external_id;
      const userAgentToUse = userAgent || request.headers.get("user-agent") || "Unknown";
      const clientIp = request.headers.get("cf-connecting-ip") || request.headers.get("x-real-ip") || request.headers.get("x-forwarded-for") || "127.0.0.1";
      return {
        event: eventName,
        event_id: eventId,
        event_time: currentTimestamp,
        user: userPayload,
        context: {
          page: {
            url,
            referrer: referrer || ""
          },
          user_agent: userAgentToUse,
          ip: clientIp
        },
        properties: eventData || {}
      };
    });
    const payload = {
      pixel_code: pixelSettings.pixelId,
      data: tiktokDataArray
    };
    if (pixelSettings.testCode) {
      payload.test_event_code = pixelSettings.testCode;
    }
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6e3);
    let response;
    try {
      response = await fetch(
        `https://business-api.tiktok.com/open_api/v1.3/pixel/track/`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Access-Token": pixelSettings.accessToken
          },
          body: JSON.stringify(payload),
          signal: controller.signal
        }
      );
    } finally {
      clearTimeout(timeoutId);
    }
    const responseData = await response.json();
    return new Response(JSON.stringify(responseData), {
      status: response.status,
      headers: { "Content-Type": "application/json" }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
__name(onRequestPost21, "onRequestPost");

// api/upload.ts
async function onRequestPost22({ request, env }) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    if (!file || !(file instanceof File)) {
      return new Response("Missing or invalid file", { status: 400 });
    }
    const ext = file.name.split(".").pop() || "webp";
    const key = `uploads/img_${Date.now()}_${crypto.randomUUID()}.${ext}`;
    const buffer = await file.arrayBuffer();
    if (!env.BUCKET) {
      throw new Error("R2 BUCKET binding is not configured. Please bind your R2 bucket to the BUCKET variable in Cloudflare Pages settings.");
    }
    await env.BUCKET.put(key, buffer, {
      httpMetadata: {
        contentType: file.type || "image/webp",
        cacheControl: "public, max-age=31536000, immutable"
      }
    });
    const customDomain = getCustomDomain(env);
    const url = `https://${customDomain}/${key}`;
    return Response.json({ success: true, url, key });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}
__name(onRequestPost22, "onRequestPost");

// api/_middleware.ts
async function onRequest(context) {
  const { request, env, next } = context;
  const url = new URL(request.url);
  const path = url.pathname;
  if (request.method === "OPTIONS") {
    return next();
  }
  const publicPaths = [
    "/api/public_state",
    "/api/login",
    "/api/register",
    "/api/logout",
    "/api/sync_check",
    "/api/sync_data",
    "/api/public_checkout",
    "/api/public_incomplete_order",
    "/api/public_add_to_order",
    "/api/public_cancel_order",
    "/api/sync_deduct_stock",
    "/api/get_my_orders",
    "/api/facebook",
    "/api/tiktok",
    "/api/ga4",
    "/api/send_telegram",
    "/api/proxy_image"
  ];
  if (publicPaths.includes(path)) {
    return next();
  }
  const authHeader = request.headers.get("Authorization");
  const tokenFromHeader = authHeader ? authHeader.replace("Bearer ", "").replace("Admin ", "") : null;
  const cookieHeader = request.headers.get("Cookie") || "";
  const cookies = Object.fromEntries(cookieHeader.split(";").map((c) => c.trim().split("=")));
  const adminToken = cookies["admin_token"];
  if (path === "/api/sync_apply") {
    const storeSettingsRes = await env.DB.prepare("SELECT value FROM settings WHERE key = ?").bind("websiteSettings").all();
    const storeSettings = storeSettingsRes.results.length > 0 ? JSON.parse(storeSettingsRes.results[0].value) : {};
    let isAdminAuth = false;
    if (adminToken) {
      try {
        const secret = new TextEncoder().encode(env.JWT_SECRET || "default_secret_change_in_production");
        await jwtVerify(adminToken, secret);
        isAdminAuth = true;
      } catch (e) {
      }
    }
    const isMasterKeyAuth = Boolean(
      tokenFromHeader && storeSettings?.apiSync?.connectedMasterApiKey && tokenFromHeader.trim() === storeSettings.apiSync.connectedMasterApiKey.trim()
    );
    if (!isAdminAuth && !isMasterKeyAuth) {
      return new Response(JSON.stringify({ error: "Unauthorized retail sync" }), { status: 401, headers: { "Content-Type": "application/json" } });
    }
    return next();
  }
  if (!adminToken) {
    return new Response(JSON.stringify({ error: "Unauthorized - Missing Token" }), { status: 401, headers: { "Content-Type": "application/json" } });
  }
  try {
    const secret = new TextEncoder().encode(env.JWT_SECRET || "default_secret_change_in_production");
    const { payload } = await jwtVerify(adminToken, secret);
    const settingsRes = await env.DB.prepare("SELECT value FROM settings WHERE key = ?").bind("adminUsers").all();
    const adminUsers = settingsRes.results.length > 0 ? JSON.parse(settingsRes.results[0].value) : [];
    const user = adminUsers.find((u) => u.email === payload.email);
    if (!user || user.isBlocked || !user.isApproved) {
      return new Response(JSON.stringify({ error: "Unauthorized or blocked admin" }), { status: 401, headers: { "Content-Type": "application/json" } });
    }
  } catch (e) {
    return new Response(JSON.stringify({ error: "Unauthorized - Invalid Token" }), { status: 401, headers: { "Content-Type": "application/json" } });
  }
  const response = await next();
  const newHeaders = new Headers(response.headers);
  newHeaders.set("X-Content-Type-Options", "nosniff");
  newHeaders.set("X-Frame-Options", "SAMEORIGIN");
  newHeaders.set("Referrer-Policy", "strict-origin-when-cross-origin");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders
  });
}
__name(onRequest, "onRequest");

// ../.wrangler/tmp/pages-bQElGf/functionsRoutes-0.8893536093203687.mjs
var routes = [
  {
    routePath: "/api/admin_orders",
    mountPath: "/api",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet]
  },
  {
    routePath: "/api/admin_state",
    mountPath: "/api",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet2]
  },
  {
    routePath: "/api/customers",
    mountPath: "/api",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost]
  },
  {
    routePath: "/api/facebook",
    mountPath: "/api",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost2]
  },
  {
    routePath: "/api/ga4",
    mountPath: "/api",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost3]
  },
  {
    routePath: "/api/gc",
    mountPath: "/api",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost4]
  },
  {
    routePath: "/api/get_admins",
    mountPath: "/api",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet3]
  },
  {
    routePath: "/api/get_my_orders",
    mountPath: "/api",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost5]
  },
  {
    routePath: "/api/login",
    mountPath: "/api",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost6]
  },
  {
    routePath: "/api/logout",
    mountPath: "/api",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost7]
  },
  {
    routePath: "/api/orders",
    mountPath: "/api",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost8]
  },
  {
    routePath: "/api/products",
    mountPath: "/api",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost9]
  },
  {
    routePath: "/api/proxy_image",
    mountPath: "/api",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet4]
  },
  {
    routePath: "/api/proxy_image",
    mountPath: "/api",
    method: "OPTIONS",
    middlewares: [],
    modules: [onRequestOptions]
  },
  {
    routePath: "/api/public_add_to_order",
    mountPath: "/api",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost10]
  },
  {
    routePath: "/api/public_cancel_order",
    mountPath: "/api",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost11]
  },
  {
    routePath: "/api/public_checkout",
    mountPath: "/api",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost12]
  },
  {
    routePath: "/api/public_incomplete_order",
    mountPath: "/api",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost13]
  },
  {
    routePath: "/api/public_state",
    mountPath: "/api",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet5]
  },
  {
    routePath: "/api/register",
    mountPath: "/api",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost14]
  },
  {
    routePath: "/api/run_retention_cleanup",
    mountPath: "/api",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost15]
  },
  {
    routePath: "/api/send_telegram",
    mountPath: "/api",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost16]
  },
  {
    routePath: "/api/settings",
    mountPath: "/api",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost17]
  },
  {
    routePath: "/api/sync_apply",
    mountPath: "/api",
    method: "OPTIONS",
    middlewares: [],
    modules: [onRequestOptions2]
  },
  {
    routePath: "/api/sync_apply",
    mountPath: "/api",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost18]
  },
  {
    routePath: "/api/sync_check",
    mountPath: "/api",
    method: "OPTIONS",
    middlewares: [],
    modules: [onRequestOptions3]
  },
  {
    routePath: "/api/sync_check",
    mountPath: "/api",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost19]
  },
  {
    routePath: "/api/sync_data",
    mountPath: "/api",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet6]
  },
  {
    routePath: "/api/sync_data",
    mountPath: "/api",
    method: "OPTIONS",
    middlewares: [],
    modules: [onRequestOptions4]
  },
  {
    routePath: "/api/sync_deduct_stock",
    mountPath: "/api",
    method: "OPTIONS",
    middlewares: [],
    modules: [onRequestOptions5]
  },
  {
    routePath: "/api/sync_deduct_stock",
    mountPath: "/api",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost20]
  },
  {
    routePath: "/api/tiktok",
    mountPath: "/api",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost21]
  },
  {
    routePath: "/api/upload",
    mountPath: "/api",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost22]
  },
  {
    routePath: "/api",
    mountPath: "/api",
    method: "",
    middlewares: [onRequest],
    modules: []
  }
];

// ../../../.npm/_npx/32026684e21afda6/node_modules/path-to-regexp/dist.es2015/index.js
function lexer(str) {
  var tokens = [];
  var i = 0;
  while (i < str.length) {
    var char = str[i];
    if (char === "*" || char === "+" || char === "?") {
      tokens.push({ type: "MODIFIER", index: i, value: str[i++] });
      continue;
    }
    if (char === "\\") {
      tokens.push({ type: "ESCAPED_CHAR", index: i++, value: str[i++] });
      continue;
    }
    if (char === "{") {
      tokens.push({ type: "OPEN", index: i, value: str[i++] });
      continue;
    }
    if (char === "}") {
      tokens.push({ type: "CLOSE", index: i, value: str[i++] });
      continue;
    }
    if (char === ":") {
      var name = "";
      var j = i + 1;
      while (j < str.length) {
        var code = str.charCodeAt(j);
        if (
          // `0-9`
          code >= 48 && code <= 57 || // `A-Z`
          code >= 65 && code <= 90 || // `a-z`
          code >= 97 && code <= 122 || // `_`
          code === 95
        ) {
          name += str[j++];
          continue;
        }
        break;
      }
      if (!name)
        throw new TypeError("Missing parameter name at ".concat(i));
      tokens.push({ type: "NAME", index: i, value: name });
      i = j;
      continue;
    }
    if (char === "(") {
      var count = 1;
      var pattern = "";
      var j = i + 1;
      if (str[j] === "?") {
        throw new TypeError('Pattern cannot start with "?" at '.concat(j));
      }
      while (j < str.length) {
        if (str[j] === "\\") {
          pattern += str[j++] + str[j++];
          continue;
        }
        if (str[j] === ")") {
          count--;
          if (count === 0) {
            j++;
            break;
          }
        } else if (str[j] === "(") {
          count++;
          if (str[j + 1] !== "?") {
            throw new TypeError("Capturing groups are not allowed at ".concat(j));
          }
        }
        pattern += str[j++];
      }
      if (count)
        throw new TypeError("Unbalanced pattern at ".concat(i));
      if (!pattern)
        throw new TypeError("Missing pattern at ".concat(i));
      tokens.push({ type: "PATTERN", index: i, value: pattern });
      i = j;
      continue;
    }
    tokens.push({ type: "CHAR", index: i, value: str[i++] });
  }
  tokens.push({ type: "END", index: i, value: "" });
  return tokens;
}
__name(lexer, "lexer");
function parse(str, options) {
  if (options === void 0) {
    options = {};
  }
  var tokens = lexer(str);
  var _a = options.prefixes, prefixes = _a === void 0 ? "./" : _a, _b = options.delimiter, delimiter = _b === void 0 ? "/#?" : _b;
  var result = [];
  var key = 0;
  var i = 0;
  var path = "";
  var tryConsume = /* @__PURE__ */ __name(function(type) {
    if (i < tokens.length && tokens[i].type === type)
      return tokens[i++].value;
  }, "tryConsume");
  var mustConsume = /* @__PURE__ */ __name(function(type) {
    var value2 = tryConsume(type);
    if (value2 !== void 0)
      return value2;
    var _a2 = tokens[i], nextType = _a2.type, index = _a2.index;
    throw new TypeError("Unexpected ".concat(nextType, " at ").concat(index, ", expected ").concat(type));
  }, "mustConsume");
  var consumeText = /* @__PURE__ */ __name(function() {
    var result2 = "";
    var value2;
    while (value2 = tryConsume("CHAR") || tryConsume("ESCAPED_CHAR")) {
      result2 += value2;
    }
    return result2;
  }, "consumeText");
  var isSafe = /* @__PURE__ */ __name(function(value2) {
    for (var _i = 0, delimiter_1 = delimiter; _i < delimiter_1.length; _i++) {
      var char2 = delimiter_1[_i];
      if (value2.indexOf(char2) > -1)
        return true;
    }
    return false;
  }, "isSafe");
  var safePattern = /* @__PURE__ */ __name(function(prefix2) {
    var prev = result[result.length - 1];
    var prevText = prefix2 || (prev && typeof prev === "string" ? prev : "");
    if (prev && !prevText) {
      throw new TypeError('Must have text between two parameters, missing text after "'.concat(prev.name, '"'));
    }
    if (!prevText || isSafe(prevText))
      return "[^".concat(escapeString(delimiter), "]+?");
    return "(?:(?!".concat(escapeString(prevText), ")[^").concat(escapeString(delimiter), "])+?");
  }, "safePattern");
  while (i < tokens.length) {
    var char = tryConsume("CHAR");
    var name = tryConsume("NAME");
    var pattern = tryConsume("PATTERN");
    if (name || pattern) {
      var prefix = char || "";
      if (prefixes.indexOf(prefix) === -1) {
        path += prefix;
        prefix = "";
      }
      if (path) {
        result.push(path);
        path = "";
      }
      result.push({
        name: name || key++,
        prefix,
        suffix: "",
        pattern: pattern || safePattern(prefix),
        modifier: tryConsume("MODIFIER") || ""
      });
      continue;
    }
    var value = char || tryConsume("ESCAPED_CHAR");
    if (value) {
      path += value;
      continue;
    }
    if (path) {
      result.push(path);
      path = "";
    }
    var open = tryConsume("OPEN");
    if (open) {
      var prefix = consumeText();
      var name_1 = tryConsume("NAME") || "";
      var pattern_1 = tryConsume("PATTERN") || "";
      var suffix = consumeText();
      mustConsume("CLOSE");
      result.push({
        name: name_1 || (pattern_1 ? key++ : ""),
        pattern: name_1 && !pattern_1 ? safePattern(prefix) : pattern_1,
        prefix,
        suffix,
        modifier: tryConsume("MODIFIER") || ""
      });
      continue;
    }
    mustConsume("END");
  }
  return result;
}
__name(parse, "parse");
function match(str, options) {
  var keys = [];
  var re = pathToRegexp(str, keys, options);
  return regexpToFunction(re, keys, options);
}
__name(match, "match");
function regexpToFunction(re, keys, options) {
  if (options === void 0) {
    options = {};
  }
  var _a = options.decode, decode2 = _a === void 0 ? function(x) {
    return x;
  } : _a;
  return function(pathname) {
    var m = re.exec(pathname);
    if (!m)
      return false;
    var path = m[0], index = m.index;
    var params = /* @__PURE__ */ Object.create(null);
    var _loop_1 = /* @__PURE__ */ __name(function(i2) {
      if (m[i2] === void 0)
        return "continue";
      var key = keys[i2 - 1];
      if (key.modifier === "*" || key.modifier === "+") {
        params[key.name] = m[i2].split(key.prefix + key.suffix).map(function(value) {
          return decode2(value, key);
        });
      } else {
        params[key.name] = decode2(m[i2], key);
      }
    }, "_loop_1");
    for (var i = 1; i < m.length; i++) {
      _loop_1(i);
    }
    return { path, index, params };
  };
}
__name(regexpToFunction, "regexpToFunction");
function escapeString(str) {
  return str.replace(/([.+*?=^!:${}()[\]|/\\])/g, "\\$1");
}
__name(escapeString, "escapeString");
function flags(options) {
  return options && options.sensitive ? "" : "i";
}
__name(flags, "flags");
function regexpToRegexp(path, keys) {
  if (!keys)
    return path;
  var groupsRegex = /\((?:\?<(.*?)>)?(?!\?)/g;
  var index = 0;
  var execResult = groupsRegex.exec(path.source);
  while (execResult) {
    keys.push({
      // Use parenthesized substring match if available, index otherwise
      name: execResult[1] || index++,
      prefix: "",
      suffix: "",
      modifier: "",
      pattern: ""
    });
    execResult = groupsRegex.exec(path.source);
  }
  return path;
}
__name(regexpToRegexp, "regexpToRegexp");
function arrayToRegexp(paths, keys, options) {
  var parts = paths.map(function(path) {
    return pathToRegexp(path, keys, options).source;
  });
  return new RegExp("(?:".concat(parts.join("|"), ")"), flags(options));
}
__name(arrayToRegexp, "arrayToRegexp");
function stringToRegexp(path, keys, options) {
  return tokensToRegexp(parse(path, options), keys, options);
}
__name(stringToRegexp, "stringToRegexp");
function tokensToRegexp(tokens, keys, options) {
  if (options === void 0) {
    options = {};
  }
  var _a = options.strict, strict = _a === void 0 ? false : _a, _b = options.start, start = _b === void 0 ? true : _b, _c = options.end, end = _c === void 0 ? true : _c, _d = options.encode, encode3 = _d === void 0 ? function(x) {
    return x;
  } : _d, _e = options.delimiter, delimiter = _e === void 0 ? "/#?" : _e, _f = options.endsWith, endsWith = _f === void 0 ? "" : _f;
  var endsWithRe = "[".concat(escapeString(endsWith), "]|$");
  var delimiterRe = "[".concat(escapeString(delimiter), "]");
  var route = start ? "^" : "";
  for (var _i = 0, tokens_1 = tokens; _i < tokens_1.length; _i++) {
    var token = tokens_1[_i];
    if (typeof token === "string") {
      route += escapeString(encode3(token));
    } else {
      var prefix = escapeString(encode3(token.prefix));
      var suffix = escapeString(encode3(token.suffix));
      if (token.pattern) {
        if (keys)
          keys.push(token);
        if (prefix || suffix) {
          if (token.modifier === "+" || token.modifier === "*") {
            var mod = token.modifier === "*" ? "?" : "";
            route += "(?:".concat(prefix, "((?:").concat(token.pattern, ")(?:").concat(suffix).concat(prefix, "(?:").concat(token.pattern, "))*)").concat(suffix, ")").concat(mod);
          } else {
            route += "(?:".concat(prefix, "(").concat(token.pattern, ")").concat(suffix, ")").concat(token.modifier);
          }
        } else {
          if (token.modifier === "+" || token.modifier === "*") {
            throw new TypeError('Can not repeat "'.concat(token.name, '" without a prefix and suffix'));
          }
          route += "(".concat(token.pattern, ")").concat(token.modifier);
        }
      } else {
        route += "(?:".concat(prefix).concat(suffix, ")").concat(token.modifier);
      }
    }
  }
  if (end) {
    if (!strict)
      route += "".concat(delimiterRe, "?");
    route += !options.endsWith ? "$" : "(?=".concat(endsWithRe, ")");
  } else {
    var endToken = tokens[tokens.length - 1];
    var isEndDelimited = typeof endToken === "string" ? delimiterRe.indexOf(endToken[endToken.length - 1]) > -1 : endToken === void 0;
    if (!strict) {
      route += "(?:".concat(delimiterRe, "(?=").concat(endsWithRe, "))?");
    }
    if (!isEndDelimited) {
      route += "(?=".concat(delimiterRe, "|").concat(endsWithRe, ")");
    }
  }
  return new RegExp(route, flags(options));
}
__name(tokensToRegexp, "tokensToRegexp");
function pathToRegexp(path, keys, options) {
  if (path instanceof RegExp)
    return regexpToRegexp(path, keys);
  if (Array.isArray(path))
    return arrayToRegexp(path, keys, options);
  return stringToRegexp(path, keys, options);
}
__name(pathToRegexp, "pathToRegexp");

// ../../../.npm/_npx/32026684e21afda6/node_modules/wrangler/templates/pages-template-worker.ts
var escapeRegex = /[.+?^${}()|[\]\\]/g;
function* executeRequest(request) {
  const requestPath = new URL(request.url).pathname;
  for (const route of [...routes].reverse()) {
    if (route.method && route.method !== request.method) {
      continue;
    }
    const routeMatcher = match(route.routePath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const mountMatcher = match(route.mountPath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const matchResult = routeMatcher(requestPath);
    const mountMatchResult = mountMatcher(requestPath);
    if (matchResult && mountMatchResult) {
      for (const handler of route.middlewares.flat()) {
        yield {
          handler,
          params: matchResult.params,
          path: mountMatchResult.path
        };
      }
    }
  }
  for (const route of routes) {
    if (route.method && route.method !== request.method) {
      continue;
    }
    const routeMatcher = match(route.routePath.replace(escapeRegex, "\\$&"), {
      end: true
    });
    const mountMatcher = match(route.mountPath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const matchResult = routeMatcher(requestPath);
    const mountMatchResult = mountMatcher(requestPath);
    if (matchResult && mountMatchResult && route.modules.length) {
      for (const handler of route.modules.flat()) {
        yield {
          handler,
          params: matchResult.params,
          path: matchResult.path
        };
      }
      break;
    }
  }
}
__name(executeRequest, "executeRequest");
var pages_template_worker_default = {
  async fetch(originalRequest, env, workerContext) {
    let request = originalRequest;
    const handlerIterator = executeRequest(request);
    let data = {};
    let isFailOpen = false;
    const next = /* @__PURE__ */ __name(async (input, init) => {
      if (input !== void 0) {
        let url = input;
        if (typeof input === "string") {
          url = new URL(input, request.url).toString();
        }
        request = new Request(url, init);
      }
      const result = handlerIterator.next();
      if (result.done === false) {
        const { handler, params, path } = result.value;
        const context = {
          request: new Request(request.clone()),
          functionPath: path,
          next,
          params,
          get data() {
            return data;
          },
          set data(value) {
            if (typeof value !== "object" || value === null) {
              throw new Error("context.data must be an object");
            }
            data = value;
          },
          env,
          waitUntil: workerContext.waitUntil.bind(workerContext),
          passThroughOnException: /* @__PURE__ */ __name(() => {
            isFailOpen = true;
          }, "passThroughOnException")
        };
        const response = await handler(context);
        if (!(response instanceof Response)) {
          throw new Error("Your Pages function should return a Response");
        }
        return cloneResponse(response);
      } else if ("ASSETS") {
        const response = await env["ASSETS"].fetch(request);
        return cloneResponse(response);
      } else {
        const response = await fetch(request);
        return cloneResponse(response);
      }
    }, "next");
    try {
      return await next();
    } catch (error) {
      if (isFailOpen) {
        const response = await env["ASSETS"].fetch(request);
        return cloneResponse(response);
      }
      throw error;
    }
  }
};
var cloneResponse = /* @__PURE__ */ __name((response) => (
  // https://fetch.spec.whatwg.org/#null-body-status
  new Response(
    [101, 204, 205, 304].includes(response.status) ? null : response.body,
    response
  )
), "cloneResponse");
export {
  pages_template_worker_default as default
};
