/**
 * Cross-cutting Echo types referenced from multiple categories.
 *
 * Math types (vec2, vec3, vec4, matrix4x4, matrix3x4, matrix3x3) live
 * under `math/`; this file holds the remaining shared types -- generic
 * color / bbox shapes used by Drawing and elsewhere.
 */
export const COMMON_AS = `
/** Screen-space bounding box returned by render::calculate_2d_bbox(). */
class bbox_2d {
    float x;
    float y;
    float width;
    float height;
    /** True if the box was successfully projected. */
    bool valid;
}

/** RGBA color (0-255 components). */
class color {
    int r;
    int g;
    int b;
    int a;
}
`;
