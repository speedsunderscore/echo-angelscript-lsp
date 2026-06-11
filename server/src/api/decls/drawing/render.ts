/**
 * Echo Render API -- viewport, images, text, primitives, polygons.
 * Source: https://echo-23.gitbook.io/angel/drawing/render
 */
export const RENDER_AS = `
// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Opaque image handle returned by render::load_image(). */
class image {}

/**
 * Box drawing style for render::draw_box.
 * Accessed like \`box_style::OUTLINED\`.
 */
enum box_style {
    /** Simple outline. */
    NORMAL,
    /** Outlined box. */
    OUTLINED,
    /** Filled box. */
    FILLED,
    /** Filled with outline. */
    FILLED_OUTLINED,
    /** Cornered (corners only, not full outline). */
    CORNERED,
    /** Cornered + filled. */
    CORNERED_FILLED
}

// ---------------------------------------------------------------------------
// render namespace
// ---------------------------------------------------------------------------

namespace render {

// -- General ----------------------------------------------------------------

/** Get viewport size as a vec2. Callable from any context. */
vec2 get_viewport_size();

/** Get viewport size as output parameters. Callable from any context. */
bool get_viewport_size(int &out width, int &out height);

/**
 * Enable or disable anti-aliasing for the current frame.
 * Can be toggled on/off between drawing calls freely.
 */
void set_anti_aliasing(bool enabled);

/** Overlay framerate (frames per second). Callable from any context. */
float get_fps();

/** Overlay frametime (milliseconds per frame). Callable from any context. */
float get_frametime();

/**
 * True when the overlay is currently visible on-screen.
 * Callable from any context.
 */
bool is_foreground();

// -- Images -----------------------------------------------------------------

/**
 * Load an image from raw bytes (PNG/JPG/etc).
 * Callable from any context.
 */
bool load_image(string data, image &out obj);

/** Draw an image at (x, y) with size (w, h). Render thread only. */
void draw_image(image obj, int x, int y, int w, int h);

/** Draw an image tinted by (r, g, b, a). Render thread only. */
void draw_image(image obj, int x, int y, int w, int h, int r, int g, int b, int a);

// -- Text -------------------------------------------------------------------

/** Update the active font and size. */
void update_font(fonts font, int size);

/**
 * Measure the rendered size of \`text\` with the current font.
 * Returns a vec2 with .x = width, .y = height.
 */
vec2 calculate_text_size(string text);

/** Draw plain text. */
void draw_text(int x, int y, string text, int r, int g, int b, int a);

/** Draw text with a 1px outline. */
void draw_text_outlined(int x, int y, string text, int r, int g, int b, int a);

/** Draw text with a drop shadow (1px down, 1px right). */
void draw_text_shadow(int x, int y, string text, int r, int g, int b, int a);

// -- Rectangles -------------------------------------------------------------

/**
 * Draw a box with the given style.
 * For cornered styles, \`rounding\` acts as corner_ratio (0.05 - 0.45) and
 * controls how much of each edge the corner lines cover.
 */
void draw_box(int x, int y, int width, int height,
              int r, int g, int b, int a,
              box_style style, float rounding);

/** Draw a gradient box (vertical when \`horizontal\` is false). */
void draw_gradient_box(int x, int y, int width, int height,
                       int r1, int g1, int b1, int a1,
                       int r2, int g2, int b2, int a2,
                       bool horizontal);

/**
 * Project a 3D bounding box to 2D screen space.
 * Returns a bbox_2d with x, y, width, height, valid.
 */
bbox_2d calculate_2d_bbox(vec3 origin, vec3 mins, vec3 maxs, matrix4x4 view_matrix);

/**
 * Project a 3D bounding box to 2D screen space using the Unity coordinate
 * system (left-handed, Y-up, Z-forward, X-right). Takes center + extents
 * (half-sizes) rather than mins/maxs.
 */
bbox_2d calculate_2d_bbox_unity(vec3 origin, vec3 center, vec3 extents, matrix4x4 view_matrix);

// -- Lines ------------------------------------------------------------------

/** Draw a 1px line. */
void draw_line(float x1, float y1, float x2, float y2, int r, int g, int b, int a);

/** Draw a line with custom thickness. */
void draw_line(float x1, float y1, float x2, float y2, int r, int g, int b, int a, float thickness);

/** Draw a line with a contrasting outline. */
void draw_line_outlined(float x1, float y1, float x2, float y2, int r, int g, int b, int a, float thickness);

// -- Circles ----------------------------------------------------------------

/** Draw a circle. */
void draw_circle(float x, float y, float radius, int r, int g, int b, int a);

/** Draw a circle with fill and segment-count controls. */
void draw_circle(float x, float y, float radius, int r, int g, int b, int a, bool filled, int segments);

// -- Triangles --------------------------------------------------------------

/** Draw a triangle. */
void draw_triangle(float x1, float y1, float x2, float y2, float x3, float y3, int r, int g, int b, int a);

/** Draw a triangle, filled or outlined. */
void draw_triangle(float x1, float y1, float x2, float y2, float x3, float y3, int r, int g, int b, int a, bool filled);

// -- Polygons ---------------------------------------------------------------

/** Draw a filled concave polygon. */
void draw_concave_poly(array<vec2> points, int r, int g, int b, int a);

/** Draw a convex polygon, filled or outlined. */
void draw_convex_poly(array<vec2> points, int r, int g, int b, int a, bool filled);

/** Draw a polyline (open or closed path). */
void draw_polyline(array<vec2> points, int r, int g, int b, int a, float thickness, bool closed);

// -- Hue bar ----------------------------------------------------------------

/** Animated hue bar that follows the menu animation. */
void draw_hue_bar(int x, int y, int w, int h, int r, int g, int b, int a);

/** Static (non-animated) hue bar. */
void draw_hue_bar_static(int x, int y, int w, int h, int r, int g, int b, int a);

}
`;
