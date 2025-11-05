import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        'mint-green': '#66FFCC',
        'teal-950': '#042f2e',
      },
      backgroundImage: {
        'dark-gradient': 'linear-gradient(180deg, rgba(91, 44, 135, 0.9), rgba(58, 26, 92, 0.8))',
      },
    },
  },
  plugins: [
    function({ addUtilities }: any) {
      addUtilities({
        '.text-mint-green': {
          color: '#66FFCC',
        },
        '.bg-mint-green': {
          backgroundColor: '#66FFCC',
        },
        '.border-mint-green': {
          borderColor: '#66FFCC',
        },
        '.glassmorphic-card': {
          background: 'rgba(60, 30, 100, 0.7)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          borderRadius: '0.75rem',
          padding: '1.5rem',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
        },
        '.tab-glassmorphic': {
          background: 'rgba(255, 255, 255, 0.1)',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          transition: 'all 0.3s ease',
        },
        '.tab-glassmorphic.active': {
          background: 'rgba(102, 255, 204, 0.2)',
          borderColor: 'rgba(102, 255, 204, 0.4)',
        },
      })
    },
  ],
}

export default config

