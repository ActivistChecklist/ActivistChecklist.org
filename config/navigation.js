import {
  IoShieldOutline,
  IoMegaphoneOutline,
  IoGlobeOutline,
  IoPhonePortraitOutline,
  IoArrowForward,
  IoPeopleOutline,
} from "react-icons/io5"
import { Landmark } from "lucide-react"
import { ROUTES } from './routes'

export const SITE_BRANDING = {
  title: "Activist Checklist",
  description: "Plain language steps for digital security, because protecting yourself helps keep your whole community safer."
}

// Define all navigation items by key for reuse
export const NAV_ITEMS = {
  HOME: {
    key: 'home',
    label: "Home",
    href: ROUTES.HOME,
    type: "link"
  },
  SECURITY_ESSENTIALS: {
    key: 'security-essentials',
    title: "Security essentials",
    href: ROUTES.CHECKLISTS.ESSENTIALS,
    description: "Core security practices every activist should follow.",
    icon: IoShieldOutline
  },
  PROTEST_PREP: {
    key: 'protest-prep',
    title: "Prepare for a protest",
    href: ROUTES.CHECKLISTS.PROTEST,
    description: "Digital security for anyone attending a protest.",
    icon: IoPeopleOutline
  },
  ORGANIZER: {
    key: 'organizer',
    title: "Action organizer checklist",
    href: ROUTES.CHECKLISTS.ORGANIZER,
    description: "For movement organizers and coordinators.",
    icon: IoMegaphoneOutline
  },
  ACTION_RESEARCH: {
    key: 'research',
    title: "Action research & scouting",
    href: ROUTES.CHECKLISTS.RESEARCH,
    description: "How to conduct research and browse the web anonymously.",
    icon: IoGlobeOutline
  },
  SECONDARY_PHONE: {
    key: 'secondary-phone',
    title: "Secondary phone",
    href: ROUTES.CHECKLISTS.SECONDARY_PHONE,
    description: "Set up an extra phone for activism and protests.",
    icon: IoPhonePortraitOutline
  },
  FEDERAL: {
    key: 'federal',
    title: "Federal workers",
    href: ROUTES.CHECKLISTS.FEDERAL,
    description: "Digital security guidance for federal employees.",
    icon: Landmark
  },
  ABOUT: {
    key: 'about',
    label: "About",
    href: ROUTES.ABOUT.INDEX,
    title: "About This Site"
  },
  CONTACT: {
    key: 'contact',
    label: "Contact",
    href: ROUTES.ABOUT.CONTACT,
    title: "Contact"
  },
  PRIVACY: {
    key: 'privacy',
    label: "Privacy",
    href: ROUTES.ABOUT.PRIVACY,
    title: "Privacy"
  }
}

export const SECURITY_CHECKLISTS = {
  key: 'security-checklists',
  label: "Security Checklists",
  href: ROUTES.CHECKLISTS.LIST,
  type: "dropdown",
  columns: 2,
  items: [
    NAV_ITEMS.SECURITY_ESSENTIALS,
    NAV_ITEMS.PROTEST_PREP,
    NAV_ITEMS.ORGANIZER,
    NAV_ITEMS.ACTION_RESEARCH,
    NAV_ITEMS.SECONDARY_PHONE,
    NAV_ITEMS.FEDERAL,
  ],
  footerLink: {
    title: "Browse all checklists",
    href: ROUTES.CHECKLISTS.LIST,
    type: "full-width",
    icon: IoArrowForward,
    className: "group",
    iconClassName: "transition-transform duration-200 group-hover:translate-x-1"
  }
}

export const ABOUT_SECTION = {
  key: 'about-section',
  label: "About",
  href: ROUTES.ABOUT.INDEX,
  type: "dropdown",
  items: [
    NAV_ITEMS.ABOUT,
    NAV_ITEMS.CONTACT,
    NAV_ITEMS.PRIVACY
  ]
}

export const navigationConfig = {
  logo: {
    href: ROUTES.HOME,
    label: SITE_BRANDING.title,
    ariaLabel: `${SITE_BRANDING.title} Home`
  },
  mainNav: [
    NAV_ITEMS.HOME,
    SECURITY_CHECKLISTS,
    ABOUT_SECTION
  ]
}

export const footerConfig = {
  branding: SITE_BRANDING,
  sections: [
    {
      title: "Navigation",
      items: [
        NAV_ITEMS.HOME,
        NAV_ITEMS.SECURITY_ESSENTIALS,
        NAV_ITEMS.ABOUT,
        NAV_ITEMS.CONTACT,
        NAV_ITEMS.PRIVACY
      ]
    },
    {
      title: "Top Checklists",
      items: SECURITY_CHECKLISTS.items
    }
  ]
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

export function findActiveSection(pathname) {
  return navigationConfig.mainNav.find(section => isNavItemActive(section, pathname))
}

export function isSubItemActive(item, pathname) {
  if (item.href?.startsWith('#')) return false
  if (item.href === pathname) return true
  return item.href !== '/' && pathname.startsWith(item.href)
} 