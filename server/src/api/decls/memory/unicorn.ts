/**
 * Echo Unicorn Emulator API -- x86_64 emulation, hooks, register I/O.
 * Source: https://echo-23.gitbook.io/angel/memory/unicorn-emulator
 *
 * Emulator handles are opaque uint64 values. A handle of 0 means creation
 * failed. Call uc::close(h) when done -- any handles left open are cleaned
 * up automatically on script unload.
 */
export const UNICORN_AS = `
// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Region returned by uc::mem_regions(). */
class uc_memory_region {
    uint64 address;
    uint64 end;
    /** uc::prot bitmask. */
    uint32 perms;
}

/**
 * x86_64 register IDs. Used with uc::reg_read64 / uc::reg_write64
 * (general-purpose), uc::reg_read128 / uc::reg_write128 (xmm) and
 * uc::reg_read256 / uc::reg_write256 (ymm).
 */
enum x86_reg {
    // general purpose
    rax, rbx, rcx, rdx, rsi, rdi, rbp, rsp, rip, eflags,
    r8, r9, r10, r11, r12, r13, r14, r15,

    // segment
    cs, ds, es, fs, gs, ss,
    fs_base, gs_base,

    // control
    /** SSE control/status. */
    mxcsr,

    // SSE 128-bit -- use reg_read128 / reg_write128
    xmm0, xmm1, xmm2, xmm3, xmm4, xmm5, xmm6, xmm7,
    xmm8, xmm9, xmm10, xmm11, xmm12, xmm13, xmm14, xmm15,

    // AVX 256-bit -- low 128 bits alias xmmN, use reg_read256 / reg_write256
    ymm0, ymm1, ymm2, ymm3, ymm4, ymm5, ymm6, ymm7,
    ymm8, ymm9, ymm10, ymm11, ymm12, ymm13, ymm14, ymm15
}

// ---------------------------------------------------------------------------
// Hook callback signatures
// ---------------------------------------------------------------------------

/** Code-hook callback. Return false to stop emulation. */
funcdef bool code_hook_fn(uint64 h, uint64 address, uint32 size);

/** Memory-hook callback. Return false to stop emulation. */
funcdef bool mem_hook_fn(uint64 h, uc::mem_type type, uint64 address, uint32 size, uint64 value);

// ---------------------------------------------------------------------------
// uc namespace -- creation, control, hooks, register / memory I/O
// ---------------------------------------------------------------------------

namespace uc {

/** Memory-protection flags (bitwise OR combinable). */
enum prot {
    none,
    read,
    write,
    exec,
    all
}

/** Memory-access type passed to hook_memory_unmapped callbacks. */
enum mem_type {
    read,
    write,
    fetch,
    read_unmapped,
    write_unmapped,
    fetch_unmapped,
    read_prot,
    write_prot,
    fetch_prot
}

/** Error codes returned by uc::start(). */
enum error {
    ok,
    nomem,
    arch,
    handle,
    mode,
    version,
    read_unmapped,
    write_unmapped,
    fetch_unmapped,
    fetch_prot,
    read_prot,
    write_prot,
    map,
    hook,
    insn_invalid
}

// -- Lifecycle --------------------------------------------------------------

/** Create an empty emulator. Returns 0 on failure. */
uint64 create();

/**
 * Create an emulator backed by the currently attached process
 * (see process::attach()). Pages are faulted in on demand using the process
 * virtual memory layout, mapped at region granularity with correct Win32
 * protection flags; if a region overlaps an already-mapped area, only the
 * faulting page is mapped instead. Write faults to unmapped regions are
 * not auto-mapped and will stop emulation. The process is never modified.
 *
 * Returns 0 if no process is currently attached.
 */
uint64 create_process();

/** Release the handle and all associated memory mappings and hooks. */
void close(uint64 h);

/**
 * Map a stack region and set rsp to the top. Writes \`stop_address\` there
 * so ret halts emulation.
 */
bool setup_stack(uint64 h, uint64 base, uint64 size, uint64 stop_address);

// -- Execution --------------------------------------------------------------

/**
 * Run emulation. \`timeout\` is microseconds; \`count\` is instructions
 * (0 = unlimited). Returns a uc::error value; uc::error::ok on clean exit.
 */
int start(uint64 h, uint64 begin, uint64 end, uint64 timeout = 0, uint64 count = 0);

/** Stop a running emulation from within a hook. */
void stop(uint64 h);

/** Invalidate the internal translation cache after self-modifying code. */
bool flush_code(uint64 h);

/** Last error code after a failed start(). */
uint32 last_error(uint64 h);

/** Fault address after a failed start(). */
uint64 fault_address(uint64 h);

// -- Hooks ------------------------------------------------------------------

/**
 * Attach a code hook. \`begin > end\` (the default) means the hook fires
 * for all addresses.
 */
bool hook_code(uint64 h, code_hook_fn@ cb, uint64 begin = 1, uint64 end = 0);

/**
 * Attach an unmapped-memory hook. \`begin > end\` (the default) means the
 * hook fires for all addresses.
 */
bool hook_memory_unmapped(uint64 h, mem_hook_fn@ cb, uint64 begin = 1, uint64 end = 0);

// -- Register access --------------------------------------------------------

/** Read a 64-bit general-purpose register. */
bool reg_read64(uint64 h, x86_reg reg, uint64 &out val);

/** Write a 64-bit general-purpose register. */
bool reg_write64(uint64 h, x86_reg reg, uint64 val);

/** Read a 128-bit xmm register. \`data\` is filled with exactly 16 bytes. */
bool reg_read128(uint64 h, x86_reg reg, array<uint8> &out data);

/** Write a 128-bit xmm register. \`data\` must be exactly 16 bytes. */
bool reg_write128(uint64 h, x86_reg reg, const array<uint8> &in data);

/** Read a 256-bit ymm register. \`data\` is filled with exactly 32 bytes. */
bool reg_read256(uint64 h, x86_reg reg, array<uint8> &out data);

/** Write a 256-bit ymm register. \`data\` must be exactly 32 bytes. */
bool reg_write256(uint64 h, x86_reg reg, const array<uint8> &in data);

// -- Memory mapping ---------------------------------------------------------

/** Map a region into the emulator's address space. */
bool mem_map(uint64 h, uint64 address, uint64 size, uint perms);

/** Unmap a region. */
bool mem_unmap(uint64 h, uint64 address, uint64 size);

/** Change protection flags on a region. */
bool mem_protect(uint64 h, uint64 address, uint64 size, uint perms);

/** Write bytes into the emulator's address space. */
bool mem_write(uint64 h, uint64 address, const array<uint8> &in data);

/** Read bytes from the emulator's address space. */
bool mem_read(uint64 h, uint64 address, uint32 size, array<uint8> &out data);

/**
 * Returns the uc::prot bitmask for the region containing \`address\`, or
 * -1 if unmapped. For create_process() handles, if the address is not yet
 * mapped in the emulator, falls back to querying the host process
 * protection and returns the equivalent uc::prot bitmask.
 */
int mem_query(uint64 h, uint64 address);

/** Fill \`regions\` with every currently mapped region. */
bool mem_regions(uint64 h, array<uc_memory_region> &out regions);

}
`;
