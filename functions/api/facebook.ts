export async function onRequestPost({ request, env }: any) {
  try {
    const data = await request.json();
    
    // Get settings from DB
    const settingsRow = await env.DB.prepare(
      "SELECT value FROM settings WHERE key = ?",
    )
      .bind("marketingSettings")
      .first();
    if (!settingsRow)
      return new Response(
        JSON.stringify({ success: false, reason: "No marketing settings" }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );

    const settings = JSON.parse(settingsRow.value);
    const pixelSettings = settings.metaPixel;

    if (
      !pixelSettings ||
      !pixelSettings.enabled ||
      !pixelSettings.pixelId ||
      !pixelSettings.accessToken
    ) {
      return new Response(
        JSON.stringify({
          success: false,
          reason: "Meta pixel server tracking not configured",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }

    // Support both batched { events: [...] } and single event mapping { eventName, eventData... }
    const inputEvents = data.events && Array.isArray(data.events) 
      ? data.events 
      : [data];

    // Get client IP
    const clientIp =
      request.headers.get("cf-connecting-ip") ||
      request.headers.get("x-real-ip") ||
      request.headers.get("x-forwarded-for") ||
      "127.0.0.1";

    const fbDataArray = inputEvents.map((ev: any) => {
      const user_data = {
        ...ev.user_data,
        client_ip_address: clientIp,
      };
      
      return {
        ...ev,
        user_data
      };
    });

    const payload: any = {
      data: fbDataArray,
    };

    if (pixelSettings.testCode) {
      payload.test_event_code = pixelSettings.testCode;
    }

    const url = `https://graph.facebook.com/v19.0/${pixelSettings.pixelId}/events?access_token=${pixelSettings.accessToken}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    let response;
    try {
      response = await fetch(
        url,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
          signal: controller.signal
        },
      );
    } finally {
      clearTimeout(timeoutId);
    }

    const responseData = await response.json();
    return new Response(JSON.stringify(responseData), {
      status: response.status,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
