import {
  CaseClause,
  Declaration,
  EnumMember,
  Expression,
  Module,
  Parameter,
  Position,
  Statement,
  TypeRef,
  VariableDecl,
} from '../parser';
import { Scope } from './scope';
import { Reference, Sym } from './symbol';
import {
  ArrayType,
  ClassType,
  EnumType,
  FunctionType,
  HandleType,
  InterfaceType,
  NamespaceType,
  OverloadSetType,
  Type,
  UNKNOWN,
  formatType,
  lookupMember,
  prim,
  symbolToType,
  typeFromRef,
} from './type';

export interface TypeCheckResult {
  /** Inferred type for each expression node. */
  types: Map<Expression, Type>;
  /** Member-access references resolved by this pass. */
  resolvedMemberCount: number;
}

/**
 * Type-inference pass. Runs after the symbol analyzer; uses the scope
 * hierarchy the analyzer built (via {@link Scope.scopeAt}) to look up
 * identifiers, and back-fills the symbol on any reference for an
 * `obj.member` site that the analyzer could not pre-resolve.
 */
export class TypeChecker {
  private readonly types = new Map<Expression, Type>();
  private readonly refIndex = new Map<string, Reference>();
  private resolvedMemberCount = 0;
  private global!: Scope;

  check(module: Module, global: Scope, references: Reference[]): TypeCheckResult {
    this.global = global;
    for (const r of references) {
      this.refIndex.set(posKey(r.range.start, r.range.end), r);
    }
    for (const d of module.declarations) this.checkDecl(d);
    return {
      types: this.types,
      resolvedMemberCount: this.resolvedMemberCount,
    };
  }

  // =========================================================================
  // Declarations / statements -- walk into bodies & initializers
  // =========================================================================

  private checkDecl(decl: Declaration): void {
    switch (decl.kind) {
      case 'ClassDecl':
      case 'InterfaceDecl':
        for (const m of decl.members) this.checkDecl(m);
        return;
      case 'EnumDecl':
        for (const m of decl.members) this.checkEnumMember(m, this.scopeAt(decl.start));
        return;
      case 'NamespaceDecl':
        for (const d of decl.declarations) this.checkDecl(d);
        return;
      case 'FunctionDecl':
        for (const p of decl.params) {
          if (p.defaultValue) this.checkExpr(p.defaultValue, this.scopeAt(p.start));
        }
        if (decl.body) {
          for (const s of decl.body.statements) this.checkStmt(s);
        }
        return;
      case 'VariableDecl':
        if (decl.initializer) this.checkExpr(decl.initializer, this.scopeAt(decl.start));
        return;
      case 'FuncDefDecl':
      case 'TypeDefDecl':
        return;
      case 'ImportDecl':
        this.checkDecl(decl.signature);
        return;
    }
  }

  private checkEnumMember(m: EnumMember, scope: Scope): void {
    if (m.value) this.checkExpr(m.value, scope);
  }

  private checkStmt(stmt: Statement): void {
    switch (stmt.kind) {
      case 'BlockStmt':
        for (const s of stmt.statements) this.checkStmt(s);
        return;
      case 'IfStmt':
        this.checkExpr(stmt.condition, this.scopeAt(stmt.start));
        this.checkStmt(stmt.then);
        if (stmt.else) this.checkStmt(stmt.else);
        return;
      case 'WhileStmt':
        this.checkExpr(stmt.condition, this.scopeAt(stmt.start));
        this.checkStmt(stmt.body);
        return;
      case 'DoWhileStmt':
        this.checkStmt(stmt.body);
        this.checkExpr(stmt.condition, this.scopeAt(stmt.start));
        return;
      case 'ForStmt':
        if (stmt.init) this.checkStmt(stmt.init);
        if (stmt.condition) this.checkExpr(stmt.condition, this.scopeAt(stmt.start));
        for (const u of stmt.update) this.checkExpr(u, this.scopeAt(stmt.start));
        this.checkStmt(stmt.body);
        return;
      case 'SwitchStmt':
        this.checkExpr(stmt.discriminant, this.scopeAt(stmt.start));
        for (const c of stmt.cases) this.checkCase(c);
        return;
      case 'BreakStmt':
      case 'ContinueStmt':
        return;
      case 'ReturnStmt':
        if (stmt.value) this.checkExpr(stmt.value, this.scopeAt(stmt.start));
        return;
      case 'TryStmt':
        this.checkStmt(stmt.block);
        this.checkStmt(stmt.catchBlock);
        return;
      case 'ExprStmt':
        this.checkExpr(stmt.expression, this.scopeAt(stmt.start));
        return;
      case 'VarDeclStmt':
        for (const d of stmt.declarations) {
          if (d.initializer) this.checkExpr(d.initializer, this.scopeAt(d.start));
        }
        return;
    }
  }

