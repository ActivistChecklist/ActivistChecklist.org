import { describe, it, expect, beforeEach } from 'vitest';
import { migrateLegacyChecklistKeysForSlug } from '../lib/checklist-storage-migrate';

function mockWindowStorage() {
  const store = {};
  globalThis.window = {
    localStorage: {
      getItem: (k) => (Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null),
      setItem: (k, v) => {
        store[k] = String(v);
      },
      removeItem: (k) => {
        delete store[k];
      },
      clear: () => {
        for (const k of Object.keys(store)) delete store[k];
      },
    },
  };
}

describe('migrateLegacyChecklistKeysForSlug', () => {
  beforeEach(() => {
    mockWindowStorage();
    window.localStorage.clear();
  });

  it('copies checked state from legacy uid key to slug key', () => {
    window.localStorage.setItem('checklist-checked-abc-uid-111', 'true');
    const idMap = { 'abc-uid-111': 'my-slug' };
    migrateLegacyChecklistKeysForSlug('my-slug', idMap);
    expect(window.localStorage.getItem('checklist-checked-my-slug')).toBe('true');
    expect(window.localStorage.getItem('checklist-checked-abc-uid-111')).toBe(null);
  });

  it('copies expanded state from legacy uid key to slug key', () => {
    window.localStorage.setItem('checklist-expanded-xyz-222', 'true');
    const idMap = { 'xyz-222': 'other-slug' };
    migrateLegacyChecklistKeysForSlug('other-slug', idMap);
    expect(window.localStorage.getItem('checklist-expanded-other-slug')).toBe('true');
    expect(window.localStorage.getItem('checklist-expanded-xyz-222')).toBe(null);
  });

  it('does not overwrite slug keys if already set', () => {
    window.localStorage.setItem('checklist-checked-s', 'false');
    window.localStorage.setItem('checklist-checked-old-id', 'true');
    const idMap = { 'old-id': 's' };
    migrateLegacyChecklistKeysForSlug('s', idMap);
    expect(window.localStorage.getItem('checklist-checked-s')).toBe('false');
    expect(window.localStorage.getItem('checklist-checked-old-id')).toBe(null);
  });

  it('is a no-op when slug has no map entries', () => {
    window.localStorage.setItem('checklist-checked-orphan', 'true');
    migrateLegacyChecklistKeysForSlug('unknown-slug', {});
    expect(window.localStorage.getItem('checklist-checked-orphan')).toBe('true');
  });
});
