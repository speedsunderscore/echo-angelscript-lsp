/**
 * Echo IW engine helpers (Call of Duty / etc.) -- uses a 3x3 view matrix
 * (forward, right, up rows) plus separate camera location and FOV.
 * Source: https://echo-23.gitbook.io/angel/engines/iw-engine
 */
export const IW_ENGINE_AS = `
namespace iw_engine {

/**
 * Convert a 3D world position to 2D screen coordinates.
 *
 * \`view_matrix\` is a 3x3 rotation matrix whose rows are:
 *   row 0: axis_forward (camera forward direction)
 *   row 1: axis_right   (camera right direction)
 *   row 2: axis_up      (camera up direction)
 *
 * Returns true on success; false if off-screen or behind the camera.
 */
bool w2s(
    vec3 world_pos,
    vec3 camera_location,
    matrix3x3 view_matrix,
    float fov_x,
    float fov_y,
    vec2 &out screen_pos
);

}
`;
