import type { DashboardTheme, ThemeTypography, ThemeLayout } from "./types";

/**
 * Built-in dashboard themes.
 *
 * Each theme defines its own palette, typography, and layout so switching
 * themes produces visible changes beyond just color — fonts, density, and
 * corner-radius all shift to match the theme's personality.
 *
 * Theme names must stay in sync with the backend's
 * `_BUILTIN_DASHBOARD_THEMES` list in `hermes_cli/web_server.py`.
 */

// ---------------------------------------------------------------------------
// Shared typography / layout presets
// ---------------------------------------------------------------------------

/** Default system stack — neutral, safe fallback for every platform. */
const SYSTEM_SANS =
  'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
const SYSTEM_MONO =
  'ui-monospace, "SF Mono", "Cascadia Mono", Menlo, Consolas, monospace';

const DEFAULT_TYPOGRAPHY: ThemeTypography = {
  fontSans: SYSTEM_SANS,
  fontMono: SYSTEM_MONO,
  baseSize: "15px",
  lineHeight: "1.55",
  letterSpacing: "0",
};

const DEFAULT_LAYOUT: ThemeLayout = {
  radius: "0.5rem",
  density: "comfortable",
};

// ---------------------------------------------------------------------------
// Themes
// ---------------------------------------------------------------------------

export const defaultTheme: DashboardTheme = {
  name: "default",
  label: "Hermes Teal",
  description: "Classic dark teal — the canonical Hermes look",
  palette: {
    background: { hex: "#041c1c", alpha: 1 },
    midground: { hex: "#ffe6cb", alpha: 1 },
    foreground: { hex: "#ffffff", alpha: 0 },
    warmGlow: "rgba(255, 189, 56, 0.35)",
    noiseOpacity: 1,
  },
  typography: DEFAULT_TYPOGRAPHY,
  layout: DEFAULT_LAYOUT,
  terminalBackground: "#000000",
};

export const midnightTheme: DashboardTheme = {
  name: "midnight",
  label: "Midnight",
  description: "Deep blue-violet with cool accents",
  palette: {
    background: { hex: "#0a0a1f", alpha: 1 },
    midground: { hex: "#d4c8ff", alpha: 1 },
    foreground: { hex: "#ffffff", alpha: 0 },
    warmGlow: "rgba(167, 139, 250, 0.32)",
    noiseOpacity: 0.8,
  },
  typography: {
    ...DEFAULT_TYPOGRAPHY,
    fontSans: `"Inter", ${SYSTEM_SANS}`,
    fontMono: `"JetBrains Mono", ${SYSTEM_MONO}`,
    fontUrl:
      "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap",
    letterSpacing: "-0.005em",
  },
  layout: {
    ...DEFAULT_LAYOUT,
    radius: "0.75rem",
  },
};

export const emberTheme: DashboardTheme = {
  name: "ember",
  label: "Ember",
  description: "Warm crimson and bronze — forge vibes",
  palette: {
    background: { hex: "#1a0a06", alpha: 1 },
    midground: { hex: "#ffd8b0", alpha: 1 },
    foreground: { hex: "#ffffff", alpha: 0 },
    warmGlow: "rgba(249, 115, 22, 0.38)",
    noiseOpacity: 1,
  },
  typography: {
    ...DEFAULT_TYPOGRAPHY,
    fontSans: `"Spectral", Georgia, "Times New Roman", serif`,
    fontMono: `"IBM Plex Mono", ${SYSTEM_MONO}`,
    fontUrl:
      "https://fonts.googleapis.com/css2?family=Spectral:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;700&display=swap",
  },
  layout: {
    ...DEFAULT_LAYOUT,
    radius: "0.25rem",
  },
  colorOverrides: {
    destructive: "#c92d0f",
    warning: "#f97316",
  },
};

export const monoTheme: DashboardTheme = {
  name: "mono",
  label: "Mono",
  description: "Clean grayscale — minimal and focused",
  palette: {
    background: { hex: "#0e0e0e", alpha: 1 },
    midground: { hex: "#eaeaea", alpha: 1 },
    foreground: { hex: "#ffffff", alpha: 0 },
    warmGlow: "rgba(255, 255, 255, 0.1)",
    noiseOpacity: 0.6,
  },
  typography: {
    ...DEFAULT_TYPOGRAPHY,
    fontSans: `"IBM Plex Sans", ${SYSTEM_SANS}`,
    fontMono: `"IBM Plex Mono", ${SYSTEM_MONO}`,
    fontUrl:
      "https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap",
  },
  layout: {
    ...DEFAULT_LAYOUT,
    radius: "0",
  },
};

