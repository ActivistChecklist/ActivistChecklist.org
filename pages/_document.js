import { Html, Head, Main, NextScript } from 'next/document'

export default function Document(props) {
  const locale = props.__NEXT_DATA__?.locale || 'en';
  return (
    <Html lang={locale} suppressHydrationWarning>
      <Head />
      <body className="min-h-screen bg-background font-body antialiased">
        <Main />
        <NextScript />
      </body>
    </Html>
  )
} 