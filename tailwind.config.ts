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
        // Kusha Theme Colors
        'mint-green': '#66FFCC',
        'dark-purple': '#5B2C87',
        'darker-purple': '#3A1A5C',
      },
      fontFamily: {
        'devanagari': ['Noto Sans Devanagari', 'sans-serif'],
      },
      backgroundImage: {
        'dark-gradient': 'linear-gradient(135deg, #5B2C87 0%, #3A1A5C 100%)',
      },
      backdropBlur: {
        'md': '12px',
      },
    },
  },
  plugins: [],
}

export default config

