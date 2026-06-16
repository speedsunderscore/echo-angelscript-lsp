/**
 * Echo Menu API -- UI element registration, getters/setters, tabs.
 * Source: https://echo-23.gitbook.io/angel/drawing/menu
 */
export const MENU_AS = `
// ---------------------------------------------------------------------------
// Types -- opaque UI element handles returned by ui::add_*.
// ---------------------------------------------------------------------------

/** Opaque handle for a checkbox element. */
class checkbox {}
/** Opaque handle for a slider element. */
class slider {}
/** Opaque handle for a color-picker element. */
class color_picker {}
/** Opaque handle for a combobox element. */
class combobox {}
/** Opaque handle for a multi-select element. */
class multi_select {}
/** Opaque handle for a button element. */
class button {}

// ---------------------------------------------------------------------------
// Callback signatures -- passed to ui::add_* with the @ handle operator.
// ---------------------------------------------------------------------------

/** Invoked when a checkbox is toggled. */
funcdef void checkbox_callback(bool value);
/** Invoked when a combobox selection changes. */
funcdef void combobox_callback(int index);
/** Invoked when a button is clicked. */
funcdef void button_callback();

// ---------------------------------------------------------------------------
// Misc supporting structs / enums
// ---------------------------------------------------------------------------

/** Snapshot of the menu state returned by ui::get_info(). */
class ui_info {
    /** True if the menu window is currently open. */
    bool open;
    /** Current DPI scale factor. */
    float dpi_scale;
    float x;
    float y;
    float w;
    float h;
    /** User-chosen accent color. */
    color accent;
}

/** A bound keybind currently in the "active" state, returned by ui::get_active_binds(). */
class active_bind {
    string category;
    string label;
}

/**
 * Controls which side of the window area the sub-tab bar appears on.
 *   middle: sub-tab bar runs along the top; categories added directly to
 *           the tab are ignored.
 *   left / right: sub-tab bar appears on that side; categories added
 *           directly to the tab will appear on the opposite side.
 */
enum sub_tab_side {
    middle,
    left,
    right
}

/**
 * Controls where a category is placed within the tab content area.
 *   automatic: categories distributed evenly across columns (up to 2/col).
 *   left_full / right_full: occupies the full height of that column.
 *   left_top / left_bottom / right_top / right_bottom: occupies the top
 *           or bottom half of the column; a resize grip appears between
 *           paired halves.
 */
enum category_pos {
    automatic,
    left_full,
    right_full,
    left_top,
    left_bottom,
    right_top,
    right_bottom
}

/** Checkbox label-style hint (color emphasis). */
enum label_style {
    /** Default white. */
    none,
    /** Orange -- caution. */
    warning,
    /** Red -- destructive. */
    dangerous
}

// ---------------------------------------------------------------------------
// ui namespace -- menu state, tabs/categories, element creation & access.
// ---------------------------------------------------------------------------

namespace ui {

/**
 * Set the config directory for the loaded script. Choose a unique folder
 * name to avoid conflicts with other scripts. Once called, a config tab
 * appears in the UI for saving / loading configs.
 */
void config_path(string folder_name);

// -- Menu state -------------------------------------------------------------

/** True if the menu window is currently open. */
bool is_open();

/** Current DPI scale factor. */
float get_scale();

/** User-chosen accent color. */
color get_accent();

/** Full snapshot of the menu state. */
ui_info get_info();

// -- Tabs / categories ------------------------------------------------------
// Call ui::add_tab, ui::add_subtab, and ui::add_category BEFORE registering
// any elements. Categories are added to the most recently created tab or
// sub-tab; elements are added to the most recently created category.

/** Create a new top-level tab. */
void add_tab(string label);

/** Create a new top-level tab with an explicit sub-tab side. */
void add_tab(string label, sub_tab_side side);

/** Create a sub-tab branching off the most recently created tab. */
void add_subtab(string label);

/** Create a category in the current tab/sub-tab. */
void add_category(string label);

/** Create a category in the current tab/sub-tab with an explicit position. */
void add_category(string label, category_pos pos);

/** Fill \`binds\` with every currently active keybind. */
bool get_active_binds(array<active_bind> &out binds);

/** Label of the currently active top-level tab. */
string get_tab();

/** Label of the currently active sub-tab. Empty string if none. */
string get_sub_tab();

// -- Element creation -------------------------------------------------------

/** Add a checkbox. */
checkbox add_checkbox(string label, bool default_value);
/** Add a checkbox with a change callback. */
checkbox add_checkbox(string label, bool default_value, checkbox_callback@ callback);
/** Add a checkbox with an explicit config key (overrides label-based key). */
checkbox add_checkbox(string label, bool default_value, string config_key);
/** Add a checkbox with both a callback and an explicit config key. */
checkbox add_checkbox(string label, bool default_value, checkbox_callback@ callback, string config_key);

/** Add a slider. */
slider add_slider(string label, int default_val, int min_val, int max_val, int step);
/** Add a slider with a value-suffix tag. */
slider add_slider(string label, int default_val, int min_val, int max_val, int step, string tag);
/** Add a slider with tag and explicit config key. */
slider add_slider(string label, int default_val, int min_val, int max_val, int step, string tag, string config_key);

/**
 * Add a color picker.
 * \`stick\` defaults to true -- the picker visually attaches to the checkbox
 * above it (max 3 stickers per checkbox). Pass false to disable sticking.
 */
color_picker add_color_picker(string label, int r, int g, int b, int a, bool stick = true);
/** Add a color picker with an explicit config key. */
color_picker add_color_picker(string label, int r, int g, int b, int a, bool stick, string config_key);

/** Add a combobox. */
combobox add_combobox(string label, array<string> options, int default_idx);
/** Add a combobox with a change callback. */
combobox add_combobox(string label, array<string> options, int default_idx, combobox_callback@ callback);
/** Add a combobox with an explicit config key. */
combobox add_combobox(string label, array<string> options, int default_idx, string config_key);
/** Add a combobox with both a callback and an explicit config key. */
combobox add_combobox(string label, array<string> options, int default_idx, combobox_callback@ callback, string config_key);

/** Add a multi-select. */
multi_select add_multi_select(string label, array<string> options);
/** Add a multi-select with an explicit config key. */
multi_select add_multi_select(string label, array<string> options, string config_key);

/** Add a button. */
button add_button(string label, button_callback@ callback);

// -- Element getters --------------------------------------------------------

/** Current value of a checkbox. */
bool get(checkbox cb);
/** Current value of a slider. */
int get(slider s);
/** Current color of a color-picker. */
color get(color_picker cp);
/** Selected index of a combobox. */
int get(combobox cb);
/** True if the option at \`index\` is selected in the multi-select. */
bool get(multi_select ms, int index);

// -- Element setters --------------------------------------------------------

/** Set checkbox value. */
void set(checkbox cb, bool value);
/** Set slider value. */
void set(slider s, int value);
/** Set color-picker color. */
void set(color_picker cp, color value);
/** Set combobox selection by index. */
void set(combobox cb, int index);
/** Set whether the option at \`index\` is selected in the multi-select. */
void set(multi_select ms, int index, bool value);

// -- Element visibility -----------------------------------------------------

/** Show or hide the checkbox. */
void set_visible(checkbox cb, bool visible);
/** Show or hide the slider. */
void set_visible(slider s, bool visible);
/** Show or hide the color picker. */
void set_visible(color_picker cp, bool visible);
/** Show or hide the combobox. */
void set_visible(combobox cb, bool visible);
/** Show or hide the multi-select. */
void set_visible(multi_select ms, bool visible);
/** Show or hide the button. */
void set_visible(button b, bool visible);

// -- Tooltips ---------------------------------------------------------------

/** Attach a hover tooltip to the checkbox. */
void add_tooltip(checkbox cb, string text);
/** Attach a hover tooltip to the slider. */
void add_tooltip(slider s, string text);
/** Attach a hover tooltip to the color picker. */
void add_tooltip(color_picker cp, string text);
/** Attach a hover tooltip to the combobox. */
void add_tooltip(combobox cb, string text);
/** Attach a hover tooltip to the multi-select. */
void add_tooltip(multi_select ms, string text);

// -- Checkbox label styling -------------------------------------------------

/** Tint the checkbox label (default / orange / red). */
void set_label_style(checkbox cb, label_style style);

}
`;
