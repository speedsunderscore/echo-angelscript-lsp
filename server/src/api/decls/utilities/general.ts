/**
 * Echo General Utilities API -- username, hex/base64 encoding, timing,
 * random, hashing, zip parsing.
 * Source: https://echo-23.gitbook.io/angel/utilities/general
 */
export const GENERAL_AS = `
// ---------------------------------------------------------------------------
// Misc
// ---------------------------------------------------------------------------

namespace util {

/** Returns the forum username of the script user. */
string get_username();

/** Unlocks anti-capture protection on menu elements. */
void disable_capture_protection();

/** Convert a wide-string byte array to UTF-8. */
string wide_to_string(array<uint8> bytes, bool stop_at_null = false);

/** Format an integer as a hex string; \`prefix\` prepends "0x". */
string to_hex(uint64 value, bool prefix = true);

/**
 * Format a string using \`{}\` placeholders.
 *
 * Basic usage:
 *   {}        next argument
 *   {0}       argument by index
 *   {{        literal {
 *   }}        literal }
 *
 * Format options (after a colon):
 *   {:<8}     left-align, width 8
 *   {:>8}     right-align, width 8 (default)
 *   {:08}     zero-pad, width 8
 *   {:.2}     2 decimal places
 *   {0:<8.2}  index + alignment + width + precision
 *
 * Shorthand (no colon needed):
 *   {.2}      precision only
 *   {0.3}     index + precision
 *
 * Invalid or out-of-range placeholders produce \`{?}\`.
 * Width is capped at 1024, precision at 17.
 * Up to 8 arguments supported.
 */
string format_string(string fmt, ...);

// -- System time ------------------------------------------------------------

/** Milliseconds since system boot. */
uint64 tickcount();

/** Current time as "16:32" or "4:32 PM". */
string system_time(bool use_12h = false);

// -- Precise timing ---------------------------------------------------------

/** Monotonic timestamp; pair with time_ms / time_us / time_ns. */
uint64 time_now();

/** Elapsed milliseconds between two time_now() values. */
double time_ms(uint64 start, uint64 end);
/** Elapsed microseconds between two time_now() values. */
double time_us(uint64 start, uint64 end);
/** Elapsed nanoseconds between two time_now() values. */
double time_ns(uint64 start, uint64 end);

// -- Random -- range [min, max] ---------------------------------------------

/**
 * Seed the RNG. Pass 0 to reset to the default sequence, any non-zero
 * value to start a custom sequence.
 */
void seed_random(uint64 seed);

/** Random int in [min, max]. */
int    random_int(int min, int max);
/** Random float in [min, max]. */
float  random_float(float min, float max);
/** Random double in [min, max]. */
double random_double(double min, double max);
/** Random int64 in [min, max]. */
int64  random_i64(int64 min, int64 max);
/** Random uint64 in [min, max]. */
uint64 random_u64(uint64 min, uint64 max);

// -- Encoding -- returns empty string on decode failure ---------------------

/** Encode a string to lowercase hex. "Hello" -> "48656c6c6f". */
string hex_encode(string str);
/** Encode a byte array to lowercase hex. */
string hex_encode(array<uint8> bytes);

/** Decode a hex string to a UTF-8 string. Empty on failure. */
string hex_decode(string str);
/** Decode a hex byte array to a UTF-8 string. Empty on failure. */
string hex_decode(array<uint8> bytes);

/** Encode a string to base64. "Hello" -> "SGVsbG8=". */
string base64_encode(string str);
/** Encode a byte array to base64. */
string base64_encode(array<uint8> bytes);

/** Decode a base64 string to a UTF-8 string. Empty on failure. */
string base64_decode(string str);
/** Decode a base64 byte array to a UTF-8 string. Empty on failure. */
string base64_decode(array<uint8> bytes);

// -- Zip ---------------------------------------------------------------------

/**
 * Parse a raw ZIP binary (e.g. from http::get or file::read) and return
 * every file entry. Zip parsing must be flat (no subdirectories); directory
 * entries are skipped. File writes still go through the filesystem API.
 */
array<zip_entry>@ zip_parse(string data);

}

/** A single file entry returned by util::zip_parse(). */
class zip_entry {
    /** Filename without directory. */
    string name;
    /** Raw file contents. */
    string data;
}

// ---------------------------------------------------------------------------
// Hashing
// ---------------------------------------------------------------------------

namespace hash {

/** 64-bit FNV-1a hash. */
uint64 fnv1a(string str);
/** 32-bit CRC32 hash. */
uint32 crc32(string str);

}
`;
