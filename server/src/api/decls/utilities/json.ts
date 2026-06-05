/**
 * Echo JSON Serialization API -- json_obj container + json:: functions.
 * Source: https://echo-23.gitbook.io/angel/utilities/json-serialization
 */
export const JSON_AS = `
/** Type tag returned by json_obj::type() / type_at(). */
enum json_type {
    null_value,
    boolean,
    number,
    string,
    object,
    array
}

/**
 * Polymorphic JSON node -- holds either an object (keyed) or an array
 * (indexed). Use json_obj() for an empty object, json::array() for an
 * empty array, json::parse() to deserialize from text.
 */
class json_obj {
    // -- Inspection ---------------------------------------------------------

    /** True if the object contains \`key\`. */
    bool has(string key);

    /** Number of keys (object) or elements (array). */
    uint length();

    /** Type of the value at \`key\`. */
    json_type type(string key);

    /** Type of the value at \`index\`. */
    json_type type_at(uint index);

    /** All keys currently in the object. */
    array<string>@ keys();

    // -- Key-based getters -- return default value if missing / type mismatch --

    string get_string(string key);
    float  get_float (string key);
    double get_double(string key);
    int    get_int   (string key);
    uint   get_uint  (string key);
    int64  get_int64 (string key);
    uint64 get_uint64(string key);
    bool   get_bool  (string key);
    /** Returns null if missing or not an object/array. */
    json_obj@ get_obj(string key);

    // -- Index-based getters -- return default if out of range / type mismatch -

    string get_string_at(uint index);
    float  get_float_at (uint index);
    double get_double_at(uint index);
    int    get_int_at   (uint index);
    uint   get_uint_at  (uint index);
    int64  get_int64_at (uint index);
    uint64 get_uint64_at(uint index);
    bool   get_bool_at  (uint index);
    /** Returns null if out of range or not an object/array. */
    json_obj@ get_obj_at(uint index);

    // -- Key-based setters -- overwrite any existing value at that key --------

    void set(string key, string value);
    void set(string key, float  value);
    void set(string key, double value);
    void set(string key, int    value);
    void set(string key, uint   value);
    void set(string key, int64  value);
    void set(string key, uint64 value);
    void set(string key, bool   value);
    void set(string key, json_obj@ value);

    /** Set the key to JSON null. */
    void set_null(string key);

    /** Remove a key. No-op if it doesn't exist. */
    void remove(string key);

    // -- Array push -- only valid on objects created via json::array() -------

    void push(string value);
    void push(float  value);
    void push(double value);
    void push(int    value);
    void push(uint   value);
    void push(int64  value);
    void push(uint64 value);
    void push(bool   value);
    /** Push a nested object or array. */
    void push(json_obj@ value);

    /** Push JSON null. */
    void push_null();
}

namespace json {

/** Construct a json_obj in ARRAY mode -- use push() to append, get_*_at() to read. */
json_obj@ array();

/**
 * Parse a JSON string into a json_obj. Returns null on failure, with the
 * reason written to \`error\`.
 */
json_obj@ parse(string text, string &out error);

/**
 * Serialize a json_obj back to a JSON string. Pass \`beautify = true\` for
 * pretty-printed output with indentation.
 */
string stringify(json_obj@ obj, bool beautify = false);

}
`;
