/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Brand
        navy: {
          DEFAULT: '#050505',
          light: '#151515',
          dark: '#000000',
        },
        amber: {
          DEFAULT: '#f5b942',
          light: '#ffd166',
          dark: '#b7791f',
        },
        // Surfaces
        bg: '#050505',
        surface: {
          DEFAULT: '#0d0d0d',
          elevated: '#151515',
          soft: '#1b1b1b',
        },
        // Text
        ink: {
          primary: '#ffffff',
          secondary: 'rgba(255,255,255,0.65)',
          muted: 'rgba(255,255,255,0.45)',
        },
        // Status
        success: '#22c55e',
        warning: '#f59e0b',
        error: '#ef4444',
        info: '#60a5fa',
        // Lines
        line: '#2a2a2a',
        'line-soft': 'rgba(255,255,255,0.06)',
      },
      borderRadius: {
        DEFAULT: '12px',
        sm: '10px',
        md: '14px',
        lg: '16px',
        xl: '22px',
        pill: '999px',
      },
      spacing: {
        sidebar: '240px',
        'sidebar-collapsed': '72px',
      },
      fontFamily: {
        sans: ['"DM Sans"', '"Segoe UI"', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'card-sm': '0 1px 2px rgba(0,0,0,0.35), 0 0 0 1px rgba(255,255,255,0.03)',
        'card-md': '0 12px 32px rgba(0,0,0,0.28), 0 0 0 1px rgba(255,255,255,0.04)',
        'card-lg': '0 24px 60px rgba(0,0,0,0.42), 0 0 0 1px rgba(255,255,255,0.05)',
      },
      maxWidth: {
        content: '1480px',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: 0, transform: 'translateY(8px)' },
          '100%': { opacity: 1, transform: 'translateY(0)' },
        },
        pulse: {
          '0%, 100%': { opacity: 1 },
          '50%': { opacity: 0.5 },
        },
      },
      animation: {
        'fade-in': 'fadeIn 0.4s ease forwards',
        pulse: 'pulse 1.1s infinite',
      },
    },
  },
  plugins: [],
};
