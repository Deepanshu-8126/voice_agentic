/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        chatBg: {
          900: '#131314',
          800: '#1e1f20',
          700: '#282a2c',
          600: '#333538',
          sidebar: '#171717',
          main: '#212121',
          input: '#2f2f2f'
        },
        gemini: {
          blue: '#1a73e8',
          purple: '#8e44ad',
          gradientStart: '#4285f4',
          gradientEnd: '#a142f4'
        }
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'orb-glow': 'orbGlow 4s ease-in-out infinite alternate',
        'ripple': 'ripple 1.5s cubic-bezier(0, 0.2, 0.8, 1) infinite',
      },
      keyframes: {
        orbGlow: {
          '0%': { transform: 'scale(0.95)', filter: 'drop-shadow(0 0 20px rgba(66, 133, 244, 0.4))' },
          '100%': { transform: 'scale(1.05)', filter: 'drop-shadow(0 0 45px rgba(161, 66, 244, 0.7))' }
        },
        ripple: {
          '0%': { transform: 'scale(0.8)', opacity: '1' },
          '100%': { transform: 'scale(2.4)', opacity: '0' }
        }
      }
    },
  },
  plugins: [],
}