  private checkCase(c: CaseClause): void {
    if (c.match) this.checkExpr(c.match, this.scopeAt(c.start));
    for (const s of c.statements) this.checkStmt(s);
  }

  // =========================================================================
  // Expressions -- infer + back-fill member references
  // =========================================================================

  private checkExpr(expr: Expression, scope: Scope): Type {
    const t = this.computeType(expr, scope);
    this.types.set(expr, t);
    return t;
  }

  private computeType(expr: Expression, scope: Scope): Type {
    switch (expr.kind) {
      case 'InitListExpr':
        for (const el of expr.elements) this.checkExpr(el, scope);
        return UNKNOWN;

      case 'LiteralExpr':
        switch (expr.literalType) {
          case 'int':    return prim('int');
          case 'float':  return prim('float');
          case 'bool':   return prim('bool');
          case 'string': {
            // If the `string` class is declared (in the API scope), use that
            // so `"hello".length()` resolves as a method call.
            const stringSym = this.global.lookup('string');
            if (stringSym && stringSym[0].kind === 'class') {
              return { kind: 'class', symbol: stringSym[0] };
            }
            return prim('string');
          }
          case 'null':   return { kind: 'handle', pointee: UNKNOWN, isConst: false };
        }
        return UNKNOWN;

      case 'ThisExpr': {
        const cls = scope.enclosingClass();
        if (!cls?.owner) return UNKNOWN;
        const owner = cls.owner;
        const inner = owner.kind === 'class'
          ? { kind: 'class' as const, symbol: owner }
          : { kind: 'interface' as const, symbol: owner };
        return { kind: 'handle', pointee: inner, isConst: false };
      }

      case 'Identifier': {
        const found = scope.lookup(expr.name);
        if (!found || found.length === 0) return UNKNOWN;
        if (found.length === 1) return symbolToType(found[0]);
        return { kind: 'overload', symbols: found };
      }

      case 'QualifiedName': {
        let cur = scope.lookup(expr.parts[0]);
        if (!cur || cur.length === 0) return UNKNOWN;
        let sym: Sym = cur[0];
        for (let i = 1; i < expr.parts.length; i++) {
          if (!sym.innerScope) return UNKNOWN;
          const next = sym.innerScope.lookupLocal(expr.parts[i]);
          if (!next || next.length === 0) return UNKNOWN;
          sym = next[0];
        }
        return symbolToType(sym);
      }

      case 'ParenExpr':
        return this.checkExpr(expr.expression, scope);

      case 'MemberExpr': {
        const recvType = this.checkExpr(expr.object, scope);
        const memberSym = lookupMember(recvType, expr.property);
        this.backfillMemberRef(expr.propertyStartPos, expr.propertyEndPos, memberSym);
        if (!memberSym) return UNKNOWN;
        return symbolToType(memberSym);
      }

      case 'IndexExpr': {
        const objType = this.checkExpr(expr.object, scope);
        this.checkExpr(expr.index, scope);
        // Indexing an array gives its element type. We model `array<T>` as
        // either a structural ArrayType (no API loaded) or a ClassType
        // pointing at the bundled `array` class with templateArgs preserved
        // -- handle both.
        const arr = unwrapHandle(objType);
        if (arr.kind === 'array') return arr.element;
        if (arr.kind === 'class'
            && arr.symbol.name === 'array'
            && arr.templateArgs
            && arr.templateArgs.length === 1) {
          return arr.templateArgs[0];
        }
        return UNKNOWN;
      }

      case 'CallExpr': {
        const calleeType = this.checkExpr(expr.callee, scope);
        for (const a of expr.args) this.checkExpr(a, scope);
        return callResult(calleeType);
      }

      case 'NewExpr': {
        for (const a of expr.args) this.checkExpr(a, scope);
        const t = typeFromRef(expr.type, scope);
        return { kind: 'handle', pointee: t, isConst: false };
      }

      case 'CastExpr':
        this.checkExpr(expr.value, scope);
        return typeFromRef(expr.targetType, scope);

      case 'HandleExpr':
        return this.checkExpr(expr.operand, scope);

      case 'UnaryExpr': {
        const t = this.checkExpr(expr.operand, scope);
        if (expr.op === '!' || expr.op === 'not') return prim('bool');
        return t;
      }

      case 'PostfixExpr':
        return this.checkExpr(expr.operand, scope);

      case 'AssignmentExpr': {
        this.checkExpr(expr.value, scope);
        return this.checkExpr(expr.target, scope);
      }

      case 'TernaryExpr': {
        this.checkExpr(expr.condition, scope);
        const a = this.checkExpr(expr.whenTrue, scope);
        this.checkExpr(expr.whenFalse, scope);
        return a;
      }

      case 'BinaryExpr': {
        const l = this.checkExpr(expr.left, scope);
        this.checkExpr(expr.right, scope);
        switch (expr.op) {
          case '==': case '!=':
          case '<':  case '>':  case '<=': case '>=':
          case 'is': case '!is':
          case '&&': case '||':
          case 'and': case 'or': case 'xor':
            return prim('bool');
          default:
            return l;
        }
      }

      case 'AnonymousFunctionExpr': {
        // Walk the body so inner expressions get typed.
        const fnScope = this.scopeAt(expr.start);
        for (const s of expr.body.statements) this.checkStmt(s);
        // We don't synthesize a full FunctionType here yet -- AS callsites
        // that take a funcdef@ accept anonymous functions structurally;
        // returning UNKNOWN keeps things working without a sema layer.
        void fnScope;
        return UNKNOWN;
      }
    }
  }

