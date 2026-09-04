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
        carbon: {
          950: "#07090b",
          900: "#0b0d10",
          850: "#11141a",
          800: "#181d26",
          700: "#232a37",
          600: "#374151",
        },
        classified: {
          crimson: "#8b0000",
          crimsonDark: "#4a0000",
          amber: "#d97706",
          amberLight: "#f59e0b",
          terminal: "#22c55e",
          intelBlue: "#1a365d",
          intelBlueDark: "#0d1b2a",
        },
      },
      fontFamily: {
        mono: [
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "Monaco",
          "Consolas",
          "Liberation Mono",
          "Courier New",
          "monospace",
        ],
      },
      backgroundImage: {
        "scanline-pattern":
          "linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.25) 50%)",
      },
    },
  },
  plugins: [],
};
export default config;
