import * as React from "react"
import styles from "../../styles/Alert.module.css";
import {
  IoAlertCircle,
  IoCloseCircle,
  IoMegaphone,
  IoWarning,
  IoFlag,
  IoInformationCircle,
  IoCheckmarkCircle
} from "react-icons/io5"

import { cn } from "@/lib/utils"
import { storyblokEditable } from "@storyblok/react";

const iconMap = {
  default: IoInformationCircle,
  error: IoCloseCircle,
  warning: IoMegaphone,
  info: IoFlag,
  success: IoCheckmarkCircle,
}

const Alert = React.forwardRef(({ 
  className, 
  variant = "default", 
  icon, 
  hideIcon = false, 
  title,
  children, 
  blok,
  ...props 
}, ref) => {
  if (!variant) variant = 'default'
  const Icon = icon || iconMap[variant]
  const showIcon = !hideIcon && Icon

  const shouldWrapInDescription = React.Children.toArray(children).every(
    child => typeof child === 'string' 
    || typeof child === 'number'
    || (React.isValidElement(child) 
        && child.type !== AlertTitle 
        && child.type !== AlertDescription)
  )

  const content = shouldWrapInDescription ? (
    <AlertDescription>{children}</AlertDescription>
  ) : children
  
  return (
    <div
      ref={ref}
      role="alert"
      className={cn(styles.alert, styles[variant], "prose", className)}
      {...storyblokEditable(blok)}
      {...props}>
      {showIcon && <Icon className={cn(styles.alertIcon)} />}
      <div className={cn(
        styles.alertContent,
        showIcon && styles.alertContentWithIcon
      )}>
        {title && <AlertTitle>{title}</AlertTitle>}
        {content}
      </div>
    </div>
  )
})
Alert.displayName = "Alert"

const AlertTitle = React.forwardRef(({ className, ...props }, ref) => (
  <h4
    ref={ref}
    className={cn("alertTitle !mb-2 !-mt-1 !text-lg font-bold leading-none tracking-tight hidden", className)}
    {...props} />
))
AlertTitle.displayName = "AlertTitle"

const AlertDescription = React.forwardRef(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(styles.alertDescription, className)}
    {...props} />
))
AlertDescription.displayName = "AlertDescription"

export { Alert, AlertTitle, AlertDescription }
