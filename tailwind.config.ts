import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: [
    "./client/index.html",
    "./client/src/**/*.{js,jsx,ts,tsx,html}",
  ],  
    theme: {
    extend: {
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      colors: {
        background: "#FFFFFF",
        foreground: "#222222",
        card: {
          DEFAULT: "#FFFFFF",
          foreground: "#222222",
        },
        popover: {
          DEFAULT: "#FFFFFF",
          foreground: "#222222",
        },
        primary: {
          DEFAULT: "#274E37",
          foreground: "#FFFFFF",
          dark: "#1E3E2B",
        },
        secondary: {
          DEFAULT: "#F7F7F7",
          foreground: "#1E3E2B",
        },
        muted: {
          DEFAULT: "#F7F7F7",
          foreground: "#666666",
        },
        accent: {
          DEFAULT: "#3A7D44",  // Replaced wine red with Vinaturel green
          foreground: "#FFFFFF",
        },
        destructive: {
          DEFAULT: "#EF4444",
          foreground: "#FFFFFF",
        },
        border: "#E5E7EB",
        input: "#E5E7EB",
        ring: "#274E37",
        chart: {
          "1": "#274E37",
          "2": "#3A7D44",
          "3": "#F59E0B",
          "4": "#8B5CF6",
          "5": "#EC4899",
        },
        sidebar: {
          DEFAULT: "#FFFFFF",
          foreground: "#222222",
          primary: "#274E37",
          "primary-foreground": "#FFFFFF",
          accent: "#F7F7F7",
          "accent-foreground": "#1E3E2B",
          border: "#E5E7EB",
          ring: "#274E37",
        },
        vinaturel: {
          detail: "#1E3E2B",
          original: "#274E37",
          highlight: "#e65b2d",
          gray: "#959998",
          light: "#F7F7F7",
          dark: "#1A3323",
        },
      },
      keyframes: {
        "accordion-down": {
          from: {
            height: "0",
          },
          to: {
            height: "var(--radix-accordion-content-height)",
          },
        },
        "accordion-up": {
          from: {
            height: "var(--radix-accordion-content-height)",
          },
          to: {
            height: "0",
          },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate"), require("@tailwindcss/typography")],
} satisfies Config;
