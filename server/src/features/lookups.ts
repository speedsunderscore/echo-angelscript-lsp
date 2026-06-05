import { Position } from 'vscode-languageserver/node';
import { Reference, Sym } from '../analyzer';

/** Position is inside [start, end). */
export function positionInRange(pos: Position, range: { start: { line: number; column: number }; end: { line: number; column: number } }): boolean {
  if (pos.line < range.start.line || pos.line > range.end.line) return false;
  if (pos.line === range.start.line && pos.character < range.start.column) return false;
  if (pos.line === range.end.line && pos.character > range.end.column) return false;
  return true;
}

/** Find the reference under a given cursor position. */
export function referenceAt(references: Reference[], pos: Position): Reference | undefined {
  for (const r of references) {
    if (positionInRange(pos, r.range)) return r;
  }
  return undefined;
}

/** Two symbols are "the same" if they share identity (same declaration). */
export function sameSymbol(a: Sym, b: Sym): boolean {
  return a.decl === b.decl;
}

/**
 * True if the symbol came from a bundled API declaration. The selection
 * range stored on these symbols is in API-source coordinates and has no
 * meaning in a user file, so LSP location-returning features should skip
 * them.
 */
export function isExternalSymbol(sym: Sym): boolean {
  let s: { external: boolean; parent: typeof s | null } | null = sym.scope;
  while (s) {
    if (s.external) return true;
    s = s.parent;
  }
  return false;
}
