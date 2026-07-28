import type { Config } from "tailwindcss";

const config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],

  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#422AFB",
          50: "#F4F2FF",
          100: "#E9E5FF",
          200: "#D8D0FF",
          300: "#BFAFFF",
          400: "#957BFF",
          500: "#6C4DFF",
          600: "#422AFB",
          700: "#3311DB",
          800: "#270DB0",
          900: "#210E8A",
        },

        ink: {
          50: "#F7F8FC",
          100: "#EEF0F8",
          200: "#DDE1EF",
          300: "#C5CCE1",
          400: "#A3AED0",
          500: "#707EAE",
          600: "#4D5B8C",
          700: "#2B3674",
          800: "#222D63",
          900: "#1B2559",
          950: "#11183D",
        },

        surface: {
          canvas: "#F4F7FE",
          elevated: "#FFFFFF",
          muted: "#F8F9FD",
          glass: "rgba(255, 255, 255, 0.72)",
          subtle: "rgba(255, 255, 255, 0.48)",
        },

        codier: {
          violet: "#8B6CFF",
          lilac: "#C4B5FD",
          pink: "#F5A9D0",
          sky: "#8DD5FF",
          teal: "#64DCCB",
        },
      },

      fontFamily: {
        sans: [
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "sans-serif",
        ],
        mono: [
          "JetBrains Mono",
          "SFMono-Regular",
          "Consolas",
          "Liberation Mono",
          "monospace",
        ],
      },

      boxShadow: {
        soft: "0 4px 30px rgba(112, 144, 176, 0.08)",
        card: "0 18px 40px rgba(112, 144, 176, 0.12)",
        panel: "0 20px 60px -30px rgba(43, 54, 116, 0.32)",
        elevated: "0 24px 70px -32px rgba(50, 56, 100, 0.35)",
        floating: "0 16px 40px -18px rgba(43, 54, 116, 0.28)",
        brand: "0 12px 30px -12px rgba(66, 42, 251, 0.42)",
        glow: "0 0 40px rgba(139, 108, 255, 0.2)",
        "glow-sm": "0 0 18px rgba(139, 108, 255, 0.18)",
        inset:
          "inset 0 1px 0 rgba(255, 255, 255, 0.85), inset 0 0 0 1px rgba(255, 255, 255, 0.35)",
      },

      borderRadius: {
        xl2: "1.25rem",
        panel: "1.5rem",
        card: "1.125rem",
      },

      backgroundImage: {
        "app-gradient":
          "radial-gradient(circle at 10% 0%, rgba(196, 181, 253, 0.24), transparent 34%), radial-gradient(circle at 92% 15%, rgba(141, 213, 255, 0.22), transparent 32%), radial-gradient(circle at 55% 100%, rgba(245, 169, 208, 0.18), transparent 36%), linear-gradient(180deg, #F8F9FF 0%, #F2F5FC 100%)",

        "brand-gradient":
          "linear-gradient(135deg, #422AFB 0%, #8B6CFF 55%, #BFAFFF 100%)",

        "soft-gradient":
          "linear-gradient(135deg, rgba(244, 242, 255, 0.96), rgba(238, 248, 255, 0.92))",

        "panel-gradient":
          "linear-gradient(145deg, rgba(255, 255, 255, 0.92), rgba(248, 249, 253, 0.78))",

        "codier-gradient":
          "linear-gradient(135deg, rgba(139, 108, 255, 0.18), rgba(245, 169, 208, 0.14) 50%, rgba(141, 213, 255, 0.16))",

        grid:
          "linear-gradient(rgba(43, 54, 116, 0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(43, 54, 116, 0.04) 1px, transparent 1px)",
      },

      backgroundSize: {
        grid: "32px 32px",
      },

      backdropBlur: {
        xs: "2px",
      },

      transitionTimingFunction: {
        smooth: "cubic-bezier(0.22, 1, 0.36, 1)",
      },

      animation: {
        "fade-in": "fade-in 200ms ease-out",
        "slide-up": "slide-up 250ms cubic-bezier(0.22, 1, 0.36, 1)",
        "soft-pulse": "soft-pulse 3s ease-in-out infinite",
        float: "float 6s ease-in-out infinite",
      },

      keyframes: {
        "fade-in": {
          from: {
            opacity: "0",
          },
          to: {
            opacity: "1",
          },
        },

        "slide-up": {
          from: {
            opacity: "0",
            transform: "translateY(8px)",
          },
          to: {
            opacity: "1",
            transform: "translateY(0)",
          },
        },

        "soft-pulse": {
          "0%, 100%": {
            opacity: "0.65",
          },
          "50%": {
            opacity: "1",
          },
        },

        float: {
          "0%, 100%": {
            transform: "translateY(0)",
          },
          "50%": {
            transform: "translateY(-6px)",
          },
        },
      },
    },
  },

  plugins: [],
} satisfies Config;

export default config;