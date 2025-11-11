import './globals.css';
import type { ReactNode } from 'react';
import Link from 'next/link';

export const metadata = {
  title: 'Project Dhruv Dashboard',
  description: 'Functional dashboard in Hindi (Devanagari)',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="hi">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body>
        <header className="bg-gray-800 text-white p-4">
          <nav className="container mx-auto flex justify-between">
            <Link href="/" className="font-bold text-lg">
              Project Dhruv
            </Link>
            <div>
              <Link href="/dashboard/analytics" className="hover:text-gray-300">
                Analytics Dashboard
              </Link>
            </div>
          </nav>
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}
