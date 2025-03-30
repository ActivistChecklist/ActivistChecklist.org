import { debugLog } from '@/contexts/DebugContext';
import { isProd } from '@/utils/core';

// Need to not include a trailing slash in the endpoint (even though this cuases a redirect in development, it is what is needed in production)
export const sendAnalytics = async (data = {}, endpoint = '/api-server/counter') => {
  // This allows us to turn logging back on in dev (which is disabled by default)
  const DEBUG_MODE = process.env.NEXT_PUBLIC_DEBUG_COUNTER === 'true';
  if (!isProd && !DEBUG_MODE) {
    return;
  }

  const fullData = {
    // Always send these. (If there's nothing else, this will be a page view)
    url: window.location.pathname,
    referrer: document.referrer,
    hostname: window.location.hostname,
    title: document.title,
    userAgent: navigator.userAgent,
    screen: `${window.screen.width}x${window.screen.height}`,
    // Optionally allow additional data to be sent
    ...data
  };

  debugLog('fullData', fullData);

  return fetch(endpoint, {
    method: 'POST',
    credentials: 'same-origin',
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache'
    },
    body: JSON.stringify(fullData)
  }).catch(() => {
    // Silently fail - no need to log client-side
  });
};

export const initializeOnLoad = (callback) => {
  // Wait until the page is loaded before sending initial data
  if (document.readyState === 'complete') {
    callback();
  } else {
    window.addEventListener('load', callback);
    return () => window.removeEventListener('load', callback);
  }
}; 

export function useAnalytics() {
  const trackEvent = async ({ ...data }) => {
    await sendAnalytics(data);
  };

  return { trackEvent };
} 