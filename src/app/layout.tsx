import './globals.css';
import { notoDevanagari } from './fonts';
import type { ReactNode } from 'react';
import ErrorBoundary from '@/components/ErrorBoundary';

export const metadata = {
  title: 'Project Dhruv Dashboard',
  description: 'Functional dashboard in Hindi (Devanagari)',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="hi" className={`bg-teal-950 ${notoDevanagari.className}`}>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body className="bg-teal-950 text-teal-50">
        <ErrorBoundary>{children}</ErrorBoundary>
      </body>
    </html>
  );
}
