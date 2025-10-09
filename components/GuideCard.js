import React from 'react';
import Link from '@/components/Link';
import { ArrowRight } from 'lucide-react';
import { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

const GuideCard = ({ 
  guideItem, 
  size = "medium" 
}) => {
  const sizeVariants = {
    medium: {
      card: "h-full transition-all duration-200 ease-in-out transform hover:scale-101 hover:shadow-xl border-primary/10 hover:border-primary/30 bg-gradient-to-br from-card via-card flex flex-col",
      header: "py-3 px-4",
      content: "py-3 px-4 pt-0 flex-1",
      footer: "py-3 px-4 pt-0 mt-auto",
      iconContainer: "p-2 rounded-lg bg-primary/10 text-primary",
      icon: "h-5 w-5",
      title: "text-lg",
      description: "text-sm",
      footerText: "text-sm"
    },
    large: {
      card: "h-full transition-all duration-200 ease-in-out transform hover:scale-101 hover:shadow-xl border-primary/10 hover:border-primary/30 bg-gradient-to-br from-card via-card flex flex-col",
      header: "",
      content: "flex-1",
      footer: "mt-auto",
      iconContainer: "p-2 rounded-lg bg-primary/10 text-primary",
      icon: "h-6 w-6",
      title: "text-lg",
      description: "text-lg",
      footerText: "text-base"
    }
  };

  const variant = sizeVariants[size];

  // Extract properties from guideItem
  const { href, icon: Icon, title, description } = guideItem;

  return (
    <Link href={href} className="block group">
      <Card className={cn(variant.card, "to-primary/5")}>
        <CardHeader className={variant.header}>
          <div className="flex items-center gap-3">
            <div className={variant.iconContainer}>
              <Icon className={variant.icon} />
            </div>
            <CardTitle className={variant.title}>{title}</CardTitle>
          </div>
        </CardHeader>
        <CardContent className={variant.content}>
          <CardDescription className={variant.description}>{description}</CardDescription>
        </CardContent>
        <CardFooter className={variant.footer}>
          <span className={cn("text-primary font-medium inline-flex items-center", variant.footerText)}>
            View checklist <ArrowRight className="ml-2 transition-transform duration-300 ease-out group-hover:translate-x-1" />
          </span>
        </CardFooter>
      </Card>
    </Link>
  );
};

export default GuideCard;
