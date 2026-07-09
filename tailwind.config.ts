import type { Config } from "tailwindcss";

export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#422AFB",
          50: "#EFEEFF",
          100: "#E0DEFF",
          500: "#422AFB",
          600: "#3311DB",
          700: "#2200AC",
        },
        ink: {
          900: "#1B2559",
          700: "#2B3674",
          500: "#707EAE",
          400: "#A3AED0",
        },
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      boxShadow: {
        soft: "0 4px 30px rgba(112, 144, 176, 0.08)",
        card: "0 18px 40px rgba(112, 144, 176, 0.12)",
      },
      borderRadius: {
        xl2: "1.25rem",
      },
    },
  },
  plugins: [],
} satisfies Config;
