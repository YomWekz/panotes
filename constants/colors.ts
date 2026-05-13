// Panotes Color Palette
// Primary: Amethyst Purple | Accent: Emerald Green

export const Colors = {
  // Brand
  primary: '#7C3AED',       // Amethyst Purple
  primaryLight: '#A78BFA',  // Light Purple
  primaryDark: '#5B21B6',   // Deep Purple
  primaryGlow: 'rgba(124, 58, 237, 0.15)',

  accent: '#10B981',        // Emerald Green
  accentLight: '#34D399',   // Light Emerald
  accentDark: '#059669',    // Deep Emerald
  accentGlow: 'rgba(16, 185, 129, 0.15)',

  // Background layers (dark theme)
  bg: '#0F0A1E',            // Deep dark purple-black
  bgCard: '#1A1035',        // Card background
  bgInput: '#241848',       // Input background
  bgOverlay: 'rgba(15, 10, 30, 0.85)',

  // Text
  textPrimary: '#F0EAFF',   // Near-white with purple tint
  textSecondary: '#A78BFA', // Muted purple
  textMuted: '#6B6080',     // Very muted
  textInverse: '#0F0A1E',   // Dark text (on light bg)

  // Status colors
  success: '#258F29',       // Quiz pass green
  successBg: 'rgba(37, 143, 41, 0.15)',
  warning: '#BDAD00',       // Add Details yellow
  warningBg: 'rgba(189, 173, 0, 0.15)',
  error: '#ED0000',         // Quiz fail red
  errorBg: 'rgba(237, 0, 0, 0.15)',
  info: '#3B82F6',

  // UI Elements
  border: 'rgba(124, 58, 237, 0.3)',
  borderFocus: '#7C3AED',
  separator: 'rgba(167, 139, 250, 0.1)',

  // Misc
  white: '#FFFFFF',
  black: '#000000',
  transparent: 'transparent',
} as const;

export type ColorKey = keyof typeof Colors;
