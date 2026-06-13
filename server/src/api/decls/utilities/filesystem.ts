/**
 * Echo Filesystem API -- sandboxed file + directory I/O.
 * Source: https://echo-23.gitbook.io/angel/utilities/filesystem
 *
 * Paths are relative to the script data directory. Max file size: 512 MB.
 * Directory depth is capped at 2 levels; executable extensions are blocked.
 */
export const FILESYSTEM_AS = `
// ---------------------------------------------------------------------------
// Files
// ---------------------------------------------------------------------------

namespace file {

/** True if a file with this name exists. */
bool exists(string filename);

/** Write \`data\` to \`filename\`, replacing any existing content. */
bool write(string filename, string data);

/** Append \`data\` to \`filename\` (creating if needed). */
bool append(string filename, string data);

/** Read the file's contents into \`data\`. Returns false on failure. */
bool read(string filename, string &out data);

/** Write raw bytes to \`filename\`, replacing any existing content. */
bool write_bytes(string filename, array<uint8> data);

/** Append raw bytes to \`filename\` (creating if needed). */
bool append_bytes(string filename, array<uint8> data);

/** Read the file's contents as raw bytes. Returns null on failure. */
array<uint8>@ read_bytes(string filename);

/** Delete a file. Returns false if not present or unwritable. */
bool remove(string filename);

/** Get the size of a file in bytes. */
bool size(string filename, uint64 &out size);

}

// ---------------------------------------------------------------------------
// Directories -- one level deep inside the data directory.
// ---------------------------------------------------------------------------

namespace dir {

/** True if a directory with this name exists. */
bool exists(string name);

/** Create a directory. Returns true if created (or already existed). */
bool create(string name);

/** Remove a directory (must be empty). */
bool remove(string name);

/** List the entries inside a directory. */
array<string> list(string name);

}
`;
