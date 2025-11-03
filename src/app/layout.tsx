import './globals.css';
import type { ReactNode } from 'react';
import { Noto_Sans_Devanagari } from 'next/font/google';

const notoSans = Noto_Sans_Devanagari({
  subsets: ['devanagari'],
  display: 'optional',
});

export const metadata = {
  title: 'Project Dhruv Dashboard',
  description: 'Functional dashboard in Hindi (Devanagari)',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="hi">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined&display=swap" rel="stylesheet" />
        <style dangerouslySetInnerHTML={{
          __html: `
            .material-symbols-outlined {
              font-variation-settings:
                'FILL' 0,
                'wght' 400,
                'GRAD' 0,
                'opsz' 24;
            }
          `
        }} />
      </head>
      <body className={notoSans.className}>{children}</body>
    </html>
  );
}
