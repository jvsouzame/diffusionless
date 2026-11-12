export const PALETTES: Record<string, string[]> = {
  Ink: ['#0d0d12', '#3b3b58', '#9a8fb5', '#f2e9e4'],
  Mono: ['#0b0b0c', '#f2f0eb'],
  Paper: ['#f4f1ea', '#c9c3b6', '#6f6a60', '#1c1b19'],
  Moss: ['#0f380f', '#306230', '#8bac0f', '#9bbc0f'],
  Ember: ['#0a0a0a', '#3d0c11', '#a4161a', '#f48c06', '#ffe8a3'],
  Ocean: ['#03045e', '#0077b6', '#00b4d8', '#90e0ef', '#caf0f8'],
  Dusk: ['#1a1423', '#3d314a', '#684756', '#96705b', '#ab8476', '#eacdc2'],
  Signal: ['#101014', '#2b2d42', '#ef233c', '#edf2f4'],
  Spectrum: ['#0b0b0c', '#3a0ca3', '#7209b7', '#f72585', '#ff9e00', '#ffd60a', '#caffbf', '#ffffff'],
}

export const PALETTE_NAMES = Object.keys(PALETTES)
export const DEFAULT_PALETTE = 'Ink'

/** Fallback for color slots a palette does not define. */
export const FALLBACK_COLORS = PALETTES.Spectrum
