export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        canvas: "#F8F7F4",
        ink: "#111827",
        muted: "#6B7280",
        indigo: {
          brand: "#4F46E5",
        },
        emerald: {
          brand: "#10B981",
        },
        rose: {
          correction: "#F43F5E",
        },
        amber: {
          connector: "#F59E0B",
        },
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      borderRadius: {
        "2xl": "1rem",
      },
    },
  },
};
