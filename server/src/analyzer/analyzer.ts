import {
  ClassDecl,
  Declaration,
  EnumDecl,
  Expression,
  FuncDefDecl,
  FunctionDecl,
  InterfaceDecl,
  Module,
  NamespaceDecl,
  Parameter,
  Position,
  Statement,
  TypeDefDecl,
  TypeRef,
  VariableDecl,
} from '../parser';
import { Scope } from './scope';
import { Reference, Sym, SymDecl, SymKind } from './symbol';

/**
 * Symbol kinds that participate as qualifiers in `Foo::bar` (i.e. have an
 * inner scope worth descending into). Used to disambiguate against
 * same-named user functions / variables when looking up a qualifier.
 */
const TYPE_LIKE_KINDS: ReadonlySet<SymKind> = new Set<SymKind>([
  'class', 'interface', 'enum', 'namespace', 'funcdef', 'typedef',
]);

function hasInnerScopeOrTypeLike(sym: Sym): boolean {
  return !!sym.innerScope || TYPE_LIKE_KINDS.has(sym.kind);
}

const PRIMITIVE_TYPES = new Set([
  'void', 'bool', 'auto',
  'int', 'int8', 'int16', 'int32', 'int64',
  'uint', 'uint8', 'uint16', 'uint32', 'uint64',
  'float', 'double',
  // AS variant type -- not really a primitive, but treated as one for
  // reference-emission purposes (don't try to resolve `?` as a symbol).
  '?',
]);

export interface AnalyzerResult {
  global: Scope;
  references: Reference[];
}

/**
 * Two-pass static analyzer.
 *
 * Pass 1 (declare) walks the AST and registers every type-like and
 * module-level / class-member / enum-member symbol into scopes. Forward
 * references between top-level decls work because the entire pass completes
 * before resolution begins.
 *
 * Pass 2 (resolve) walks bodies, declaring locals/parameters as it goes,
 * and records every identifier reference together with the symbol it
 * resolves to (or null if unresolved).
 */
/**
 * Callback the analyzer uses when local scope lookup fails. Returns a
 * symbol from another file (workspace-wide), or null if nothing matches.
 * Used to make qualified names like `relay::on_load` from main.as resolve
 * to declarations in relay.as.
 */
export type ExternalLookup = (name: string) => Sym | null;

export class Analyzer {
  private global!: Scope;
  private readonly references: Reference[] = [];
  /**
   * Optional source-file URI stamped onto every symbol this analyzer
   * creates. Used by the API loader (and the workspace layer) so goto-def
   * can jump to the on-disk copy of a bundled declaration file or to a
   * sibling user file.
   */
  private sourceUri?: string;
  /** Cross-file lookup fallback -- see ExternalLookup. */
  private externalLookup?: ExternalLookup;

  constructor(sourceUri?: string, externalLookup?: ExternalLookup) {
    this.sourceUri = sourceUri;
    this.externalLookup = externalLookup;
  }

  /** scope.lookup with a workspace-wide fallback for the first lookup. */
  private lookupWithFallback(name: string, scope: Scope): Sym[] | null {
    const local = scope.lookup(name);
    if (local && local.length > 0) return local;
    if (this.externalLookup) {
      const external = this.externalLookup(name);
      if (external) return [external];
    }
    return null;
  }

  /**
   * Like {@link lookupWithFallback}, but for the qualifier position of
   * `Foo::bar`: prefers a symbol that has an inner scope (namespace,
   * class, interface, enum, funcdef, typedef). Fixes the case where a
   * user function called `render` shadows the API's `render` namespace.
   */
  private lookupQualifierWithFallback(name: string, scope: Scope): Sym[] | null {
    const local = scope.lookupPreferring(name, hasInnerScopeOrTypeLike);
    if (local && local.length > 0 && hasInnerScopeOrTypeLike(local[0])) return local;
    if (this.externalLookup) {
      const external = this.externalLookup(name);
      if (external && hasInnerScopeOrTypeLike(external)) return [external];
    }
    return local && local.length > 0 ? local : null;
  }

