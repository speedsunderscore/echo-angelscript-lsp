/**
 * Echo Fonts API -- bundled font choices passed to render::update_font(),
 * plus font_hint / font_handle for user-loaded fonts via render::load_font().
 * Source: https://echo-23.gitbook.io/angel/drawing/fonts
 */
export const FONTS_AS = `
/**
 * Bundled font identifiers. Pass to render::update_font(fonts, int size).
 */
enum fonts {
    /**
     * Classic monospace pixel font. Snaps to fixed sizes: 13, 26, 39px.
     * Sizes 1-5 are treated as multipliers (1 = 13px, 2 = 26px, 3 = 39px);
     * direct values snap down to the nearest fixed size.
     */
    PROGGY,
    /** Clean, readable font. Standard pixel-size scaling. */
    TAHOMA,
    /** Pixel-perfect variant of Tahoma. Minimum size: 11. */
    TAHOMA_PX,
    /** Bold variant of Tahoma. Standard pixel-size scaling. */
    TAHOMA_BOLD,
    /** Pixel-perfect bold variant of Tahoma. Minimum size: 11. */
    TAHOMA_BOLD_PX,
    /**
     * Tiny retro pixel font. Snaps to fixed sizes: 10, 20, 30, 40px.
     * Sizes 1-6 are treated as multipliers (1 = 10px, 2 = 20px, 3 = 30px,
     * 4 = 40px); direct values snap down to the nearest fixed size.
     */
    SMALLEST_PIXEL_7,
    /**
     * Extended Unicode support for multilingual text.
     * Valid sizes: 10-14 (small), 15+ snaps to 26 (large). Max: 65.
     */
    TAHOMISH
}

/** Rendering hint passed to render::load_font(). */
enum font_hint {
    /** No hinting. */
    NONE,
    /** Pick a hinting strategy automatically (default). */
    AUTO,
    /** Hint as if the font were monospace. */
    MONO
}

/** Handle returned by render::load_font(). */
class font_handle {
    /** Internal font index. */
    int index;
}
`;
