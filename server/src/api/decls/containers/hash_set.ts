/**
 * Echo Hash Set API -- typed open-addressing hash sets.
 * Source: https://echo-23.gitbook.io/angel/containers/hash-set
 *
 * Each numeric type has its own concrete class. Instantiate via the
 * default constructor (e.g. \`hash_set_uint64()\`) or the matching
 * \`create_*\` factory.
 */
export const HASH_SET_AS = `
// ---------------------------------------------------------------------------
// Hash-set classes -- one per element type. Methods are the same shape on
// every type; the element parameter type varies.
// ---------------------------------------------------------------------------

/** Hash set of float values. */
class hash_set_float {
    /** Insert. Returns true if inserted, false if already present. */
    bool insert(float value);
    /** Remove. Returns true if removed, false if not found. */
    bool erase(float value);
    /** True if the set contains \`value\`. */
    bool contains(float value);
    /** Number of elements. */
    uint size();
    /** True if empty. */
    bool empty();
    /** Remove all elements. */
    void clear();
}

/** Hash set of double values. */
class hash_set_double {
    bool insert(double value);
    bool erase(double value);
    bool contains(double value);
    uint size();
    bool empty();
    void clear();
}

/** Hash set of int32 values. */
class hash_set_int32 {
    bool insert(int32 value);
    bool erase(int32 value);
    bool contains(int32 value);
    uint size();
    bool empty();
    void clear();
}

/** Hash set of uint32 values. */
class hash_set_uint32 {
    bool insert(uint32 value);
    bool erase(uint32 value);
    bool contains(uint32 value);
    uint size();
    bool empty();
    void clear();
}

/** Hash set of int64 values. */
class hash_set_int64 {
    bool insert(int64 value);
    bool erase(int64 value);
    bool contains(int64 value);
    uint size();
    bool empty();
    void clear();
}

/** Hash set of uint64 values. */
class hash_set_uint64 {
    bool insert(uint64 value);
    bool erase(uint64 value);
    bool contains(uint64 value);
    uint size();
    bool empty();
    void clear();
}

// ---------------------------------------------------------------------------
// Free constructors -- mirror the create_* style used in some examples.
// ---------------------------------------------------------------------------

/** Construct an empty hash_set_float. */
hash_set_float@  create_hash_set_float();
/** Construct an empty hash_set_double. */
hash_set_double@ create_hash_set_double();
/** Construct an empty hash_set_int32. */
hash_set_int32@  create_hash_set_int32();
/** Construct an empty hash_set_uint32. */
hash_set_uint32@ create_hash_set_uint32();
/** Construct an empty hash_set_int64. */
hash_set_int64@  create_hash_set_int64();
/** Construct an empty hash_set_uint64. */
hash_set_uint64@ create_hash_set_uint64();
`;
