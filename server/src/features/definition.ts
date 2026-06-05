import { Location, Position } from 'vscode-languageserver/node';
import { Reference } from '../analyzer';
import { referenceAt } from './lookups';

/**
 * Handle textDocument/definition.
 *
 * Returns the resolved symbol's declaration location. If the symbol was
 * declared in another file (a different user file, or the bundled API),
 * the symbol carries a `sourceUri` and we use that -- F12 then jumps
 * cross-file. Otherwise fall back to the request URI.
 */
export function findDefinition(
  uri: string,
  position: Position,
  references: Reference[],
): Location[] {
  const ref = referenceAt(references, position);
  if (!ref || !ref.symbol) return [];

  const targetUri = ref.symbol.sourceUri ?? uri;
  const sel = ref.symbol.selectionRange;
  return [{
    uri: targetUri,
    range: {
      start: { line: sel.start.line, character: sel.start.column },
      end:   { line: sel.end.line,   character: sel.end.column },
    },
  }];
}