  analyze(module: Module, parent: Scope | null = null): AnalyzerResult {
    this.global = new Scope('global', parent, { start: module.start, end: module.end });
    for (const d of module.declarations) this.declareDecl(d, this.global);
    for (const d of module.declarations) this.resolveDecl(d, this.global);
    return { global: this.global, references: this.references };
  }

  /** Analyze a module's declarations directly into an existing scope. */
  analyzeInto(module: Module, scope: Scope): AnalyzerResult {
    this.global = scope;
    for (const d of module.declarations) this.declareDecl(d, scope);
    for (const d of module.declarations) this.resolveDecl(d, scope);
    return { global: scope, references: this.references };
  }

  // =========================================================================
  // Pass 1 -- declare
  // =========================================================================

  private declareDecl(decl: Declaration, scope: Scope): void {
    switch (decl.kind) {
      case 'ClassDecl':
      case 'InterfaceDecl':     return this.declareTypeWithMembers(decl, scope);
      case 'EnumDecl':          return this.declareEnum(decl, scope);
      case 'NamespaceDecl':     return this.declareNamespace(decl, scope);
      case 'FunctionDecl':      return this.declareFunction(decl, scope);
      case 'VariableDecl':      return this.declareVariable(decl, scope);
      case 'FuncDefDecl':       return this.declareFuncDef(decl, scope);
      case 'TypeDefDecl':       return this.declareTypeDef(decl, scope);
      case 'ImportDecl':        return this.declareDecl(decl.signature, scope);
    }
  }

  private declareTypeWithMembers(decl: ClassDecl | InterfaceDecl, scope: Scope): void {
    const sym = this.makeSymbol(decl.name, decl.kind === 'ClassDecl' ? 'class' : 'interface', decl, scope);
    scope.declare(sym);
    const inner = scope.pushChild(decl.kind === 'ClassDecl' ? 'class' : 'interface',
      { start: decl.start, end: decl.end }, sym);
    sym.innerScope = inner;
    for (const m of decl.members) this.declareDecl(m, inner);
  }

  private declareEnum(decl: EnumDecl, scope: Scope): void {
    const sym = this.makeSymbol(decl.name, 'enum', decl, scope);
    scope.declare(sym);
    const inner = scope.pushChild('enum', { start: decl.start, end: decl.end }, sym);
    sym.innerScope = inner;
    for (const m of decl.members) {
      inner.declare(this.makeSymbol(m.name, 'enum-member', m, inner));
    }
  }

  private declareNamespace(decl: NamespaceDecl, scope: Scope): void {
    // `namespace A::B { ... }` -- walk parts, reusing existing namespace
    // symbols if they already exist (namespaces can be reopened).
    let cur = scope;
    for (const part of decl.name) {
      const existing = cur.lookupLocal(part);
      let nsSym: Sym;
      if (existing && existing[0].kind === 'namespace' && existing[0].innerScope) {
        nsSym = existing[0];
      } else {
        nsSym = this.makeSymbol(part, 'namespace', decl, cur);
        cur.declare(nsSym);
        const inner = cur.pushChild('namespace', { start: decl.start, end: decl.end }, nsSym);
        nsSym.innerScope = inner;
      }
      cur = nsSym.innerScope!;
    }
    for (const d of decl.declarations) this.declareDecl(d, cur);
  }

  private declareFunction(decl: FunctionDecl, scope: Scope): void {
    let kind: SymKind = 'function';
    if (scope.kind === 'class' || scope.kind === 'interface') {
      if (decl.name.startsWith('~')) kind = 'destructor';
      else if (scope.owner && decl.name === scope.owner.name) kind = 'constructor';
      else kind = 'method';
    }
    scope.declare(this.makeSymbol(decl.name, kind, decl, scope));
  }

  private declareVariable(decl: VariableDecl, scope: Scope): void {
    const kind: SymKind =
      scope.kind === 'class' || scope.kind === 'interface' ? 'field' : 'global-variable';
    scope.declare(this.makeSymbol(decl.name, kind, decl, scope));
  }

  private declareFuncDef(decl: FuncDefDecl, scope: Scope): void {
    scope.declare(this.makeSymbol(decl.name, 'funcdef', decl, scope));
  }

