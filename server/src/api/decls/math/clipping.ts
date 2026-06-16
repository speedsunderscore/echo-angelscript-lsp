/**
 * Echo Clipping API -- Clipper2-style polygon boolean ops, inflate/deflate,
 * simplification on collections of 2D paths.
 * Source: https://echo-23.gitbook.io/angel/math/clipping
 */
export const CLIPPING_AS = `
// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

/** Boolean clip operation passed to clip_paths::boolean_op. */
enum clip_type {
    INTERSECTION,
    UNION,
    DIFFERENCE,
    XOR
}

/** Polygon fill rule. */
enum fill_rule {
    EVEN_ODD,
    NON_ZERO,
    POSITIVE,
    NEGATIVE
}

/** Corner-joining style for clip_paths::inflate. */
enum join_type {
    MITER,
    SQUARE,
    BEVEL,
    ROUND
}

/** End / cap style for clip_paths::inflate. */
enum end_type {
    ET_POLYGON,
    ET_JOINED,
    ET_BUTT,
    ET_SQUARE,
    ET_ROUND
}

// ---------------------------------------------------------------------------
// clip_paths
// ---------------------------------------------------------------------------

/**
 * Ref-counted container for a set of paths (polygons / polylines).
 * Operations mutate the object in place.
 */
class clip_paths {
    /** Add a path (polygon or polyline) from an array of points. */
    void add_path(const array<vec2> &in points);

    /** Returns the path at the given index as an array of points. */
    array<vec2>@ get_path(uint index);

    /** Returns the number of paths in this object. */
    uint path_count();

    /** Removes all paths. */
    void clear();

    /** Returns a new clip_paths object with a copy of all paths. */
    clip_paths@ clone();

    /**
     * Boolean operation against another set of paths. Mutates this object.
     */
    void boolean_op(
        clip_paths@ clips,
        clip_type op,
        fill_rule rule = fill_rule::NON_ZERO
    );

    /**
     * Inflate (outset) or deflate (inset) all paths by \`delta\` units.
     * Use ET_POLYGON for closed polygons, ET_BUTT / ET_ROUND for open
     * polylines. \`join\` controls how corners are handled.
     */
    void inflate(
        double delta,
        join_type join = join_type::ROUND,
        end_type end  = end_type::ET_POLYGON
    );

    /**
     * Simplify paths by removing vertices within \`epsilon\` distance of
     * their neighbors.
     */
    void simplify(double epsilon = 0.1);

    /**
     * Merge all overlapping paths within the object into a single set.
     * Useful for cleaning up self-intersecting / overlapping input before
     * drawing.
     */
    void union_self(fill_rule rule = fill_rule::NON_ZERO);
}

/** Construct an empty clip_paths. */
clip_paths@ create_clip_paths();
`;
