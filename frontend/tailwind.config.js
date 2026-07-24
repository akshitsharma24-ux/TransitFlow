/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#14213D",
        paper: "#F4F6F5",
        signal: "#1F7A5C",   // Western Line (train)
        monsoon: "#2A4B8D",  // Aqua Line (underground metro)
        amber: "#E8A33D",    // bus / peak warning
        rust: "#B8461F",     // road
        gold: "#B8860B",     // Yellow Line metro
        scarlet: "#A6303A",  // Red Line metro
      },
      fontFamily: {
        display: ["Space Grotesk", "sans-serif"],
        body: ["Inter", "sans-serif"],
        mono: ["IBM Plex Mono", "monospace"],
      },
    },
  },
  plugins: [],
};
