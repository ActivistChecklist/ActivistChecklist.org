import { cn } from "@/lib/utils";
import { Calendar } from 'lucide-react';
import { useEffect, useState } from 'react';

export function getDateMetaItem(date, label = "Last updated on") {
  return {
    icon: <Calendar className="h-4 w-4 mr-1" />,
    label,
    value: new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  };
}

export const MetaBar = ({ 
  items = [],
  className,
  ...props 
}) => {
  if (items.length === 0) return null;
  
  const valueStyle = "text-foreground font-semibold"; 
  const [currentUrl, setCurrentUrl] = useState('');

  useEffect(() => {
    setCurrentUrl(window.location.href);
  }, []);

  return (
    <div className={cn(
      "bg-muted rounded-md lg:rounded-2xl py-3 px-6 mb-6 flex flex-wrap items-center", 
      "gap-y-2 gap-x-6 text-sm text-muted-foreground",
      "print:mb-0",
      className
    )}
    {...props}
    >
      {items.map((item, index) => (
        <div key={index} className="flex items-center whitespace-nowrap">
          {item.icon && (
            <>
              {item.icon}
              &nbsp;
            </>
          )}
          <span>
            {item.label}&nbsp;
            <span className={valueStyle}>
              {item.value}
            </span>
          </span>
        </div>
      ))}
      <div className="hidden print:flex whitespace-normal">
        <span>
          View the latest guide at{' '}
          <span className={valueStyle}>
            {currentUrl}
          </span>
        </span>
      </div>
    </div>
  );
}; 