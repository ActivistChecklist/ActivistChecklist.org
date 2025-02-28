'use client';

import { useState, useEffect } from 'react';
import { X, Bell, AlertTriangle, InfoIcon } from 'lucide-react';
import Link from 'next/link';

// Predefined color schemes
export const colorSchemes = {
  primary: {
    background: 'bg-primary',
    text: 'text-primary-foreground',
    button: {
      background: 'bg-primary-foreground',
      text: 'text-primary',
    }
  },
};

// Specify which announcement is currently active
export const ACTIVE_ANNOUNCEMENT = null; //'softLaunch';

// Configure your announcements
export const announcements = {
  softLaunch: {
    icon: Bell,
    title: 'Early Access',
    message: 'We would love your feedback before we launch this site to the public!',
    buttonText: 'Share feedback',
    buttonUrl: '/contact',
    allowDismiss: false,
    colorScheme: 'primary',
  },
};

const STORAGE_PREFIX = 'announcement_dismissed_';

const AnnouncementBar = ({ announcementKey = ACTIVE_ANNOUNCEMENT }) => {
  const [isVisible, setIsVisible] = useState(true);
  const announcement = announcements[announcementKey];

  useEffect(() => {
    // Only hide if explicitly dismissed
    const isDismissed = localStorage.getItem(STORAGE_PREFIX + announcementKey);
    if (isDismissed) {
      setIsVisible(false);
    }
  }, [announcementKey]);

  const handleDismiss = () => {
    setIsVisible(false);
    localStorage.setItem(STORAGE_PREFIX + announcementKey, 'true');
  };

  if (!isVisible || !announcement || announcementKey !== ACTIVE_ANNOUNCEMENT) return null;

  const Icon = announcement.icon;
  const allowDismiss = announcement.allowDismiss ?? true;
  const theme = colorSchemes[announcement.colorScheme ?? 'primary'];

  return (
    <div className={`${theme.background} ${theme.text}`}>
      <div className="max-w-5xl mx-auto px-4 py-2 flex items-center justify-between">
        <div className="text-sm font-medium text-center flex-1 flex items-center justify-center gap-3">
          {Icon && <Icon size={18} className="flex-shrink-0" />}
          <span>
            {announcement.title && (
              <span className="font-bold mr-1">{announcement.title}:</span>
            )}
            {announcement.message}
          </span>
          {announcement.buttonText && announcement.buttonUrl && (
            <Link
              href={announcement.buttonUrl}
              className={`inline-flex items-center px-3 py-1 rounded-md ${theme.button.background} ${theme.button.text} hover:opacity-90 transition-opacity text-sm font-medium`}
            >
              {announcement.buttonText}
            </Link>
          )}
        </div>
        {allowDismiss && (
          <button
            onClick={handleDismiss}
            className="p-1 hover:opacity-80 transition-opacity ml-2"
            aria-label="Close announcement"
          >
            <X size={16} />
          </button>
        )}
      </div>
    </div>
  );
};

export default AnnouncementBar; 