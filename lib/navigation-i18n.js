const MAIN_NAV_TRANSLATION_KEYS = {
  home: 'nav.home',
  checklists: 'nav.checklists',
  news: 'nav.news',
  resources: 'nav.resources',
  about: 'nav.about',
};

const ITEM_TRANSLATION_KEYS = {
  essentials: {
    title: 'navItems.essentials.title',
    description: 'navItems.essentials.description',
  },
  signal: {
    title: 'navItems.signal.title',
    description: 'navItems.signal.description',
  },
  protest: {
    title: 'navItems.protest.title',
    description: 'navItems.protest.description',
  },
  ice: {
    title: 'navItems.ice.title',
    description: 'navItems.ice.description',
  },
  doxxing: {
    title: 'navItems.doxxing.title',
    description: 'navItems.doxxing.description',
  },
  travel: {
    title: 'navItems.travel.title',
    description: 'navItems.travel.description',
  },
  emergency: {
    title: 'navItems.emergency.title',
    description: 'navItems.emergency.description',
  },
  secondary: {
    title: 'navItems.secondary.title',
    description: 'navItems.secondary.description',
  },
  links: {
    title: 'navItems.links.title',
    label: 'navItems.links.label',
  },
  'police-door-poster': {
    title: 'navItems.policeDoorPoster.title',
    label: 'navItems.policeDoorPoster.label',
  },
  flyer: {
    title: 'navItems.flyer.title',
    label: 'navItems.flyer.label',
  },
  movies: {
    title: 'navItems.movies.title',
    label: 'navItems.movies.label',
  },
  resources: {
    title: 'navItems.resources.title',
    label: 'navItems.resources.label',
  },
  about: {
    title: 'navItems.about.title',
    label: 'navItems.about.label',
  },
  changelog: {
    title: 'navItems.changelog.title',
    label: 'navItems.changelog.label',
  },
  contact: {
    title: 'navItems.contact.title',
    label: 'navItems.contact.label',
  },
  privacy: {
    title: 'navItems.privacy.title',
    label: 'navItems.privacy.label',
  },
};

export function translateNavigationItem(item, translateText) {
  const topLevelKey = MAIN_NAV_TRANSLATION_KEYS[item.key];
  const itemKey = ITEM_TRANSLATION_KEYS[item.key] || {};

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
    translatedItem.items = item.items.map((subItem) => translateNavigationItem(subItem, translateText));
  }

  if (item.footerLink) {
    translatedItem.footerLink = {
      ...item.footerLink,
      title: translateText('nav.browseAllChecklists', item.footerLink.title),
    };
  }

  return translatedItem;
}

export function translateMainNavigation(mainNav, translateText) {
  return mainNav.map((item) => translateNavigationItem(item, translateText));
}
