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
    const pixelSettings = settings.tiktokPixel;

    if (
      !pixelSettings ||
      !pixelSettings.enabled ||
      !pixelSettings.pixelId ||
      !pixelSettings.accessToken
    ) {
      return new Response(
        JSON.stringify({
          success: false,
          reason: "TikTok pixel server tracking not configured",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }

    const currentTimestamp = Math.floor(Date.now() / 1000);
    
    // Support both batched { events: [...] } and single event mapping { eventName, eventData... }
    const inputEvents = data.events && Array.isArray(data.events) 
      ? data.events 
      : [data];

    const tiktokDataArray = inputEvents.map((ev: any) => {
      const {
        eventName,
        eventData,
        userData = {},
        eventId,
        url,
        referrer,
        userAgent,
      } = ev;

      const userPayload: any = {};
      if (userData.ttp) userPayload.ttp = userData.ttp;
      if (userData.ttclid) userPayload.ttclid = userData.ttclid;
      if (userData.ph) userPayload.phone_number = userData.ph;
      if (userData.em) userPayload.email = userData.em;
      if (userData.external_id) userPayload.external_id = userData.external_id;

      const userAgentToUse =
        userAgent || request.headers.get("user-agent") || "Unknown";

      // Get client IP
      const clientIp =
        request.headers.get("cf-connecting-ip") ||
        request.headers.get("x-real-ip") ||
        request.headers.get("x-forwarded-for") ||
        "127.0.0.1";

      return {
        event: eventName,
        event_id: eventId,
        event_time: currentTimestamp,
        user: userPayload,
        context: {
          page: {
            url: url,
            referrer: referrer || "",
          },
          user_agent: userAgentToUse,
          ip: clientIp,
        },
        properties: eventData || {},
      };
    });

    const payload: any = {
      pixel_code: pixelSettings.pixelId,
      data: tiktokDataArray,
    };

    if (pixelSettings.testCode) {
      payload.test_event_code = pixelSettings.testCode;
    }

    // Send to Events API
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    let response;
    try {
      response = await fetch(
        `https://business-api.tiktok.com/open_api/v1.3/pixel/track/`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Access-Token": pixelSettings.accessToken,
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
