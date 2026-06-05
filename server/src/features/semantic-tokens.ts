import { SemanticTokens, SemanticTokensLegend } from 'vscode-languageserver/node';
import { Reference, SymKind } from '../analyzer';

/**
 * Standard LSP semantic token types we emit. The index of each entry is
 * its wire-protocol ID -- VSCode's themes map these names to colors.
 *
 * Keep this in lockstep with {@link tokenTypeIndex} below.
 */
export const TOKEN_TYPES = [
  'namespace',
  'type',
  'class',
  'interface',
  'enum',
  'enumMember',
  'parameter',
  'variable',
  'property',
  'function',
  'method',
] as const;

const TOKEN_TYPE_INDEX = new Map<string, number>(
  TOKEN_TYPES.map((name, i) => [name, i]),
);

export const SEMANTIC_TOKENS_LEGEND: SemanticTokensLegend = {
  tokenTypes: [...TOKEN_TYPES],
  tokenModifiers: [],
};

/**
 * Encode every reference into the LSP semantic-tokens delta format.
 *
 * Wire format per token: [deltaLine, deltaStart, length, tokenType, modifiers].
 * `deltaLine` is relative to the previous token's line. `deltaStart` is
 * relative to the previous token's column when on the same line, else
 * absolute.
 */
export function computeSemanticTokens(references: Reference[]): SemanticTokens {
  // Only resolved references; sort by position.
  const sorted = references
    .filter(r => r.symbol !== null)
    .slice()
    .sort((a, b) => {
      if (a.range.start.line !== b.range.start.line) {
        return a.range.start.line - b.range.start.line;
      }
      return a.range.start.column - b.range.start.column;
    });

  const data: number[] = [];
  let prevLine = 0;
  let prevCol = 0;

  for (const ref of sorted) {
    const line = ref.range.start.line;
    const startCol = ref.range.start.column;
    const endCol = ref.range.end.column;
    const length = endCol - startCol;

    // Skip multi-line ranges (shouldn't happen for identifier refs) and
    // empty ranges.
    if (length <= 0 || ref.range.start.line !== ref.range.end.line) continue;

    const tokenType = tokenTypeIndex(ref.symbol!.kind);
    if (tokenType < 0) continue;

    const deltaLine = line - prevLine;
    const deltaStart = deltaLine === 0 ? startCol - prevCol : startCol;

    data.push(deltaLine, deltaStart, length, tokenType, 0);

    prevLine = line;
    prevCol = startCol;
  }

  return { data };
}

function tokenTypeIndex(kind: SymKind): number {
  const name = tokenTypeFor(kind);
  if (!name) return -1;
  return TOKEN_TYPE_INDEX.get(name) ?? -1;
}

function tokenTypeFor(kind: SymKind): string | null {
  switch (kind) {
    case 'class':           return 'class';
    case 'interface':       return 'interface';
    case 'enum':            return 'enum';
    case 'enum-member':     return 'enumMember';
    case 'namespace':       return 'namespace';
    case 'funcdef':         return 'interface';
    case 'typedef':         return 'type';
    case 'function':        return 'function';
    case 'method':          return 'method';
    case 'constructor':     return 'method';
    case 'destructor':      return 'method';
    case 'field':           return 'property';
    case 'parameter':       return 'parameter';
    case 'local-variable':  return 'variable';
    case 'global-variable': return 'variable';
  }
}
