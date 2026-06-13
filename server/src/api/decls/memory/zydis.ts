/**
 * Echo Zydis Disasm API -- x86 disassembly with rip-relative resolution.
 * Source: https://echo-23.gitbook.io/angel/memory/zydis-disasm
 */
export const ZYDIS_AS = `
// ---------------------------------------------------------------------------
// Operand classification enums -- used by disasm_operand fields.
// ---------------------------------------------------------------------------

/** Operand type (disasm_operand::type). */
enum op_type {
    unused,
    reg,
    mem,
    ptr,
    imm
}

/** Operand visibility (disasm_operand::visibility). */
enum op_visibility {
    invalid,
    explicit,
    implicit,
    hidden
}

/** Operand action flags (disasm_operand::action -- bitmask). */
enum op_action {
    read,
    write,
    readwrite,
    condread,
    condwrite,
    read_condwrite,
    condread_write
}

// ---------------------------------------------------------------------------
// Operand & instruction structs
// ---------------------------------------------------------------------------

/** A single operand decoded from an instruction. */
class disasm_operand {
    /** op_type value. */
    int type;
    /** op_visibility value. */
    int visibility;
    /** op_action bitmask. */
    int action;

    /** Valid when type == op_type::reg; pass to zydis::reg_name(). */
    int reg;

    /** Valid when type == op_type::imm. */
    bool imm_is_signed;
    bool imm_is_relative;
    uint64 imm_value;

    /** Valid when type == op_type::mem. */
    int mem_segment;
    int mem_base;
    int mem_index;
    uint8 mem_scale;
    int64 mem_disp;
    bool mem_has_disp;
}

/**
 * A decoded instruction. Reference-counted -- returned inside the output
 * array of zydis::disasm() / zydis::disasm_func().
 */
class disasm_insn {
    /** Base address; rip-relative operands resolve against this. */
    uint64 runtime_address;
    /** Encoded byte length. */
    uint8 length;
    /** Raw Zydis mnemonic id. */
    int mnemonic;
    /** Intel-syntax disassembly. */
    string text;
    /** Total operand count (includes implicit and hidden operands). */
    uint8 operand_count;
    /** Visible operand count (excludes implicit / hidden). */
    uint8 operand_count_visible;

    /** Get the operand at \`idx\`. Returns a default operand if out of range. */
    disasm_operand get_op(uint8 idx) const;
}

// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

namespace zydis {

/** Returns the register name string from disasm_operand::reg. */
string reg_name(int reg);

/**
 * Disassemble every byte in \`bytes\`. Results appended to \`insns\`.
 * Returns true on success.
 */
bool disasm(const array<uint8>@ &in bytes, array<disasm_insn@> &out insns);

/**
 * Disassemble every byte in \`bytes\`, treating \`rip\` as the base address.
 * \`rip\` affects display and resolves rip-relative operands.
 */
bool disasm(const array<uint8>@ &in bytes, uint64 rip, array<disasm_insn@> &out insns);

/**
 * Disassemble until the first ret/iret.
 * Returns false if the instruction limit (4096) is reached without a return.
 */
bool disasm_func(const array<uint8>@ &in bytes, array<disasm_insn@> &out insns);

/**
 * Disassemble until the first ret/iret, treating \`rip\` as the base address.
 * Returns false if the instruction limit (4096) is reached without a return.
 */
bool disasm_func(const array<uint8>@ &in bytes, uint64 rip, array<disasm_insn@> &out insns);

}
`;
