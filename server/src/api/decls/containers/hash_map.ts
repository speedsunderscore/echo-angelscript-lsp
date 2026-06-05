/**
 * Echo Hash Map API -- typed value hash map keyed by uint64.
 * Source: https://echo-23.gitbook.io/angel/containers/hash-map
 */
export const HASH_MAP_AS = `
/** Type tag returned by hash_map::get_type(). */
enum hmap_type {
    unset,
    boolean,
    i32,
    u32,
    i64,
    u64,
    /** 32-bit float. */
    f32,
    /** 64-bit float. */
    f64,
    string
}

/** Heterogeneous map keyed by uint64. Each key stores one typed value. */
class hash_map {
    // -- Setters -- overwrite any existing value at that key -----------------

    void set_bool   (uint64 key, bool   value);
    void set_int32  (uint64 key, int32  value);
    void set_uint32 (uint64 key, uint32 value);
    void set_int64  (uint64 key, int64  value);
    void set_uint64 (uint64 key, uint64 value);
    void set_float  (uint64 key, float  value);
    void set_double (uint64 key, double value);
    void set_string (uint64 key, string value);

    // -- Getters -- return true if key exists AND type matches --------------

    bool get_bool   (uint64 key, bool   &out value);
    bool get_int32  (uint64 key, int32  &out value);
    bool get_uint32 (uint64 key, uint32 &out value);
    bool get_int64  (uint64 key, int64  &out value);
    bool get_uint64 (uint64 key, uint64 &out value);
    bool get_float  (uint64 key, float  &out value);
    bool get_double (uint64 key, double &out value);
    bool get_string (uint64 key, string &out value);

    // -- Operations ---------------------------------------------------------

    /** True if any value is stored at \`key\` regardless of type. */
    bool contains(uint64 key);

    /** Remove a key. Returns true if removed, false if not found. */
    bool erase(uint64 key);

    /** Type of the value at \`key\`, or hmap_type::unset if absent. */
    hmap_type get_type(uint64 key);

    /** Number of stored keys. */
    uint size();

    /** True if empty. */
    bool empty();

    /** Remove every entry. */
    void clear();
}

/** Construct an empty hash_map. */
hash_map@ create_hash_map();
`;
