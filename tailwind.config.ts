import type { Config } from "tailwindcss";
import { borders, elevation, gradients, nebulaColourScales, nebulaPalette, radii, spacing, statusSemantics, typography } from "./lib/design-system/tokens";

const config = {
  content: ["./app/**/*.{js,ts,jsx,tsx,mdx}", "./components/**/*.{js,ts,jsx,tsx,mdx}", "./lib/design-system/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        nebula: nebulaPalette.ink,
        "deep-orbit": nebulaPalette.deepOrbit,
        orbit: nebulaPalette.orbit,
        "cosmic-slate": nebulaPalette.cosmicSlate,
        "stellar-slate": nebulaPalette.stellarSlate,
        starlight: nebulaPalette.starlight,
        moonlight: nebulaPalette.moonlight,
        brand: nebulaColourScales.brand,
        ink: nebulaColourScales.ink,
        surface: nebulaColourScales.surface,
        intelligence: { DEFAULT: nebulaPalette.ionCyan, execution: nebulaPalette.cosmicBlue },
        codier: { violet: nebulaPalette.auroraViolet, lavender: nebulaPalette.lavender, magenta: nebulaPalette.codierMagenta, pink: nebulaPalette.codierPink, cyan: nebulaPalette.ionCyan },
        status: Object.fromEntries(Object.entries(statusSemantics).map(([key, value]) => [key, value.accent])),
        "border-subtle": borders.colour.subtle,
        "border-default": borders.colour.default,
        "border-active": borders.colour.active,
      },
      fontFamily: { sans: [...typography.family.sans], mono: [...typography.family.mono] },
      fontSize: {
        caption: [typography.size.caption[0], { ...typography.size.caption[1] }],
        label: [typography.size.label[0], { ...typography.size.label[1] }],
        bodySmall: [typography.size.bodySmall[0], { ...typography.size.bodySmall[1] }],
        body: [typography.size.body[0], { ...typography.size.body[1] }],
        titleSmall: [typography.size.titleSmall[0], { ...typography.size.titleSmall[1] }],
        title: [typography.size.title[0], { ...typography.size.title[1] }],
        display: [typography.size.display[0], { ...typography.size.display[1] }],
      },
      spacing: { compact: spacing.compact, control: spacing.control, panel: spacing.panel, section: spacing.section, workspace: spacing.workspace, sidebar: spacing.sidebar, toolbar: spacing.toolbar },
      borderRadius: { control: radii.control, button: radii.button, card: radii.card, panel: radii.panel, shell: radii.shell },
      borderColor: { subtle: borders.colour.subtle, DEFAULT: borders.colour.default, active: borders.colour.active },
      boxShadow: {
        soft: elevation.card, card: elevation.card, panel: elevation.panel, elevated: elevation.panel, floating: elevation.floating,
        brand: elevation.brandGlow, glow: elevation.brandGlow, "glow-sm": elevation.brandGlow,
        intelligence: elevation.intelligenceGlow, codier: elevation.codierGlow,
      },
      backgroundImage: {
        "app-gradient": gradients.app, "brand-gradient": gradients.codexia, "intelligence-gradient": gradients.intelligence,
        "codier-gradient": gradients.codier, "panel-gradient": gradients.panel, "glass-gradient": gradients.glass,
        grid: gradients.grid,
      },
      backgroundSize: { grid: "32px 32px" },
      backdropBlur: { xs: "2px" },
      transitionTimingFunction: { smooth: "cubic-bezier(0.22, 1, 0.36, 1)" },
      animation: { "fade-in": "fade-in 200ms ease-out", "slide-up": "slide-up 250ms cubic-bezier(0.22, 1, 0.36, 1)", "soft-pulse": "soft-pulse 3s ease-in-out infinite", float: "float 6s ease-in-out infinite" },
      keyframes: {
        "fade-in": { from: { opacity: "0" }, to: { opacity: "1" } },
        "slide-up": { from: { opacity: "0", transform: "translateY(8px)" }, to: { opacity: "1", transform: "translateY(0)" } },
        "soft-pulse": { "0%, 100%": { opacity: "0.65" }, "50%": { opacity: "1" } },
        float: { "0%, 100%": { transform: "translateY(0)" }, "50%": { transform: "translateY(-6px)" } },
      },
    },
  },
  plugins: [],
} satisfies Config;

export default config;