export const cyberpunkTheme: DashboardTheme = {
  name: "cyberpunk",
  label: "Cyberpunk",
  description: "Neon green on black — matrix terminal",
  palette: {
    background: { hex: "#040608", alpha: 1 },
    midground: { hex: "#9bffcf", alpha: 1 },
    foreground: { hex: "#ffffff", alpha: 0 },
    warmGlow: "rgba(0, 255, 136, 0.22)",
    noiseOpacity: 1.2,
  },
  typography: {
    ...DEFAULT_TYPOGRAPHY,
    fontSans: `"Share Tech Mono", "JetBrains Mono", ${SYSTEM_MONO}`,
    fontMono: `"Share Tech Mono", "JetBrains Mono", ${SYSTEM_MONO}`,
    fontUrl:
      "https://fonts.googleapis.com/css2?family=Share+Tech+Mono&family=JetBrains+Mono:wght@400;700&display=swap",
  },
  layout: {
    ...DEFAULT_LAYOUT,
    radius: "0",
  },
  colorOverrides: {
    success: "#00ff88",
    warning: "#ffd700",
    destructive: "#ff0055",
  },
};

export const roseTheme: DashboardTheme = {
  name: "rose",
  label: "Rosé",
  description: "Soft pink and warm ivory — easy on the eyes",
  palette: {
    background: { hex: "#1a0f15", alpha: 1 },
    midground: { hex: "#ffd4e1", alpha: 1 },
    foreground: { hex: "#ffffff", alpha: 0 },
    warmGlow: "rgba(249, 168, 212, 0.3)",
    noiseOpacity: 0.9,
  },
  typography: {
    ...DEFAULT_TYPOGRAPHY,
    fontSans: `"Fraunces", Georgia, serif`,
    fontMono: `"DM Mono", ${SYSTEM_MONO}`,
    fontUrl:
      "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600&family=DM+Mono:wght@400;500&display=swap",
  },
  layout: {
    ...DEFAULT_LAYOUT,
    radius: "1rem",
  },
};

/** Light mode — vivid Nous-blue accents on a cream canvas. */
export const nousBlueTheme: DashboardTheme = {
  name: "nous-blue",
  label: "Nous Blue",
  description: "Light mode — vivid Nous-blue accents on cream canvas",
  palette: {
    background: { hex: "#E8F2FD", alpha: 1 },
    midground: { hex: "#0053FD", alpha: 1 },
    foreground: { hex: "#170d02", alpha: 0 },
    warmGlow: "rgba(0, 83, 253, 0.12)",
    noiseOpacity: 0,
  },
  typography: DEFAULT_TYPOGRAPHY,
  layout: DEFAULT_LAYOUT,
  terminalBackground: "#f5f8fc",
  terminalForeground: "#170d02",
  seriesColors: {
    inputTokenAccent: "#001934",
    outputTokenAccent: "#0053fd",
  },
  swatchColors: ["#170d02", "#0053FD", "#E8F2FD"],
};

/**
 * Same look as ``defaultTheme`` but with a larger root font size, looser
 * line-height, and ``spacious`` density so every rem-based size in the
 * dashboard scales up. For users who find the default 15px UI too dense.
 */
export const defaultLargeTheme: DashboardTheme = {
  name: "default-large",
  label: "Hermes Teal (Large)",
  description: "Hermes Teal with bigger fonts and roomier spacing",
  palette: defaultTheme.palette,
  typography: {
    ...DEFAULT_TYPOGRAPHY,
    baseSize: "18px",
    lineHeight: "1.65",
  },
  layout: {
    ...DEFAULT_LAYOUT,
    density: "spacious",
  },
};

// ---------------------------------------------------------------------------
// J.A.R.V.I.S. — Cinematic AI Operating System theme
// ---------------------------------------------------------------------------

/** Cinematic JARVIS theme — Iron Man inspired.
 *
 *  Deep navy-black canvas with restrained cyan accents that fire only for
 *  active intelligence. Glass-panel surfaces, atmospheric grid/scanline
 *  overlays, breathing core animations, and state-driven CSS hooks.
 *
 *  Visual axiom: expensive and cinematic, never flashy or gaming-HUD. */
