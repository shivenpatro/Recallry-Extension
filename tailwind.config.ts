import type { Config } from 'tailwindcss';

export default {
  content: ['./popup.html', './dashboard.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'Segoe UI', 'sans-serif'],
        display: ['Fraunces', 'Georgia', 'Times New Roman', 'serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'monospace']
      },
      colors: {
        paper: '#f4efe6',
        'paper-soft': '#fbf8f1',
        ink: '#1a1714',
        'ink-soft': '#3d3631',
        vermillion: '#e63946',
        'vermillion-deep': '#c1121f',
        slate: {
          mist: '#a8a29e',
          rule: '#d6cdc0'
        }
      },
      boxShadow: {
        editorial: '6px 6px 0 0 #1a1714',
        'editorial-sm': '3px 3px 0 0 #1a1714',
        'editorial-vermillion': '6px 6px 0 0 #e63946'
      },
      letterSpacing: {
        tightest: '-0.04em'
      },
      backgroundImage: {
        'linkscape-radial':
          'radial-gradient(circle at 20% 10%, rgba(102,231,255,0.22), transparent 28%), radial-gradient(circle at 86% 0%, rgba(255,111,145,0.18), transparent 24%), linear-gradient(135deg, #090b10 0%, #111827 48%, #10111d 100%)'
      }
    }
  },
  plugins: []
} satisfies Config;
