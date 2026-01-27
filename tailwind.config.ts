import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        // Sage Green - Primary Brand Color
        sage: {
          50: '#F0F9F7',
          100: '#E8F5F2',
          200: '#D1EBE5',
          300: '#B3DDD4',
          400: '#8CCABE',
          500: '#6DB5A4',  // Primary
          600: '#5A9988',  // Primary Hover
          700: '#487A6C',  // Primary Active
          800: '#365B51',
          900: '#243D36',
        },
        // Coral Pink - Accent Color
        coral: {
          50: '#FEF7F8',
          100: '#FDEFF1',
          200: '#FBD9DF',
          300: '#F8BECB',
          400: '#F6A4B7',
          500: '#F4A5B0',
          600: '#EF7E90',
          700: '#E85A72',
          800: '#D13C5A',
          900: '#A12E45',
        },
        // Slate - Neutral (개선된 팔레트)
        slate: {
          50: '#F8FAFC',
          100: '#F1F5F9',
          200: '#E2E8F0',
          300: '#CBD5E1',
          400: '#94A3B8',
          500: '#64748B',
          600: '#475569',
          700: '#334155',
          800: '#1E293B',
          900: '#0F172A',
          950: '#020617',
        },
        // Semantic Colors
        success: {
          50: '#F0FDF4',
          100: '#DCFCE7',
          200: '#BBF7D0',
          300: '#86EFAC',
          400: '#4ADE80',
          500: '#22C55E',  // Primary Success
          600: '#16A34A',
          700: '#15803D',
          800: '#166534',
          900: '#14532D',
        },
        warning: {
          50: '#FFFBEB',
          100: '#FEF3C7',
          200: '#FDE68A',
          300: '#FCD34D',
          400: '#FBBF24',
          500: '#F59E0B',  // Primary Warning
          600: '#D97706',
          700: '#B45309',
          800: '#92400E',
          900: '#78350F',
        },
        danger: {
          50: '#FEF2F2',
          100: '#FEE2E2',
          200: '#FECACA',
          300: '#FCA5A5',
          400: '#F87171',
          500: '#EF4444',  // Primary Danger
          600: '#DC2626',
          700: '#B91C1C',
          800: '#991B1B',
          900: '#7F1D1D',
        },
        info: {
          50: '#EFF6FF',
          100: '#DBEAFE',
          200: '#BFDBFE',
          300: '#93C5FD',
          400: '#60A5FA',
          500: '#3B82F6',  // Primary Info
          600: '#2563EB',
          700: '#1D4ED8',
          800: '#1E40AF',
          900: '#1E3A8A',
        },
        // Legacy compatibility
        cream: {
          50: '#FEFEFE',
          100: '#FAFAFA',
          200: '#F5F5F5',
          300: '#F0F0F0',
          400: '#EBEBEB',
          500: '#E5E5E5',
          600: '#D9D9D9',
          700: '#BFBFBF',
          800: '#999999',
          900: '#666666',
        },
        neutral: {
          50: '#FAFAFA',
          100: '#F5F5F5',
          200: '#EFEFEF',
          300: '#DDDDDD',
          400: '#AAAAAA',
          500: '#999999',
          600: '#777777',
          700: '#666666',
          800: '#333333',
          900: '#1A1A1A',
        },
        lavender: {
          50: '#F9F6FB',
          100: '#F3EDF7',
          200: '#E9DCEF',
          300: '#DCC9E6',
          400: '#CFB5DD',
          500: '#E5D5F0',
          600: '#C4A8D6',
          700: '#A37CBC',
          800: '#7E5A9A',
          900: '#5A4070',
        },
        hotpink: {
          50: '#FFF0F3',
          100: '#FFE1E8',
          200: '#FFC3D1',
          300: '#FF9AB3',
          400: '#FF7195',
          500: '#FF6B8A',
          600: '#E6517A',
          700: '#CC3A6A',
          800: '#B32659',
          900: '#8C1D45',
        },
      },
      // Typography Scale
      fontSize: {
        'display': ['2rem', { lineHeight: '1.2', letterSpacing: '-0.02em', fontWeight: '600' }],
        'heading': ['1.5rem', { lineHeight: '1.3', letterSpacing: '-0.01em', fontWeight: '600' }],
        'subheading': ['1.125rem', { lineHeight: '1.4', fontWeight: '500' }],
        'body': ['0.875rem', { lineHeight: '1.6', fontWeight: '400' }],
        'caption': ['0.75rem', { lineHeight: '1.5', fontWeight: '400' }],
        'overline': ['0.6875rem', { lineHeight: '1.5', letterSpacing: '0.05em', fontWeight: '600' }],
      },
      // Spacing
      spacing: {
        'card': '1.5rem',  // 24px
        'section': '2rem', // 32px
      },
      // Border Radius
      borderRadius: {
        'xs': '0.25rem',   // 4px
        'sm': '0.375rem',  // 6px
        'md': '0.5rem',    // 8px
        'lg': '0.75rem',   // 12px
        'xl': '1rem',      // 16px
        '2xl': '1.5rem',   // 24px
      },
      // Background Images
      backgroundImage: {
        'sage-gradient-light': 'linear-gradient(to bottom, white, rgba(240, 249, 247, 0.2), white)',
        'sage-gradient-medium': 'linear-gradient(to bottom, rgba(240, 249, 247, 1), white, white)',
        'sage-accent-pattern': 'radial-gradient(circle at top right, rgba(109, 181, 164, 0.2), rgba(90, 153, 136, 0.1))',
      },
      // Font Family
      fontFamily: {
        sans: ['var(--font-geist-sans)', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Malgun Gothic', 'sans-serif'],
        mono: ['var(--font-geist-mono)', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
      },
      // Box Shadows
      boxShadow: {
        'xs': '0 1px 2px rgba(0, 0, 0, 0.04)',
        'sm': '0 2px 4px rgba(0, 0, 0, 0.04), 0 1px 2px rgba(0, 0, 0, 0.06)',
        'md': '0 4px 8px rgba(0, 0, 0, 0.04), 0 2px 4px rgba(0, 0, 0, 0.06)',
        'lg': '0 10px 20px rgba(0, 0, 0, 0.06), 0 4px 8px rgba(0, 0, 0, 0.04)',
        'xl': '0 20px 40px rgba(0, 0, 0, 0.08), 0 8px 16px rgba(0, 0, 0, 0.06)',
        'sage-sm': '0 2px 8px rgba(109, 181, 164, 0.08), 0 1px 2px rgba(109, 181, 164, 0.12)',
        'sage-md': '0 10px 30px rgba(109, 181, 164, 0.12), 0 4px 8px rgba(109, 181, 164, 0.08)',
        'sage-lg': '0 20px 50px rgba(109, 181, 164, 0.15), 0 8px 16px rgba(109, 181, 164, 0.10)',
        'toss': '0 2px 8px rgba(0, 0, 0, 0.04), 0 1px 2px rgba(0, 0, 0, 0.06)',
        'toss-lg': '0 10px 30px rgba(0, 0, 0, 0.06), 0 4px 8px rgba(0, 0, 0, 0.04)',
        'toss-xl': '0 20px 50px rgba(0, 0, 0, 0.08), 0 8px 16px rgba(0, 0, 0, 0.06)',
      },
      // Animations
      animation: {
        'fade-in': 'fadeIn 0.3s ease forwards',
        'fade-in-up': 'fadeInUp 0.5s ease forwards',
        'scale-in': 'scaleIn 0.3s ease forwards',
        'slide-in-left': 'slideInLeft 0.3s ease forwards',
        'slide-in-right': 'slideInRight 0.3s ease forwards',
        'slide-down': 'slideDown 0.3s ease forwards',
        'float': 'float 3s ease-in-out infinite',
        'ping': 'ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite',
        'pulse': 'pulse 2s ease-in-out infinite',
      },
      // Keyframes
      keyframes: {
        fadeIn: {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        fadeInUp: {
          from: {
            opacity: '0',
            transform: 'translateY(20px)',
          },
          to: {
            opacity: '1',
            transform: 'translateY(0)',
          },
        },
        scaleIn: {
          from: {
            opacity: '0',
            transform: 'scale(0.95)',
          },
          to: {
            opacity: '1',
            transform: 'scale(1)',
          },
        },
        slideInLeft: {
          from: {
            opacity: '0',
            transform: 'translateX(-20px)',
          },
          to: {
            opacity: '1',
            transform: 'translateX(0)',
          },
        },
        slideInRight: {
          from: {
            opacity: '0',
            transform: 'translateX(20px)',
          },
          to: {
            opacity: '1',
            transform: 'translateX(0)',
          },
        },
        slideDown: {
          from: {
            opacity: '0',
            maxHeight: '0',
            transform: 'translateY(-10px)',
          },
          to: {
            opacity: '1',
            maxHeight: '500px',
            transform: 'translateY(0)',
          },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        ping: {
          '75%, 100%': {
            transform: 'scale(1.5)',
            opacity: '0',
          },
        },
        pulse: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.5' },
        },
      },
      // Transition Duration
      transitionDuration: {
        '250': '250ms',
        '350': '350ms',
      },
      // Max Width
      maxWidth: {
        '8xl': '88rem',  // 1408px
        '9xl': '96rem',  // 1536px
      },
    },
  },
  plugins: [],
};

export default config;
