/**
 * Codexia Nebula design tokens.
 *
 * This is the product-level source of truth for Phase 9 visual semantics.
 * Tailwind consumes these values; feature components should consume semantic
 * utilities instead of redefining colours, shadows, or state treatments.
 */
export const nebulaPalette = {
  ink: "#050B1B",
  deepOrbit: "#09142B",
  orbit: "#0E1C38",
  cosmicSlate: "#172A4D",
  stellarSlate: "#526A98",
  starlight: "#F5F7FF",
  moonlight: "#C9D4F3",
  periwinkle: "#6F78F4",
  lavender: "#A78BFA",
  auroraViolet: "#7E58FF",
  ionCyan: "#35D9F2",
  cosmicBlue: "#4285F4",
  codierMagenta: "#FF63D8",
  codierPink: "#FF8FDB",
  success: "#42D6A4",
  warning: "#F6B95E",
  danger: "#FF647C",
} as const;

/** Tailwind-compatible ramps are defined here so configuration is an adapter, not another token authority. */
export const nebulaColourScales = {
  brand: {
    DEFAULT: nebulaPalette.periwinkle,
    50: "rgba(111, 120, 244, 0.08)", 100: "rgba(111, 120, 244, 0.14)", 200: "rgba(111, 120, 244, 0.24)",
    300: nebulaPalette.lavender, 400: "#8E83FA", 500: nebulaPalette.periwinkle, 600: "#626AE0",
    700: nebulaPalette.auroraViolet, 800: "#5D3ED1", 900: "#452C9E",
  },
  ink: {
    50: "rgba(82, 106, 152, 0.10)", 100: "rgba(82, 106, 152, 0.16)", 200: "rgba(82, 106, 152, 0.24)",
    300: "#6D82AC", 400: nebulaPalette.stellarSlate, 500: "#91A4CE", 600: "#AEBDE0",
    700: nebulaPalette.moonlight, 800: "#DFE6FA", 900: nebulaPalette.starlight, 950: "#FFFFFF",
  },
  surface: {
    canvas: nebulaPalette.ink, sunken: nebulaPalette.deepOrbit, DEFAULT: nebulaPalette.orbit,
    elevated: nebulaPalette.cosmicSlate, glass: "rgba(23, 42, 77, 0.72)", subtle: "rgba(14, 28, 56, 0.74)",
  },
} as const;

export const typography = {
  family: {
    sans: ["Inter", "ui-sans-serif", "system-ui", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "sans-serif"],
    mono: ["JetBrains Mono", "SFMono-Regular", "Consolas", "Liberation Mono", "monospace"],
  },
  size: {
    caption: ["0.6875rem", { lineHeight: "1rem", letterSpacing: "0.08em" }],
    label: ["0.75rem", { lineHeight: "1rem" }],
    bodySmall: ["0.8125rem", { lineHeight: "1.25rem" }],
    body: ["0.875rem", { lineHeight: "1.375rem" }],
    titleSmall: ["1rem", { lineHeight: "1.5rem" }],
    title: ["1.125rem", { lineHeight: "1.75rem", letterSpacing: "-0.02em" }],
    display: ["1.5rem", { lineHeight: "2rem", letterSpacing: "-0.025em" }],
  },
} as const;

export const spacing = {
  hairline: "0.125rem",
  compact: "0.375rem",
  control: "0.625rem",
  panel: "1rem",
  section: "1.5rem",
  workspace: "2rem",
  sidebar: "16rem",
  toolbar: "4.5rem",
} as const;

export const radii = {
  control: "0.5rem",
  button: "0.75rem",
  card: "1rem",
  panel: "1.25rem",
  shell: "1.5rem",
  pill: "9999px",
} as const;

export const borders = {
  width: { hairline: "1px", active: "1px" },
  colour: {
    subtle: "rgba(82, 106, 152, 0.24)",
    default: "rgba(82, 106, 152, 0.38)",
    active: "rgba(111, 120, 244, 0.72)",
    intelligence: "rgba(53, 217, 242, 0.58)",
  },
} as const;

