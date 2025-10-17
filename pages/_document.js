import { Html, Head, Main, NextScript } from 'next/document'

export default function Document() {
  return (
    <Html lang="en-US" suppressHydrationWarning>
      <Head />
      <body className="min-h-screen bg-background font-body antialiased">
        <Main />
        <NextScript />
      </body>
    </Html>
  )
} 