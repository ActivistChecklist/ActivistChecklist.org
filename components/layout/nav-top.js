import * as React from "react"
import { useState, useEffect } from "react"
import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"
import { useTranslations } from "next-intl"
import { Sheet, SheetTrigger, SheetContent } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Menu } from "lucide-react"
import Search from "@/components/Search"
import LanguageSwitcher from "@/components/LanguageSwitcher"
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
  const t = useTranslations()
  const [prevScrollPos, setPrevScrollPos] = useState(0);
  const [visible, setVisible] = useState(true);

  const translateText = (key, fallback) => {
    try {
      return t(key);
    } catch {
      return fallback;
    }
  };

  const mainNavTranslationKeys = {
    home: "nav.home",
    "security-checklists": "nav.checklists",
    news: "nav.news",
    "resources-section": "nav.resources",
    "about-section": "nav.about",
  };

  const itemTranslationKeys = {
    essentials: {
      title: "navItems.essentials.title",
      description: "navItems.essentials.description",
    },
    signal: {
      title: "navItems.signal.title",
      description: "navItems.signal.description",
    },
    protest: {
      title: "navItems.protest.title",
      description: "navItems.protest.description",
    },
    ice: {
      title: "navItems.ice.title",
      description: "navItems.ice.description",
    },
    doxxing: {
      title: "navItems.doxxing.title",
      description: "navItems.doxxing.description",
    },
    travel: {
      title: "navItems.travel.title",
      description: "navItems.travel.description",
    },
    emergency: {
      title: "navItems.emergency.title",
      description: "navItems.emergency.description",
    },
    secondary: {
      title: "navItems.secondary.title",
      description: "navItems.secondary.description",
    },
    links: {
      title: "navItems.links.title",
      label: "navItems.links.label",
    },
    "police-door-poster": {
      title: "navItems.policeDoorPoster.title",
      label: "navItems.policeDoorPoster.label",
    },
    flyer: {
      title: "navItems.flyer.title",
      label: "navItems.flyer.label",
    },
    movies: {
      title: "navItems.movies.title",
      label: "navItems.movies.label",
    },
    resources: {
      title: "navItems.resources.title",
      label: "navItems.resources.label",
    },
    about: {
      title: "navItems.about.title",
      label: "navItems.about.label",
    },
    changelog: {
      title: "navItems.changelog.title",
      label: "navItems.changelog.label",
    },
    contact: {
      title: "navItems.contact.title",
      label: "navItems.contact.label",
    },
    privacy: {
      title: "navItems.privacy.title",
      label: "navItems.privacy.label",
    },
  };

  const getTranslatedNav = (item) => {
    const topLevelKey = mainNavTranslationKeys[item.key];
    const itemKey = itemTranslationKeys[item.key] || {};

    const translatedItem = {
      ...item,
      label: topLevelKey
        ? translateText(topLevelKey, item.label)
        : itemKey.label
          ? translateText(itemKey.label, item.label)
          : item.label,
      title: itemKey.title ? translateText(itemKey.title, item.title) : item.title,
      description: itemKey.description
        ? translateText(itemKey.description, item.description)
        : item.description,
    };

    if (item.items?.length) {
      translatedItem.items = item.items.map((subItem) => getTranslatedNav(subItem));
    }

    if (item.footerLink) {
      translatedItem.footerLink = {
        ...item.footerLink,
        title: translateText("nav.browseAllChecklists", item.footerLink.title),
      };
    }

    return translatedItem;
  };

  const translatedMainNav = navigationConfig.mainNav.map((item) => getTranslatedNav(item));

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
    <>
      {/* If printing, show the logo */}
      <div className="hidden print:block print:relative">
        <Image 
          className="print:absolute print:top-0 print:right-0" 
          src={navigationConfig.logo.image} 
          alt={navigationConfig.logo.ariaLabel} 
          width={250} 
          height={20} 
        />
      </div>
      <header className={cn(
        "sticky top-0 w-full border-b bg-background text-foreground z-50",
        hideOnScroll ? 'transition-transform duration-300' : '',
        visible ? 'translate-y-0' : '-translate-y-full',
        "print:hidden",
      )}>
        {/* Normal top nav bar */}
        <div className={cn(
          maxWidth,
          "mx-auto px-4",
        )}>
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
                    {translatedMainNav.map((item) => (
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
                          {item.items.length > 0 && item.key === "security-checklists" && (
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
                <Image src={navigationConfig.logo.image} alt={navigationConfig.logo.ariaLabel} width={250} height={20} />
              </Link>
            </div>
            <div className="flex items-center gap-4">
              <div className="hidden md:flex items-center space-x-4">
                <NavigationMenu>
                  <NavigationMenuList>
                    {translatedMainNav.map((item, mainIndex) => (
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
                                          "block select-none space-y-1 rounded-md p-3 leading-none no-underline outline-none transition-colors hover:bg-muted hover:text-primary focus:bg-muted focus:text-primary",
                                          isSubItemActive(subItem, pathname) && "bg-muted"
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
                                          "block select-none rounded-md p-2 no-underline outline-none transition-colors hover:bg-muted hover:text-primary focus:bg-muted focus:text-primary text-center",
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
              <div className="flex items-center gap-2">
                {navigationConfig.socialLinks?.map((social) => (
                  <a
                    key={social.key}
                    href={social.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={social.ariaLabel}
                    className="text-foreground/70 hover:text-foreground transition-colors"
                  >
                    <social.icon className="h-5 w-5" aria-hidden="true" />
                  </a>
                ))}
                <LanguageSwitcher />
                <Search variant="button" />
              </div>
            </div>
          </div>
        </div>
      </header>
    </>
  )
}

export default TopNav
