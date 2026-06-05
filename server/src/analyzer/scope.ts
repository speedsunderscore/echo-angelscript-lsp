import { Sym } from './symbol';

export type ScopeKind =
  | 'global'
  | 'namespace'
  | 'class'
  | 'interface'
  | 'enum'
  | 'function'
  | 'block';

/**
 * A lexical scope. Holds declared symbols (as a multimap to support
 * overloads), child scopes (for outline / scope-at-cursor lookup), and a
 * source range so cursor -> scope lookup works.
 */
export class Scope {
  /** Multimap because functions can be overloaded by signature. */
  readonly symbols = new Map<string, Sym[]>();
  readonly children: Scope[] = [];
  /**
   * True if this scope (or any ancestor) was loaded from a bundled API
   * declaration file rather than a user document. Used by LSP features to
   * avoid returning positions that don't exist in the user's file.
   */
  external = false;

  constructor(
    public readonly kind: ScopeKind,
    public readonly parent: Scope | null,
    /** Source offset range this scope covers. */
    public range: { start: number; end: number },
    /** For namespace/class/function: the symbol that owns this scope. */
    public owner?: Sym,
  ) {}

  declare(sym: Sym): void {
    const existing = this.symbols.get(sym.name);
    if (existing) {
      existing.push(sym);
    } else {
      this.symbols.set(sym.name, [sym]);
    }
  }

  /** Look up only in this scope (no parent walk). */
  lookupLocal(name: string): Sym[] | undefined {
    return this.symbols.get(name);
  }

  /** Walk this scope and its parents; return the first hit. */
  lookup(name: string): Sym[] | undefined {
    let s: Scope | null = this;
    while (s) {
      const found = s.symbols.get(name);
      if (found) return found;
      s = s.parent;
    }
    return undefined;
  }

  /**
   * Walk this scope and its parents looking for a symbol named `name`.
   * Prefers any matching symbol the predicate accepts (used to prefer
   * type-like / namespace-like symbols when resolving the qualifier of
   * `Foo::bar` -- so a user function called `render` doesn't shadow the
   * API's `render` namespace at the qualifier position).
   *
   * Falls back to the first match if no predicate-accepted symbol exists
   * anywhere on the chain.
   */
  lookupPreferring(name: string, predicate: (sym: Sym) => boolean): Sym[] | undefined {
    let fallback: Sym[] | undefined;
    let s: Scope | null = this;
    while (s) {
      const list = s.symbols.get(name);
      if (list && list.length > 0) {
        const match = list.find(predicate);
        if (match) return [match];
        if (!fallback) fallback = list;
      }
      s = s.parent;
    }
    return fallback;
  }

  /**
   * Walk the class scope chain (this scope and any enclosing class/interface
   * scopes) looking for `name`. Used to special-case `this.X` member access.
   */
  lookupInEnclosingClass(name: string): Sym[] | undefined {
    let s: Scope | null = this;
    while (s) {
      if (s.kind === 'class' || s.kind === 'interface') {
        const found = s.symbols.get(name);
        if (found) return found;
      }
      s = s.parent;
    }
    return undefined;
  }

  pushChild(kind: ScopeKind, range: { start: number; end: number }, owner?: Sym): Scope {
    const child = new Scope(kind, this, range, owner);
    child.external = this.external;
    this.children.push(child);
    return child;
  }

  /**
   * Find the deepest scope whose range contains `offset`. Returns this scope
   * if no child matches.
   */
  scopeAt(offset: number): Scope {
    for (const c of this.children) {
      if (offset >= c.range.start && offset <= c.range.end) {
        return c.scopeAt(offset);
      }
    }
    return this;
  }

  /** Enclosing class/interface scope, if any. */
  enclosingClass(): Scope | null {
    let s: Scope | null = this;
    while (s) {
      if (s.kind === 'class' || s.kind === 'interface') return s;
      s = s.parent;
    }
    return null;
  }
}
