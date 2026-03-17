// components/Link.js
import NextLink from 'next/link'
import { useRouter } from 'next/router'
import { SUPPORTED_LANGUAGES, DEFAULT_LANGUAGE } from '@/lib/i18n'

const nonDefaultLangCodes = SUPPORTED_LANGUAGES
  .filter(lang => lang.code !== DEFAULT_LANGUAGE)
  .map(lang => lang.code)

export default function Link({ href, children, ...props }) {
  const router = useRouter()
  const isExternal = typeof href === 'string' && href.startsWith('http')

  if (isExternal) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" {...props}>
        {children}
      </a>
    )
  }

  // Preserve language prefix from the current URL on internal links
  let localizedHref = href
  if (typeof href === 'string' && !href.startsWith('#')) {
    const path = router.asPath
    for (const code of nonDefaultLangCodes) {
      if (path.startsWith(`/${code}/`) || path === `/${code}`) {
        // Don't double-prefix
        if (!href.startsWith(`/${code}/`) && !href.startsWith(`/${code}`)) {
          localizedHref = `/${code}${href}`
        }
        break
      }
    }
  }

  return (
    <NextLink href={localizedHref} {...props}>
      {children}
    </NextLink>
  )
}
