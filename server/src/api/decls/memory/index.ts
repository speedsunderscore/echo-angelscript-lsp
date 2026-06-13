import { PROCESS_AS } from './process';
import { ZYDIS_AS } from './zydis';
import { UNICORN_AS } from './unicorn';
import { SIMD_AS } from './simd';

/**
 * Echo "Memory" category -- process attach, disassembly, emulation, SIMD.
 * Add new memory APIs by importing their constant and listing them below.
 */
export const MEMORY_SOURCES: ReadonlyArray<readonly [string, string]> = [
  ['memory/process.as', PROCESS_AS],
  ['memory/zydis.as',   ZYDIS_AS],
  ['memory/unicorn.as', UNICORN_AS],
  ['memory/simd.as',    SIMD_AS],
];
