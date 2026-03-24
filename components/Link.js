// components/Link.js
import NextLink from 'next/link'
import { applyPaywallBypassHref } from '@/lib/paywall-bypass-url'

export default function Link({ href, children, ...props }) {
  const isExternal = typeof href === 'string' && href.startsWith('http')
  const resolvedHref = isExternal ? applyPaywallBypassHref(href) : href

  if (isExternal) {
    return (
      <a href={resolvedHref} target="_blank" rel="noopener noreferrer" {...props}>
        {children}
      </a>
    )
  }
  
  return (
    <NextLink href={resolvedHref} {...props}>
      {children}
    </NextLink>
  )
}