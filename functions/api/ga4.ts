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
    const pixelSettings = settings.ga4;

    if (
      !pixelSettings ||
      !pixelSettings.enabled ||
      !pixelSettings.measurementId ||
      !pixelSettings.apiSecret
    ) {
      return new Response(
        JSON.stringify({
          success: false,
          reason: "GA4 server tracking not configured",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }

    const payload: any = {
      client_id: data.client_id,
      events: data.events,
    };
    
    if (data.user_data) {
      payload.user_data = data.user_data;
    }

    const url = `https://www.google-analytics.com/mp/collect?measurement_id=${pixelSettings.measurementId}&api_secret=${pixelSettings.apiSecret}`;
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

    let responseData = {};
    try {
      responseData = await response.json();
    } catch(e) {
      // empty response from GA4 sometimes
      responseData = { success: true };
    }

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