  // =========================================================================
  // Helpers
  // =========================================================================

  private scopeAt(offset: number): Scope {
    return this.global.scopeAt(offset);
  }

  private backfillMemberRef(start: Position, end: Position, sym: Sym | null): void {
    if (!sym) return;
    const ref = this.refIndex.get(posKey(start, end));
    if (ref && !ref.symbol) {
      ref.symbol = sym;
      this.resolvedMemberCount++;
    }
  }
}

function posKey(start: Position, end: Position): string {
  return `${start.line}:${start.column}:${end.line}:${end.column}`;
}

/** Drill through handles transparently -- `Player@` indexes/members like `Player`. */
function unwrapHandle(t: Type): Type {
  return t.kind === 'handle' ? unwrapHandle(t.pointee) : t;
}

/**
 * What does a CallExpr produce given its callee's type?
 *
 * - function          -> its return type
 * - class / interface -> a handle to that type (constructor call)
 * - funcdef           -> unknown (we don't unwrap funcdef signatures here yet)
 * - overload          -> first overload's return type (good enough for hover)
 * - anything else     -> unknown
 */
function callResult(callee: Type): Type {
  switch (callee.kind) {
    case 'function':
      return callee.returnType;
    case 'class':
      return { kind: 'handle', pointee: callee, isConst: false };
    case 'interface':
      return { kind: 'handle', pointee: callee, isConst: false };
    case 'overload': {
      const first = callee.symbols[0];
      const fn = symbolToType(first);
      return fn.kind === 'function' ? fn.returnType : UNKNOWN;
    }
    default:
      return UNKNOWN;
  }
}

// Re-export for downstream features that want it.
export { formatType };
export type { ArrayType, ClassType, EnumType, FunctionType, HandleType, InterfaceType, NamespaceType, OverloadSetType };
