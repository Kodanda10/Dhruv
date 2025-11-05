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
        'dark-gradient': 'linear-gradient(135deg, #5D3FD3 0%, #8B1A8B 100%)', /* Official theme gradient - VERBATIM */
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
          background: 'var(--card-bg)', /* Official theme card background - VERBATIM */
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
          background: 'rgba(65, 105, 225, 0.2)', /* official-active-tab with opacity */
          borderColor: 'var(--active-tab)', /* Official active tab color - VERBATIM */
        },
      })
    },
  ],
}

export default config

