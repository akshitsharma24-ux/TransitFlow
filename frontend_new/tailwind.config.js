/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        // Indicator Board system — an industrial/signage material language,
        // not a generic light-or-dark app theme. The board is dark; the
        // structural chrome around it is a cool industrial neutral.
        ground: "#E7E9E4",       // industrial neutral (page background)
        surface: "#EFF0EB",      // panel surface
        card: "#F6F7F2",         // elevated panel
        ink: {
          DEFAULT: "#1C1B17",
          soft: "#54524A",
          muted: "#848175",
          line: "#D3D2C7",       // hairline borders on light ground
        },
        board: {
          DEFAULT: "#14120D",    // the indicator board casing
          panel: "#1C1911",      // a panel/slot on the board
          line: "#39352A",       // hairline borders on the dark board
          dot: "#3A3527",        // unlit dot-matrix cell
        },
        amber: {
          DEFAULT: "#E8A33D",    // lit dot-matrix / maintenance status
          dim: "#8A661F",
          wash: "#F6E7C9",
        },
        // Real railway signal semantics — never decorative, always paired
        // with a text label (ON TIME / BUSY / PACKED), never color alone.
        signal: {
          green: "#2E7D4F",
          "green-wash": "#DEEAE1",
          red: "#C23B2E",
          "red-wash": "#F3DEDA",
          amber: "#E8A33D",
          "amber-wash": "#F6E7C9",
        },
        // Real transit line colors (subject-accurate, not arbitrary accents)
        line: {
          western: "#2F6B4F",
          central: "#8B3A3A",
          yellow: "#C4941F",
          red: "#AF3A32",
          aqua: "#3E6491",
          bus: "#B9832E",
          road: "#8C5A3C",
          walk: "#848175",
        },
      },
      fontFamily: {
        display: ["Barlow Condensed", "Arial Narrow", "sans-serif"],
        sans: ["IBM Plex Sans", "system-ui", "sans-serif"],
        body: ["IBM Plex Sans", "system-ui", "sans-serif"],
        mono: ["IBM Plex Mono", "monospace"],
      },
      boxShadow: {
        // Flat, hard-edged — no soft/complex shadows (Brutalism-adjacent,
        // flagged explicitly as an "avoid" pairing with 3D effects).
        edge: "2px 2px 0 0 rgba(28,27,23,0.9)",
        "edge-sm": "1px 1px 0 0 rgba(28,27,23,0.85)",
      },
    },
  },
  plugins: [],
};