  private declareTypeDef(decl: TypeDefDecl, scope: Scope): void {
    scope.declare(this.makeSymbol(decl.name, 'typedef', decl, scope));
  }

  // =========================================================================
  // Pass 2 -- resolve
  // =========================================================================

  private resolveDecl(decl: Declaration, scope: Scope): void {
    switch (decl.kind) {
      case 'ClassDecl':
      case 'InterfaceDecl': {
        const sym = scope.lookupLocal(decl.name)?.[0];
        if (!sym?.innerScope) return;
        for (const m of decl.members) this.resolveDecl(m, sym.innerScope);
        return;
      }
      case 'EnumDecl': {
        const sym = scope.lookupLocal(decl.name)?.[0];
        if (!sym?.innerScope) return;
        for (const m of decl.members) {
          if (m.value) this.resolveExpr(m.value, sym.innerScope);
        }
        return;
      }
      case 'NamespaceDecl': {
        let cur: Scope | undefined = scope;
        for (const part of decl.name) {
          cur = cur?.lookupLocal(part)?.[0]?.innerScope;
          if (!cur) return;
        }
        for (const d of decl.declarations) this.resolveDecl(d, cur);
        return;
      }
      case 'FunctionDecl': return this.resolveFunction(decl, scope);
      case 'VariableDecl': return this.resolveVariableAtDecl(decl, scope);
      case 'FuncDefDecl':  return this.resolveFuncDef(decl, scope);
      case 'TypeDefDecl':  return this.resolveType(decl.aliased, scope);
      case 'ImportDecl':   return this.resolveDecl(decl.signature, scope);
    }
  }

  private resolveFunction(decl: FunctionDecl, scope: Scope): void {
    if (decl.returnType) this.resolveType(decl.returnType, scope);
    const funcScope = scope.pushChild('function', { start: decl.start, end: decl.end });
    for (const p of decl.params) this.resolveParameter(p, scope, funcScope);
    if (decl.body) {
      // The body is a BlockStmt -- but we want params and body-locals in the
      // same scope. Inline the block's statements into funcScope.
      for (const s of decl.body.statements) this.resolveStmt(s, funcScope);
    }
  }

  private resolveParameter(p: Parameter, typeScope: Scope, funcScope: Scope): void {
    this.resolveType(p.type, typeScope);
    if (p.defaultValue) this.resolveExpr(p.defaultValue, funcScope);
    if (p.name) {
      funcScope.declare(this.makeSymbol(p.name, 'parameter', p, funcScope));
    }
  }

  private resolveVariableAtDecl(decl: VariableDecl, scope: Scope): void {
    this.resolveType(decl.type, scope);
    if (decl.initializer) this.resolveExpr(decl.initializer, scope);
  }

  private resolveFuncDef(decl: FuncDefDecl, scope: Scope): void {
    this.resolveType(decl.returnType, scope);
    for (const p of decl.params) this.resolveType(p.type, scope);
  }

  // ----- statements -------------------------------------------------------

  private resolveStmt(stmt: Statement, scope: Scope): void {
    switch (stmt.kind) {
      case 'BlockStmt': {
        const block = scope.pushChild('block', { start: stmt.start, end: stmt.end });
        for (const s of stmt.statements) this.resolveStmt(s, block);
        return;
      }
      case 'IfStmt':
        this.resolveExpr(stmt.condition, scope);
        this.resolveStmt(stmt.then, scope);
        if (stmt.else) this.resolveStmt(stmt.else, scope);
        return;
      case 'WhileStmt':
        this.resolveExpr(stmt.condition, scope);
        this.resolveStmt(stmt.body, scope);
        return;
      case 'DoWhileStmt':
        this.resolveStmt(stmt.body, scope);
        this.resolveExpr(stmt.condition, scope);
        return;
      case 'ForStmt': {
        const forScope = scope.pushChild('block', { start: stmt.start, end: stmt.end });
        if (stmt.init) this.resolveStmt(stmt.init, forScope);
        if (stmt.condition) this.resolveExpr(stmt.condition, forScope);
        for (const u of stmt.update) this.resolveExpr(u, forScope);
        this.resolveStmt(stmt.body, forScope);
        return;
      }
      case 'SwitchStmt':
        this.resolveExpr(stmt.discriminant, scope);
        for (const c of stmt.cases) {
          if (c.match) this.resolveExpr(c.match, scope);
          const caseScope = scope.pushChild('block', { start: c.start, end: c.end });
          for (const s of c.statements) this.resolveStmt(s, caseScope);
        }
        return;
      case 'BreakStmt':
      case 'ContinueStmt':
        return;
      case 'ReturnStmt':
        if (stmt.value) this.resolveExpr(stmt.value, scope);
        return;
      case 'TryStmt':
        this.resolveStmt(stmt.block, scope);
        this.resolveStmt(stmt.catchBlock, scope);
        return;
      case 'ExprStmt':
        this.resolveExpr(stmt.expression, scope);
        return;
      case 'VarDeclStmt':
        for (const d of stmt.declarations) {
          this.resolveType(d.type, scope);
          if (d.initializer) this.resolveExpr(d.initializer, scope);
          scope.declare(this.makeSymbol(d.name, 'local-variable', d, scope));
        }
        return;
    }
  }

