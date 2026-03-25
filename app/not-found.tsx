'use client';
import Link from 'next/link';

export default function NotFound() {
  return (
    <div style={{ padding: '2rem', textAlign: 'center' }}>
      <h1>404 - Page Not Found</h1>
      <p><Link href="/">Return Home</Link></p>
    </div>
  );
}
