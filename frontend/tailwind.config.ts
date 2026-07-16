import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    borderRadius: {
      none: '0',
      sm: '1px',
      DEFAULT: '2px',
      md: '3px',
      lg: '3px',
      xl: '4px',
      '2xl': '5px',
      '3xl': '6px',
      full: '9999px',
    },
    extend: {
      colors: {
        violet: {
          50: '#f3f4fd',
          100: '#e7e9fc',
          200: '#b7bdf7',
          300: '#8791f1',
          400: '#5664eb',
          500: '#2638e5',
          600: '#0e23e3',
          700: '#0b1aaa',
          800: '#071272',
          900: '#040939',
          950: '#02041b',
        },
        primary: {
          50: '#f3f4fd',
          100: '#e7e9fc',
          200: '#b7bdf7',
          300: '#8791f1',
          400: '#5664eb',
          500: '#2638e5',
          600: '#0e23e3',
          700: '#0b1aaa',
          800: '#071272',
          900: '#040939',
          950: '#02041b',
        },
      },
      animation: {
        'fade-in': 'fadeIn 0.4s ease-out both',
        'fade-in-fast': 'fadeIn 0.2s ease-out both',
        'slide-up': 'slideUp 0.4s ease-out both',
        'slide-up-sm': 'slideUpSm 0.3s ease-out both',
        'slide-down': 'slideDown 0.3s ease-out both',
        'slide-in-right': 'slideInRight 0.35s ease-out both',
        'slide-in-left': 'slideInLeft 0.35s ease-out both',
        'scale-in': 'scaleIn 0.25s ease-out both',
        'bounce-in': 'bounceIn 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55) both',
        'shake': 'shake 0.5s ease-in-out',
        'shimmer': 'shimmer 2s linear infinite',
        'progress': 'progress 1s ease-out both',
        'toast-in': 'toastIn 0.35s ease-out both',
        'toast-out': 'toastOut 0.25s ease-in both',
        'check-draw': 'checkDraw 0.4s ease-out 0.2s both',
        'float': 'float 6s ease-in-out infinite',
        'pulse-soft': 'pulseSoft 2s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(16px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        slideUpSm: {
          '0%': { transform: 'translateY(8px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        slideDown: {
          '0%': { transform: 'translateY(-8px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        slideInRight: {
          '0%': { transform: 'translateX(20px)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        slideInLeft: {
          '0%': { transform: 'translateX(-20px)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        scaleIn: {
          '0%': { transform: 'scale(0.92)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        bounceIn: {
          '0%': { transform: 'scale(0.3)', opacity: '0' },
          '50%': { transform: 'scale(1.05)' },
          '70%': { transform: 'scale(0.95)' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        shake: {
          '0%, 100%': { transform: 'translateX(0)' },
          '10%, 30%, 50%, 70%, 90%': { transform: 'translateX(-4px)' },
          '20%, 40%, 60%, 80%': { transform: 'translateX(4px)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-1000px 0' },
          '100%': { backgroundPosition: '1000px 0' },
        },
        progress: {
          '0%': { width: '0%' },
          '100%': { width: 'var(--progress-width, 100%)' },
        },
        toastIn: {
          '0%': { transform: 'translateY(-8px) scale(0.95)', opacity: '0' },
          '100%': { transform: 'translateY(0) scale(1)', opacity: '1' },
        },
        toastOut: {
          '0%': { transform: 'translateY(0) scale(1)', opacity: '1' },
          '100%': { transform: 'translateY(-8px) scale(0.95)', opacity: '0' },
        },
        checkDraw: {
          '0%': { strokeDashoffset: '24' },
          '100%': { strokeDashoffset: '0' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-8px)' },
        },
        pulseSoft: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.7' },
        },
      },
      transitionTimingFunction: {
        'bounce-out': 'cubic-bezier(0.34, 1.56, 0.64, 1)',
      },
    },
  },
  plugins: [],
};

export default config;
