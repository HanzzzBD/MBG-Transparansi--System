/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      // === FONT ===
      fontFamily: {
        primary: ['"Plus Jakarta Sans"', '"DM Sans"', '"Noto Sans"', 'Arial', 'sans-serif'],
        sans: ['"Plus Jakarta Sans"', '"DM Sans"', 'Arial', 'sans-serif'],
      },

      // === WARNA BRAND MBG ===
      colors: {
        navy: {
          50:  '#EBF3FC',
          100: '#C8DCF4',
          200: '#96BEE8',
          300: '#5B8FD9',
          400: '#2D6BC4',
          500: '#1A52A8',
          600: '#114086',
          700: '#0D3370',
          800: '#0A2759',
          900: '#071E49',
        },
        mbg: {
          primary:   '#071E49',
          secondary: '#2D6BC4',
          accent:    '#1E90FF',
          light:     '#EBF3FC',
        },
      },

      // === BORDER RADIUS ===
      borderRadius: {
        'xs':   '4px',
        'sm':   '6px',
        'md':   '8px',
        'lg':   '12px',
        'xl':   '16px',
        '2xl':  '24px',
        'full': '9999px',
      },

      // === BOX SHADOW ===
      boxShadow: {
        'sm':   '0px 1px 3px rgba(7,30,73,0.08)',
        'md':   '0px 4px 16px rgba(7,30,73,0.12), 0px 2px 6px rgba(7,30,73,0.06)',
        'lg':   '0px 12px 40px rgba(7,30,73,0.16)',
        'xl':   '0px 24px 80px rgba(7,30,73,0.22)',
        'glow': '0px 0px 32px rgba(45,107,196,0.35)',
        'card': '0px 2px 12px rgba(7,30,73,0.08)',
      },

      // === ANIMASI ===
      keyframes: {
        fadeInUp: {
          '0%':   { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        fadeIn: {
          '0%':   { opacity: '0' },
          '100%': { opacity: '1' },
        },
        scaleIn: {
          '0%':   { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        slideInLeft: {
          '0%':   { opacity: '0', transform: 'translateX(-24px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        floatUp: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%':      { transform: 'translateY(-8px)' },
        },
        shimmer: {
          '0%':   { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
      animation: {
        'fade-in-up':   'fadeInUp 0.6s cubic-bezier(0.22,1,0.36,1) both',
        'fade-in':      'fadeIn 0.4s cubic-bezier(0.22,1,0.36,1) both',
        'scale-in':     'scaleIn 0.3s cubic-bezier(0.22,1,0.36,1) both',
        'slide-left':   'slideInLeft 0.5s cubic-bezier(0.22,1,0.36,1) both',
        'float-up':     'floatUp 3s ease-in-out infinite',
        'shimmer':      'shimmer 2s linear infinite',
        'fade-in-up-1': 'fadeInUp 0.6s cubic-bezier(0.22,1,0.36,1) 80ms both',
        'fade-in-up-2': 'fadeInUp 0.6s cubic-bezier(0.22,1,0.36,1) 160ms both',
        'fade-in-up-3': 'fadeInUp 0.6s cubic-bezier(0.22,1,0.36,1) 240ms both',
        'fade-in-up-4': 'fadeInUp 0.6s cubic-bezier(0.22,1,0.36,1) 320ms both',
      },

      // === TRANSITION TIMING ===
      transitionTimingFunction: {
        'smooth': 'cubic-bezier(0.22, 1, 0.36, 1)',
        'spring': 'cubic-bezier(0.34, 1.56, 0.64, 1)',
      },
      transitionDuration: {
        '150': '150ms',
        '250': '250ms',
        '350': '350ms',
        '600': '600ms',
      },

      // === BACKGROUND IMAGE (gradient mesh) ===
      backgroundImage: {
        'navy-mesh': `
          radial-gradient(ellipse 60% 50% at 20% 50%, rgba(45,107,196,0.25) 0%, transparent 70%),
          radial-gradient(ellipse 40% 60% at 80% 20%, rgba(17,64,134,0.30) 0%, transparent 65%),
          radial-gradient(ellipse 50% 40% at 60% 80%, rgba(26,82,168,0.15) 0%, transparent 60%)
        `,
      },
    },
  },
  plugins: [],
}
