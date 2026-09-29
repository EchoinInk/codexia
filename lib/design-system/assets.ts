const logoRoot = "/brand/codexia/logo";
const iconRoot = "/brand/codexia/icons";
const codierRoot = "/brand/codier";

export const codexiaAssets = {
  logo: {
    primary: `${logoRoot}/codexia-logo-primary.svg`,
    light: `${logoRoot}/codexia-logo-light.svg`,
    dark: `${logoRoot}/codexia-logo-dark.svg`,
  },
  symbol: {
    primary: `${logoRoot}/codexia-symbol-primary.svg`,
    light: `${logoRoot}/codexia-symbol-light.svg`,
    dark: `${logoRoot}/codexia-symbol-dark.svg`,
  },
  icons: {
    favicon16: `${iconRoot}/favicon-16.png`,
    favicon32: `${iconRoot}/favicon-32.png`,
    favicon48: `${iconRoot}/favicon-48.png`,
    appleTouch: `${iconRoot}/codexia-apple-touch-icon-180.png`,
    app192: `${iconRoot}/codexia-app-icon-192.png`,
    app512: `${iconRoot}/codexia-app-icon-512.png`,
    app1024: `${iconRoot}/codexia-app-icon-1024.png`,
  },
} as const;

export const codierPoses = {
  analysing: `${codierRoot}/poses/codier-analysing-with-binoculars.png`,
  buildingStack: `${codierRoot}/poses/codier-building-stack.png`,
  building: `${codierRoot}/poses/codier-building.png`,
  celebrating: `${codierRoot}/poses/codier-celebrating.png`,
  checkingResults: `${codierRoot}/poses/codier-checking-results.png`,
  coding: `${codierRoot}/poses/codier-coding.png`,
  comparingOptions: `${codierRoot}/poses/codier-comparing-options.png`,
  debugging: `${codierRoot}/poses/codier-debugging.png`,
  deploying: `${codierRoot}/poses/codier-deploying.png`,
  documenting: `${codierRoot}/poses/codier-documenting.png`,
  explaining: `${codierRoot}/poses/codier-explaining.png`,
  greeting: `${codierRoot}/poses/codier-greeting.png`,
  inspectingCode: `${codierRoot}/poses/codier-inspecting-code.png`,
  meditating: `${codierRoot}/poses/codier-meditating.png`,
  monitoringRuntime: `${codierRoot}/poses/codier-monitoring-runtime.png`,
  planningArchitecture: `${codierRoot}/poses/codier-planning-architecture.png`,
  playing: `${codierRoot}/poses/codier-playing.png`,
  readingDocs: `${codierRoot}/poses/codier-reading-docs.png`,
  restingAfterCoding: `${codierRoot}/poses/codier-resting-after-coding.png`,
  resting: `${codierRoot}/poses/codier-resting.png`,
  reviewingPullRequest: `${codierRoot}/poses/codier-reviewing-pull-request.png`,
  searching: `${codierRoot}/poses/codier-searching.png`,
  sitting: `${codierRoot}/poses/codier-sitting.png`,
  sleeping: `${codierRoot}/poses/codier-sleeping.png`,
  troubleshooting: `${codierRoot}/poses/codier-troubleshooting.png`,
  typing: `${codierRoot}/poses/codier-typing.png`,
  waving: `${codierRoot}/poses/codier-waving.png`,
  workingOnLaptop: `${codierRoot}/poses/codier-working-on-laptop.png`,
} as const;

export const codierExpressions = {
  winking: `${codierRoot}/expressions/codier-winking.png`,
} as const;

export type CodexiaLogoVariant = keyof typeof codexiaAssets.logo;
export type CodexiaSymbolVariant = keyof typeof codexiaAssets.symbol;
export type CodierPose = keyof typeof codierPoses;
