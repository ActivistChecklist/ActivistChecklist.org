// Translated navigation configuration using react-i18next
import { useTranslation } from 'react-i18next';
import { useLanguage } from './useLanguage';
import { useMemo } from 'react';
import {
  IoShieldOutline,
  IoMegaphoneOutline,
  IoGlobeOutline,
  IoPhonePortraitOutline,
  IoArrowForward,
  IoPeopleOutline,
  IoChatbubbleOutline,
  IoAirplaneOutline,
  IoEyeOffOutline,
  IoNotificationsOutline,
} from "react-icons/io5"
import { Landmark } from "lucide-react"
import { ROUTES } from '@/config/routes'

// Hook to get translated navigation items
export function useTranslatedNavigation() {
  const { t } = useTranslation();
  const { currentLanguage } = useLanguage();

  const SITE_BRANDING = {
    title: t('site.title'),
    description: t('site.description')
  };

  const NAV_ITEMS = {
    HOME: {
      key: 'home',
      label: t('nav.home'),
      href: ROUTES.HOME,
      type: "link"
    },
    SECURITY_ESSENTIALS: {
      key: 'security-essentials',
      title: t('nav.security-essentials'),
      href: ROUTES.CHECKLISTS.ESSENTIALS,
      description: t('desc.security-essentials'),
      icon: IoShieldOutline
    },
    PROTEST_PREP: {
      key: 'protest-prep',
      title: t('nav.protest-prep'),
      href: ROUTES.CHECKLISTS.PROTEST,
      description: t('desc.protest-prep'),
      icon: IoPeopleOutline
    },
    TRAVEL: {
      key: 'travel',
      title: t('nav.travel'),
      href: ROUTES.CHECKLISTS.TRAVEL,
      description: t('desc.travel'),
      icon: IoAirplaneOutline
    },
    SIGNAL: {
      key: 'signal',
      title: t('nav.signal'),
      href: ROUTES.CHECKLISTS.SIGNAL,
      description: t('desc.signal'),
      icon: IoChatbubbleOutline
    },
    SECONDARY_PHONE: {
      key: 'secondary-phone',
      title: t('nav.secondary-phone'),
      href: ROUTES.CHECKLISTS.SECONDARY_PHONE,
      description: t('desc.secondary-phone'),
      icon: IoPhonePortraitOutline
    },
    EMERGENCY: {
      key: 'emergency',
      title: t('nav.emergency'),
      href: ROUTES.CHECKLISTS.EMERGENCY,
      description: t('desc.emergency'),
      icon: IoNotificationsOutline
    },
    SPYWARE: {
      key: 'spyware',
      title: t('nav.spyware'),
      href: ROUTES.CHECKLISTS.SPYWARE,
      description: t('desc.spyware'),
      icon: IoEyeOffOutline
    },
    ORGANIZER: {
      key: 'organizer',
      title: t('nav.organizer'),
      href: ROUTES.CHECKLISTS.ORGANIZER,
      description: t('desc.organizer'),
      icon: IoMegaphoneOutline
    },
    ACTION_RESEARCH: {
      key: 'research',
      title: t('nav.research'),
      href: ROUTES.CHECKLISTS.RESEARCH,
      description: t('desc.research'),
      icon: IoGlobeOutline
    },
    FEDERAL: {
      key: 'federal',
      title: t('nav.federal'),
      href: ROUTES.CHECKLISTS.FEDERAL,
      description: t('desc.federal'),
      icon: Landmark
    },
    MOVIES: {
      key: 'movies',
      label: t('nav.movies'),
      href: ROUTES.MOVIES,
      title: t('nav.movies')
    },
    RESOURCES: {
      key: 'resources',
      label: t('nav.resources'),
      href: ROUTES.RESOURCES,
      title: t('nav.resources'),
      type: "link"
    },
    POLICE_DOOR_POSTER: {
      key: 'police-door-poster',
      label: t('nav.police-poster'),
      href: ROUTES.POLICE_DOOR_POSTER,
      title: t('nav.police-poster'),
      type: "link"
    },
    ABOUT: {
      key: 'about',
      label: t('nav.about'),
      href: ROUTES.ABOUT.INDEX,
      title: t('nav.about')
    },
    CONTACT: {
      key: 'contact',
      label: t('nav.contact'),
      href: ROUTES.ABOUT.CONTACT,
      title: t('nav.contact')
    },
    PRIVACY: {
      key: 'privacy',
      label: t('nav.privacy'),
      href: ROUTES.ABOUT.PRIVACY,
      title: t('nav.privacy')
    },
    CHANGELOG: {
      key: 'changelog',
      label: t('nav.changelog'),
      href: ROUTES.CHANGELOG,
      title: t('nav.changelog')
    },
    NEWS: {
      key: 'news',
      label: t('nav.news'),
      href: ROUTES.NEWS,
      title: t('nav.news'),
      type: "link"
    },
    FLYER: {
      key: 'flyer',
      label: t('nav.flyer'),
      href: ROUTES.FLYER,
      title: t('nav.flyer'),
      type: "link"
    },
    LINKS: {
      key: 'links',
      label: t('nav.links'),
      href: ROUTES.LINKS,
      title: t('nav.links'),
      type: "link"
    }
  };

  const SECURITY_CHECKLISTS = {
    key: 'security-checklists',
    label: t('section.security-checklists'),
    href: ROUTES.CHECKLISTS.LIST,
    type: "dropdown",
    columns: 2,
    items: [
      NAV_ITEMS.SECURITY_ESSENTIALS,
      NAV_ITEMS.PROTEST_PREP,
      NAV_ITEMS.SIGNAL,
      NAV_ITEMS.TRAVEL,
      NAV_ITEMS.SECONDARY_PHONE,
      NAV_ITEMS.SPYWARE,
      NAV_ITEMS.EMERGENCY,
      NAV_ITEMS.ORGANIZER,
    ].slice(0, 8), // Limit to 8 items maximum
    footerLink: {
      title: t('section.browse-all'),
      href: ROUTES.CHECKLISTS.LIST,
      type: "full-width",
      icon: IoArrowForward,
      className: "group",
      iconClassName: "transition-transform duration-200 group-hover:translate-x-1"
    }
  };

  const RESOURCES_SECTION = {
    key: 'resources-section',
    label: t('section.resources'),
    href: ROUTES.RESOURCES,
    type: "dropdown",
    items: [
      NAV_ITEMS.LINKS,
      NAV_ITEMS.POLICE_DOOR_POSTER,
      NAV_ITEMS.FLYER,
      NAV_ITEMS.MOVIES,
      NAV_ITEMS.RESOURCES,
    ]
  };

  const ABOUT_SECTION = {
    key: 'about-section',
    label: t('section.about'),
    href: ROUTES.ABOUT.INDEX,
    type: "dropdown",
    items: [
      NAV_ITEMS.ABOUT,
      NAV_ITEMS.CHANGELOG,
      NAV_ITEMS.CONTACT,
      NAV_ITEMS.PRIVACY
    ]
  };

  const navigationConfig = {
    logo: {
      href: ROUTES.HOME,
      label: SITE_BRANDING.title,
      ariaLabel: `${SITE_BRANDING.title} Home`,
      image: "/images/logo-bg-white.png"
    },
    // Top navigation menu bar
    mainNav: [
      NAV_ITEMS.HOME,
      SECURITY_CHECKLISTS,
      NAV_ITEMS.NEWS,
      RESOURCES_SECTION,
      ABOUT_SECTION
    ]
  };

  const footerConfig = {
    branding: SITE_BRANDING,
    sections: [
      {
        title: t('footer.navigation'),
        items: [
          NAV_ITEMS.HOME,
          NAV_ITEMS.SECURITY_ESSENTIALS,
          NAV_ITEMS.NEWS,
          NAV_ITEMS.ABOUT,
          NAV_ITEMS.MOVIES,
          NAV_ITEMS.RESOURCES,
          NAV_ITEMS.CHANGELOG,
          NAV_ITEMS.CONTACT,
          NAV_ITEMS.PRIVACY
        ]
      },
      {
        title: t('footer.top-checklists'),
        items: SECURITY_CHECKLISTS.items
      }
    ]
  };

  return useMemo(() => ({
    SITE_BRANDING,
    NAV_ITEMS,
    SECURITY_CHECKLISTS,
    RESOURCES_SECTION,
    ABOUT_SECTION,
    navigationConfig,
    footerConfig
  }), [currentLanguage, t]);
}

// Helper functions remain the same
export function isNavItemActive(item, pathname) {
  // Handle placeholder routes that start with #
  if (item.href?.startsWith('#')) {
    return false
  }
  
  if (item.type === 'link') {
    return item.href === pathname || (item.href === '/' && pathname === '')
  }
  
  // For sub items, check if any child route is active
  return item.items?.some(subItem => {
    if (subItem.href?.startsWith('#')) return false
    // Exact match for the subitem
    if (subItem.href === pathname) return true
    // Check if pathname starts with subitem href
    return subItem.href !== '/' && pathname.startsWith(subItem.href)
  })
}

export function findActiveSection(pathname, navigationConfig) {
  return navigationConfig.mainNav.find(section => isNavItemActive(section, pathname))
}

export function isSubItemActive(item, pathname) {
  if (item.href?.startsWith('#')) return false
  if (item.href === pathname) return true
  return item.href !== '/' && pathname.startsWith(item.href)
}
