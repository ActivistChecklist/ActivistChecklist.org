import { describe, it, expect } from 'vitest';
import { fixInternalPath } from '../scripts/lib/trailing-slash-paths-core.mjs';

describe('fixInternalPath', () => {
  it('leaves root and static files', () => {
    expect(fixInternalPath('/')).toBe('/');
    expect(fixInternalPath('/files/x.pdf')).toBe('/files/x.pdf');
    expect(fixInternalPath('/images/a.png')).toBe('/images/a.png');
  });

  it('adds trailing slash to directory-like paths', () => {
    expect(fixInternalPath('/about')).toBe('/about/');
    expect(fixInternalPath('/essentials')).toBe('/essentials/');
    expect(fixInternalPath('/es/about')).toBe('/es/about/');
  });

  it('preserves query and hash', () => {
    expect(fixInternalPath('/about?x=1')).toBe('/about/?x=1');
    expect(fixInternalPath('/about#x')).toBe('/about/#x');
  });

  it('skips external and protocol-relative', () => {
    expect(fixInternalPath('//cdn.com/x')).toBe('//cdn.com/x');
  });
});
