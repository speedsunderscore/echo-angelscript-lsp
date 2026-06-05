import { DocumentHighlight, DocumentHighlightKind, Position } from 'vscode-languageserver/node';
import { Reference } from '../analyzer';
import { referenceAt, sameSymbol } from './lookups';

/**
 * Handle textDocument/documentHighlight.
 *
 * When the user's cursor is on a symbol, highlight every other reference to
 * that same symbol in the current file. Used by VSCode's automatic
 * same-symbol highlighting (the gentle box around the word).
 */
export function findDocumentHighlights(
  position: Position,
  references: Reference[],
): DocumentHighlight[] {
  const target = referenceAt(references, position);
  if (!target || !target.symbol) return [];
  const sym = target.symbol;

  const out: DocumentHighlight[] = [];
  for (const r of references) {
    if (r.symbol && sameSymbol(r.symbol, sym)) {
      out.push({
        range: {
          start: { line: r.range.start.line, character: r.range.start.column },
          end:   { line: r.range.end.line,   character: r.range.end.column },
        },
        kind: DocumentHighlightKind.Read,
      });
    }
  }
  return out;
}
