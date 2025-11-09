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
        'mint-green': '#8BF5E6',
        'teal-950': '#042f2e',
        /* Official Theme Colors - VERBATIM */
        'official-purple': '#5D3FD3',
        'official-dark-purple': '#8B1A8B',
        'official-card-bg': 'rgba(177, 156, 217, 0.7)',
        'official-nav-bg': '#D8BFD8',
        'official-text-primary': '#FFFFFF',
        'official-approved': '#32CD32',
        'official-pending': '#FFD700',
        'official-rejected': '#FF4500',
        'official-warning': '#FF4500',
        'official-active-tab': '#4169E1',
      },
      backgroundImage: {
        'dark-gradient': 'linear-gradient(135deg, #5C47D4 0%, #7D4BCE 50%, #8F6FE8 100%)', /* Unified cool purple-lavender gradient */
      },
    },
  },
  plugins: [
    function({ addUtilities }: any) {
      addUtilities({
        '.text-mint-green': {
          color: '#8BF5E6',
        },
        '.bg-mint-green': {
          backgroundColor: '#8BF5E6',
        },
        '.border-mint-green': {
          borderColor: '#8BF5E6',
        },
        '.glassmorphic-card': {
          background: 'rgba(120, 90, 210, 0.25)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          border: '1px solid rgba(200, 220, 255, 0.25)',
          borderRadius: '1rem',
          padding: '1.5rem',
          boxShadow: '0 0 25px rgba(180, 255, 250, 0.2)',
        },
        '.tab-glassmorphic': {
          background: 'rgba(255, 255, 255, 0.1)',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          transition: 'all 0.3s ease',
        },
        '.tab-glassmorphic.active': {
          background: 'rgba(255, 255, 255, 0.05)',
          borderColor: '#8FFAE8',
          borderWidth: '2px',
          boxShadow: '0 0 15px rgba(143, 250, 232, 0.3)',
        },
      })
    },
  ],
}

export default config

