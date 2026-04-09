module.exports = {
  darkMode: ["class"],
  content: ["./src/**/*.{ts,tsx}"],
  plugins: [require("tailwindcss-animate")],
  theme: {
    extend: {
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "grid": "linear-gradient(to right, #80808012 1px, transparent 1px), linear-gradient(to bottom, #80808012 1px, transparent 1px)",
      },
      backgroundSize: {
        "grid": "24px 24px",
      },
    },
  },
};