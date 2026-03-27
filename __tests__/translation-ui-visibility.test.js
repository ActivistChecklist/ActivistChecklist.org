import { describe, it, expect, vi, afterEach } from 'vitest';

describe('isTranslationUiVisible', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('is true when NODE_ENV is development', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    const { isTranslationUiVisible } = await import('../utils/core.js');
    expect(isTranslationUiVisible).toBe(true);
  });

  it('is true when NODE_ENV is test', async () => {
    vi.stubEnv('NODE_ENV', 'test');
    const { isTranslationUiVisible } = await import('../utils/core.js');
    expect(isTranslationUiVisible).toBe(true);
  });

  it('is false in production when NEXT_PUBLIC_SHOW_TRANSLATION_UI is unset', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('NEXT_PUBLIC_SHOW_TRANSLATION_UI', '');
    const { isTranslationUiVisible } = await import('../utils/core.js');
    expect(isTranslationUiVisible).toBe(false);
  });

  it('is true in production when NEXT_PUBLIC_SHOW_TRANSLATION_UI is true', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('NEXT_PUBLIC_SHOW_TRANSLATION_UI', 'true');
    const { isTranslationUiVisible } = await import('../utils/core.js');
    expect(isTranslationUiVisible).toBe(true);
  });
});
