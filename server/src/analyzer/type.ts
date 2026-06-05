import { Parameter, TypeRef } from '../parser';
import { Scope } from './scope';
import { Sym } from './symbol';

/**
 * The inferred type of an expression, or the declared type of a variable /
 * parameter / field. Distinct from {@link TypeRef} (which is the AST node).
 */
export type Type =
  | PrimitiveType
  | ClassType
  | InterfaceType
  | EnumType
  | ArrayType
  | HandleType
  | FunctionType
  | FuncdefType
  | TypedefType
  | NamespaceType
  | OverloadSetType
  | UnknownType;

export interface PrimitiveType { kind: 'primitive'; name: string; }
export interface ClassType     { kind: 'class';     symbol: Sym; templateArgs?: Type[]; }
export interface InterfaceType { kind: 'interface'; symbol: Sym; }
export interface EnumType      { kind: 'enum';      symbol: Sym; }
export interface ArrayType     { kind: 'array';     element: Type; }
export interface HandleType    { kind: 'handle';    pointee: Type; isConst: boolean; }
export interface FuncdefType   { kind: 'funcdef';   symbol: Sym; }
export interface TypedefType   { kind: 'typedef';   symbol: Sym; aliased: Type; }
export interface NamespaceType { kind: 'namespace'; symbol: Sym; }
export interface OverloadSetType { kind: 'overload'; symbols: Sym[]; }
export interface UnknownType   { kind: 'unknown'; }

export interface FunctionType {
  kind: 'function';
  symbol: Sym;
  returnType: Type;
  params: { name?: string; type: Type; direction?: Parameter['direction']; defaulted: boolean }[];
}

export const UNKNOWN: UnknownType = { kind: 'unknown' };

export function prim(name: string): PrimitiveType {
  return { kind: 'primitive', name };
}

const PRIMITIVE_NAMES: ReadonlySet<string> = new Set([
  'void', 'bool', 'auto',
  'int', 'int8', 'int16', 'int32', 'int64',
  'uint', 'uint8', 'uint16', 'uint32', 'uint64',
  'float', 'double',
]);

/** Format a Type for display in hover / completion detail. */
export function formatType(t: Type): string {
  switch (t.kind) {
    case 'primitive': return t.name;
    case 'class': {
      const args = t.templateArgs && t.templateArgs.length > 0
        ? '<' + t.templateArgs.map(formatType).join(', ') + '>'
        : '';
      return t.symbol.name + args;
    }
    case 'interface': return t.symbol.name;
    case 'enum':      return t.symbol.name;
    case 'funcdef':   return t.symbol.name;
    case 'typedef':   return t.symbol.name;
    case 'namespace': return t.symbol.name;
    case 'array':     return `${formatType(t.element)}[]`;
    case 'handle':    return `${formatType(t.pointee)}@${t.isConst ? '+' : ''}`;
    case 'function': {
      const params = t.params.map(p => {
        const dir = p.direction ? p.direction + ' ' : '';
        const nm = p.name ? ' ' + p.name : '';
        const def = p.defaulted ? ' = ...' : '';
        return `${dir}${formatType(p.type)}${nm}${def}`;
      }).join(', ');
      return `${formatType(t.returnType)}(${params})`;
    }
    case 'overload': return `<${t.symbols.length} overloads>`;
    case 'unknown':  return '?';
  }
}

/**
 * Convert a parsed TypeRef AST node into a resolved Type.
 *
 * `visited` is a cycle-detection set: when a type-name lookup resolves to
 * a symbol whose own type recursively resolves back to the same symbol
 * (e.g. user code `vec3 vec3;` where the variable shadows the class), we
 * bail to UNKNOWN instead of overflowing the stack.
 */
export function typeFromRef(ref: TypeRef, scope: Scope, visited: Set<Sym> = new Set()): Type {
  let base: Type = UNKNOWN;

  if (ref.name.length > 0 && PRIMITIVE_NAMES.has(ref.name[0])) {
    base = prim(ref.name[0]);
  } else if (ref.name.length > 0) {
    // Look up as a named type first. This resolves `array<T>` to the
    // bundled `array` class (so members like .length() are reachable). If
    // no such class is declared, fall back to a structural ArrayType so we
    // don't lose element-type info on `array<T>`.
    const sym = lookupQualified(ref.name, scope);
    if (sym && !visited.has(sym)) {
      visited.add(sym);
      const t = symbolToType(sym, visited);
      visited.delete(sym);
      if (t.kind === 'class' && ref.templateArgs.length > 0) {
        base = {
          kind: 'class',
          symbol: t.symbol,
          templateArgs: ref.templateArgs.map(a => typeFromRef(a, scope, visited)),
        };
      } else {
        base = t;
      }
    } else if (!sym && ref.name.length === 1 && ref.name[0] === 'array' && ref.templateArgs.length === 1) {
      base = { kind: 'array', element: typeFromRef(ref.templateArgs[0], scope, visited) };
    }
  }

  for (let i = 0; i < ref.arrayDepth; i++) base = { kind: 'array', element: base };
  if (ref.isHandle) base = { kind: 'handle', pointee: base, isConst: ref.isHandleConst };
  return base;
}

