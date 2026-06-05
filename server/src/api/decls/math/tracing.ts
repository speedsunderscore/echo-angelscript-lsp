/**
 * Echo Tracing API -- BVH tree for ray occlusion + one-off ray-triangle /
 * ray-AABB tests.
 * Source: https://echo-23.gitbook.io/angel/math/tracing
 */
export const TRACING_AS = `
/** Triangle in world space, used by trace functions and bvh_tree. */
class triangle {
    vec3 p1;
    vec3 p2;
    vec3 p3;
}

/**
 * Ref-counted BVH tree for ray-occlusion queries. Add triangles, call
 * build(), then query with is_occluded(). Thread-safe -- multiple threads
 * may call is_occluded() concurrently. Any mutation (add_triangle,
 * add_triangles, clear) invalidates the tree until build() is called again.
 */
class bvh_tree {
    /** Add one triangle by its three corner points. */
    void add_triangle(const vec3 &in p1, const vec3 &in p2, const vec3 &in p3);

    /** Add a batch of triangles. */
    void add_triangles(const array<triangle> &in tris);

    /** Build the tree. Returns false if no triangles have been added. */
    bool build();

    /**
     * Returns true if the segment from -> to is blocked by any triangle.
     * Returns false if the tree is not built.
     */
    bool is_occluded(const vec3 &in from, const vec3 &in to) const;

    /** Remove all triangles and reset to an unbuilt state. */
    void clear();

    /** Number of triangles currently in the tree. */
    uint64 triangle_count() const;

    /** True if build() has been called and no mutations have occurred since. */
    bool is_ready() const;
}

/** Construct an empty bvh_tree. Returns null on allocation failure. */
bvh_tree@ create_bvh_tree();

namespace trace {

/** Test a ray against a single triangle. */
bool ray_triangle(
    const triangle &in tri,
    const vec3 &in origin,
    const vec3 &in dir,
    double max_t
);

/** Test a ray against an axis-aligned bounding box. */
bool ray_bbox(
    const vec3 &in origin,
    const vec3 &in dir,
    double max_t,
    const vec3 &in box_min,
    const vec3 &in box_max
);

}
`;
