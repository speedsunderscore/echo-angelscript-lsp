/**
 * Echo matrix types -- matrix4x4, matrix3x4, matrix3x3.
 * Source: https://echo-23.gitbook.io/angel/math/matrixes
 *
 * Element access via the chained subscript form: `m[row][col]`. Each
 * matrix also has read methods for materializing from a remote address.
 */
export const MATRICES_AS = `
/** Row-major 4x4 float matrix used for view/projection transforms. */
class matrix4x4 {
    /** Read 16 floats starting at \`address\`. Returns true on success. */
    bool read(uint64 address);
    /** Read 16 doubles starting at \`address\`. Returns true on success. */
    bool read_double(uint64 address);
}

/** Row-major 3x4 float matrix (rotation + translation, no last row). */
class matrix3x4 {
    /** Read 12 floats starting at \`address\`. Returns true on success. */
    bool read(uint64 address);
    /** Read 12 doubles starting at \`address\`. Returns true on success. */
    bool read_double(uint64 address);
}

/** Row-major 3x3 float matrix (pure rotation / orthonormal basis). */
class matrix3x3 {
    /** Read 9 floats starting at \`address\`. Returns true on success. */
    bool read(uint64 address);
    /** Read 9 doubles starting at \`address\`. Returns true on success. */
    bool read_double(uint64 address);
}
`;
