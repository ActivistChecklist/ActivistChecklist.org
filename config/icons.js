/**
 * Shared icon configuration for guides/checklists.
 * Used by navigation.js for the UI and og-image.js for social share images.
 */
import {
  IoShieldOutline,
  IoMegaphoneOutline,
  IoGlobeOutline,
  IoPhonePortraitOutline,
  IoPeopleOutline,
  IoChatbubbleOutline,
  IoAirplaneOutline,
  IoEyeOffOutline,
  IoVideocamOutline,
  IoNotificationsOutline,
  IoLockClosedOutline,
  IoHandRightOutline,
} from "react-icons/io5"
import { Landmark } from "lucide-react"

// Map guide keys to their icons
// Keys should match the slug patterns used in routes.js
export const GUIDE_ICONS = {
  'essentials': IoShieldOutline,
  'protest': IoPeopleOutline,
  'travel': IoAirplaneOutline,
  'signal': IoChatbubbleOutline,
  'secondary': IoPhonePortraitOutline,
  'emergency': IoNotificationsOutline,
  'spyware': IoEyeOffOutline,
  'organizing': IoMegaphoneOutline,
  'research': IoGlobeOutline,
  'federal': Landmark,
  'doxxing': IoLockClosedOutline,
  'action': IoHandRightOutline,
  'ice': IoVideocamOutline,
}

// Default icon for pages without a specific icon (shield)
export const DEFAULT_ICON = IoShieldOutline

/**
 * Get icon component for a guide key
 */
export function getGuideIcon(key) {
  return GUIDE_ICONS[key] || DEFAULT_ICON
}
