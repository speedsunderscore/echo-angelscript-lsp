/**
 * Standard AngelScript add-on declarations: `string` and `array<T>`.
 *
 * Source kept as a template literal so the build step doesn't need to copy
 * `.as` files into the output bundle. To edit, replace this string with the
 * desired AS declarations.
 */
export const BUILTIN_AS = `
/**
 * Built-in mutable string type from the AngelScript std-string add-on.
 */
class string {
    /** Number of bytes (NOT codepoints) in the string. */
    uint length() const;

    /** Resize, padding with 0 bytes if growing. */
    void resize(uint newSize);

    /** True if length() == 0. */
    bool isEmpty() const;

    /** Return a substring [start, start+count). count=-1 means "rest". */
    string substr(uint start = 0, int count = -1) const;

    /** Index of the first occurrence of \`str\`, or -1. */
    int findFirst(const string &in str, uint start = 0) const;

    /** Index of the last occurrence of \`str\`, or -1. */
    int findLast(const string &in str, int start = -1) const;

    /** Insert \`other\` at byte position \`pos\`. */
    void insert(uint pos, const string &in other);

    /** Erase \`count\` bytes from \`pos\`. count=-1 means "to end". */
    void erase(uint pos, int count = -1);
}

/**
 * Built-in growable array from the AngelScript array add-on.
 * Element-type-dependent operations (insertLast, opIndex, etc.) are
 * currently declared without their element-type parameters; the IDE will
 * resolve them in a future iteration that adds template substitution.
 */
class array {
    /** Number of elements. */
    uint length() const;

    /** Resize to \`newSize\` elements; new slots are default-constructed. */
    void resize(uint newSize);

    /** Pre-allocate capacity for \`capacity\` elements. */
    void reserve(uint capacity);

    /** True if length() == 0. */
    bool isEmpty() const;

    /** Append a default-constructed element. */
    void insertLast();

    /** Remove the element at \`index\`. */
    void removeAt(uint index);

    /** Remove the last element. */
    void removeLast();

    /** Sort ascending. */
    void sortAsc();

    /** Sort descending. */
    void sortDesc();

    /** Reverse in place. */
    void reverse();
}
`;
