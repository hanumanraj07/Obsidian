import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        obsidian: {
          950: "#050816",
          900: "#0f172a",
          800: "#1e293b",
          700: "#334155",
          accent: "#7c3aed"
        }
      }
    }
  },
  plugins: []
};

export default config;
