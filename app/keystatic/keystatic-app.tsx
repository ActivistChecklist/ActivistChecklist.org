'use client';

import { KeystaticApp } from '@keystatic/next/ui/app';
import keystaticConfig from '../../keystatic.config';

export default function App() {
  return <KeystaticApp config={keystaticConfig} />;
}
