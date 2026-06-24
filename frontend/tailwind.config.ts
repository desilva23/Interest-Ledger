import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        cover: "#1F3A2E",
        coverDark: "#152A20",
        parchment: "#ECE3CC",
        paper: "#F7F2E2",
        ink: "#1B2430",
        inkSoft: "#5B6270",
        gold: "#B8923D",
        goldBg: "#FBF1DD",
        rust: "#A3402E",
        sage: "#5F8567",
      },
      fontFamily: {
        display: ["Fraunces", "Georgia", "serif"],
        body: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
