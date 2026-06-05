import { BUILTIN_AS } from './builtin';
import { COMMON_AS } from './common';
import { MATH_SOURCES } from './math';
import { MEMORY_SOURCES } from './memory';
import { DRAWING_SOURCES } from './drawing';
import { UTILITIES_SOURCES } from './utilities';
import { CONTAINERS_SOURCES } from './containers';
import { NETWORKING_SOURCES } from './networking';
import { RUNTIME_SOURCES } from './runtime';
import { ENGINES_SOURCES } from './engines';

/**
 * Every bundled API declaration source, in load order. Order matters --
 * each source is analyzed into the API scope before the next is parsed,
 * so any file that references types from another file must come AFTER
 * that file.
 *
 * Math (vectors/matrices) comes early because drawing and engines both
 * reference vec/matrix types.
 *
 * Add new categories by importing their `*_SOURCES` array from
 * `./<category>/index.ts` and spreading it in at the right position.
 */
export const ALL_SOURCES: ReadonlyArray<readonly [string, string]> = [
  ['builtin.as', BUILTIN_AS],
  ['common.as',  COMMON_AS],
  ...MATH_SOURCES,
  ...MEMORY_SOURCES,
  ...DRAWING_SOURCES,
  ...UTILITIES_SOURCES,
  ...CONTAINERS_SOURCES,
  ...NETWORKING_SOURCES,
  ...RUNTIME_SOURCES,
  ...ENGINES_SOURCES,
];
