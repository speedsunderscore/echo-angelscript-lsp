import {
  CompletionItem,
  CompletionItemKind,
  Position,
} from 'vscode-languageserver/node';
import {
  Scope,
  Sym,
  SymKind,
  Type,
  formatType,
  membersOf,
  symbolToType,
} from '../analyzer';

const AS_KEYWORDS: ReadonlySet<string> = new Set([
  'and', 'abstract', 'auto', 'bool', 'break', 'case', 'cast', 'catch', 'class',
  'const', 'continue', 'default', 'delete', 'do', 'double', 'else', 'enum',
  'explicit', 'external', 'false', 'final', 'float', 'for', 'from', 'funcdef',
  'function', 'get', 'if', 'import', 'in', 'inout', 'int', 'int8', 'int16',
  'int32', 'int64', 'interface', 'is', 'mixin', 'namespace', 'not', 'null',
  'or', 'out', 'override', 'private', 'property', 'protected', 'public',
  'return', 'set', 'shared', 'super', 'switch', 'this', 'true', 'try',
  'typedef', 'uint', 'uint8', 'uint16', 'uint32', 'uint64', 'void', 'while',
  'xor',
]);

/**
 * Handle textDocument/completion.
 *
 * Determines the completion context by looking at characters immediately
 * before the cursor:
 *   - `receiver.` -> list members reachable through `receiver`'s type
 *   - `Qualifier::` -> list members of `Qualifier`'s inner scope
 *   - otherwise -> list every symbol visible from the current scope chain,
 *                  plus AS keywords
 */
export function findCompletions(
  text: string,
  offset: number,
  position: Position,
  global: Scope,
): CompletionItem[] {
  // Step back past any partial identifier being typed.
  let i = offset;
  while (i > 0 && isIdentChar(text.charAt(i - 1))) i--;

  const trigger = text.charAt(i - 1);
  const trigger2 = text.substring(i - 2, i);

  const cursorScope = global.scopeAt(offset);

  if (trigger2 === '::') {
    return completeAfterColonColon(text, i - 2, global);
  }
  if (trigger === '.') {
    return completeAfterDot(text, i - 1, cursorScope);
  }
  return completeIdentifiers(cursorScope, position);
}

// ---------------------------------------------------------------------------

function completeIdentifiers(scope: Scope, _position: Position): CompletionItem[] {
  const out: CompletionItem[] = [];
  const seen = new Set<string>();
  let s: Scope | null = scope;
  while (s) {
    for (const [name, syms] of s.symbols) {
      if (seen.has(name)) continue;
      seen.add(name);
      out.push(symbolToCompletion(syms[0]));
    }
    s = s.parent;
  }
  for (const kw of AS_KEYWORDS) {
    if (seen.has(kw)) continue;
    out.push({ label: kw, kind: CompletionItemKind.Keyword });
  }
  return out;
}

function completeAfterDot(text: string, dotPos: number, scope: Scope): CompletionItem[] {
  const recvName = readIdentBefore(text, dotPos);
  if (!recvName) return [];
  const sym = scope.lookup(recvName);
  if (!sym || sym.length === 0) return [];
  const recvType = symbolToType(sym[0]);
  return memberCompletions(recvType);
}

function completeAfterColonColon(text: string, colonsPos: number, scope: Scope): CompletionItem[] {
  const recvName = readIdentBefore(text, colonsPos);
  if (!recvName) return [];
  const sym = scope.lookup(recvName);
  if (!sym || sym.length === 0 || !sym[0].innerScope) return [];
  const out: CompletionItem[] = [];
  for (const [, syms] of sym[0].innerScope.symbols) {
    out.push(symbolToCompletion(syms[0]));
  }
  return out;
}

function memberCompletions(t: Type): CompletionItem[] {
  return membersOf(t).map(symbolToCompletion);
}

function symbolToCompletion(sym: Sym): CompletionItem {
  return {
    label: sym.name,
    kind: completionKind(sym.kind),
    detail: formatType(symbolToType(sym)),
  };
}

function completionKind(kind: SymKind): CompletionItemKind {
  switch (kind) {
    case 'class':           return CompletionItemKind.Class;
    case 'interface':       return CompletionItemKind.Interface;
    case 'enum':            return CompletionItemKind.Enum;
    case 'enum-member':     return CompletionItemKind.EnumMember;
    case 'namespace':       return CompletionItemKind.Module;
    case 'funcdef':         return CompletionItemKind.Interface;
    case 'typedef':         return CompletionItemKind.TypeParameter;
    case 'constructor':     return CompletionItemKind.Constructor;
    case 'destructor':      return CompletionItemKind.Constructor;
    case 'function':        return CompletionItemKind.Function;
    case 'method':          return CompletionItemKind.Method;
    case 'field':           return CompletionItemKind.Field;
    case 'parameter':       return CompletionItemKind.Variable;
    case 'local-variable':  return CompletionItemKind.Variable;
    case 'global-variable': return CompletionItemKind.Variable;
  }
}

// ---------------------------------------------------------------------------

function isIdentChar(c: string): boolean {
  return (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z')
      || (c >= '0' && c <= '9') || c === '_';
}

/** Read the identifier ending at position `end` (exclusive); returns '' if none. */
function readIdentBefore(text: string, end: number): string {
  let j = end;
  while (j > 0 && isIdentChar(text.charAt(j - 1))) j--;
  return text.slice(j, end);
}
