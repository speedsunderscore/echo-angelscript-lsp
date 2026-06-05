/**
 * Echo vector types -- vec2 / vec3 / vec4.
 * Sources:
 *   https://echo-23.gitbook.io/angel/math/vector-2d
 *   https://echo-23.gitbook.io/angel/math/vector-3d
 *   https://echo-23.gitbook.io/angel/math/vector-4d
 */
export const VECTORS_AS = `
/** 2D float vector. */
class vec2 {
    float x;
    float y;

    /** Returns true if x and y are both zero. */
    bool is_empty();
    /** Magnitude (sqrt). */
    float length();
    /** Magnitude squared (no sqrt -- faster for distance comparisons). */
    float length_squared();
    /** Returns a copy with length 1. */
    vec2 normalize();
    /** Dot product. */
    float dot(vec2 other);

    /** Component-wise add. */
    vec2 add(vec2 other);
    /** Component-wise subtract. */
    vec2 subtract(vec2 other);
    /** Scale by a scalar. */
    vec2 multiply(float scalar);
    /** Euclidean distance to \`other\`. */
    float distance(vec2 other);
    /** Linear interpolation (t: 0.0 -> self, 1.0 -> other). */
    vec2 lerp(vec2 other, float t);

    /** Read two floats from \`address\` into x, y. */
    bool read_float(uint64 address);
    /** Read two doubles from \`address\` into x, y. */
    bool read_double(uint64 address);
    /** Write x, y as two floats at \`address\`. */
    bool write_float(uint64 address);
    /** Write x, y as two doubles at \`address\`. */
    bool write_double(uint64 address);
}

/** 3D float vector. */
class vec3 {
    float x;
    float y;
    float z;

    /** Returns true if x, y, z are all zero. */
    bool is_empty();
    /** Magnitude (sqrt). */
    float length();
    /** Magnitude squared (no sqrt -- faster for distance comparisons). */
    float length_squared();
    /** Returns a copy with length 1. */
    vec3 normalize();
    /** Dot product. */
    float dot(vec3 other);

    /** Component-wise add. */
    vec3 add(vec3 other);
    /** Component-wise subtract. */
    vec3 subtract(vec3 other);
    /** Scale by a scalar. */
    vec3 multiply(float scalar);
    /** Euclidean distance to \`other\`. */
    float distance(vec3 other);
    /** Linear interpolation (t: 0.0 -> self, 1.0 -> other). */
    vec3 lerp(vec3 other, float t);

    /** Read three floats from \`address\` into x, y, z. */
    bool read_float(uint64 address);
    /** Read three doubles from \`address\` into x, y, z. */
    bool read_double(uint64 address);
    /** Write x, y, z as three floats at \`address\`. */
    bool write_float(uint64 address);
    /** Write x, y, z as three doubles at \`address\`. */
    bool write_double(uint64 address);
}

/** 4D float vector (also used as a quaternion: x, y, z, w). */
class vec4 {
    float x;
    float y;
    float z;
    float w;

    /** Returns true if x, y, z, w are all zero. */
    bool is_empty();
    /** Magnitude (sqrt). */
    float length();
    /** Magnitude squared (no sqrt -- faster for distance comparisons). */
    float length_squared();
    /** Returns a copy with length 1. */
    vec4 normalize();
    /** Dot product. */
    float dot(vec4 other);

    /** Component-wise add. */
    vec4 add(vec4 other);
    /** Component-wise subtract. */
    vec4 subtract(vec4 other);
    /** Scale by a scalar. */
    vec4 multiply(float scalar);
    /** Euclidean distance to \`other\`. */
    float distance(vec4 other);
    /** Linear interpolation (t: 0.0 -> self, 1.0 -> other). */
    vec4 lerp(vec4 other, float t);

    /** Read four floats from \`address\` into x, y, z, w. */
    bool read_float(uint64 address);
    /** Read four doubles from \`address\` into x, y, z, w. */
    bool read_double(uint64 address);
    /** Write x, y, z, w as four floats at \`address\`. */
    bool write_float(uint64 address);
    /** Write x, y, z, w as four doubles at \`address\`. */
    bool write_double(uint64 address);
}
`;
