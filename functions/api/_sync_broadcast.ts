import { getOriginBase } from './_domain';

/**
 * Broadcasts stock changes to all registered retail websites.
 * Used when orders are placed, edited, or cancelled on the Master website,
 * or when stock deductions occur.
 */
export async function broadcastStockToRetails(
  env: any,
  request: Request,
  changedProducts: any[],
  context?: any
) {
  if (!changedProducts || !Array.isArray(changedProducts) || changedProducts.length === 0) {
    return;
  }

  const broadcastTask = async () => {
    try {
      const [settingsRes, storeSettingsRes] = await Promise.all([
        env.DB.prepare("SELECT value FROM settings WHERE key = 'registered_retails'").first(),
        env.DB.prepare("SELECT value FROM settings WHERE key = 'websiteSettings'").first()
      ]);

      if (!settingsRes || !settingsRes.value) return;

      let retails: string[] = [];
      try {
        retails = JSON.parse(settingsRes.value as string);
      } catch (e) {
        return;
      }

      if (!Array.isArray(retails) || retails.length === 0) return;

      let storeSettings: any = {};
      try {
        if (storeSettingsRes && storeSettingsRes.value) {
          storeSettings = JSON.parse(storeSettingsRes.value as string);
        }
      } catch (e) {}

      // If store is explicitly configured as not master or disabled, skip
      if (storeSettings?.apiSync?.enabled === false || storeSettings?.apiSync?.isMaster === false) {
        return;
      }

      const masterApiKey = storeSettings?.apiSync?.masterApiKey || '';
      const url = new URL(request.url);
      const originBase = getOriginBase(env, url.origin);

      const broadcastProducts = changedProducts.map(p => {
        const pCopy = { ...p };
        if (pCopy.image && pCopy.image.startsWith('/')) pCopy.image = originBase + pCopy.image;
        if (pCopy.images) pCopy.images = pCopy.images.map((img: string) => img.startsWith('/') ? originBase + img : img);
        return pCopy;
      });

      const broadcastData = JSON.stringify({ products: broadcastProducts, isStockOnly: true });

      await Promise.allSettled(retails.map(async (retailUrl: string) => {
        if (!retailUrl || typeof retailUrl !== 'string') return;
        const cleanUrl = retailUrl.trim().replace(/\/$/, '');
        if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) return;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 6000);
        try {
          await fetch(`${cleanUrl}/api/sync_apply`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${masterApiKey}`
            },
            body: broadcastData,
            signal: controller.signal
          });
        } catch (err) {
          // Ignore individual retail network failures
        } finally {
          clearTimeout(timeoutId);
        }
      }));
    } catch (e) {
      console.error('Error broadcasting stock update to retails:', e);
    }
  };

  if (context && typeof context.waitUntil === 'function') {
    context.waitUntil(broadcastTask());
  } else {
    await broadcastTask();
  }
}

/**
 * Notifies the Master store to deduct stock when a connected retail store
 * places an order, adds items to an order, or adjusts quantities.
 */
export async function notifyMasterOfStockDeduction(
  env: any,
  request: Request,
  itemsToDeduct: any[],
  context?: any
) {
  if (!itemsToDeduct || !Array.isArray(itemsToDeduct) || itemsToDeduct.length === 0) {
    return;
  }

  const syncTask = async () => {
    try {
      const storeSettingsRes = await env.DB.prepare("SELECT value FROM settings WHERE key = 'websiteSettings'").first();
      if (!storeSettingsRes || !storeSettingsRes.value) return;

      let storeSettings: any = {};
      try {
        storeSettings = JSON.parse(storeSettingsRes.value as string);
      } catch (e) {
        return;
      }

      if (
        !storeSettings?.apiSync?.enabled ||
        storeSettings?.apiSync?.isMaster ||
        !storeSettings?.apiSync?.connectedMasterUrl ||
        !storeSettings?.apiSync?.connectedMasterApiKey
      ) {
        return;
      }

      const masterUrl = storeSettings.apiSync.connectedMasterUrl.trim().replace(/\/$/, '');
      const apiKey = storeSettings.apiSync.connectedMasterApiKey;
      const url = new URL(request.url);
      const retailOrigin = url.origin;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);

      try {
        await fetch(`${masterUrl}/api/sync_deduct_stock`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            itemsToDeduct,
            retailUrl: retailOrigin
          }),
          signal: controller.signal
        });
      } catch (err) {
        console.error('Error notifying master store of stock deduction:', err);
      } finally {
        clearTimeout(timeoutId);
      }
    } catch (e) {
      console.error('Error in notifyMasterOfStockDeduction:', e);
    }
  };

  if (context && typeof context.waitUntil === 'function') {
    context.waitUntil(syncTask());
  } else {
    await syncTask();
  }
}
