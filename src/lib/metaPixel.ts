import { MetaPixelSettings } from '../types';

declare global {
  interface Window {
    fbq: any;
    _fbq: any;
  }
}

// Generate a unique event ID for deduplication
const generateEventId = () => {
  return 'evt_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
};

// Helper to get cookie value
const getCookie = (name: string) => {
  if (typeof document === 'undefined') return undefined;
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop()?.split(';').shift();
  return undefined;
};

// Helper to get URL parameter
const getUrlParam = (name: string) => {
  if (typeof window === 'undefined') return undefined;
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get(name);
};

export const initMetaPixel = (settings: MetaPixelSettings, advancedMatching?: any) => {
  if (!settings.enabled || !settings.pixelId) return;

  if (typeof window !== 'undefined') {
    if (!window.fbq) {
      (function(f: any, b: any, e: any, v: any, n?: any, t?: any, s?: any) {
        if(f.fbq)return;n=f.fbq=function(){n.callMethod?
        n.callMethod.apply(n,arguments):n.queue.push(arguments)};
        if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
        n.queue=[];t=b.createElement(e);t.async=!0;
        t.src=v;s=b.getElementsByTagName(e)[0];
        s.parentNode.insertBefore(t,s)})(window, document,'script',
        'https://connect.facebook.net/en_US/fbevents.js');
    }
      
    window.fbq('set', 'autoConfig', false, settings.pixelId);
    
    if (advancedMatching && Object.keys(advancedMatching).length > 0) {
      window.fbq('init', settings.pixelId, advancedMatching, { disablePushState: true });
    } else {
      window.fbq('init', settings.pixelId, {}, { disablePushState: true });
    }
  }
};

// Basic SHA-256 hash function for user data (Meta requires hashed data)
async function hashData(data: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(data.toLowerCase().trim());
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

import { queueBrowserEvent, queueMetaServerEvent } from './eventBatcher';

export const trackMetaEvent = async (
  eventName: string, 
  eventData: any, 
  settings: MetaPixelSettings,
  userData: any = {},
  providedEventId?: string
) => {
  if (!settings.enabled || !settings.pixelId) return;

  const eventId = providedEventId || generateEventId();

  // Automatically extract saved user data if available
  if (typeof localStorage !== 'undefined') {
    try {
      if (!userData.fn && !userData.ln) {
        const savedName = localStorage.getItem('checkout_name');
        if (savedName) {
          const nameParts = savedName.trim().split(' ');
          if (nameParts.length > 0) userData.fn = nameParts[0];
          if (nameParts.length > 1) userData.ln = nameParts.slice(1).join(' ');
        }
      }
      if (!userData.ph) {
        const savedPhone = localStorage.getItem('checkout_phone');
        if (savedPhone) userData.ph = savedPhone;
      }
    } catch (e) {
      // ignore
    }
  }

  // Get or create External ID
  let externalId = getCookie('_fbd_external_id');
  if (!externalId && typeof localStorage !== 'undefined') {
    externalId = localStorage.getItem('_fbd_external_id') || undefined;
  }
  if (!externalId) {
    externalId = 'ext_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    if (typeof document !== 'undefined') {
      document.cookie = `_fbd_external_id=${externalId}; max-age=31536000; path=/`;
    }
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('_fbd_external_id', externalId);
    }
  }

  // Generate advanced matching for browser
  const advancedMatching: any = { external_id: externalId, country: 'bd' };
  if (userData.em) advancedMatching.em = userData.em.toLowerCase().trim();
  if (userData.ph) advancedMatching.ph = userData.ph.replace(/\D/g, ''); // Remove non-numeric
  if (userData.fn) advancedMatching.fn = userData.fn.toLowerCase().trim();
  if (userData.ln) advancedMatching.ln = userData.ln.toLowerCase().trim();

  // 1. Browser-side tracking (Pixel)
  if (typeof window !== 'undefined') {
    initMetaPixel(settings, advancedMatching);
    if (window.fbq) {
      queueBrowserEvent('meta', eventName, eventData, eventId, settings.pixelId, advancedMatching);
    }
  }

  // 2. Server-side tracking (Conversions API)
  if (settings.enabled && settings.pixelId) {
    try {
      const currentTimestamp = Math.floor(Date.now() / 1000);
      
      const hashedUserData: any = {
        client_user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
      };

      // Try to get fbp and fbc cookies
      let fbp = getCookie('_fbp');
      if (!fbp && typeof document !== 'undefined') {
        const generatedFbp = `fb.1.${Date.now()}.${Math.round(Math.random() * 10000000000)}`;
        document.cookie = `_fbp=${generatedFbp}; max-age=${3*30*24*60*60}; path=/`;
        fbp = generatedFbp;
      }
      if (fbp) hashedUserData.fbp = fbp;
      
      let fbc = getCookie('_fbc');
      if (!fbc && typeof window !== 'undefined') {
        const fbclid = getUrlParam('fbclid');
        if (fbclid) {
          fbc = `fb.1.${Date.now()}.${fbclid}`;
        }
      }
      if (fbc) hashedUserData.fbc = fbc;

      // Hash User Data for CAPI
      if (userData.ph) hashedUserData.ph = await hashData(userData.ph.replace(/\D/g, ''));
      if (userData.em) hashedUserData.em = await hashData(userData.em);
      if (userData.fn) hashedUserData.fn = await hashData(userData.fn);
      if (userData.ln) hashedUserData.ln = await hashData(userData.ln);
      
      hashedUserData.external_id = await hashData(externalId);
      hashedUserData.country = await hashData(userData.country || 'bd');

      const eventPayload = {
        event_name: eventName,
        event_time: currentTimestamp,
        action_source: 'website',
        event_source_url: typeof window !== 'undefined' ? window.location.href : '',
        event_id: eventId,
        user_data: hashedUserData,
        custom_data: eventData,
      };

      queueMetaServerEvent(eventPayload);
    } catch (error) {
      console.error('Meta CAPI Request Failed:', error);
    }
  }
};
