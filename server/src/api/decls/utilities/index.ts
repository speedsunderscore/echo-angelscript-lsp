import { GENERAL_AS } from './general';
import { LOGGING_AS } from './logging';
import { FILESYSTEM_AS } from './filesystem';
import { INPUT_AS } from './input';
import { JSON_AS } from './json';

/** Echo "Utilities" category -- general, logging, filesystem, input, json. */
export const UTILITIES_SOURCES: ReadonlyArray<readonly [string, string]> = [
  ['utilities/general.as',    GENERAL_AS],
  ['utilities/logging.as',    LOGGING_AS],
  ['utilities/filesystem.as', FILESYSTEM_AS],
  ['utilities/input.as',      INPUT_AS],
  ['utilities/json.as',       JSON_AS],
];
