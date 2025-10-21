// components/Link.js
import NextLink from 'next/link'

export default function Link({ href, children, ...props }) {
  const isExternal = typeof href === 'string' && href.startsWith('http')
  
  if (isExternal) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" {...props}>
        {children}
      </a>
    )
  }
  
  return (
    <NextLink href={href} {...props}>
      {children}
    </NextLink>
  )
}