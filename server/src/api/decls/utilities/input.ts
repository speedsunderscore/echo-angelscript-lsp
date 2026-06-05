/**
 * Echo Input API -- WinAPI-backed mouse / keyboard input.
 * Source: https://echo-23.gitbook.io/angel/utilities/input-winapi
 */
export const INPUT_AS = `
namespace input {

// ---------------------------------------------------------------------------
// Mouse
// ---------------------------------------------------------------------------

/** Move the mouse cursor to (x, y) in screen coordinates. */
void mouse_move(int x, int y);

/** Press the left mouse button (key-down event). */
bool mouse_press();

/** Release the left mouse button (key-up event). */
bool mouse_release();

/** Press + release the left mouse button atomically. */
bool mouse_click();

/** Get the current mouse cursor position. */
void mouse_pos(int &out x, int &out y);

// ---------------------------------------------------------------------------
// Keyboard
// ---------------------------------------------------------------------------

/** True while the key with this VK code is held down. */
bool key_active(int vk_code);

/** True if the key is toggled on (e.g. Caps Lock). */
bool key_toggled(int vk_code);

/** Send a key-down event for the given VK code. */
void key_press(int vk_code);

/** Send a key-up event for the given VK code. */
void key_release(int vk_code);

/** Send key-down + key-up for the given VK code atomically. */
void key_tap(int vk_code);

}
`;
