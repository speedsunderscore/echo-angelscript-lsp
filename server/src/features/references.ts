import { Location, Position } from 'vscode-languageserver/node';
import { Reference } from '../analyzer';
import { isExternalSymbol, referenceAt, sameSymbol } from './lookups';

/**
 * Handle textDocument/references.
 *
 * Finds the symbol under the cursor, then returns the source ranges of
 * every other reference resolving to that same symbol. When
 * includeDeclaration is true, the declaration itself is also returned.
 */
export function findReferences(
  uri: string,
  position: Position,
  references: Reference[],
  includeDeclaration: boolean,
): Location[] {
  const target = referenceAt(references, position);
  if (!target || !target.symbol) return [];
  const sym = target.symbol;

  const out: Location[] = [];
  for (const r of references) {
    if (r.symbol && sameSymbol(r.symbol, sym)) {
      out.push({
        uri,
        range: {
          start: { line: r.range.start.line, character: r.range.start.column },
          end:   { line: r.range.end.line,   character: r.range.end.column },
        },
      });
    }
  }

  if (includeDeclaration) {
    const declUri = sym.sourceUri ?? uri;
    const sel = sym.selectionRange;
    out.push({
      uri: declUri,
      range: {
        start: { line: sel.start.line, character: sel.start.column },
        end:   { line: sel.end.line,   character: sel.end.column },
      },
    });
  }

  return out;
}
