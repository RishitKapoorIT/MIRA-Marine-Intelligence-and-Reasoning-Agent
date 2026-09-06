/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        'orca-bg':        '#0A0C0F',
        'orca-surface':   '#131A22',
        'orca-surface-2': '#1C2730',
        'orca-teal':      '#30E8B8',
        'orca-danger':    '#EF4444',
        'orca-warning':   '#F97316',
        'orca-route':     '#38BDF8',
        'orca-muted':     '#8A9BAE',
        'orca-border':    '#1E2D3D',
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
      letterSpacing: {
        'micro': '0.12em',
      },
    },
  },
  plugins: [],
};
