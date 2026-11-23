/**
 * SINGLE SOURCE OF TRUTH FOR MOBILE DESIGN TOKENS
 * 
 * Edit colors ONLY in this file to update the entire mobile app!
 * Both Tailwind (className) and TypeScript (ThemeConfig) read from here.
 * 
 * The 60-30-10 System:
 * - 60% Cloud White (#F4F5F7): App canvas, screens, inset tracks
 * - 30% Royal Cobalt (#1F3FBF): Brand primary CTAs, active pills, structure
 * - 10% Sunshine Yellow (#FFC83D): High-impact badges, alerts, beacons
 */
const content = {
  primary: "#0F172A",         // Midnight Slate headings and body
  secondary: "#475569",       // Cool Slate subtitles and metadata
  muted: "#94A3B8",           // Silver Slate placeholder and disabled text
  inverse: "#FFFFFF",         // Text on dark/primary surfaces
};

const Colors = {
  brand: {
    primary: "#1F3FBF",         // 30% Royal Cobalt
    primaryLight: "#EFF2FC",    // Soft cobalt glaze
    primaryDark: "#18329B",     // Deep cobalt for pressed states
    onPrimary: "#FFFFFF",       // Text on primary buttons
  },
  surface: {
    background: "#F4F5F7",      // 60% Cloud White app canvas
    card: "#FFFFFF",            // Clean white card surface
    border: "#E2E8F0",          // Metallic silver border
    muted: "#E9EBF0",           // Inset container surface
    elevated: "#FFFFFF",        // Modals and bottom sheets
  },
  content: content,
  text: content,                // Backward-compatible alias for ThemeConfig.text.*
  accent: {
    sunshine: "#FFC83D",        // 10% Sunshine Yellow accent
    sunshineLight: "#FFFBEB",   // Soft sunshine tint
    sunshineDark: "#B45309",    // High contrast sunshine text / border
    sunshineForeground: "#0F172A", // Dark slate text on sunshine yellow (10.5:1 AAA contrast)
  },
  status: {
    success: "#10B981",         // Emerald-500: Checked in, approved, paid
    successLight: "#ECFDF5",
    warning: "#FFC83D",         // Sunshine Yellow: Attention & pending alerts
    warningLight: "#FFFBEB",
    danger: "#EF4444",          // Rose-500: Absent, rejected, punch out
    dangerLight: "#FEF2F2",
    info: "#1F3FBF",            // Royal Cobalt: Announcements, notices
    infoLight: "#EFF2FC",
  },
  tabBar: {
    background: "rgba(255, 255, 255, 0.96)",
    border: "#E2E8F0",
    activeTint: "#1F3FBF",
    activeBackground: "#EFF2FC",
    inactiveTint: "#94A3B8",
  },
};

module.exports = Colors;