  // ----- expressions ------------------------------------------------------

  private resolveExpr(expr: Expression, scope: Scope): void {
    switch (expr.kind) {
      case 'AssignmentExpr':
        this.resolveExpr(expr.target, scope);
        this.resolveExpr(expr.value, scope);
        return;
      case 'TernaryExpr':
        this.resolveExpr(expr.condition, scope);
        this.resolveExpr(expr.whenTrue, scope);
        this.resolveExpr(expr.whenFalse, scope);
        return;
      case 'BinaryExpr':
        this.resolveExpr(expr.left, scope);
        this.resolveExpr(expr.right, scope);
        return;
      case 'UnaryExpr':
      case 'PostfixExpr':
        this.resolveExpr(expr.operand, scope);
        return;
      case 'CallExpr':
        this.resolveExpr(expr.callee, scope);
        for (const a of expr.args) this.resolveExpr(a, scope);
        return;
      case 'MemberExpr':
        return this.resolveMember(expr, scope);
      case 'IndexExpr':
        this.resolveExpr(expr.object, scope);
        this.resolveExpr(expr.index, scope);
        return;
      case 'CastExpr':
        this.resolveType(expr.targetType, scope);
        this.resolveExpr(expr.value, scope);
        return;
      case 'NewExpr':
        this.resolveType(expr.type, scope);
        for (const a of expr.args) this.resolveExpr(a, scope);
        return;
      case 'HandleExpr':
        this.resolveExpr(expr.operand, scope);
        return;
      case 'ParenExpr':
        this.resolveExpr(expr.expression, scope);
        return;
      case 'Identifier': {
        // Skip primitive-type names -- they appear here only as cast-style
        // calls like `int(x)` and aren't symbols.
        if (PRIMITIVE_TYPES.has(expr.name)) return;
        const found = this.lookupWithFallback(expr.name, scope);
        this.references.push({
          range: { start: expr.startPos, end: expr.endPos },
          name: expr.name,
          symbol: found ? found[0] : null,
        });
        return;
      }
      case 'QualifiedName':
        return this.resolveQualifiedPerPart(expr.parts, expr.partRanges, scope);
      case 'LiteralExpr':
      case 'ThisExpr':
        return;
    }
  }

  /**
   * Resolve a member access. We handle the cases where the receiver carries
   * enough info to do a name lookup without full type inference:
   *   - `this.X`                  -> look up X in enclosing class scope
   *   - `Identifier.X` where the identifier resolves to a class / enum /
   *      namespace / typedef-of-a-type -> look up X in that inner scope
   * Everything else (arbitrary expression .X) is left unresolved for now;
   * the type checker (step 5) will fill that in.
   */
  private resolveMember(expr: { kind: 'MemberExpr'; object: Expression; property: string; propertyStartPos: Position; propertyEndPos: Position }, scope: Scope): void {
    this.resolveExpr(expr.object, scope);

    let sym: Sym | null = null;

    if (expr.object.kind === 'ThisExpr') {
      const found = scope.lookupInEnclosingClass(expr.property);
      sym = found ? found[0] : null;
    } else if (expr.object.kind === 'Identifier') {
      const recv = scope.lookup(expr.object.name);
      if (recv && recv[0].innerScope) {
        const found = recv[0].innerScope.lookupLocal(expr.property);
        sym = found ? found[0] : null;
      }
    } else if (expr.object.kind === 'QualifiedName') {
      const recv = this.lookupQualified(expr.object.parts, scope);
      if (recv && recv.innerScope) {
        const found = recv.innerScope.lookupLocal(expr.property);
        sym = found ? found[0] : null;
      }
    }

    this.references.push({
      range: { start: expr.propertyStartPos, end: expr.propertyEndPos },
      name: expr.property,
      symbol: sym,
    });
  }

