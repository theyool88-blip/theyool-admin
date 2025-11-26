import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // 법무법인 더율 - Sage Green 색상 시스템 (임신 앱 스타일)
        sage: {
          50: '#F0F9F7',
          100: '#E8F5F2',
          200: '#D1EBE5',
          300: '#B3DDD4',
          400: '#8CCABE',
          500: '#6DB5A4',  // Primary Sage Green (메인 브랜드 컬러)
          600: '#5A9988',
          700: '#487A6C',
          800: '#365B51',
          900: '#243D36',
        },
        coral: {
          50: '#FEF7F8',
          100: '#FDEFF1',
          200: '#FBD9DF',
          300: '#F8BECB',
          400: '#F6A4B7',
          500: '#F4A5B0',  // Accent Coral Pink
          600: '#EF7E90',
          700: '#E85A72',
          800: '#D13C5A',
          900: '#A12E45',
        },
        cream: {
          50: '#FEFEFE',
          100: '#FAFAFA',  // Main background
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
          500: '#999999',  // Secondary text
          600: '#777777',
          700: '#666666',
          800: '#333333',  // Primary text
          900: '#1A1A1A',
        },
        lavender: {
          50: '#F9F6FB',
          100: '#F3EDF7',
          200: '#E9DCEF',
          300: '#DCC9E6',
          400: '#CFB5DD',
          500: '#E5D5F0',  // Soft Lavender
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
          500: '#FF6B8A',  // HOT PICK badge
          600: '#E6517A',
          700: '#CC3A6A',
          800: '#B32659',
          900: '#8C1D45',
        },
      },
      backgroundImage: {
        'sage-gradient-light': 'linear-gradient(to bottom, white, rgba(240, 249, 247, 0.2), white)',
        'sage-gradient-medium': 'linear-gradient(to bottom, rgba(240, 249, 247, 1), white, white)',
        'sage-accent-pattern': 'radial-gradient(circle at top right, rgba(109, 181, 164, 0.2), rgba(90, 153, 136, 0.1))',
      },
      fontFamily: {
        sans: ['var(--font-geist-sans)', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Malgun Gothic', 'sans-serif'],
        mono: ['var(--font-geist-mono)', 'monospace'],
      },
      boxShadow: {
        'sage-sm': '0 2px 8px rgba(109, 181, 164, 0.08), 0 1px 2px rgba(109, 181, 164, 0.12)',
        'sage-md': '0 10px 30px rgba(109, 181, 164, 0.12), 0 4px 8px rgba(109, 181, 164, 0.08)',
        'sage-lg': '0 20px 50px rgba(109, 181, 164, 0.15), 0 8px 16px rgba(109, 181, 164, 0.10)',
        'toss': '0 2px 8px rgba(0, 0, 0, 0.04), 0 1px 2px rgba(0, 0, 0, 0.06)',
        'toss-lg': '0 10px 30px rgba(0, 0, 0, 0.06), 0 4px 8px rgba(0, 0, 0, 0.04)',
        'toss-xl': '0 20px 50px rgba(0, 0, 0, 0.08), 0 8px 16px rgba(0, 0, 0, 0.06)',
      },
      animation: {
        'fade-in-up': 'fadeInUp 0.8s ease-out forwards',
        'fade-in': 'fadeIn 0.8s ease-out forwards',
        'slide-in-left': 'slideInLeft 0.8s ease-out forwards',
        'slide-in-right': 'slideInRight 0.8s ease-out forwards',
        'scale-in': 'scaleIn 0.6s ease-out forwards',
        'ping': 'ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite',
        'float': 'float 3s ease-in-out infinite',
      },
      keyframes: {
        fadeInUp: {
          from: {
            opacity: '0',
            transform: 'translateY(40px)',
          },
          to: {
            opacity: '1',
            transform: 'translateY(0)',
          },
        },
        fadeIn: {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        slideInLeft: {
          from: {
            opacity: '0',
            transform: 'translateX(-40px)',
          },
          to: {
            opacity: '1',
            transform: 'translateX(0)',
          },
        },
        slideInRight: {
          from: {
            opacity: '0',
            transform: 'translateX(40px)',
          },
          to: {
            opacity: '1',
            transform: 'translateX(0)',
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
        ping: {
          '75%, 100%': {
            transform: 'scale(1.5)',
            opacity: '0',
          },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-10px)' },
        },
      },
    },
  },
  plugins: [],
};

export default config;
