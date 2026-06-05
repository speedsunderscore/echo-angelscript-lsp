/**
 * Echo Unreal engine helpers -- view cache, world-to-screen, bone array,
 * ftransform.
 * Source: https://echo-23.gitbook.io/angel/engines/unreal-engine
 */
export const UNREAL_ENGINE_AS = `
// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Camera state for a single frame -- populated by the script. */
class f_view_info {
    /** Camera world position. */
    vec3 location;
    /** Camera rotation (pitch, yaw, roll). */
    vec3 rotation;
    /** Vertical field of view (degrees). */
    float fov;
}

/**
 * Pre-baked view state derived from f_view_info. Avoids recomputing the
 * rotation matrix and FOV per entity. Build once per frame before
 * iterating entities.
 */
class f_view_cache {}

/**
 * Wrapper around a remote bone array. Call valid() before indexing.
 * Indexable by raw bone index: \`bones[110]\`.
 */
class u_bone_array {
    /** Returns true if the bones were read successfully. */
    bool valid();
    /** Number of bones in the array. */
    uint count();
}

/**
 * Bone / component transform. \`rotation\` is a quaternion (x, y, z, w),
 * \`translation\` is world position, \`scale_3d\` is a per-axis scale.
 */
class ftransform {
    /** Quaternion rotation (x, y, z, w). */
    vec4 rotation;
    /** World position. */
    vec3 translation;
    /** Per-axis scale. */
    vec3 scale_3d;

    /** Read the transform from \`bone_address\`. */
    bool read(uint64 bone_address);

    /** Transform self from local space into world space using \`parent_transform\`. */
    vec3 transform_to_world(ftransform parent_transform);
}

// ---------------------------------------------------------------------------
// Global functions
// ---------------------------------------------------------------------------

/**
 * Build a cached view state from a f_view_info. Pass vertical_fov = true
 * for games that require the alternate FOV solution.
 */
f_view_cache build_view_cache(f_view_info camera, bool vertical_fov = false);

// ---------------------------------------------------------------------------
// unreal namespace
// ---------------------------------------------------------------------------

namespace unreal {

/**
 * Convert a 3D world position to 2D screen coordinates using a view cache.
 * Returns true on success; false if off-screen or behind the camera.
 */
bool w2s(vec3 world_pos, f_view_cache cache, vec2 &out screen_pos);

/**
 * Read bones using the skeletal mesh, with a cached fallback.
 * Returned u_bone_array may be invalid -- check valid() first.
 */
u_bone_array read_bones(
    uint64 skeletal_mesh,
    uint64 bone_array_offset,
    uint64 bone_array_cached_offset,
    uint64 component_offset
);

/**
 * Read bones using the skeletal mesh, with NO cached fallback.
 * Bones may flicker on frames where the array is being rewritten by the
 * engine. Returned u_bone_array may be invalid -- check valid() first.
 */
u_bone_array read_bones(
    uint64 skeletal_mesh,
    uint64 bone_array_offset,
    uint64 component_offset
);

}
`;
