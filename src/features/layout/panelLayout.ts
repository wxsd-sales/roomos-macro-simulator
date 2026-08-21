export const DESKTOP_LAYOUT_MEDIA_QUERY = "(min-width: 1160px)";
export const HORIZONTAL_RESIZER_SIZE = 18;
export const VERTICAL_RESIZER_SIZE = 18;

export const PANEL_MIN_WIDTHS = {
  files: 220,
  editor: 360,
  simulator: 560,
};

export const PANEL_DEFAULT_WIDTHS = {
  files: 280,
  simulator: 560,
};

export const PANEL_MAX_WIDTHS = {
  files: 420,
};

export const PANEL_MIN_HEIGHTS = {
  editor: 220,
  runtime: 160,
};

export const PANEL_DEFAULT_HEIGHTS = {
  runtime: 280,
};

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
