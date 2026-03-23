import { describe, it, expect } from 'vitest';
import { translateMainNavigation } from '../lib/navigation-i18n';
import { navigationConfig } from '../config/navigation';

describe('navigation i18n translation mapping', () => {
  it('translates top-level nav labels when keys are available', () => {
    const t = (key, fallback) => {
      const map = {
        'nav.home': 'Inicio',
        'nav.checklists': 'Listas de seguridad',
        'nav.news': 'Noticias',
      };
      return map[key] || fallback;
    };

    const translated = translateMainNavigation(navigationConfig.mainNav, t);

    expect(translated[0].label).toBe('Inicio');
    expect(translated[1].label).toBe('Listas de seguridad');
    expect(translated[2].label).toBe('Noticias');
  });

  it('translates dropdown items and footer link', () => {
    const t = (key, fallback) => {
      const map = {
        'navItems.essentials.title': 'Fundamentos de seguridad',
        'navItems.essentials.description': 'Practicas basicas.',
        'nav.browseAllChecklists': 'Ver todas las listas',
      };
      return map[key] || fallback;
    };

    const translated = translateMainNavigation(navigationConfig.mainNav, t);
    const checklists = translated.find((item) => item.key === 'security-checklists');
    const essentials = checklists.items.find((item) => item.key === 'essentials');

    expect(essentials.title).toBe('Fundamentos de seguridad');
    expect(essentials.description).toBe('Practicas basicas.');
    expect(checklists.footerLink.title).toBe('Ver todas las listas');
  });

  it('falls back to existing labels when translation is missing', () => {
    const t = (_key, fallback) => fallback;
    const translated = translateMainNavigation(navigationConfig.mainNav, t);

    const home = translated.find((item) => item.key === 'home');
    const resources = translated.find((item) => item.key === 'resources-section');

    expect(home.label).toBe('Home');
    expect(resources.label).toBe('Resources');
  });
});
