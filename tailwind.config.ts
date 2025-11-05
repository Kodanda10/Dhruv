import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {},
  },
  plugins: [],
  safelist: [
    'text-mint-green',
    'bg-mint-green',
    'border-mint-green',
    'glassmorphic-card',
    'tab-glassmorphic',
    'bg-teal-950',
    'text-teal-50',
    'bg-dark-gradient',
    'text-primary'
  ],
}

export default config

