import tokens from '../../brand/tokens.json';

/** Brand palette used by the SVG and HTML exporters (mirrors brand/tokens.css). */
export type ThemeName = 'light' | 'dark';
export type Palette = (typeof tokens.color)['light'];

export const PALETTES: Record<ThemeName, Palette> = tokens.color;
export const FONT_SANS = tokens.font.sans;
export const FONT_MONO = tokens.font.mono;
