const Colors = require("./src/constants/colors");

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/app/**/*.{js,jsx,ts,tsx}",
    "./src/components/**/*.{js,jsx,ts,tsx}",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        brand: {
          primary: Colors.brand.primary,
          "primary-light": Colors.brand.primaryLight,
          "primary-dark": Colors.brand.primaryDark,
          "on-primary": Colors.brand.onPrimary,
        },
        surface: {
          background: Colors.surface.background,
          card: Colors.surface.card,
          border: Colors.surface.border,
          muted: Colors.surface.muted,
          elevated: Colors.surface.elevated,
        },
        content: {
          primary: Colors.content.primary,
          secondary: Colors.content.secondary,
          muted: Colors.content.muted,
          inverse: Colors.content.inverse,
        },
        accent: {
          sunshine: Colors.accent.sunshine,
          "sunshine-light": Colors.accent.sunshineLight,
          "sunshine-dark": Colors.accent.sunshineDark,
          "sunshine-foreground": Colors.accent.sunshineForeground,
        },
        status: {
          success: Colors.status.success,
          "success-light": Colors.status.successLight,
          warning: Colors.status.warning,
          "warning-light": Colors.status.warningLight,
          danger: Colors.status.danger,
          "danger-light": Colors.status.dangerLight,
          info: Colors.status.info,
          "info-light": Colors.status.infoLight,
        },
      },
    },
  },
  plugins: [],
};
