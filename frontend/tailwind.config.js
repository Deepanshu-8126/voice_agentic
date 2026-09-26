/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      colors: {
        dark: {
          950: '#070709',
          900: '#0c0d12',
          850: '#11131a',
          800: '#161822',
          750: '#1c1f2c',
          700: '#242738',
          600: '#32374d',
        },
        accent: {
          blue: '#3b82f6',
          cyan: '#06b6d4',
          indigo: '#6366f1',
          purple: '#8b5cf6',
          fuchsia: '#d946ef',
          emerald: '#10b981',
          rose: '#f43f5e'
        }
      },
      animation: {
        'glow-pulse': 'glowPulse 3s ease-in-out infinite alternate',
        'subtle-float': 'subtleFloat 6s ease-in-out infinite alternate',
        'fade-in': 'fadeIn 0.25s ease-out forwards',
        'slide-up': 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'radar': 'radar 2s cubic-bezier(0, 0.2, 0.8, 1) infinite',
      },
      keyframes: {
        glowPulse: {
          '0%': { filter: 'drop-shadow(0 0 25px rgba(99, 102, 241, 0.35))' },
          '100%': { filter: 'drop-shadow(0 0 50px rgba(139, 92, 246, 0.65)) drop-shadow(0 0 80px rgba(6, 182, 212, 0.4))' }
        },
        subtleFloat: {
          '0%': { transform: 'translateY(0px)' },
          '100%': { transform: 'translateY(-8px)' }
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' }
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' }
        },
        radar: {
          '0%': { transform: 'scale(0.8)', opacity: '0.8' },
          '100%': { transform: 'scale(2.2)', opacity: '0' }
        }
      }
    },
  },
  plugins: [],
}
