/**
 * SubPulse design tokens, taken from the Stitch "SubPulse" design system
 * (stitch/subpulse/DESIGN.md): obsidian canvas, tonal surface tiers with 1px
 * hairline borders instead of shadows, electric-emerald accent, amber for
 * "due soon", crimson for "overdue", Hanken Grotesk headlines + Geist body.
 *
 * The Theme Customizer screen edits a ThemeSettings object; buildTheme turns
 * it into concrete colors/radii used by every component.
 */

export type PresetId = 'cyberpunk' | 'frost' | 'terminal' | 'slate';
export type AccentId = 'mint' | 'violet' | 'cobalt' | 'solar';
export type DepthId = 'flat' | 'lined' | 'raised' | 'sunken';
export type RadiusId = 'sharp' | 'tech' | 'smooth' | 'pill';

export interface ThemeSettings {
  preset: PresetId;
  accent: AccentId;
  depth: DepthId;
  radius: RadiusId;
}

export const DEFAULT_THEME_SETTINGS: ThemeSettings = { preset: 'cyberpunk', accent: 'mint', depth: 'lined', radius: 'tech' };

export const ACCENTS: Record<AccentId, { label: string; color: string; on: string }> = {
  mint: { label: 'Mint', color: '#00F59B', on: '#08090A' },
  violet: { label: 'Violet', color: '#A78BFA', on: '#0B0816' },
  cobalt: { label: 'Cobalt', color: '#4C8DFF', on: '#050A14' },
  solar: { label: 'Solar', color: '#FFB224', on: '#140C00' },
};

export const RADII: Record<RadiusId, { label: string; card: number }> = {
  sharp: { label: 'Sharp (0px)', card: 0 },
  tech: { label: 'Tech (6px)', card: 6 },
  smooth: { label: 'Smooth (12px)', card: 12 },
  pill: { label: 'Pill (24px)', card: 24 },
};

interface PresetDef {
  label: string;
  blurb: string;
  canvas: string;
  surface1: string;
  surface2: string;
  surface3: string;
  defaultAccent: AccentId;
  defaultRadius: RadiusId;
}

export const PRESETS: Record<PresetId, PresetDef> = {
  cyberpunk: {
    label: 'Cyberpunk Core',
    blurb: 'Pure OLED black, neon mint, hairline-lined blocks.',
    canvas: '#08090A',
    surface1: '#0F1115',
    surface2: '#16191F',
    surface3: '#1E2229',
    defaultAccent: 'mint',
    defaultRadius: 'tech',
  },
  frost: {
    label: 'Sleek Frost & Inset',
    blurb: 'Sunken console recess with violet glow.',
    canvas: '#0B0D12',
    surface1: '#11141B',
    surface2: '#181C25',
    surface3: '#212634',
    defaultAccent: 'violet',
    defaultRadius: 'smooth',
  },
  terminal: {
    label: 'Terminal Rigor',
    blurb: 'Zero-bevel stark lines, sharp corners, high contrast.',
    canvas: '#000000',
    surface1: '#0A0A0A',
    surface2: '#121212',
    surface3: '#1A1A1A',
    defaultAccent: 'mint',
    defaultRadius: 'sharp',
  },
  slate: {
    label: 'One UI Slate',
    blurb: 'Deep charcoal slate, smooth rounds, cobalt highlights.',
    canvas: '#121315',
    surface1: '#1B1C1D',
    surface2: '#232426',
    surface3: '#2C2D30',
    defaultAccent: 'cobalt',
    defaultRadius: 'pill',
  },
};

export const FONTS = {
  headingBold: 'HankenGrotesk_700Bold',
  heading: 'HankenGrotesk_600SemiBold',
  body: 'Geist_400Regular',
  bodyMedium: 'Geist_500Medium',
  bodySemi: 'Geist_600SemiBold',
};

export interface Theme {
  settings: ThemeSettings;
  colors: {
    canvas: string;
    surface1: string;
    surface2: string;
    surface3: string;
    border: string;
    borderStrong: string;
    divider: string;
    text: string;
    textMuted: string;
    textFaint: string;
    accent: string;
    onAccent: string;
    accentSoft: string;
    accentBorder: string;
    warning: string;
    warningSoft: string;
    danger: string;
    dangerSoft: string;
    dangerBorder: string;
  };
  radius: { card: number; control: number; chip: number };
  /** Card border width for the chosen depth style. */
  borderWidth: number;
  /** Extra elevation (Android) for "raised" depth. */
  elevation: number;
  fonts: typeof FONTS;
}

function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

export function buildTheme(settings: ThemeSettings): Theme {
  const p = PRESETS[settings.preset] ?? PRESETS.cyberpunk;
  const a = ACCENTS[settings.accent] ?? ACCENTS.mint;
  const r = RADII[settings.radius] ?? RADII.tech;
  const sunken = settings.depth === 'sunken';
  return {
    settings,
    colors: {
      canvas: p.canvas,
      surface1: sunken ? p.canvas : p.surface1,
      surface2: p.surface2,
      surface3: p.surface3,
      border: settings.depth === 'flat' ? 'transparent' : 'rgba(255,255,255,0.06)',
      borderStrong: 'rgba(255,255,255,0.12)',
      divider: 'rgba(255,255,255,0.04)',
      text: '#E3E2E3',
      textMuted: '#9AA3A0',
      textFaint: '#5F6866',
      accent: a.color,
      onAccent: a.on,
      accentSoft: hexToRgba(a.color, 0.1),
      accentBorder: hexToRgba(a.color, 0.25),
      warning: '#FFB224',
      warningSoft: 'rgba(255,178,36,0.1)',
      danger: '#FF5C5C',
      dangerSoft: 'rgba(255,92,92,0.12)',
      dangerBorder: 'rgba(255,92,92,0.4)',
    },
    radius: { card: r.card, control: Math.min(r.card, 12), chip: 999 },
    borderWidth: settings.depth === 'flat' ? 0 : 1,
    elevation: settings.depth === 'raised' ? 6 : 0,
    fonts: FONTS,
  };
}

/** Machine-readable token pack (shown/exported by the Theme Customizer, also readable by agents). */
export function themeTokenJSON(t: Theme): string {
  return JSON.stringify(
    {
      theme: `subpulse-${t.settings.preset}`,
      surfaceMode: t.settings.depth,
      borderRadius: `${t.radius.card}px`,
      accentToken: t.colors.accent,
      surfaceFill: t.colors.surface1,
      canvasTone: t.colors.canvas,
    },
    null,
    2
  );
}

export { hexToRgba };
