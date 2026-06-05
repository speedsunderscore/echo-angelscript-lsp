/**
 * Echo Source / Source 2 engine helpers -- world-to-screen, entity list
 * traversal.
 * Source: https://echo-23.gitbook.io/angel/engines/source-engine
 */
export const SOURCE_AS = `
// ---------------------------------------------------------------------------
// Source engine (CS:GO / TF2 / etc.)
// ---------------------------------------------------------------------------

namespace source {

/**
 * Convert a 3D world position to 2D screen coordinates.
 * Returns true on success; false if off-screen or behind the camera.
 */
bool w2s(vec3 world_pos, matrix4x4 view_matrix, vec2 &out screen_pos);

/** Retrieve an entity address by index from the entity list. Returns 0 if invalid. */
uint64 get_entity(uint64 entity_list_address, uint64 index);

}

// ---------------------------------------------------------------------------
// Source 2 engine (CS2 / Deadlock / Dota / etc.)
// ---------------------------------------------------------------------------

namespace source2 {

/**
 * Convert a 3D world position to 2D screen coordinates.
 * Returns true on success; false if off-screen or behind the camera.
 */
bool w2s(vec3 world_pos, matrix4x4 view_matrix, vec2 &out screen_pos);

/** Retrieve a controller address by index from the entity list. Returns 0 if invalid. */
uint64 get_controller(uint64 entity_list_address, uint64 index);

/** Retrieve a pawn address from a controller. Returns 0 if invalid. */
uint64 get_pawn(uint64 entity_list_address, uint64 controller_address, uint64 pawn_offset);

}
`;
