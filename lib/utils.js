import { clsx } from "clsx";
import { twMerge } from "tailwind-merge"

/**
 * Get fully qualified base URL for the site. Never returns relative paths.
 * Used for OG images, canonical URLs, etc. so they load correctly on Vercel.
 */
export function getBaseUrl() {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (siteUrl && (siteUrl.startsWith('http://') || siteUrl.startsWith('https://'))) {
    return siteUrl.replace(/\/$/, ''); // trim trailing slash
  }
  if (process.env.NEXT_PUBLIC_VERCEL_URL) {
    return `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`;
  }
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }
  return 'https://activistchecklist.org';
}

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

/**
 * Format a date string to show relative dates for recent entries (within 7 days)
 * and fixed dates for older entries
 * @param {string} dateString - ISO date string
 * @returns {string} Formatted date string
 */
export function formatRelativeDate(dateString) {
  if (!dateString) return '';
  
  const date = new Date(dateString);
  const now = new Date();
  const diffInMs = now - date;
  const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));
  
  // If within the last 7 days, show relative date
  if (diffInDays >= 0 && diffInDays <= 7) {
    if (diffInDays === 0) return 'Today';
    if (diffInDays === 1) return 'Yesterday';
    return `${diffInDays} days ago`;
  }
  
  // Check if it's within the last year
  const oneYearAgo = new Date(now);
  oneYearAgo.setFullYear(now.getFullYear() - 1);
  
  if (date >= oneYearAgo) {
    // Within the last year: "Sep 25"
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    });
  } else {
    // More than a year ago: "Sep 25, 2025"
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  }
}



