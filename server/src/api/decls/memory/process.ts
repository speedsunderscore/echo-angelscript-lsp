/**
 * Echo Process API -- process attachment and memory I/O against a target.
 * Source: https://echo-23.gitbook.io/angel/memory/process
 *
 * Kept as a template literal so the build step doesn't need to copy
 * `.as` files into the output bundle. The trailing newline is significant.
 */
export const PROCESS_AS = `
/**
 * Snapshot of a memory region pulled from the target in one read, for
 * efficient multi-field access. Construct via process::read_buffer().
 *
 * Faster than repeated single-field reads when reading many fields from
 * the same nearby region.
 */
class memory_buffer {
    /** Read an unsigned 8-bit integer at \`offset\`. */
    uint8  read_uint8 (uint64 offset);
    /** Read an unsigned 16-bit integer at \`offset\`. */
    uint16 read_uint16(uint64 offset);
    /** Read an unsigned 32-bit integer at \`offset\`. */
    uint32 read_uint32(uint64 offset);
    /** Read an unsigned 64-bit integer at \`offset\`. */
    uint64 read_uint64(uint64 offset);

    /** Read a signed 8-bit integer at \`offset\`. */
    int8  read_int8 (uint64 offset);
    /** Read a signed 16-bit integer at \`offset\`. */
    int16 read_int16(uint64 offset);
    /** Read a signed 32-bit integer at \`offset\`. */
    int32 read_int32(uint64 offset);
    /** Read a signed 64-bit integer at \`offset\`. */
    int64 read_int64(uint64 offset);

    /** Read a 32-bit float at \`offset\`. */
    float  read_float (uint64 offset);
    /** Read a 64-bit double at \`offset\`. */
    double read_double(uint64 offset);

    /** Read two consecutive 32-bit floats at \`offset\` into a vec2. */
    vec2 read_vec2_float (uint64 offset);
    /** Read two consecutive 64-bit doubles at \`offset\` into a vec2. */
    vec2 read_vec2_double(uint64 offset);
    /** Read three consecutive 32-bit floats at \`offset\` into a vec3. */
    vec3 read_vec3_float (uint64 offset);
    /** Read three consecutive 64-bit doubles at \`offset\` into a vec3. */
    vec3 read_vec3_double(uint64 offset);
    /** Read four consecutive 32-bit floats at \`offset\` into a vec4. */
    vec4 read_vec4_float (uint64 offset);
    /** Read four consecutive 64-bit doubles at \`offset\` into a vec4. */
    vec4 read_vec4_double(uint64 offset);

    /** Total size of the buffer in bytes. */
    uint64 size();
}

namespace process {

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Returned by attach(). Any field equal to zero indicates failure. */
class attach_data {
    /** Process ID. */
    uint32 pid;
    /** PEB address. */
    uint64 peb_address;
    /** Base address. */
    uint64 base_address;
}

/** Entry returned by get_module_list(). */
class module_entry {
    /** Module name. */
    string name;
    /** Base address. */
    uint64 base;
    /** Module size in bytes. */
    uint64 size;
}

/** Result of virtual_query(). */
class memory_region {
    /** Base address of the region. */
    uint64 base;
    /** Size of the region in bytes. */
    uint64 size;
    /** Win32 PAGE_* protection flags (e.g. PAGE_READWRITE = 0x04). */
    uint32 protect;
    /**
     * Whether the region is privately owned by the process, as opposed to
     * mapped or image-backed.
     */
    bool private_memory;
}

// ---------------------------------------------------------------------------
// Attach / liveness
// ---------------------------------------------------------------------------

/**
 * Attach to a process by name. Does not inject or modify the target.
 * Returns an attach_data; any field equal to zero indicates failure.
 *
 * \`attach_window\` defaults to true: the matching window is found and
 * attached automatically. Pass false to skip window attachment (it is also
 * skipped automatically if no window exists).
 */
attach_data attach(string name, bool attach_window = true);

/**
 * Attach to a process by PID. Does not inject or modify the target.
 * Returns an attach_data; any field equal to zero indicates failure.
 *
 * \`attach_window\` defaults to true: the matching window is found and
 * attached automatically. Pass false to skip window attachment (it is also
 * skipped automatically if no window exists).
 */
attach_data attach(uint32 pid, bool attach_window = true);

/**
 * Checks if the attached process is still alive.
 *
 * MUST be called periodically from one thread -- the backend relies on this
 * to detect and adjust to process changes.
 */
bool is_alive();

/**
 * Detach from the currently attached process. Subsequent reads/writes
 * fail until another attach() succeeds.
 */
void detach();

// ---------------------------------------------------------------------------
// Read memory -- value-returning. Returns a default (0 / 0.0 / false / "")
// on failure.
// ---------------------------------------------------------------------------

/** Read \`size\` raw bytes starting at \`address\`. Returns null on failure. */
array<uint8>@ read_bytes(uint64 address, uint32 size);

/**
 * Read a region of memory into a memory_buffer for efficient multi-field
 * access. Returns null on failure.
 *
 * Faster than repeated single-field reads when reading many fields from
 * the same nearby region.
 */
memory_buffer@ read_buffer(uint64 address, uint64 size);

/** Read a signed 8-bit integer. Returns 0 on failure. */
int8   read_int8(uint64 address);
/** Read an unsigned 8-bit integer. Returns 0 on failure. */
uint8  read_uint8(uint64 address);
/** Read a signed 16-bit integer. Returns 0 on failure. */
int16  read_int16(uint64 address);
/** Read an unsigned 16-bit integer. Returns 0 on failure. */
uint16 read_uint16(uint64 address);
/** Read a signed 32-bit integer. Returns 0 on failure. */
int32  read_int32(uint64 address);
/** Read an unsigned 32-bit integer. Returns 0 on failure. */
uint32 read_uint32(uint64 address);
/** Read a signed 64-bit integer. Returns 0 on failure. */
int64  read_int64(uint64 address);
/** Read an unsigned 64-bit integer. Returns 0 on failure. */
uint64 read_uint64(uint64 address);
/** Read a 32-bit float. Returns 0.0 on failure. */
float  read_float(uint64 address);
/** Read a 64-bit double. Returns 0.0 on failure. */
double read_double(uint64 address);

/**
 * Read a null-terminated string (256 byte max). Returns "" on failure.
 * For wide strings or larger buffers use \`read_bytes\` instead.
 */
string read_string(uint64 address);

// ---------------------------------------------------------------------------
// Read memory -- status-returning. Returns true on success, false otherwise.
// The result is written through the \`&out\` parameter.
// ---------------------------------------------------------------------------

/** Read a signed 8-bit integer into \`out\`. Returns true on success. */
bool read_int8(uint64 address, int8 &out);
/** Read an unsigned 8-bit integer into \`out\`. Returns true on success. */
bool read_uint8(uint64 address, uint8 &out);
/** Read a signed 16-bit integer into \`out\`. Returns true on success. */
bool read_int16(uint64 address, int16 &out);
/** Read an unsigned 16-bit integer into \`out\`. Returns true on success. */
bool read_uint16(uint64 address, uint16 &out);
/** Read a signed 32-bit integer into \`out\`. Returns true on success. */
bool read_int32(uint64 address, int32 &out);
/** Read an unsigned 32-bit integer into \`out\`. Returns true on success. */
bool read_uint32(uint64 address, uint32 &out);
/** Read a signed 64-bit integer into \`out\`. Returns true on success. */
bool read_int64(uint64 address, int64 &out);
/** Read an unsigned 64-bit integer into \`out\`. Returns true on success. */
bool read_uint64(uint64 address, uint64 &out);
/** Read a 32-bit float into \`out\`. Returns true on success. */
bool read_float(uint64 address, float &out);
/** Read a 64-bit double into \`out\`. Returns true on success. */
bool read_double(uint64 address, double &out);
/** Read a null-terminated string into \`out\`. Returns true on success. */
bool read_string(uint64 address, string &out);

// ---------------------------------------------------------------------------
// Write memory -- returns true on success, false on failure.
// ---------------------------------------------------------------------------

/** Write raw bytes from \`bytes\` to \`address\`. */
bool write_bytes(array<uint8> bytes, uint64 address);

/** Write a signed 8-bit integer. */
bool write_int8(uint64 address, int8 value);
/** Write an unsigned 8-bit integer. */
bool write_uint8(uint64 address, uint8 value);
/** Write a signed 16-bit integer. */
bool write_int16(uint64 address, int16 value);
/** Write an unsigned 16-bit integer. */
bool write_uint16(uint64 address, uint16 value);
/** Write a signed 32-bit integer. */
bool write_int32(uint64 address, int32 value);
/** Write an unsigned 32-bit integer. */
bool write_uint32(uint64 address, uint32 value);
/** Write a signed 64-bit integer. */
bool write_int64(uint64 address, int64 value);
/** Write an unsigned 64-bit integer. */
bool write_uint64(uint64 address, uint64 value);
/** Write a 32-bit float. */
bool write_float(uint64 address, float value);
/** Write a 64-bit double. */
bool write_double(uint64 address, double value);

// ---------------------------------------------------------------------------
// Virtual query
// ---------------------------------------------------------------------------

/** Query the virtual memory region containing \`address\`. */
memory_region virtual_query(uint64 address);

// ---------------------------------------------------------------------------
// Module utilities
// ---------------------------------------------------------------------------

/** Returns the base address of the named module, or 0 if not found. */
uint64 get_module_base(string name);

/** Returns the size (bytes) of the module at \`base\`, or 0 if not found. */
uint32 get_module_size(uint64 base);

/**
 * Returns the address of the named export from the module at \`base\`, or 0
 * if not found.
 */
uint64 get_module_export(uint64 base, string name);

/** Enumerate every loaded module. */
array<module_entry>@ get_module_list();

// ---------------------------------------------------------------------------
// Pattern scanning -- returns 0 / null if no match.
// ---------------------------------------------------------------------------

/**
 * Find the first match of \`sig\` masked by \`mask\` inside the module at
 * \`base\`. Returns the absolute address, or 0 if not found.
 */
uint64 find_signature(uint64 base, string sig, string mask);

/**
 * Find all matches of \`sig\` masked by \`mask\` inside the module at \`base\`.
 * Returns null if no matches.
 */
array<uint64>@ find_signatures(uint64 base, string sig, string mask);

/**
 * IDA-style: find the first match of \`sig\` (e.g. "48 8B ? 24") in the
 * module at \`base\`. Returns the absolute address, or 0 if not found.
 */
uint64 find_signature(uint64 base, string sig);

/**
 * IDA-style: find all matches of \`sig\` (e.g. "48 8B ? 24") in the module
 * at \`base\`. Returns null if no matches.
 */
array<uint64>@ find_signatures(uint64 base, string sig);

// ---------------------------------------------------------------------------
// Address resolution
// ---------------------------------------------------------------------------

/**
 * Resolve a relative address embedded in an instruction.
 *   \`address\`   -- start of the instruction
 *   \`offset\`    -- byte offset of the relative displacement within the instruction
 *   \`inst_size\` -- total instruction size in bytes
 */
uint64 get_relative_address(uint64 address, uint32 offset, uint32 inst_size);

// ---------------------------------------------------------------------------
// Dump to file -- all dumps saved under the "dmp" folder inside the scripts
// folder. Returns true on success.
// ---------------------------------------------------------------------------

/** Dump the main executable to \`filename\`. */
bool dump(string filename);

/** Dump the named module to \`filename\`. */
bool dump(string module_name, string filename);

}
`;
