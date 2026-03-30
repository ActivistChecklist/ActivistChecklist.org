/**
 * Shared logic: internal root-relative paths should end with / unless they
 * point at a static file (extension) or are exactly /.
 * Matches next.config.js trailingSlash: true.
 */

const FILE_EXT_LAST_SEG = /\.[a-z0-9]{2,12}$/i;

export function fixInternalPath(path) {
  if (typeof path !== 'string' || !path.startsWith('/') || path.startsWith('//')) {
    return path;
  }
  if (path === '/') return path;

  let end = path.length;
  const q = path.indexOf('?');
  const h = path.indexOf('#');
  if (q >= 0 && h >= 0) end = Math.min(q, h);
  else if (q >= 0) end = q;
  else if (h >= 0) end = h;

  const base = path.slice(0, end);
  const rest = path.slice(end);

  const segments = base.split('/').filter(Boolean);
  const last = segments[segments.length - 1] || '';
  if (last && FILE_EXT_LAST_SEG.test(last)) {
    return path;
  }
  if (base.endsWith('/')) return path;
  return `${base}/${rest}`;
}

/**
 * Apply all safe text transforms to file contents.
 * @returns {string} updated content
 */
export function applyTrailingSlashFixes(content, { ext } = {}) {
  let out = content;

  // --- JSX / HTML: href="..." href='...'
  out = out.replace(/\bhref\s*=\s*"(\/[^"]*)"/gi, (m, p) => {
    const f = fixInternalPath(p);
    return f === p ? m : `href="${f}"`;
  });
  out = out.replace(/\bhref\s*=\s*'(\/[^']*)'/gi, (m, p) => {
    const f = fixInternalPath(p);
    return f === p ? m : `href='${f}'`;
  });

  // href={"/path"} or href={'/path'}
  out = out.replace(/\bhref=\{\s*(["'])(\/[^"']*)\1\s*\}/g, (m, q, p) => {
    const f = fixInternalPath(p);
    return f === p ? m : `href={${q}${f}${q}}`;
  });

  // href={`/path`} (no interpolation)
  out = out.replace(/\bhref=\{\s*`(\/[^`$]*)`\s*\}/g, (m, p) => {
    const f = fixInternalPath(p);
    return f === p ? m : `href={\`${f}\`}`;
  });

  // JSON: "href": "/..."
  if (ext === '.json') {
    out = out.replace(/"href"\s*:\s*"(\/[^"]*)"/g, (m, p) => {
      const f = fixInternalPath(p);
      return f === p ? m : `"href": "${f}"`;
    });
  }

  // YAML: buttonUrl: /path  or  href: /path
  if (ext === '.yaml' || ext === '.yml') {
    out = out.replace(/^(\s*(?:buttonUrl|href)\s*:\s*)(\/[^\s#]+)/gm, (m, pre, p) => {
      const f = fixInternalPath(p);
      return f === p ? m : `${pre}${f}`;
    });
  }

  // Markdown links: ](url) or ](url "title")
  if (ext === '.md' || ext === '.mdx') {
    out = out.replace(/\]\(([^)]+)\)/g, (full, inner) => {
      const trimmed = inner.trim();
      if (!trimmed.startsWith('/')) return full;

      let urlPart = trimmed;
      let title = '';
      const spaceIdx = trimmed.search(/\s/);
      if (spaceIdx > 0) {
        const beforeSpace = trimmed.slice(0, spaceIdx);
        const afterSpace = trimmed.slice(spaceIdx + 1).trim();
        if (
          beforeSpace.startsWith('/') &&
          !beforeSpace.startsWith('//') &&
          (afterSpace.startsWith('"') || afterSpace.startsWith("'"))
        ) {
          urlPart = beforeSpace;
          title = ' ' + trimmed.slice(spaceIdx + 1);
        }
      }
      const f = fixInternalPath(urlPart);
      return f === urlPart ? full : `](${f}${title})`;
    });
  }

  return out;
}