  // =========================================================================
  // Types
  // =========================================================================

  private resolveType(t: TypeRef, scope: Scope): void {
    // Primitive type -- no symbol to emit.
    if (t.name.length > 0 && !PRIMITIVE_TYPES.has(t.name[0])) {
      this.resolveQualifiedPerPart(t.name, t.nameRanges, scope);
    }
    for (const arg of t.templateArgs) this.resolveType(arg, scope);
  }

  // =========================================================================
  // Lookup helpers
  // =========================================================================

  private resolveQualified(parts: string[], scope: Scope, start: Position, end: Position): void {
    const sym = this.lookupQualified(parts, scope);
    this.references.push({
      range: { start, end },
      name: parts.join('::'),
      symbol: sym,
    });
  }

  /**
   * Emit one reference per part of a qualified name, each resolved against
   * the appropriate scope (first part against the lexical scope, subsequent
   * parts against the previous symbol's inner scope). This lets semantic
   * tokens / goto-def / hover work on the precise part the cursor sits on.
   */
  private resolveQualifiedPerPart(parts: string[], ranges: { startPos: Position; endPos: Position }[], scope: Scope): void {
    if (parts.length === 0) return;

    // First part: scope-chain lookup, with cross-file fallback so qualified
    // names like `relay::on_load` resolve to another file's namespace.
    // For multi-part names, prefer a type-like (namespace/class/enum/etc.)
    // symbol over a plain function/variable that shadows it -- otherwise
    // a user function called `render` would steal the lookup of
    // `render::draw_line`.
    const firstHit = parts.length > 1
      ? this.lookupQualifierWithFallback(parts[0], scope)
      : this.lookupWithFallback(parts[0], scope);
    let sym: Sym | null = firstHit ? firstHit[0] : null;
    this.references.push({
      range: { start: ranges[0].startPos, end: ranges[0].endPos },
      name: parts[0],
      symbol: sym,
    });

    // Subsequent parts: walk the symbol chain via innerScope.
    for (let i = 1; i < parts.length; i++) {
      let nextSym: Sym | null = null;
      if (sym && sym.innerScope) {
        const found = sym.innerScope.lookupLocal(parts[i]);
        if (found && found.length > 0) nextSym = found[0];
      }
      this.references.push({
        range: { start: ranges[i].startPos, end: ranges[i].endPos },
        name: parts[i],
        symbol: nextSym,
      });
      sym = nextSym;
    }
  }

  private lookupQualified(parts: string[], scope: Scope): Sym | null {
    const first = scope.lookup(parts[0]);
    if (!first || first.length === 0) return null;
    let sym: Sym = first[0];
    for (let i = 1; i < parts.length; i++) {
      const inner = sym.innerScope;
      if (!inner) return null;
      const next = inner.lookupLocal(parts[i]);
      if (!next || next.length === 0) return null;
      sym = next[0];
    }
    return sym;
  }

  // =========================================================================
  // Symbol construction
  // =========================================================================

  private makeSymbol(name: string, kind: SymKind, decl: SymDecl, scope: Scope): Sym {
    // For most decls the "selection range" is the name token position.
    // We don't have that token range cached on every decl node -- for first
    // cut, use the decl's full range. The outline already shows the same.
    return {
      name,
      kind,
      decl,
      scope,
      range: { start: decl.startPos, end: decl.endPos },
      selectionRange: { start: decl.startPos, end: decl.endPos },
      sourceUri: this.sourceUri,
    };
  }
}
