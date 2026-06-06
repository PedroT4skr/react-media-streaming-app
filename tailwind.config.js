/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        stremio: {
          purple: '#8a5a99',
          light: '#a172b0',
          dark: '#684075',
        },
        netflix: {
          dark: '#141414',
          gray: '#808080',
          light: '#e5e5e5'
        }
      },
      backgroundImage: {
        'hero-vignette': 'linear-gradient(to top, #141414 0%, transparent 50%), linear-gradient(to right, rgba(20,20,20,0.8) 0%, transparent 50%)',
      },
      animation: {
        'fade-in-up': 'fadeInUp 0.5s ease-out forwards',
        'scale-hover': 'scaleHover 0.3s ease-out forwards',
      },
      keyframes: {
        fadeInUp: {
          '0%': { opacity: 0, transform: 'translateY(20px)' },
          '100%': { opacity: 1, transform: 'translateY(0)' },
        },
        scaleHover: {
          '0%': { transform: 'scale(1)' },
          '100%': { transform: 'scale(1.05)' },
        }
      }
    },
  },
  plugins: [
    require('tailwindcss-animate')
  ],
}
