import React from 'react';
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Shield } from "lucide-react";

const PROTECTION_LEVELS = {
  basic: {
    text: "Baseline Security",
    variant: "primary"
  },
  enhanced: {
    text: "Enhanced Security",
    variant: "info"
  }
};

export function ProtectionBadge({ type = "basic", className, ...props }) {
  const config = PROTECTION_LEVELS[type.toLowerCase()] || PROTECTION_LEVELS.basic;
  
  return (
    <Badge 
      variant={config.variant}
      className={cn(className)} 
      {...props}
    >
      {config.text}
    </Badge>
  );
} 