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
        brand: {
          navy: "#15324F",
          dark: "#0F2338",
          blue: "#2169A6",
          blueHover: "#1B5587",
          light: "#F4F7FA",
          surface: "#FFFFFF",
          border: "#E2E8F0",
        },
        status: {
          activeBg: "#ECFDF5",
          activeText: "#065F46",
          pendingBg: "#FFFBEB",
          pendingText: "#92400E",
          draftBg: "#F1F5F9",
          draftText: "#475569",
          rejectedBg: "#FEF2F2",
          rejectedText: "#991B1B",
          approvedBg: "#EFF6FF",
          approvedText: "#1E40AF",
        }
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "Segoe UI", "Tahoma", "Arial", "sans-serif"],
      },
    },
  },
  plugins: [],
};
export default config;