export const elevation = {
  card: "0 16px 40px -24px rgba(0, 0, 0, 0.72)",
  panel: "0 24px 64px -34px rgba(0, 0, 0, 0.82)",
  floating: "0 24px 70px -26px rgba(0, 0, 0, 0.86)",
  brandGlow: "0 0 28px rgba(111, 120, 244, 0.24)",
  intelligenceGlow: "0 0 24px rgba(53, 217, 242, 0.18)",
  codierGlow: "0 0 24px rgba(255, 99, 216, 0.12)",
} as const;

export const gradients = {
  codexia: `linear-gradient(135deg, ${nebulaPalette.periwinkle}, ${nebulaPalette.auroraViolet})`,
  intelligence: `linear-gradient(135deg, ${nebulaPalette.cosmicBlue}, ${nebulaPalette.ionCyan})`,
  codier: `linear-gradient(135deg, ${nebulaPalette.auroraViolet}, ${nebulaPalette.codierMagenta})`,
  app: "radial-gradient(circle at 12% 0%, rgba(111, 120, 244, 0.16), transparent 32%), radial-gradient(circle at 88% 12%, rgba(53, 217, 242, 0.10), transparent 28%), linear-gradient(180deg, #050B1B 0%, #09142B 100%)",
  panel: "linear-gradient(145deg, rgba(23, 42, 77, 0.92), rgba(14, 28, 56, 0.94))",
  glass: "linear-gradient(145deg, rgba(23, 42, 77, 0.72), rgba(9, 20, 43, 0.78))",
  grid: "linear-gradient(rgba(82, 106, 152, 0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(82, 106, 152, 0.08) 1px, transparent 1px)",
} as const;

export const statusSemantics = {
  neutral: { accent: nebulaPalette.stellarSlate, surface: "rgba(82, 106, 152, 0.14)", text: nebulaPalette.moonlight },
  info: { accent: nebulaPalette.ionCyan, surface: "rgba(53, 217, 242, 0.12)", text: nebulaPalette.ionCyan },
  active: { accent: nebulaPalette.periwinkle, surface: "rgba(111, 120, 244, 0.14)", text: nebulaPalette.lavender },
  success: { accent: nebulaPalette.success, surface: "rgba(66, 214, 164, 0.12)", text: nebulaPalette.success },
  warning: { accent: nebulaPalette.warning, surface: "rgba(246, 185, 94, 0.12)", text: nebulaPalette.warning },
  danger: { accent: nebulaPalette.danger, surface: "rgba(255, 100, 124, 0.12)", text: nebulaPalette.danger },
} as const;

export const agentStates = {
  idle: statusSemantics.neutral,
  planning: statusSemantics.active,
  analysing: statusSemantics.info,
  executing: { accent: nebulaPalette.cosmicBlue, surface: "rgba(66, 133, 244, 0.12)", text: nebulaPalette.cosmicBlue },
  awaitingApproval: statusSemantics.warning,
  verified: statusSemantics.success,
  blocked: statusSemantics.danger,
} as const;

export const codierAccents = {
  primary: nebulaPalette.auroraViolet,
  personality: nebulaPalette.codierMagenta,
  detail: nebulaPalette.codierPink,
  intelligence: nebulaPalette.ionCyan,
  usage: "Pink and magenta are restrained Codier/personality accents, never dominant product colours.",
} as const;

export const nebulaTokens = {
  colour: nebulaPalette,
  colourScales: nebulaColourScales,
  typography,
  spacing,
  radii,
  borders,
  elevation,
  gradients,
  status: statusSemantics,
  agent: agentStates,
  codier: codierAccents,
} as const;

export type StatusSemantic = keyof typeof statusSemantics;
export type AgentState = keyof typeof agentStates;
