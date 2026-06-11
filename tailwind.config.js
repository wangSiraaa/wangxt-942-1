/** @type {import('tailwindcss').Config} */

export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    container: {
      center: true,
      padding: "1rem",
    },
    extend: {
      colors: {
        clay: {
          50: "#FBF3EF",
          100: "#F6E2D7",
          200: "#EDC4AC",
          300: "#E07A5F",
          400: "#D06349",
          500: "#B84F38",
          600: "#9A3F2C",
          700: "#7C3122",
        },
        ink: {
          50: "#F4F3EE",
          100: "#E0DFD5",
          200: "#B8B6A8",
          300: "#8A8876",
          400: "#5C5A4B",
          500: "#3D405B",
          600: "#2E3147",
          700: "#202334",
        },
        cream: {
          50: "#FCFAF4",
          100: "#F8F4E6",
          200: "#F0E8CC",
          300: "#E5D7A8",
        },
        sage: {
          100: "#D9E8DE",
          300: "#81B29A",
          500: "#508968",
        },
      },
      fontFamily: {
        display: ["'Playfair Display'", "'Source Han Serif SC'", "'Noto Serif SC'", "serif"],
        sans: ["-apple-system", "BlinkMacSystemFont", "'PingFang SC'", "'Microsoft YaHei'", "'Segoe UI'", "sans-serif"],
      },
      boxShadow: {
        soft: "0 4px 20px -4px rgba(61, 64, 91, 0.12)",
        card: "0 2px 12px -2px rgba(61, 64, 91, 0.08), 0 8px 24px -8px rgba(61, 64, 91, 0.10)",
        pop: "0 12px 40px -8px rgba(61, 64, 91, 0.25)",
      },
      borderRadius: {
        xl2: "14px",
      },
      animation: {
        "fade-in": "fadeIn 0.3s ease-out",
        "scale-in": "scaleIn 0.25s cubic-bezier(0.16, 1, 0.3, 1)",
        "slide-up": "slideUp 0.3s ease-out",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        scaleIn: {
          "0%": { opacity: "0", transform: "scale(0.95)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
    },
  },
  plugins: [],
};
