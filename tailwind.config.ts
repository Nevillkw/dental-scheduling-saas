import type { Config } from "tailwindcss";

/**
 * Minimalist neutral theme: white surfaces, near-black text (#0a0a0a),
 * thin neutral-gray borders, subtly rounded form controls, flat (no shadows).
 */
const config: Config = {
  darkMode: ["class"],
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        border: "hsl(0 0% 90%)", // neutral-200
        input: "hsl(0 0% 83%)", // neutral-300
        ring: "hsl(0 0% 9%)", // neutral-900
        background: "hsl(0 0% 100%)",
        foreground: "hsl(0 0% 4%)", // ~#0a0a0a
        primary: {
          DEFAULT: "hsl(0 0% 9%)", // neutral-900
          foreground: "hsl(0 0% 98%)", // neutral-50
        },
        secondary: {
          DEFAULT: "hsl(0 0% 96%)", // neutral-100
          foreground: "hsl(0 0% 9%)",
        },
        muted: {
          DEFAULT: "hsl(0 0% 96%)", // neutral-100
          foreground: "hsl(0 0% 45%)", // neutral-500
        },
        destructive: {
          DEFAULT: "hsl(0 0% 96%)", // subtle, not alarming
          foreground: "hsl(0 0% 35%)", // neutral-600/700
        },
      },
      boxShadow: {
        // Flat theme: brutalist shadows neutralized so existing usages render nothing.
        brutal: "none",
        "brutal-sm": "none",
      },
      fontFamily: {
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