const JARVIS_CUSTOM_CSS = `
/* ── J.A.R.V.I.S. Theme Custom CSS ─────────────────────────────────── */
/* Scoped via body[data-jarvis] so nothing leaks into other themes.      */
/* ThemeProvider sets data-jarvis on <html> when this theme is active.    */

/* ── Root marker ──────────────────────────────────────────────────── */
:root { --jarvis-primary: #00E5FF; --jarvis-primary-dim: rgba(0,229,255,0.12);
  --jarvis-secondary: #75F7FF; --jarvis-surface: #0A1628;
  --jarvis-base: #02060B; --jarvis-base-mid: #061019;
  --jarvis-text: #EAFBFF; --jarvis-muted: #66808C;
  --jarvis-amber: #FF9500; --jarvis-red: #FF3B3B;
  --jarvis-grid-color: rgba(0,229,255,0.025);
  --jarvis-scanline-color: rgba(0,229,255,0.012);
  --jarvis-glow: 0 0 30px rgba(0,229,255,0.06);
}

/* ── Atmospheric background overlays ────────────────────────────── */
/* Fine technical grid */
body::before {
  content: '';
  position: fixed; inset: 0; z-index: 0;
  pointer-events: none;
  background-image:
    linear-gradient(var(--jarvis-grid-color) 1px, transparent 1px),
    linear-gradient(90deg, var(--jarvis-grid-color) 1px, transparent 1px);
  background-size: 80px 80px;
  opacity: 0.6;
  animation: jarvis-grid-drift 120s linear infinite;
}

/* Horizontal scanlines */
body::after {
  content: '';
  position: fixed; inset: 0; z-index: 0;
  pointer-events: none;
  background: repeating-linear-gradient(
    0deg,
    transparent,
    transparent 3px,
    var(--jarvis-scanline-color) 3px,
    var(--jarvis-scanline-color) 4px
  );
  opacity: 0.8;
}

/* Radial vignette */
#root::before {
  content: '';
  position: fixed; inset: 0; z-index: 0;
  pointer-events: none;
  background: radial-gradient(
    ellipse 80% 60% at 50% 50%,
    transparent 40%,
    rgba(2,6,11,0.7) 100%
  );
}

/* Bottom ambient glow */
#root::after {
  content: '';
  position: fixed; bottom: 0; left: 0; right: 0;
  height: 200px; z-index: 0;
  pointer-events: none;
  background: radial-gradient(
    ellipse 60% 100% at 50% 100%,
    rgba(0,229,255,0.035) 0%,
    transparent 70%
  );
}

@keyframes jarvis-grid-drift {
  from { background-position: 0 0, 0 0; }
  to   { background-position: 80px 80px, 80px 80px; }
}

/* ── Glass panel treatment ──────────────────────────────────────── */
/* Cards / panels */
[class*="bg-card"],
[class*="bg-popover"],
div[class*="rounded"][class*="border"][class*="bg-"] {
  backdrop-filter: blur(12px) saturate(1.2) !important;
  -webkit-backdrop-filter: blur(12px) saturate(1.2) !important;
}

/* ── Card decorations — subtle corner brackets ──────────────────── */
[class*="bg-card"]::before {
  content: '';
  position: absolute; top: 0; left: 0; right: 0;
  height: 1px;
  background: linear-gradient(
    90deg,
    transparent 0%,
    rgba(0,229,255,0.15) 20%,
    rgba(0,229,255,0.25) 50%,
    rgba(0,229,255,0.15) 80%,
    transparent 100%
  );
  pointer-events: none;
}

/* ── Sidebar thin-rail treatment ──────────────────────────────── */
#app-sidebar {
  border-right-color: rgba(0,229,255,0.06) !important;
}

/* ── Scrollbar styling ──────────────────────────────────────────── */
::-webkit-scrollbar { width: 4px; height: 4px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb {
  background: rgba(0,229,255,0.15);
  border-radius: 2px;
}
::-webkit-scrollbar-thumb:hover { background: rgba(0,229,255,0.3); }

/* ── Interactive element hover glow ─────────────────────────────── */
button:hover, a:hover,
[role="button"]:hover, [role="tab"]:hover {
  text-shadow: 0 0 8px rgba(0,229,255,0.2);
}

/* ── Active nav indicator ──────────────────────────────────────── */
nav a[aria-current="page"],
nav a.active {
  position: relative;
}
nav a[aria-current="page"]::after,
nav a.active::after {
  content: '';
  position: absolute;
  left: 0; top: 25%; bottom: 25%;
  width: 2px;
  background: var(--jarvis-primary);
  box-shadow: 0 0 6px rgba(0,229,255,0.5);
  border-radius: 1px;
}

/* ── Animated separator line ────────────────────────────────────── */
hr, [class*="border-t"], [class*="border-b"] {
  border-color: rgba(0,229,255,0.06) !important;
}

/* ── Status pulse dot ──────────────────────────────────────────── */
@keyframes jarvis-pulse {
  0%, 100% { opacity: 0.4; transform: scale(1); }
  50%      { opacity: 1;   transform: scale(1.2); }
}

/* ── JARVIS Core Breathing Animation ────────────────────────────── */
@keyframes jarvis-breathe {
  0%, 100% { box-shadow: 0 0 20px rgba(0,229,255,0.08), 0 0 60px rgba(0,229,255,0.04); }
  50%      { box-shadow: 0 0 30px rgba(0,229,255,0.15), 0 0 80px rgba(0,229,255,0.06); }
}

@keyframes jarvis-core-rotate {
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
}

@keyframes jarvis-core-pulse {
  0%, 100% { transform: scale(1); opacity: 0.6; }
  50%      { transform: scale(1.08); opacity: 1; }
}

/* State hooks — ready for future integration.
   Apply data-jarvis-state="idle|listening|thinking|searching|acting|speaking|error"
   on a container element to activate the corresponding visual state. */

[data-jarvis-state="idle"] {
  animation: jarvis-breathe 4s ease-in-out infinite;
}

[data-jarvis-state="listening"] {
  animation: jarvis-core-pulse 1.5s ease-in-out infinite;
  box-shadow: 0 0 40px rgba(0,229,255,0.2), 0 0 80px rgba(0,229,255,0.08) !important;
}

[data-jarvis-state="thinking"] {
  animation: jarvis-core-rotate 3s linear infinite;
}

[data-jarvis-state="searching"] {
  animation: jarvis-core-rotate 2s linear infinite, jarvis-core-pulse 1s ease-in-out infinite;
}

[data-jarvis-state="acting"] {
  box-shadow: 0 0 30px rgba(0,229,255,0.25), inset 0 0 20px rgba(0,229,255,0.05) !important;
}

[data-jarvis-state="speaking"] {
  animation: jarvis-core-pulse 0.8s ease-in-out infinite;
  box-shadow: 0 0 40px rgba(0,229,255,0.3) !important;
}

[data-jarvis-state="error"] {
  animation: jarvis-core-pulse 1s ease-in-out infinite;
  box-shadow: 0 0 30px rgba(255,149,0,0.2), 0 0 60px rgba(255,59,59,0.1) !important;
  border-color: rgba(255,149,0,0.3) !important;
}

/* ── Telemetry text style ──────────────────────────────────────── */
.jarvis-telemetry {
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: 0.65rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--jarvis-muted);
}

/* ── Typing reveal animation ────────────────────────────────────── */
@keyframes jarvis-type-reveal {
  from { max-width: 0; }
  to   { max-width: 100%; }
}

.jarvis-type-reveal {
  overflow: hidden;
  white-space: nowrap;
  animation: jarvis-type-reveal 1.5s steps(30) forwards;
}

/* ── Confidence bar ─────────────────────────────────────────────── */
.jarvis-confidence-bar {
  height: 2px;
  background: rgba(0,229,255,0.1);
  border-radius: 1px;
  overflow: hidden;
}
.jarvis-confidence-bar > div {
  height: 100%;
  background: linear-gradient(90deg, var(--jarvis-primary), var(--jarvis-secondary));
  box-shadow: 0 0 8px rgba(0,229,255,0.3);
  transition: width 0.6s cubic-bezier(0.23,1,0.32,1);
}

/* ── Separator sweep animation ──────────────────────────────────── */
@keyframes jarvis-sweep {
  0%   { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}

.jarvis-separator {
  height: 1px;
  background: linear-gradient(
    90deg,
    transparent 0%,
    rgba(0,229,255,0.3) 50%,
    transparent 100%
  );
  background-size: 200% 100%;
  animation: jarvis-sweep 4s ease-in-out infinite;
}

/* ── Selection highlight ────────────────────────────────────────── */
::selection {
  background: rgba(0,229,255,0.25);
  color: var(--jarvis-text);
}
::moz-selection {
  background: rgba(0,229,255,0.25);
  color: var(--jarvis-text);
}

/* ── Input focus glow ───────────────────────────────────────────── */
input:focus, textarea:focus, [contenteditable="true"]:focus {
  box-shadow: 0 0 0 1px rgba(0,229,255,0.2), 0 0 12px rgba(0,229,255,0.08) !important;
  border-color: rgba(0,229,255,0.3) !important;
}

/* ── Badge styling ──────────────────────────────────────────────── */
[class*="badge"] {
  border: 1px solid rgba(0,229,255,0.15) !important;
  background: rgba(0,229,255,0.06) !important;
  text-shadow: 0 0 4px rgba(0,229,255,0.15);
}
`;

