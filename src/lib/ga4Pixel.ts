import { GA4Settings } from '../types';
import { queueBrowserEvent, queueGA4ServerEvent } from './eventBatcher';

declare global {
  interface Window {
    dataLayer: any[];
    gtag: (...args: any[]) => void;
  }
}

let gtagInitialized = false;

export const initGA4 = (settings: GA4Settings) => {
  if (typeof window === 'undefined') return;
  if (!settings.enabled || !settings.measurementId) return;

  if (!gtagInitialized) {
    const script = document.createElement('script');
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${settings.measurementId}`;
    document.head.appendChild(script);

    window.dataLayer = window.dataLayer || [];
    window.gtag = function() {
      // Do nothing, eventBatcher handles firing
      // Oh wait, we still need gtag to be initialized to accept arguments from flushEvents
      window.dataLayer.push(arguments);
    };
    
    window.gtag('js', new Date());
    window.gtag('config', settings.measurementId, {
      send_page_view: false // we track pageview manually to avoid duplicates on SPA
    });

    gtagInitialized = true;
  }
};

const getClientId = async (measurementId: string): Promise<string> => {
  if (typeof window !== 'undefined' && window.gtag) {
    return new Promise((resolve) => {
      window.gtag('get', measurementId, 'client_id', (clientId: string) => {
        resolve(clientId || getFallbackClientId());
      });
    });
  }
  return getFallbackClientId();
};

const getFallbackClientId = () => {
  let cid = localStorage.getItem('_ga_fallback_cid');
  if (!cid) {
    cid = crypto.randomUUID();
    localStorage.setItem('_ga_fallback_cid', cid);
  }
  return cid;
};

const getSessionId = () => {
  // Try to find GA session ID from cookies if possible, or fallback
  const match = document.cookie.match(/_ga_[A-Z0-9]+=(.*?)(;|$)/);
  if (match && match[1]) {
    const parts = match[1].split('.');
    if (parts.length > 2) {
      return parts[2];
    }
  }
  return undefined;
};

// Queue or fire browser event
export const trackGA4BrowserEvent = (eventName: string, eventParams: any, settings: GA4Settings) => {
  if (!settings.enabled || !settings.measurementId || typeof window === 'undefined' || !window.gtag) return;
  queueBrowserEvent('ga4', eventName, eventParams);
};

// Fire Server-Side Measurement Protocol
export const trackGA4ServerEvent = async (eventName: string, eventParams: any, settings: GA4Settings, userInfo?: any) => {
  if (!settings.enabled || !settings.measurementId) return;

  const clientId = await getClientId(settings.measurementId);
  const sessionId = getSessionId();

  const payload: any = {
    name: eventName,
    params: {
      ...eventParams,
      session_id: sessionId,
    }
  };

  queueGA4ServerEvent(clientId, payload, userInfo);
};

// Unified Event Tracker
export const trackGA4Event = (eventName: string, browserParams: any, serverParams: any | null, settings: GA4Settings, userInfo?: any) => {
  if (!settings.enabled) return;

  // Track on browser
  trackGA4BrowserEvent(eventName, browserParams, settings);

  // If serverParams are defined, track via Measurement Protocol (e.g. for Purchase)
  if (serverParams) {
    trackGA4ServerEvent(eventName, serverParams, settings, userInfo);
  }
};
