import { SOURCE_AS } from './source';
import { UNREAL_ENGINE_AS } from './unreal';
import { IW_ENGINE_AS } from './iw';

/** Echo "Engines" category -- Source / Source 2, Unreal, IW (Call of Duty). */
export const ENGINES_SOURCES: ReadonlyArray<readonly [string, string]> = [
  ['engines/source.as', SOURCE_AS],
  ['engines/unreal.as', UNREAL_ENGINE_AS],
  ['engines/iw.as',     IW_ENGINE_AS],
];
