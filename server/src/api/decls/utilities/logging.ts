/**
 * Echo Logging API -- on-screen alerts and dev console.
 * Source: https://echo-23.gitbook.io/angel/utilities/general (Logging section)
 */
export const LOGGING_AS = `
// ---------------------------------------------------------------------------
// Alerts -- on-screen notifications.
// ---------------------------------------------------------------------------

namespace alert {

/** Show a default-color alert. */
void show(string msg);
/** Show an alert with a custom RGB color. */
void show(string msg, int r, int g, int b);
/** Show an alert with custom color and a duration in seconds. */
void show(string msg, int r, int g, int b, float duration);
/** Show an alert with custom color, duration, and an optional rainbow flag. */
void show(string msg, int r, int g, int b, float duration, bool rainbow);

/**
 * Tagged alert -- subsequent calls with the same tag update the existing
 * alert instead of creating a new one.
 */
void show_tag(string msg, string tag);
/** Tagged alert with custom color. */
void show_tag(string msg, string tag, int r, int g, int b);
/** Tagged alert with custom color and duration. */
void show_tag(string msg, string tag, int r, int g, int b, float duration);
/** Tagged alert with custom color, duration, and rainbow flag. */
void show_tag(string msg, string tag, int r, int g, int b, float duration, bool rainbow);

/** Clear all alerts. */
void dismiss();
/** Dismiss a specific tagged alert. */
void dismiss(string tag);

}

// ---------------------------------------------------------------------------
// Console -- developer log panel.
// ---------------------------------------------------------------------------

namespace console {

/** Log a value (any type, auto-stringified). */
void log(?&in msg);
/** Log a value with a custom RGB color. */
void log(?&in msg, int r, int g, int b);

/** Yellow warning log. */
void warn(?&in msg);
/** Red error log. */
void error(?&in msg);

/** Clear the console panel. */
void clear();

}

// ---------------------------------------------------------------------------
// Global print
// ---------------------------------------------------------------------------

/** Print a value to the console -- accepts any type, auto-converts to string. */
void print(?&in msg);
`;
