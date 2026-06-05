import {
  ParameterInformation,
  SignatureHelp,
  SignatureInformation,
} from 'vscode-languageserver/node';
import {
  FunctionType,
  Scope,
  Sym,
  Type,
  formatType,
  lookupMemberAll,
  symbolToType,
} from '../analyzer';

/**
 * Handle textDocument/signatureHelp.
 *
 * Text-based -- walks back from the cursor to find the nearest unmatched `(`,
 * reads the callee (a chain like `foo`, `obj.foo`, `NS::cls.foo`), resolves
 * it through the scope, and emits one SignatureInformation per overload.
 * Active parameter is the number of top-level commas between `(` and cursor.
 *
 * Text-based (not AST-based) so it keeps working while the user is still
 * typing and the parser can't yet produce a clean CallExpr.
 */
export function findSignatureHelp(
  text: string,
  offset: number,
  global: Scope,
): SignatureHelp | null {
  const probe = findEnclosingCall(text, offset);
  if (!probe) return null;

  const scope = global.scopeAt(offset);
  const overloads = resolveChainOverloads(probe.chain, scope);
  if (overloads.length === 0) return null;

  const signatures: SignatureInformation[] = [];
  for (const sym of overloads) {
    const t = symbolToType(sym);
    if (t.kind === 'function') signatures.push(toSignatureInformation(t));
  }
  if (signatures.length === 0) return null;

  return {
    signatures,
    activeSignature: 0,
    activeParameter: probe.activeParameter,
  };
}

// ---------------------------------------------------------------------------

interface CallProbe {
  /** Callee chain -- e.g. ['obj', 'foo'] for `obj.foo(...)`. */
  chain: string[];
  /** Zero-based index of the parameter the cursor is currently in. */
  activeParameter: number;
}

function findEnclosingCall(text: string, offset: number): CallProbe | null {
  // Walk backwards looking for the unmatched `(`. Skip past nested parens
  // and any quoted strings.
  let depth = 0;
  let commas = 0;
  let i = offset - 1;
  while (i >= 0) {
    const c = text.charAt(i);
    if (c === '"' || c === "'") {
      // Skip past matching quote
      const q = c;
      i--;
      while (i >= 0 && text.charAt(i) !== q) {
        if (text.charAt(i) === '\\') i--;
        i--;
      }
      i--;
      continue;
    }
    if (c === ')' || c === ']' || c === '}') {
      depth++;
    } else if (c === '(') {
      if (depth === 0) {
        const chain = readCalleeChain(text, i);
        if (chain.length === 0) return null;
        return { chain, activeParameter: commas };
      }
      depth--;
    } else if (c === '[' || c === '{') {
      depth--;
    } else if (c === ',' && depth === 0) {
      commas++;
    }
    i--;
  }
  return null;
}

/** Read a chain like `foo`, `obj.foo`, `NS::cls.foo` ending just before `lparenPos`. */
function readCalleeChain(text: string, lparenPos: number): string[] {
  const parts: string[] = [];
  let i = lparenPos;
  while (true) {
    // Skip whitespace
    while (i > 0 && isHorizontalWs(text.charAt(i - 1))) i--;
    // Read identifier
    let end = i;
    while (i > 0 && isIdentChar(text.charAt(i - 1))) i--;
    if (i === end) return parts; // no identifier here
    parts.unshift(text.slice(i, end));
    // Skip whitespace
    while (i > 0 && isHorizontalWs(text.charAt(i - 1))) i--;
    // Look for chain separator
    if (text.substring(i - 2, i) === '::') { i -= 2; continue; }
    if (text.charAt(i - 1) === '.') { i--; continue; }
    return parts;
  }
}

function resolveChainOverloads(chain: string[], scope: Scope): Sym[] {
  if (chain.length === 0) return [];
  // First part: scope-chain lookup, returning all overloads.
  const first = scope.lookup(chain[0]);
  if (!first || first.length === 0) return [];
  if (chain.length === 1) return first;

  // Walk to penultimate -- at each step we pick the first symbol that has
  // member access (variable, class symbol, etc.); overloads are resolved
  // only at the final step.
  let sym: Sym = first[0];
  for (let j = 1; j < chain.length - 1; j++) {
    const t = symbolToType(sym);
    const next = lookupMemberAll(t, chain[j])[0];
    if (!next) return [];
    sym = next;
  }
  const last = chain[chain.length - 1];
  return lookupMemberAll(symbolToType(sym), last);
}

function toSignatureInformation(fn: FunctionType): SignatureInformation {
  const params: ParameterInformation[] = fn.params.map(p => {
    const dir = p.direction ? p.direction + ' ' : '';
    const nm = p.name ? ' ' + p.name : '';
    const def = p.defaulted ? ' = ...' : '';
    return { label: `${dir}${formatType(p.type)}${nm}${def}` };
  });
  const ret = retTypeString(fn.returnType);
  return {
    label: `${ret}${fn.symbol.name}(${params.map(p => p.label).join(', ')})`,
    parameters: params,
  };
}

function retTypeString(t: Type): string {
  if (t.kind === 'unknown') return '';
  return formatType(t) + ' ';
}

function isIdentChar(c: string): boolean {
  return (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z')
      || (c >= '0' && c <= '9') || c === '_';
}

function isHorizontalWs(c: string): boolean {
  return c === ' ' || c === '\t';
}
