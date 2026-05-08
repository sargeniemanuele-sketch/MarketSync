/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#ecfeff",
          100: "#cffafe",
          500: "#06b6d4",
          600: "#0891b2",
          700: "#0e7490",
        },
      },
      boxShadow: {
        soft: "0 12px 40px -20px rgb(15 23 42 / 0.35)",
      },
    },
  },
  plugins: [],
};