export const jarvisTheme: DashboardTheme = {
  name: "jarvis",
  label: "J.A.R.V.I.S.",
  description: "Cinematic AI operating system — Iron Man inspired",
  palette: {
    background: { hex: "#02060B", alpha: 1 },
    midground: { hex: "#EAFBFF", alpha: 1 },
    foreground: { hex: "#ffffff", alpha: 0 },
    warmGlow: "rgba(0, 229, 255, 0.12)",
    noiseOpacity: 0,
  },
  typography: {
    fontSans: `"Rajdhani", ${SYSTEM_SANS}`,
    fontMono: `"JetBrains Mono", ${SYSTEM_MONO}`,
    fontDisplay: `"Rajdhani", ${SYSTEM_SANS}`,
    fontUrl:
      "https://fonts.googleapis.com/css2?family=Rajdhani:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap",
    baseSize: "15px",
    lineHeight: "1.55",
    letterSpacing: "0.01em",
  },
  layout: {
    radius: "0.125rem",
    density: "comfortable",
  },
  colorOverrides: {
    card: "#0A1628",
    cardForeground: "#EAFBFF",
    popover: "#0A1628",
    popoverForeground: "#EAFBFF",
    primary: "#00E5FF",
    primaryForeground: "#02060B",
    secondary: "#0D1F33",
    secondaryForeground: "#EAFBFF",
    muted: "#0D1B2A",
    mutedForeground: "#66808C",
    accent: "#0D2438",
    accentForeground: "#EAFBFF",
    destructive: "#FF3B3B",
    destructiveForeground: "#FFFFFF",
    success: "#00E676",
    warning: "#FF9500",
    border: "rgba(0,229,255,0.08)",
    input: "rgba(0,229,255,0.08)",
    ring: "#00E5FF",
  },
  componentStyles: {
    card: {
      background: "rgba(10,22,40,0.75)",
      borderColor: "rgba(0,229,255,0.06)",
      boxShadow: "0 0 30px rgba(0,229,255,0.03), inset 0 1px 0 rgba(0,229,255,0.06)",
    },
    sidebar: {
      background: "rgba(2,6,11,0.92)",
      borderColor: "rgba(0,229,255,0.06)",
    },
    header: {
      background: "rgba(2,6,11,0.85)",
      borderColor: "rgba(0,229,255,0.06)",
    },
    backdrop: {
      background: "radial-gradient(ellipse 120% 80% at 50% 120%, rgba(0,229,255,0.04) 0%, transparent 60%), #02060B",
    },
    page: {
      background: "transparent",
    },
  },
  customCSS: JARVIS_CUSTOM_CSS,
  swatchColors: ["#02060B", "#00E5FF", "#061019"],
  terminalBackground: "#02060B",
  terminalForeground: "#EAFBFF",
  seriesColors: {
    inputTokenAccent: "#00E5FF",
    outputTokenAccent: "#75F7FF",
  },
};

export const BUILTIN_THEMES: Record<string, DashboardTheme> = {
  default: defaultTheme,
  "default-large": defaultLargeTheme,
  "nous-blue": nousBlueTheme,
  midnight: midnightTheme,
  ember: emberTheme,
  mono: monoTheme,
  cyberpunk: cyberpunkTheme,
  rose: roseTheme,
  jarvis: jarvisTheme,
};
