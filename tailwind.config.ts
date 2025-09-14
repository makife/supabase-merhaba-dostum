import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./app/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
  ],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: '2rem',
      screens: {
        '2xl': '1400px'
      }
    },
    extend: {
      fontFamily: {
        sans: ["Inter", "sans-serif"],
        fredoka: ["Fredoka", "cursive"],
        comfortaa: ["Comfortaa", "cursive"],
        righteous: ["Righteous", "cursive"],
        bungee: ["Bungee", "cursive"],
        orbitron: ["Orbitron", "monospace"],
        "press-start": ["Press Start 2P", "cursive"],
        painter: ["Permanent Marker", "cursive"],
      },
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))'
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))'
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))'
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))'
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))'
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))'
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))'
        },
        sidebar: {
          DEFAULT: 'hsl(var(--sidebar-background))',
          foreground: 'hsl(var(--sidebar-foreground))',
          primary: 'hsl(var(--sidebar-primary))',
          'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
          accent: 'hsl(var(--sidebar-accent))',
          'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
          border: 'hsl(var(--sidebar-border))',
          ring: 'hsl(var(--sidebar-ring))'
        },
        game: {
          primary: 'hsl(var(--game-primary))',
          secondary: 'hsl(var(--game-secondary))',
          success: 'hsl(var(--game-success))',
          warning: 'hsl(var(--game-warning))',
          grid: 'hsl(var(--game-grid))',
          letter: 'hsl(var(--game-letter))'
        },
        // YENİ: Chat renklerini buraya ekle
        chat: {
          50: '#fffbeb',
          100: '#fef3c7',
          200: '#fde68a',
          300: '#fcd34d',
          400: '#fbbf24',
          500: '#f59e0b',
          600: '#d97706',
          700: '#b45309',
          800: '#92400e',
          900: '#78350f',
        }
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)'
      },
      keyframes: {
        'accordion-down': {
          from: {
            height: '0'
          },
          to: {
            height: 'var(--radix-accordion-content-height)'
          }
        },
        'accordion-up': {
          from: {
            height: 'var(--radix-accordion-content-height)'
          },
          to: {
            height: '0'
          }
        },
        // Chat animasyonları
        'pulse-slow': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.7' }
        },
        'bounce-slow': {
          '0%, 100%': {
            transform: 'translateY(0)',
            animationTimingFunction: 'cubic-bezier(0.8, 0, 1, 1)'
          },
          '50%': {
            transform: 'translateY(-25%)',
            animationTimingFunction: 'cubic-bezier(0, 0, 0.2, 1)'
          }
        },
        // 🎬 PREMIUM THEME ANIMATIONS 🎬
        'premium-glow': {
          '0%, 100%': { 
            boxShadow: '0 0 20px hsl(var(--primary) / 0.3)',
            transform: 'scale(1)'
          },
          '50%': { 
            boxShadow: '0 0 40px hsl(var(--primary) / 0.6), 0 0 60px hsl(var(--accent) / 0.3)',
            transform: 'scale(1.02)'
          }
        },
        'luxury-shimmer': {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' }
        },
        'mystical-float': {
          '0%, 100%': { 
            transform: 'translateY(0px) rotate(0deg)',
            filter: 'brightness(1)'
          },
          '33%': { 
            transform: 'translateY(-2px) rotate(0.5deg)',
            filter: 'brightness(1.1)'
          },
          '66%': { 
            transform: 'translateY(2px) rotate(-0.5deg)',
            filter: 'brightness(0.9)'
          }
        },
        'royal-pulse': {
          '0%, 100%': { 
            opacity: '1',
            transform: 'scale(1)',
            filter: 'hue-rotate(0deg)'
          },
          '50%': { 
            opacity: '0.8',
            transform: 'scale(1.05)',
            filter: 'hue-rotate(10deg)'
          }
        }
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
        // Chat animasyonları
        'pulse-slow': 'pulse-slow 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'bounce-slow': 'bounce-slow 2s infinite',
        // 🎬 PREMIUM ANIMATIONS 🎬
        'premium-glow': 'premium-glow 4s ease-in-out infinite',
        'luxury-shimmer': 'luxury-shimmer 3s ease-in-out infinite',
        'mystical-float': 'mystical-float 6s ease-in-out infinite',
        'royal-pulse': 'royal-pulse 2s ease-in-out infinite'
      }
    }
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;