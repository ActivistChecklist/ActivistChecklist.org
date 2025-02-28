import * as React from "react"
import { useState, useEffect } from "react"
import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"
import { Sheet, SheetTrigger, SheetContent } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Menu } from "lucide-react"
import Search from "@/components/Search"
import { navigationConfig, isNavItemActive, isSubItemActive } from "@/config/navigation"
import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
  NavigationMenuContent,
  navigationMenuTriggerStyle,
} from "@/components/ui/navigation-menu"
import { cn } from "@/lib/utils"

const TopNav = ({ hideOnScroll = false, maxWidth }) => {
  const pathname = usePathname()
  const [prevScrollPos, setPrevScrollPos] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (!hideOnScroll) {
      setVisible(true);
      return;
    }

    const handleScroll = () => {
      const currentScrollPos = window.scrollY;
      const isScrollingDown = prevScrollPos < currentScrollPos;
      const isScrolledPastThreshold = currentScrollPos > 10;

      setVisible(!isScrollingDown || !isScrolledPastThreshold);
      setPrevScrollPos(currentScrollPos);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [prevScrollPos, hideOnScroll]);

  return (
    <header className={`sticky top-0 w-full border-b bg-background text-foreground z-50 ${
      hideOnScroll ? 'transition-transform duration-300' : ''
    } ${
      visible ? 'translate-y-0' : '-translate-y-full'
    }`}>
      <div className={`${maxWidth} mx-auto px-4`}>
        <div className="flex h-14 items-center justify-between">
          <div className="flex items-center">
            <Sheet>
              <SheetTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="md:hidden mr-2 text-foreground hover:text-foreground/80"
                  aria-label="Open navigation menu"
                >
                  <Menu className="h-6 w-6" aria-hidden="true" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left">
                <nav className="flex flex-col mt-6">
                  {navigationConfig.mainNav.map((item) => (
                    item.type === "link" ? (
                      <Link 
                        key={item.key} 
                        href={item.href} 
                        className={cn(
                          "text-lg font-semibold border-l-2 border-l-transparent hover:border-l-foreground/20 pl-2",
                          isNavItemActive(item, pathname) && "border-primary"
                        )}
                      >
                        {item.label}
                      </Link>
                    ) : (
                      <div key={item.key} className="space-y-2">
                        <Link 
                          href={item.href || '#'} 
                          className={cn(
                            "block text-lg font-semibold pl-2 border-l-2 border-l-transparent hover:border-l-foreground/20",
                            isNavItemActive(item, pathname) && "border-primary text-primary"
                          )}
                        >
                          {item.label}
                        </Link>
                        {item.items.map((subItem) => (
                          <Link
                            key={subItem.key}
                            href={subItem.href}
                            className={cn(
                              "flex items-center gap-2 pl-4 py-1 text-md border-l-2 border-l-transparent hover:border-l-foreground/20",
                              isSubItemActive(subItem, pathname) && "border-primary font-bold text-primary"
                            )}
                          >
                            {subItem.icon && <subItem.icon className="h-4 w-4" />}
                            {subItem.title}
                          </Link>
                        ))}
                        {item.items.length > 0 && item.label === "Security Checklists" && (
                          <Link
                            href="/checklists"
                            className={cn(
                              "flex items-center gap-2 pl-4 py-2 text-md border-l-2 border-l-transparent hover:border-l-foreground/20 text-muted-foreground group",
                              item.footerLink?.className
                            )}
                          >
                            {item.footerLink?.title || "Browse all checklists"}
                            {item.footerLink?.icon && (
                              <item.footerLink.icon className={item.footerLink.iconClassName} />
                            )}
                          </Link>
                        )}
                      </div>
                    )
                  ))}
                </nav>
                <div className="pt-4 border-t mt-4 flex items-center gap-2">
                  <Search variant="searchbar" />
                </div>
              </SheetContent>
            </Sheet>
            <Link 
              href={navigationConfig.logo.href} 
              className="flex items-center space-x-2 ml-0 font-bold text-xl" 
              aria-label={navigationConfig.logo.ariaLabel}
            >
              <Image src={navigationConfig.logo.image} alt={navigationConfig.logo.ariaLabel} width={280} height={19} />
            </Link>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden md:flex items-center space-x-4">
              <NavigationMenu>
                <NavigationMenuList>
                  {navigationConfig.mainNav.map((item, mainIndex) => (
                    <NavigationMenuItem key={`desktop-${item.label}-${mainIndex}`}>
                      {item.type === "dropdown" ? (
                        <>
                          <NavigationMenuTrigger
                            className={cn(
                              "px-4 py-2 h-auto",
                              isNavItemActive(item, pathname) && "text-primary font-bold"
                            )}
                          >
                            {item.label}
                          </NavigationMenuTrigger>
                          <NavigationMenuContent>
                            <ul className={cn(
                              "grid w-[400px] gap-3 p-4",
                              (item.columns === 2)
                                ? "md:w-[500px] md:grid-cols-2"
                                : "md:w-[200px]"
                            )}>
                              {item.items.map((subItem) => (
                                <li key={subItem.key}>
                                  <NavigationMenuLink asChild>
                                    <Link
                                      href={subItem.href}
                                      className={cn(
                                        "block select-none space-y-1 rounded-md p-3 leading-none no-underline outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground",
                                        isSubItemActive(subItem, pathname) && "bg-accent"
                                      )}
                                    >
                                      <div className="flex items-center gap-2">
                                        {subItem.icon && <subItem.icon className="h-4 w-4" />}
                                        <div className="text-sm font-medium leading-none">{subItem.title}</div>
                                      </div>
                                      {subItem.description && (
                                        <p className="line-clamp-2 text-sm leading-snug text-muted-foreground">
                                          {subItem.description}
                                        </p>
                                      )}
                                    </Link>
                                  </NavigationMenuLink>
                                </li>
                              ))}
                              {item.footerLink && (
                                <li className={cn(
                                  "col-span-1",
                                  item.footerLink.type === "full-width" && item.items.length % 2 === 0 ? "md:col-span-2" : ""
                                )}>
                                  <NavigationMenuLink asChild>
                                    <Link
                                      href={item.footerLink.href}
                                      className={cn(
                                        "block select-none rounded-md p-2 no-underline outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground text-center",
                                        item.footerLink.type === "full-width" && item.items.length % 2 === 0 ? "bg-muted" : "bg-muted h-full flex items-center justify-center",
                                        item.footerLink.className
                                      )}
                                    >
                                      <div className="text-sm font-medium flex items-center justify-center w-full gap-2">
                                        {item.footerLink.title}
                                        {item.footerLink.icon && (
                                          <item.footerLink.icon className={item.footerLink.iconClassName} />
                                        )}
                                      </div>
                                    </Link>
                                  </NavigationMenuLink>
                                </li>
                              )}
                            </ul>
                          </NavigationMenuContent>
                        </>
                      ) : (
                        <Link href={item.href} legacyBehavior passHref>
                          <NavigationMenuLink className={navigationMenuTriggerStyle()}>
                            {item.label}
                          </NavigationMenuLink>
                        </Link>
                      )}
                    </NavigationMenuItem>
                  ))}
                </NavigationMenuList>
              </NavigationMenu>
            </div>
            <Search variant="button" />
          </div>
        </div>
      </div>
    </header>
  )
}

export default TopNav
