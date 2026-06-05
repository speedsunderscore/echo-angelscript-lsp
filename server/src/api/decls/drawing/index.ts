import { FONTS_AS } from './fonts';
import { RENDER_AS } from './render';
import { MENU_AS } from './menu';

/**
 * Echo "Drawing" category -- render primitives, fonts, menu UI.
 *
 * Load order matters: render references the `fonts` enum, so fonts must
 * be analyzed first.
 */
export const DRAWING_SOURCES: ReadonlyArray<readonly [string, string]> = [
  ['drawing/fonts.as',  FONTS_AS],
  ['drawing/render.as', RENDER_AS],
  ['drawing/menu.as',   MENU_AS],
];