/**
 * Map a Sym to the Type the symbol "is". Class symbols become ClassType,
 * variables/parameters become their declared types, functions become
 * FunctionType, etc.
 *
 * `visited` participates in the same cycle-detection scheme as typeFromRef.
 */
export function symbolToType(sym: Sym, visited: Set<Sym> = new Set()): Type {
  switch (sym.kind) {
    case 'class':     return { kind: 'class', symbol: sym };
    case 'interface': return { kind: 'interface', symbol: sym };
    case 'enum':      return { kind: 'enum', symbol: sym };
    case 'namespace': return { kind: 'namespace', symbol: sym };
    case 'funcdef':   return { kind: 'funcdef', symbol: sym };
    case 'typedef': {
      // Unwrap the typedef target lazily -- we don't store an Aliased type
      // here because we don't always have the scope. Returned as typedef
      // with `aliased: unknown` to be filled in by callers if they care.
      return { kind: 'typedef', symbol: sym, aliased: UNKNOWN };
    }
    case 'enum-member':
      // The value of an enum member acts as the enum type.
      return sym.scope.owner
        ? { kind: 'enum', symbol: sym.scope.owner }
        : UNKNOWN;
    case 'field':
    case 'global-variable':
    case 'local-variable':
    case 'parameter': {
      const declType = (sym.decl as { type?: TypeRef }).type;
      return declType ? typeFromRef(declType, sym.scope, visited) : UNKNOWN;
    }
    case 'function':
    case 'method':
    case 'constructor':
    case 'destructor': {
      const decl = sym.decl as { returnType: TypeRef | null; params: Parameter[] };
      const returnType = decl.returnType
        ? typeFromRef(decl.returnType, sym.scope, visited)
        : (sym.scope.owner ? symbolToType(sym.scope.owner, visited) : UNKNOWN);
      return {
        kind: 'function',
        symbol: sym,
        returnType,
        params: decl.params.map(p => ({
          name: p.name,
          type: typeFromRef(p.type, sym.scope, visited),
          direction: p.direction,
          defaulted: !!p.defaultValue,
        })),
      };
    }
  }
}

/**
 * Walk a qualified name down through scope.lookup -> symbol.innerScope chain.
 *
 * The first lookup prefers type-like symbols (class / enum / namespace /
 * etc.) over plain values, so `vec3` resolves to the class even when the
 * user has a variable with the same name in an enclosing scope.
 */
function lookupQualified(parts: string[], scope: Scope): Sym | null {
  const first = scope.lookupPreferring(parts[0], isTypeLike);
  if (!first || first.length === 0) return null;
  let sym: Sym = first[0];
  for (let i = 1; i < parts.length; i++) {
    if (!sym.innerScope) return null;
    const next = sym.innerScope.lookupLocal(parts[i]);
    if (!next || next.length === 0) return null;
    sym = next[0];
  }
  return sym;
}

function isTypeLike(sym: Sym): boolean {
  switch (sym.kind) {
    case 'class':
    case 'interface':
    case 'enum':
    case 'namespace':
    case 'funcdef':
    case 'typedef':
      return true;
    default:
      return false;
  }
}

/**
 * Look up a member on a receiver type. Used by both the type checker (to
 * type-check `obj.X`) and by completion (to enumerate members).
 *
 * Returns null if the receiver has no member named `name`, or if the
 * receiver type doesn't have a meaningful member-access shape (e.g. a raw
 * primitive).
 */
export function lookupMember(receiver: Type, name: string): Sym | null {
  const scope = memberScopeOf(receiver);
  if (!scope) return null;
  const found = scope.lookupLocal(name);
  return found ? found[0] : null;
}

/** Enumerate every member of the receiver type (for completion). */
export function membersOf(receiver: Type): Sym[] {
  const scope = memberScopeOf(receiver);
  if (!scope) return [];
  const out: Sym[] = [];
  for (const list of scope.symbols.values()) out.push(...list);
  return out;
}

/** All overloads of a named member (returns [] if no member by that name). */
export function lookupMemberAll(receiver: Type, name: string): Sym[] {
  const scope = memberScopeOf(receiver);
  if (!scope) return [];
  return scope.lookupLocal(name) ?? [];
}

/**
 * Returns the "inner scope" reachable through member-access for a receiver
 * type. Dereferences handles transparently -- `Player@.foo` looks in Player's
 * scope. Returns null if the type has no addressable members.
 */
function memberScopeOf(receiver: Type): Scope | null {
  switch (receiver.kind) {
    case 'handle':    return memberScopeOf(receiver.pointee);
    case 'class':     return receiver.symbol.innerScope ?? null;
    case 'interface': return receiver.symbol.innerScope ?? null;
    case 'enum':      return receiver.symbol.innerScope ?? null;
    case 'namespace': return receiver.symbol.innerScope ?? null;
    case 'typedef':   return memberScopeOf(receiver.aliased);
    default:          return null;
  }
}
