import { Hover, MarkupKind, Position } from 'vscode-languageserver/node';
import { Reference, Sym, formatType, symbolToType } from '../analyzer';
import { referenceAt } from './lookups';

/**
 * Handle textDocument/hover.
 *
 * When the cursor sits on a resolved reference, return a hover containing
 * the symbol's kind, formatted signature/type, and source location.
 */
export function findHover(
  position: Position,
  references: Reference[],
): Hover | null {
  const ref = referenceAt(references, position);
  if (!ref || !ref.symbol) return null;

  const sig = formatSymbol(ref.symbol);
  const doc = (ref.symbol.decl as { doc?: string }).doc;
  const value = doc
    ? '```angelscript\n' + sig + '\n```\n\n---\n\n' + doc
    : '```angelscript\n' + sig + '\n```';
  return {
    contents: { kind: MarkupKind.Markdown, value },
    range: {
      start: { line: ref.range.start.line, character: ref.range.start.column },
      end:   { line: ref.range.end.line,   character: ref.range.end.column },
    },
  };
}

function formatSymbol(sym: Sym): string {
  const t = symbolToType(sym);
  switch (sym.kind) {
    case 'class':           return `class ${sym.name}`;
    case 'interface':       return `interface ${sym.name}`;
    case 'enum':            return `enum ${sym.name}`;
    case 'enum-member':     return `${sym.scope.owner?.name ?? '<enum>'}::${sym.name}`;
    case 'namespace':       return `namespace ${sym.name}`;
    case 'funcdef':         return `funcdef ${sym.name}`;
    case 'typedef':         return `typedef ${sym.name}`;
    case 'constructor':     return `${sym.name}${formatFunctionSig(t)}`;
    case 'destructor':      return `${sym.name}${formatFunctionSig(t)}`;
    case 'function':
    case 'method':          return `${formatTypeOrEmpty(returnTypeOf(t))} ${sym.name}${formatFunctionSig(t)}`;
    case 'field':           return `(field) ${formatType(t)} ${sym.name}`;
    case 'global-variable': return `${formatType(t)} ${sym.name}`;
    case 'local-variable':  return `(local) ${formatType(t)} ${sym.name}`;
    case 'parameter':       return `(parameter) ${formatType(t)} ${sym.name}`;
  }
}

function returnTypeOf(t: ReturnType<typeof symbolToType>) {
  return t.kind === 'function' ? t.returnType : t;
}

function formatTypeOrEmpty(t: ReturnType<typeof symbolToType>): string {
  return t.kind === 'unknown' ? '' : formatType(t);
}

function formatFunctionSig(t: ReturnType<typeof symbolToType>): string {
  if (t.kind !== 'function') return '()';
  const params = t.params.map(p => {
    const dir = p.direction ? p.direction + ' ' : '';
    const nm = p.name ? ' ' + p.name : '';
    return `${dir}${formatType(p.type)}${nm}${p.defaulted ? ' = ...' : ''}`;
  }).join(', ');
  return `(${params})`;
}
