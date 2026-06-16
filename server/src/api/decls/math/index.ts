import { VECTORS_AS } from './vectors';
import { MATRICES_AS } from './matrices';
import { TRACING_AS } from './tracing';
import { HELPERS_AS } from './helpers';
import { CLIPPING_AS } from './clipping';

/**
 * Echo "Math" category. Vectors and matrices come first because
 * everything else (tracing, helpers, clipping, drawing, engines)
 * references them.
 */
export const MATH_SOURCES: ReadonlyArray<readonly [string, string]> = [
  ['math/vectors.as',  VECTORS_AS],
  ['math/matrices.as', MATRICES_AS],
  ['math/tracing.as',  TRACING_AS],
  ['math/helpers.as',  HELPERS_AS],
  ['math/clipping.as', CLIPPING_AS],
];
