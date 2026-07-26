/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // Deep Futuristic Metro Tunnel background palette
        ink: {
          950: "#0B1622", // Dominant deep tunnel navy
          900: "#101B28", // Card background navy
          850: "#152335", // Hover card background
          800: "#1B2C42", // Border stroke navy
          700: "#283E5B", // Light border stroke
        },
        metro: {
          navy: {
            950: "#0B1622",
            900: "#101B28",
            850: "#152335",
            800: "#1B2C42",
            700: "#283E5B",
          },
          cyan: {
            300: "#70E2F0",
            400: "#4DD9E8",
            500: "#3FCFE0",
            600: "#2BB5C6",
            700: "#1E8E9D",
          },
          amber: {
            300: "#F2BE6B",
            400: "#E8A94D",
            500: "#D99A3D",
            600: "#B87E2C",
          },
          platform: "#E8B23D",
          silver: "#F2F5F7",
        },
        // Exact Jewel Line palette per user requirements (UNTOUCHED)
        transit: {
          western: "#2D8B6F",
          yellow: "#C9971F",
          red: "#B33A44",
          aqua: "#3D5FA3",
          bus: "#E0A94E",
          road: "#C25B36",
          walk: "#64748b",
        },
      },
      fontFamily: {
        sans: ["Inter", "sans-serif"],
        display: ["Space Grotesk", "sans-serif"],
        body: ["Inter", "sans-serif"],
        mono: ["IBM Plex Mono", "monospace"],
      },
      boxShadow: {
        'soft-dark': '0 12px 32px -4px rgba(7, 13, 20, 0.8)',
        'glass-card': '0 8px 24px 0 rgba(7, 13, 20, 0.6)',
        'cyan-glow': '0 0 20px rgba(63, 207, 224, 0.4)',
        'amber-glow': '0 0 20px rgba(217, 154, 61, 0.35)',
      },
    },
  },
  plugins: [],
};
