import { TikTokPixelSettings } from "../types";

declare global {
  interface Window {
    ttq: any;
    TiktokAnalyticsObject: any;
  }
}

// Generate a unique event ID for deduplication
const generateEventId = () => {
  return "evt_" + Date.now() + "_" + Math.random().toString(36).substr(2, 9);
};

// Helper to get cookie value
const getCookie = (name: string) => {
  if (typeof document === "undefined") return undefined;
  const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
  if (match) return match[2];
  return undefined;
};

// Helper to get URL parameter
const getUrlParam = (name: string) => {
  if (typeof window === "undefined") return undefined;
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get(name);
};

export const initTikTokPixel = (settings: TikTokPixelSettings) => {
  if (!settings.enabled || !settings.pixelId) return;

  if (typeof window !== "undefined" && !window.ttq) {
    (function (w: any, d: any, t: any) {
      w.TiktokAnalyticsObject = t;
      var ttq = (w[t] = w[t] || []);
      ((ttq.methods = [
        "page",
        "track",
        "identify",
        "instances",
        "debug",
        "on",
        "off",
        "once",
        "ready",
        "alias",
        "group",
        "enableCookie",
        "disableCookie",
      ]),
        (ttq.setAndDefer = function (t: any, e: any) {
          t[e] = function () {
            t.push([e].concat(Array.prototype.slice.call(arguments, 0)));
          };
        }));
      for (var i = 0; i < ttq.methods.length; i++)
        ttq.setAndDefer(ttq, ttq.methods[i]);
      ((ttq.instance = function (t: any) {
        for (var e = ttq._i[t] || [], n = 0; n < ttq.methods.length; n++)
          ttq.setAndDefer(e, ttq.methods[n]);
        return e;
      }),
        (ttq.load = function (e: any, n: any) {
          var i = "https://analytics.tiktok.com/i18n/pixel/events.js";
          ((ttq._i = ttq._i || {}),
            (ttq._i[e] = []),
            (ttq._i[e]._u = i),
            (ttq._t = ttq._t || {}),
            (ttq._t[e] = +new Date()),
            (ttq._o = ttq._o || {}),
            (ttq._o[e] = n || {}));
          var o = d.createElement("script");
          ((o.type = "text/javascript"),
            (o.async = !0),
            (o.src = i + "?sdkid=" + e + "&lib=" + t));
          var a = d.getElementsByTagName("script")[0];
          if (a?.parentNode) {
            a.parentNode.insertBefore(o, a);
          } else {
            d.head.appendChild(o);
          }
        }));
    })(window, document, "ttq");

    // Enable first-party cookies for advanced matching
    window.ttq.enableCookie();
    window.ttq.load(settings.pixelId);

    // Store ttclid if present in URL
    const ttclid = getUrlParam("ttclid");
    if (ttclid && typeof document !== "undefined") {
      document.cookie = `ttclid=${ttclid}; path=/; max-age=2592000`; // 30 days
    }
  }
};

// Basic SHA-256 hash function for user data
async function hashData(data: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(data.toLowerCase().trim());
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

import { queueBrowserEvent, queueTikTokServerEvent } from './eventBatcher';

export const trackTikTokEvent = async (
  eventName: string,
  eventData: any,
  settings: TikTokPixelSettings,
  userData: any = {},
  providedEventId?: string,
) => {
  if (!settings.enabled || !settings.pixelId) return;

  const eventId = providedEventId || generateEventId();
  const normalizedEventName = eventName.toLowerCase() === 'pageview' ? 'Pageview' : eventName;

  // 1. Browser-side tracking (Pixel)
  if (typeof window !== "undefined" && window.ttq) {
    const userToIdentify: any = {};
    if (userData.em) userToIdentify.email = userData.em; // TikTok pixel handles hashing automatically
    if (userData.ph) userToIdentify.phone_number = userData.ph;
    if (userData.external_id) userToIdentify.external_id = userData.external_id;

    if (Object.keys(userToIdentify).length > 0) {
      window.ttq.identify(userToIdentify);
    }
    
    if (normalizedEventName === 'Pageview' || normalizedEventName === 'PageView') {
      queueBrowserEvent('tiktok', 'Pageview', {}, eventId);
    } else {
      queueBrowserEvent('tiktok', normalizedEventName, eventData, eventId);
    }
  }

  // 2. Server-side tracking (Events API)
  if (settings.enabled && settings.pixelId) {
    try {
      const hashedUserData: any = {};

      const ttp = getCookie("_ttp");
      if (ttp) hashedUserData.ttp = ttp;

      const ttclid = getCookie("ttclid") || getUrlParam("ttclid");
      if (ttclid) hashedUserData.ttclid = ttclid;

      if (userData.ph) {
        hashedUserData.ph = await hashData(userData.ph);
      }
      if (userData.em) {
        hashedUserData.em = await hashData(userData.em);
      }
      if (userData.external_id) {
        hashedUserData.external_id = await hashData(userData.external_id.toString());
      }

      const payload = {
        eventName: normalizedEventName,
        eventData,
        userData: hashedUserData,
        eventId,
        url: window.location.href,
        referrer: document.referrer,
        userAgent: navigator.userAgent,
      };

      queueTikTokServerEvent(payload);
    } catch (error) {
      console.error("TikTok Events API Exception:", error);
    }
  }
};
