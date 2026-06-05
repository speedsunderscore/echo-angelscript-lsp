/**
 * Echo Math Helpers -- constants, matrix/vector ops, angle utilities,
 * Unreal-specific rotation helpers.
 * Source: https://echo-23.gitbook.io/angel/math/helpers
 */
export const HELPERS_AS = `
// ---------------------------------------------------------------------------
// Angle ranges
// ---------------------------------------------------------------------------

/** Target range for angle normalization. */
enum angle_range {
    /** Normalize to [-180, 180]. */
    R_180,
    /** Normalize to [0, 360]. */
    R_360
}

// ---------------------------------------------------------------------------
// math namespace
// ---------------------------------------------------------------------------

namespace math {

// -- Constants --------------------------------------------------------------

/** Pi. */
const double PI;
/** 2 * Pi. */
const double TAU;
/** 180 / Pi -- radians to degrees multiplier. */
const double RAD2DEG;
/** Pi / 180 -- degrees to radians multiplier. */
const double DEG2RAD;

// -- Matrix operations ------------------------------------------------------

/** Multiply two 4x4 matrices: a * b. */
matrix4x4 multiply_matrix(matrix4x4 a, matrix4x4 b);

/** Build a rotation matrix from euler angles around \`origin\`. */
matrix4x4 rotation_matrix(vec3 rotation, vec3 origin);

/** Rotate a point by a quaternion (x, y, z, w). */
vec3 rotated_vector(vec3 point, vec4 quaternion);

// -- Direction vectors from view angles ------------------------------------

/** Forward unit vector from (pitch, yaw) angles. */
vec3 forward_vector(vec2 angles);

/** Right unit vector from (pitch, yaw) angles. */
vec3 right_vector(vec2 angles);

/** Up unit vector from (pitch, yaw) angles. */
vec3 up_vector(vec2 angles);

// -- Angle helpers ----------------------------------------------------------

/** Convert a direction vector to (pitch, yaw) angles. */
vec2 vec_to_angles(vec3 direction);

/** Convert (pitch, yaw) angles to a direction vector. */
vec3 angles_to_vec(vec2 angles);

/** Normalize \`angle\` to the chosen range. */
double normalize_angle(double angle, angle_range range);

/** Shortest signed angular difference between \`a\` and \`b\`. */
double angle_diff(double a, double b);

/** FOV (field of view) between two sets of (pitch, yaw) angles. */
double calculate_fov(vec2 a, vec2 b);

/** Angles required to look from \`from\` at \`to\`. */
vec2 calculate_angle(vec3 from, vec3 to);

/** Clamp (pitch, yaw); pitch to [-89, 89], yaw to the chosen range. */
vec2 clamp_angles(vec2 angles, angle_range range);

/**
 * Smooth (pitch, yaw) transition with configurable speed. Automatically
 * clamps and normalizes. \`smoothing\`: 0.0 = fast, 1.0 = slow. Adjust
 * min/max speed to your thread's tick rate.
 */
vec2 smooth_angles(
    vec2 current,
    vec2 target,
    angle_range range,
    double smoothing,
    double min_speed,
    double max_speed
);

// -- Unreal helpers ---------------------------------------------------------

/**
 * Convert Unreal rotation (a, b, c) to (pitch_radians, yaw_radians).
 */
vec2 unreal_rotation_to_radians(vec3 camera_rot);

/**
 * FOV in degrees between the current rotation and a world-space target.
 * Returns 0 when looking directly at the target.
 */
double unreal_calculate_fov(vec3 camera_rot, vec3 camera_pos, vec3 target_pos);

/** Direct angle delta (degrees) to add to current rotation. */
vec2 unreal_calculate_angle(vec3 camera_rot, vec3 camera_pos, vec3 target_pos);

/**
 * Smoothed angle delta in radians to add to current rotation. \`smoothing\`:
 * 0.0 = fast, 1.0 = slow.
 */
vec2 unreal_smooth_rotation(
    vec3 camera_rot,
    vec3 camera_pos,
    vec3 target_pos,
    double smoothing,
    double min_speed,
    double max_speed
);

}
`;
