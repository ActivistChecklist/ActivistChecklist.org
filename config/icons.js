/**
 * Shared icon configuration for guides/checklists.
 * Used by navigation.js for the UI and og-image.js for social share images.
 */
import {
  IoShield,
  IoMegaphone,
  IoGlobe,
  IoPhonePortrait,
  IoPeople,
  IoChatbubble,
  IoAirplane,
  IoEyeOff,
  IoVideocam,
  IoNotifications,
  IoLockClosed,
  IoHandRight,
} from "react-icons/io5"
import { Landmark } from "lucide-react"

// Map guide keys to their icons (solid variants)
// Keys should match item keys in config/navigation.json (checklist slugs)
export const GUIDE_ICONS = {
  'essentials': IoShield,
  'protest': IoPeople,
  'travel': IoAirplane,
  'signal': IoChatbubble,
  'secondary': IoPhonePortrait,
  'emergency': IoNotifications,
  'spyware': IoEyeOff,
  'organizing': IoMegaphone,
  'research': IoGlobe,
  'federal': Landmark,
  'doxxing': IoLockClosed,
  'action': IoHandRight,
  'ice': IoVideocam,
}

// Default icon for pages without a specific icon (shield)
export const DEFAULT_ICON = IoShield

/**
 * Get icon component for a guide key
 */
export function getGuideIcon(key) {
  return GUIDE_ICONS[key] || DEFAULT_ICON
}
