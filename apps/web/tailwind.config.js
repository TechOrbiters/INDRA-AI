/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          blue: '#0F62FE',
          blueDark: '#0043CE',
        },
        ink: '#161616',
        subtle: '#525252',
        muted: '#8D8D8D',
        border: '#E0E0E0',
        surface: '#F4F4F4',
        success: '#24A148',
        warning: '#F1C21B',
        error: '#DA1E28',
        info: '#0043CE',
        ai: {
          purple: '#8A3FFC',
          purpleLight: '#EDE8FF',
        }
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        mono: ['Fira Code', 'monospace'],
      },
      spacing: {
        xs: '4px',
        sm: '8px',
        md: '16px',
        lg: '24px',
        xl: '32px',
        '2xl': '48px',
        '3xl': '64px',
      },
      borderRadius: {
        sm: '4px',
        md: '8px',
        lg: '12px',
        xl: '16px',
      },
      boxShadow: {
        xs: '0 1px 2px rgba(0,0,0,0.05)',
        sm: '0 2px 4px rgba(0,0,0,0.08)',
        md: '0 4px 12px rgba(0,0,0,0.10)',
        lg: '0 8px 24px rgba(0,0,0,0.12)',
        xl: '0 16px 48px rgba(0,0,0,0.16)',
      }
    },
  },
  plugins: [],
}
