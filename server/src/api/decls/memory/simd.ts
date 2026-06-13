/**
 * Echo SIMD & Bit Operations API -- low-level CPU intrinsics for bit
 * manipulation and SSE integer ops.
 * Source: https://echo-23.gitbook.io/angel/memory/simd-and-bit-operations
 *
 * NOTE: All SSE functions require array<uint8> of exactly 16 bytes (128 bits).
 */
export const SIMD_AS = `
// ===========================================================================
// Bit Rotation
// ===========================================================================

/** Rotate \`value\` left by \`count\` bits, wrapping around. */
uint8  rol8 (uint8  value, int count);
/** Rotate \`value\` right by \`count\` bits, wrapping around. */
uint8  ror8 (uint8  value, int count);
/** Rotate \`value\` left by \`count\` bits, wrapping around. */
uint16 rol16(uint16 value, int count);
/** Rotate \`value\` right by \`count\` bits, wrapping around. */
uint16 ror16(uint16 value, int count);
/** Rotate \`value\` left by \`count\` bits, wrapping around. */
uint32 rol32(uint32 value, int count);
/** Rotate \`value\` right by \`count\` bits, wrapping around. */
uint32 ror32(uint32 value, int count);
/** Rotate \`value\` left by \`count\` bits, wrapping around. */
uint64 rol64(uint64 value, int count);
/** Rotate \`value\` right by \`count\` bits, wrapping around. */
uint64 ror64(uint64 value, int count);

// ===========================================================================
// Byte Swap -- reverse byte order (endianness conversion)
// ===========================================================================

/** Reverse byte order of a 16-bit value. */
uint16 bswap16(uint16 value);
/** Reverse byte order of a 32-bit value. */
uint32 bswap32(uint32 value);
/** Reverse byte order of a 64-bit value. */
uint64 bswap64(uint64 value);

// ===========================================================================
// Bit Counts
// ===========================================================================

/** Population count -- number of set bits. */
int popcnt32(uint32 value);
/** Population count -- number of set bits. */
int popcnt64(uint64 value);

/** Leading-zero count (counted from MSB). */
int lzcnt32(uint32 value);
/** Leading-zero count (counted from MSB). */
int lzcnt64(uint64 value);

/** Trailing-zero count (counted from LSB). */
int tzcnt32(uint32 value);
/** Trailing-zero count (counted from LSB). */
int tzcnt64(uint64 value);

// ===========================================================================
// SSE Logical (16 bytes in, 16 bytes out)
// ===========================================================================

/** Bitwise XOR: result = a ^ b. */
void mm_xor_si128(array<uint8> a, array<uint8> b, array<uint8> &out result);
/** Bitwise OR: result = a | b. */
void mm_or_si128 (array<uint8> a, array<uint8> b, array<uint8> &out result);
/** Bitwise AND: result = a & b. */
void mm_and_si128(array<uint8> a, array<uint8> b, array<uint8> &out result);
/** Bitwise AND-NOT: result = (~a) & b. */
void mm_andnot_si128(array<uint8> a, array<uint8> b, array<uint8> &out result);

// ===========================================================================
// SSE Shifts
// ===========================================================================

/** 8 lanes of int16, each shifted left by \`imm8\`. */
void mm_slli_epi16(array<uint8> a, int imm8, array<uint8> &out result);
/** 8 lanes of int16, each shifted right (logical) by \`imm8\`. */
void mm_srli_epi16(array<uint8> a, int imm8, array<uint8> &out result);
/** 4 lanes of int32, each shifted left by \`imm8\`. */
void mm_slli_epi32(array<uint8> a, int imm8, array<uint8> &out result);
/** 4 lanes of int32, each shifted right (logical) by \`imm8\`. */
void mm_srli_epi32(array<uint8> a, int imm8, array<uint8> &out result);
/** 2 lanes of int64, each shifted left by \`imm8\`. */
void mm_slli_epi64(array<uint8> a, int imm8, array<uint8> &out result);
/** 2 lanes of int64, each shifted right (logical) by \`imm8\`. */
void mm_srli_epi64(array<uint8> a, int imm8, array<uint8> &out result);

/** Whole-register byte shift left by \`imm8\` bytes (imm8 * 8 bits). */
void mm_slli_si128(array<uint8> a, int imm8, array<uint8> &out result);
/** Whole-register byte shift right by \`imm8\` bytes (imm8 * 8 bits). */
void mm_srli_si128(array<uint8> a, int imm8, array<uint8> &out result);

// ===========================================================================
// SSE Shuffle
// ===========================================================================

/** pshufb -- \`b\` selects bytes from \`a\`; mask bit 7 zeros the byte. */
void mm_shuffle_epi8(array<uint8> a, array<uint8> b, array<uint8> &out result);

/** pshufd -- permute 4 lanes of int32 according to \`imm8\`. */
void mm_shuffle_epi32(array<uint8> a, int imm8, array<uint8> &out result);

/** pshufhw -- shuffle the high 4 lanes of int16 according to \`imm8\`. */
void mm_shufflehi_epi16(array<uint8> a, int imm8, array<uint8> &out result);

/** pshuflw -- shuffle the low 4 lanes of int16 according to \`imm8\`. */
void mm_shufflelo_epi16(array<uint8> a, int imm8, array<uint8> &out result);

// ===========================================================================
// SSE Unpack
// ===========================================================================

/** Interleave high 8 bytes of a and b. */
void mm_unpackhi_epi8 (array<uint8> a, array<uint8> b, array<uint8> &out result);
/** Interleave high 4 x int16 lanes of a and b. */
void mm_unpackhi_epi16(array<uint8> a, array<uint8> b, array<uint8> &out result);
/** Interleave high 2 x int32 lanes of a and b. */
void mm_unpackhi_epi32(array<uint8> a, array<uint8> b, array<uint8> &out result);
/** Interleave high 1 x int64 lane of a and b. */
void mm_unpackhi_epi64(array<uint8> a, array<uint8> b, array<uint8> &out result);

/** Interleave low 8 bytes of a and b. */
void mm_unpacklo_epi8 (array<uint8> a, array<uint8> b, array<uint8> &out result);
/** Interleave low 4 x int16 lanes of a and b. */
void mm_unpacklo_epi16(array<uint8> a, array<uint8> b, array<uint8> &out result);
/** Interleave low 2 x int32 lanes of a and b. */
void mm_unpacklo_epi32(array<uint8> a, array<uint8> b, array<uint8> &out result);
/** Interleave low 1 x int64 lane of a and b. */
void mm_unpacklo_epi64(array<uint8> a, array<uint8> b, array<uint8> &out result);

// ===========================================================================
// SSE Arithmetic
// ===========================================================================

/** Add 16 lanes of int8 elementwise. */
void mm_add_epi8 (array<uint8> a, array<uint8> b, array<uint8> &out result);
/** Add 8 lanes of int16 elementwise. */
void mm_add_epi16(array<uint8> a, array<uint8> b, array<uint8> &out result);
/** Add 4 lanes of int32 elementwise. */
void mm_add_epi32(array<uint8> a, array<uint8> b, array<uint8> &out result);
/** Add 2 lanes of int64 elementwise. */
void mm_add_epi64(array<uint8> a, array<uint8> b, array<uint8> &out result);

/** Subtract 16 lanes of int8 elementwise (a - b). */
void mm_sub_epi8 (array<uint8> a, array<uint8> b, array<uint8> &out result);
/** Subtract 8 lanes of int16 elementwise (a - b). */
void mm_sub_epi16(array<uint8> a, array<uint8> b, array<uint8> &out result);
/** Subtract 4 lanes of int32 elementwise (a - b). */
void mm_sub_epi32(array<uint8> a, array<uint8> b, array<uint8> &out result);
/** Subtract 2 lanes of int64 elementwise (a - b). */
void mm_sub_epi64(array<uint8> a, array<uint8> b, array<uint8> &out result);

/** Multiply 8 lanes of int16, keeping the low 16 bits of each product. */
void mm_mullo_epi16(array<uint8> a, array<uint8> b, array<uint8> &out result);

/** Multiply 4 lanes of int32, keeping the low 32 bits of each product. */
void mm_mullo_epi32(array<uint8> a, array<uint8> b, array<uint8> &out result);

// ===========================================================================
// SSE Set / Broadcast
// ===========================================================================

/** result = { 0, 0, ... 16 bytes } */
void mm_setzero_si128(array<uint8> &out result);

/** result = [e1, e0] as two int64 lanes. */
void mm_set_epi64x(int64 e1, int64 e0, array<uint8> &out result);

/** result = [e3, e2, e1, e0] as four int32 lanes. */
void mm_set_epi32(int32 e3, int32 e2, int32 e1, int32 e0, array<uint8> &out result);

/** Broadcast \`a\` to two int64 lanes. */
void mm_set1_epi64x(int64 a, array<uint8> &out result);
/** Broadcast \`a\` to four int32 lanes. */
void mm_set1_epi32 (int32 a, array<uint8> &out result);
/** Broadcast \`a\` to eight int16 lanes. */
void mm_set1_epi16 (int16 a, array<uint8> &out result);
/** Broadcast \`a\` to sixteen int8 lanes. */
void mm_set1_epi8  (int8  a, array<uint8> &out result);

/** Broadcast \`a\` to two uint64 lanes. */
void broadcast_qword(uint64 a, array<uint8> &out result);
/** Broadcast \`a\` to four uint32 lanes. */
void broadcast_dword(uint32 a, array<uint8> &out result);

// ===========================================================================
// SSE Extract -- pull one lane out as a scalar
// ===========================================================================

/** Extract an int64 lane (index 0..1). */
int64 mm_extract_epi64(array<uint8> a, int index);
/** Extract an int32 lane (index 0..3). */
int   mm_extract_epi32(array<uint8> a, int index);
/** Extract an int16 lane, zero-extended (index 0..7). */
int   mm_extract_epi16(array<uint8> a, int index);
/** Extract an int8 lane, zero-extended (index 0..15). */
int   mm_extract_epi8 (array<uint8> a, int index);

// ===========================================================================
// SSE Compare -- per-lane equality. Matching lanes are 0xFF, others 0x00.
// ===========================================================================

/** Compare 16 lanes of int8 elementwise. */
void mm_cmpeq_epi8 (array<uint8> a, array<uint8> b, array<uint8> &out result);
/** Compare 8 lanes of int16 elementwise. */
void mm_cmpeq_epi16(array<uint8> a, array<uint8> b, array<uint8> &out result);
/** Compare 4 lanes of int32 elementwise. */
void mm_cmpeq_epi32(array<uint8> a, array<uint8> b, array<uint8> &out result);
`;
