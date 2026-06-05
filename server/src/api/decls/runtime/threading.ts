/**
 * Echo Multi-Threading API -- fixed-tick threads, mutexes, atomics.
 * Source: https://echo-23.gitbook.io/angel/angelscript-api/multi-threading
 *
 * Thread binding and creation are only callable from main(). Threads
 * invoke a callback at a fixed tick rate (1-128 tps). Tick time is
 * drift-free: it accumulates each interval. Pass 0 as tps to run the
 * callback once and exit -- useful for non-blocking work like file I/O.
 */
export const THREADING_AS = `
// ---------------------------------------------------------------------------
// Threads
// ---------------------------------------------------------------------------

/** Callback signature for thread loops and render hooks. */
funcdef void thread_callback();

/**
 * Create a thread that invokes \`cb\` at \`tps\` ticks per second (1-128).
 * Pass 0 as tps to run \`cb\` exactly once on a background thread and exit.
 * Only callable from main().
 */
void create_thread(int tps, thread_callback@ cb);

/**
 * Bind \`cb\` to fire every render frame.
 * Only callable from main().
 */
void on_render(thread_callback@ cb);

// ---------------------------------------------------------------------------
// Mutexes
// ---------------------------------------------------------------------------

/**
 * Read/write mutex used for cross-thread synchronization. Acquired with
 * either an exclusive lock (single writer) or a shared lock (multiple
 * readers). Construct one with create_mutex().
 */
class mutex {
    /** Acquire exclusive lock -- blocks until available. */
    void lock();
    /** Release exclusive lock. */
    void unlock();
    /** Try to acquire exclusive lock without blocking -- returns true on success. */
    bool try_lock();
    /** Acquire shared lock -- multiple readers allowed simultaneously. */
    void lock_shared();
    /** Release shared lock. */
    void unlock_shared();
}

/** Construct a new mutex. */
mutex@ create_mutex();

// ---------------------------------------------------------------------------
// Atomics -- lock-free, acquire/release ordering.
// ---------------------------------------------------------------------------

/** Atomic bool. */
class atomic_bool {
    /** Read the current value. */
    bool load();
    /** Write \`value\`. */
    void store(bool value);
    /** Write \`value\`, return the previous value. */
    bool exchange(bool value);
    /**
     * Compare current to \`expected\`; write \`desired\` if they match.
     * Returns the observed value (equals \`expected\` on success, differs
     * on failure).
     */
    bool compare_exchange(bool expected, bool desired);
}
/** Construct an atomic_bool with the given initial value. */
atomic_bool@ create_atomic_bool(bool value);

/** Atomic int32. */
class atomic_int32 {
    int load();
    void store(int value);
    int exchange(int value);
    int compare_exchange(int expected, int desired);
}
atomic_int32@ create_atomic_int32(int value);

/** Atomic uint32. */
class atomic_uint32 {
    uint load();
    void store(uint value);
    uint exchange(uint value);
    uint compare_exchange(uint expected, uint desired);
}
atomic_uint32@ create_atomic_uint32(uint value);

/** Atomic int64. */
class atomic_int64 {
    int64 load();
    void store(int64 value);
    int64 exchange(int64 value);
    int64 compare_exchange(int64 expected, int64 desired);
}
atomic_int64@ create_atomic_int64(int64 value);

/** Atomic uint64. */
class atomic_uint64 {
    uint64 load();
    void store(uint64 value);
    uint64 exchange(uint64 value);
    uint64 compare_exchange(uint64 expected, uint64 desired);
}
atomic_uint64@ create_atomic_uint64(uint64 value);

/** Atomic float. */
class atomic_float {
    float load();
    void store(float value);
    float exchange(float value);
    float compare_exchange(float expected, float desired);
}
atomic_float@ create_atomic_float(float value);

/** Atomic double. */
class atomic_double {
    double load();
    void store(double value);
    double exchange(double value);
    double compare_exchange(double expected, double desired);
}
atomic_double@ create_atomic_double(double value);
`;
