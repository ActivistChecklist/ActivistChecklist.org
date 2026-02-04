import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('OG Image Configuration', () => {
  describe('GUIDE_ICONS', () => {
    it('should export all required guide icons', async () => {
      const { GUIDE_ICONS } = await import('../config/icons.js');
      
      const requiredKeys = [
        'essentials',
        'protest',
        'travel',
        'signal',
        'secondary',
        'emergency',
        'spyware',
        'organizing',
        'research',
        'federal',
        'doxxing',
        'action',
        'ice',
      ];
      
      for (const key of requiredKeys) {
        expect(GUIDE_ICONS[key], `Missing icon for "${key}"`).toBeDefined();
        // Icons can be functions (react-icons) or objects (lucide-react)
        const iconType = typeof GUIDE_ICONS[key];
        expect(
          iconType === 'function' || iconType === 'object',
          `Icon for "${key}" should be a function or object, got ${iconType}`
        ).toBe(true);
      }
    });

    it('should export a DEFAULT_ICON', async () => {
      const { DEFAULT_ICON } = await import('../config/icons.js');
      expect(DEFAULT_ICON).toBeDefined();
      expect(typeof DEFAULT_ICON).toBe('function');
    });
  });

  describe('Icon SVG Extraction', () => {
    it('should extract valid SVG data from stroke-based icons', async () => {
      const { IoShieldOutline } = await import('react-icons/io5');
      const el = IoShieldOutline({});
      
      expect(el.props.attr.viewBox).toBeDefined();
      expect(el.props.children).toBeDefined();
      expect(el.props.children.length).toBeGreaterThan(0);
      
      // Stroke-based icons should have strokeWidth
      const hasStroke = el.props.children.some(child => child.props?.strokeWidth);
      expect(hasStroke).toBe(true);
    });

    it('should extract valid SVG data from fill-based icons', async () => {
      const { IoEyeOffOutline } = await import('react-icons/io5');
      const el = IoEyeOffOutline({});
      
      expect(el.props.attr.viewBox).toBeDefined();
      expect(el.props.children).toBeDefined();
      expect(el.props.children.length).toBeGreaterThan(0);
      
      // Fill-based icons should NOT have strokeWidth
      const hasStroke = el.props.children.some(child => child.props?.strokeWidth);
      expect(hasStroke).toBe(false);
    });

    it('should handle icons with multiple element types (path + rect)', async () => {
      const { IoLockClosedOutline } = await import('react-icons/io5');
      const el = IoLockClosedOutline({});
      
      const elementTypes = el.props.children.map(child => child.type);
      
      // Lock icon has both path and rect elements
      expect(elementTypes).toContain('path');
      expect(elementTypes).toContain('rect');
    });

    it('should handle lucide-react icons', async () => {
      const { Landmark } = await import('lucide-react');
      
      // Lucide-react exports forwardRef components (objects), not plain functions
      expect(Landmark).toBeDefined();
      expect(typeof Landmark).toBe('object');
      // Check it has the render property of a forwardRef component
      expect(Landmark.$$typeof || Landmark.render).toBeDefined();
    });
  });

  describe('Default OG Image Pages', () => {
    it('should have matching lists in og-image.js and api/og-image.js', () => {
      // These pages should use the default OG image
      const expectedPages = [
        'home',
        '',
        'privacy',
        'contact',
        'resources',
        'about',
        'checklists',
        'flyer',
      ];
      
      // Read the files to check the lists match
      const ogImageContent = fs.readFileSync(
        path.join(process.cwd(), 'lib/og-image.js'),
        'utf-8'
      );
      const apiContent = fs.readFileSync(
        path.join(process.cwd(), 'pages/api/og-image.js'),
        'utf-8'
      );
      
      // Check that both files contain the same pages
      for (const page of expectedPages) {
        expect(ogImageContent).toContain(`'${page}'`);
        expect(apiContent).toContain(`'${page}'`);
      }
    });
  });

  describe('Slug to Icon Matching', () => {
    it('should match common slug patterns to correct icons', async () => {
      const { GUIDE_ICONS } = await import('../config/icons.js');
      
      // Test that slugs would match the expected icons
      const slugTests = [
        { slug: 'protest', expectedKey: 'protest' },
        { slug: 'signal', expectedKey: 'signal' },
        { slug: 'secondary', expectedKey: 'secondary' },
        { slug: 'organizing', expectedKey: 'organizing' },
        { slug: 'spyware', expectedKey: 'spyware' },
        { slug: 'doxxing', expectedKey: 'doxxing' },
        { slug: 'action', expectedKey: 'action' },
      ];
      
      for (const { slug, expectedKey } of slugTests) {
        // Simulate the matching logic from getIconForSlug
        const normalizedSlug = slug.toLowerCase().replace(/\//g, '');
        let matchedKey = null;
        
        for (const key of Object.keys(GUIDE_ICONS)) {
          if (normalizedSlug.includes(key)) {
            matchedKey = key;
            break;
          }
        }
        
        expect(matchedKey, `Slug "${slug}" should match key "${expectedKey}"`).toBe(expectedKey);
      }
    });
  });

  describe('Navigation Icons Consistency', () => {
    it('should have icons defined for all NAV_ITEMS with icon property', async () => {
      const { NAV_ITEMS } = await import('../config/navigation.js');
      
      const itemsWithIcons = Object.values(NAV_ITEMS).filter(item => item.icon !== undefined);
      
      for (const item of itemsWithIcons) {
        expect(item.icon, `NAV_ITEMS.${item.key} has undefined icon`).toBeDefined();
        // Icons can be functions (react-icons) or objects (lucide-react forwardRef)
        const iconType = typeof item.icon;
        expect(
          iconType === 'function' || iconType === 'object',
          `NAV_ITEMS.${item.key} icon should be a function or object, got ${iconType}`
        ).toBe(true);
      }
    });
  });
});

describe('API Route Security', () => {
  it('should only be available in development', () => {
    const apiContent = fs.readFileSync(
      path.join(process.cwd(), 'pages/api/og-image.js'),
      'utf-8'
    );
    
    // Check that the dev-only check exists
    expect(apiContent).toContain("process.env.NODE_ENV !== 'development'");
    expect(apiContent).toContain('404');
  });
});
