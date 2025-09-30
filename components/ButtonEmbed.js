import React from 'react';
import { Button } from "@/components/ui/button";
import * as IoIcons from 'react-icons/io5';

// Dynamic icon renderer for Ionicons 5
const DynamicIcon = ({ iconName, className, ...props }) => {
  if (!iconName) return null;
  
  // Ensure the icon name starts with 'Io' for Ionicons 5
  const formattedIconName = iconName.startsWith('Io') ? iconName : `Io${iconName}`;
  
  // Get the icon component from the react-icons/io5 package
  const IconComponent = IoIcons[formattedIconName];
  
  if (!IconComponent) {
    console.warn(`Icon "${formattedIconName}" not found in Ionicons 5`);
    return null;
  }
  
  return <IconComponent className={className} {...props} />;
};

export const ButtonEmbed = (props) => {
  const { title, url, variant, size, className, icon, iconPosition, download } = props;
  
  // Extract the actual URL and target from the url object
  const href = url?.cached_url || url?.url || '#';
  const target = url?.target || (href?.startsWith('http') ? '_blank' : undefined);
  
  const iconElement = icon ? <DynamicIcon iconName={icon} /> : null;
  const position = iconPosition || 'left';
  
  return (
    <Button 
      asChild
      variant={variant || 'default'}
      size={size || 'default'}
      className={className}
    >
      <a 
        href={href}
        target={target}
        rel={target === '_blank' ? 'noopener noreferrer' : undefined}
        {...(download && { download: '' })}
      >
        {iconElement && position === 'left' && iconElement}
        {title}
        {iconElement && position === 'right' && iconElement}
      </a>
    </Button>
  );
};

export default ButtonEmbed;
