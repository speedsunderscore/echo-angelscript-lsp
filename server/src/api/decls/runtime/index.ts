import { THREADING_AS } from './threading';

/** Echo "AngelScript API" / runtime -- threading, mutexes, atomics. */
export const RUNTIME_SOURCES: ReadonlyArray<readonly [string, string]> = [
  ['runtime/threading.as', THREADING_AS],
];
