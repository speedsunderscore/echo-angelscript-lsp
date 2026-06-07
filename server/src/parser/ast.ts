import { Position } from './tokens';

/**
 * AST node kinds. The `kind` field is the discriminator for the
 * union of all node types in this file -- pattern-match on it.
 */
export type NodeKind =
  // Top-level
  | 'Module'
  | 'ImportDecl'
  | 'NamespaceDecl'
  // Type declarations
  | 'ClassDecl'
  | 'InterfaceDecl'
  | 'EnumDecl'
  | 'EnumMember'
  | 'FuncDefDecl'
  | 'TypeDefDecl'
  // Value declarations
  | 'FunctionDecl'
  | 'VariableDecl'
  | 'Parameter'
  // Types
  | 'TypeRef'
  // Statements
  | 'BlockStmt'
  | 'IfStmt'
  | 'WhileStmt'
  | 'DoWhileStmt'
  | 'ForStmt'
  | 'SwitchStmt'
  | 'CaseClause'
  | 'BreakStmt'
  | 'ContinueStmt'
  | 'ReturnStmt'
  | 'TryStmt'
  | 'ExprStmt'
  | 'VarDeclStmt'
  // Expressions
  | 'AssignmentExpr'
  | 'TernaryExpr'
  | 'BinaryExpr'
  | 'UnaryExpr'
  | 'PostfixExpr'
  | 'CallExpr'
  | 'MemberExpr'
  | 'IndexExpr'
  | 'CastExpr'
  | 'NewExpr'
  | 'HandleExpr'
  | 'ParenExpr'
  | 'Identifier'
  | 'QualifiedName'
  | 'LiteralExpr'
  | 'ThisExpr'
  | 'InitListExpr'
  | 'AnonymousFunctionExpr';

export interface NodeBase {
  kind: NodeKind;
  start: number;
  end: number;
  startPos: Position;
  endPos: Position;
  /**
   * Doc-comment text (`/** ... *\/` immediately preceding) attached to
   * declaration nodes. Cleaned: leading `*` and indentation removed.
   */
  doc?: string;
}

/** A source range tied to a single identifier or token. */
export interface PartRange {
  start: number;
  end: number;
  startPos: Position;
  endPos: Position;
}

// ----- top level ---------------------------------------------------------

export interface Module extends NodeBase {
  kind: 'Module';
  declarations: Declaration[];
}

export interface ImportDecl extends NodeBase {
  kind: 'ImportDecl';
  /** The declared function/type signature (verbatim AS code as a parsed declaration). */
  signature: FunctionDecl | VariableDecl;
  /** "module-name" string after `from`. */
  fromModule: string;
}

export interface NamespaceDecl extends NodeBase {
  kind: 'NamespaceDecl';
  /** Qualified name parts, e.g. `Foo::Bar::Baz` -> ['Foo','Bar','Baz']. */
  name: string[];
  declarations: Declaration[];
}

// ----- type declarations -------------------------------------------------

export interface ClassDecl extends NodeBase {
  kind: 'ClassDecl';
  name: string;
  /** `class`, `mixin class`, etc. carried as a modifier set. */
  modifiers: string[];
  /** Names of base class + implemented interfaces (parser doesn't separate them). */
  bases: string[];
  members: Declaration[];
}

export interface InterfaceDecl extends NodeBase {
  kind: 'InterfaceDecl';
  name: string;
  modifiers: string[];
  bases: string[];
  members: Declaration[];
}

export interface EnumDecl extends NodeBase {
  kind: 'EnumDecl';
  name: string;
  modifiers: string[];
  members: EnumMember[];
}

export interface EnumMember extends NodeBase {
  kind: 'EnumMember';
  name: string;
  /** Optional `= expr`. */
  value?: Expression;
}

export interface FuncDefDecl extends NodeBase {
  kind: 'FuncDefDecl';
  name: string;
  modifiers: string[];
  returnType: TypeRef;
  params: Parameter[];
}

export interface TypeDefDecl extends NodeBase {
  kind: 'TypeDefDecl';
  /** New name being introduced. */
  name: string;
  /** The aliased type. */
  aliased: TypeRef;
}

// ----- value declarations -----------------------------------------------

export interface FunctionDecl extends NodeBase {
  kind: 'FunctionDecl';
  name: string;
  modifiers: string[];
  /** Null for constructors / destructors. */
  returnType: TypeRef | null;
  params: Parameter[];
  /** True when the method is `const`. */
  isConst: boolean;
  /** Null = declaration only (interface body / pure virtual / forward). */
  body: BlockStmt | null;
}

export interface VariableDecl extends NodeBase {
  kind: 'VariableDecl';
  name: string;
  modifiers: string[];
  type: TypeRef;
  /** Optional initializer `= expr` or `(args)`. */
  initializer?: Expression;
  /**
   * If the var was declared as part of a multi-declarator statement
   * (`int a, b = 1, c;`), this is the index in the originating list.
   */
  declaratorIndex?: number;
}

export interface Parameter extends NodeBase {
  kind: 'Parameter';
  /** `in` | `out` | `inout` | undefined. */
  direction?: 'in' | 'out' | 'inout';
  type: TypeRef;
  name?: string;
  defaultValue?: Expression;
}

// ----- types -------------------------------------------------------------

export interface TypeRef extends NodeBase {
  kind: 'TypeRef';
  /** Qualified base name, e.g. ['MyNS', 'Foo'] for `MyNS::Foo`. */
  name: string[];
  /** Per-part source ranges, parallel to `name`. */
  nameRanges: PartRange[];
  isConst: boolean;
  /** `<T, U>` template args; empty if not a template. */
  templateArgs: TypeRef[];
  /** Number of trailing `[]` suffixes. */
  arrayDepth: number;
  /** True for handle types (`Foo@`). */
  isHandle: boolean;
  /** True for read-only handles (`Foo@+`). */
  isHandleConst: boolean;
  /** True for reference types (`Foo&`, parameter-only). */
  isReference: boolean;
}

// ----- statements --------------------------------------------------------

export interface BlockStmt extends NodeBase {
  kind: 'BlockStmt';
  statements: Statement[];
}

export interface IfStmt extends NodeBase {
  kind: 'IfStmt';
  condition: Expression;
  then: Statement;
  else?: Statement;
}

export interface WhileStmt extends NodeBase {
  kind: 'WhileStmt';
  condition: Expression;
  body: Statement;
}

export interface DoWhileStmt extends NodeBase {
  kind: 'DoWhileStmt';
  body: Statement;
  condition: Expression;
}

export interface ForStmt extends NodeBase {
  kind: 'ForStmt';
  /** Either a var decl or an expression statement, or null. */
  init: Statement | null;
  condition: Expression | null;
  /** Comma-separated update expressions. */
  update: Expression[];
  body: Statement;
}

export interface SwitchStmt extends NodeBase {
  kind: 'SwitchStmt';
  discriminant: Expression;
  cases: CaseClause[];
}

export interface CaseClause extends NodeBase {
  kind: 'CaseClause';
  /** Null for `default:`. */
  match: Expression | null;
  statements: Statement[];
}

export interface BreakStmt extends NodeBase {
  kind: 'BreakStmt';
}

export interface ContinueStmt extends NodeBase {
  kind: 'ContinueStmt';
}

export interface ReturnStmt extends NodeBase {
  kind: 'ReturnStmt';
  value?: Expression;
}

export interface TryStmt extends NodeBase {
  kind: 'TryStmt';
  block: BlockStmt;
  catchBlock: BlockStmt;
}

export interface ExprStmt extends NodeBase {
  kind: 'ExprStmt';
  expression: Expression;
}

export interface VarDeclStmt extends NodeBase {
  kind: 'VarDeclStmt';
  declarations: VariableDecl[];
}

// ----- expressions -------------------------------------------------------

export type AssignmentOp =
  | '=' | '+=' | '-=' | '*=' | '/=' | '%=' | '&=' | '|=' | '^='
  | '<<=' | '>>=' | '>>>=' | '**=' | '@=';

export interface AssignmentExpr extends NodeBase {
  kind: 'AssignmentExpr';
  op: AssignmentOp;
  target: Expression;
  value: Expression;
}

export interface TernaryExpr extends NodeBase {
  kind: 'TernaryExpr';
  condition: Expression;
  whenTrue: Expression;
  whenFalse: Expression;
}

export type BinaryOp =
  | '||' | '&&' | 'or' | 'and' | 'xor'
  | '|' | '^' | '&'
  | '==' | '!=' | 'is' | '!is'
  | '<' | '>' | '<=' | '>='
  | '<<' | '>>' | '>>>'
  | '+' | '-' | '*' | '/' | '%' | '**'
  | 'in';

export interface BinaryExpr extends NodeBase {
  kind: 'BinaryExpr';
  op: BinaryOp;
  left: Expression;
  right: Expression;
}

export type UnaryOp = '+' | '-' | '!' | '~' | '++' | '--' | 'not';

export interface UnaryExpr extends NodeBase {
  kind: 'UnaryExpr';
  op: UnaryOp;
  operand: Expression;
}

export interface PostfixExpr extends NodeBase {
  kind: 'PostfixExpr';
  op: '++' | '--';
  operand: Expression;
}

export interface CallExpr extends NodeBase {
  kind: 'CallExpr';
  callee: Expression;
  args: Expression[];
}

export interface MemberExpr extends NodeBase {
  kind: 'MemberExpr';
  object: Expression;
  property: string;
  /** Range of the property name token specifically (for precise go-to-def). */
  propertyStart: number;
  propertyEnd: number;
  propertyStartPos: Position;
  propertyEndPos: Position;
}

export interface IndexExpr extends NodeBase {
  kind: 'IndexExpr';
  object: Expression;
  index: Expression;
}

export interface CastExpr extends NodeBase {
  kind: 'CastExpr';
  targetType: TypeRef;
  value: Expression;
}

export interface NewExpr extends NodeBase {
  kind: 'NewExpr';
  type: TypeRef;
  args: Expression[];
}

/** `@expr` -- handle-of operator. */
export interface HandleExpr extends NodeBase {
  kind: 'HandleExpr';
  operand: Expression;
}

export interface ParenExpr extends NodeBase {
  kind: 'ParenExpr';
  expression: Expression;
}

export interface Identifier extends NodeBase {
  kind: 'Identifier';
  name: string;
}

/** `Foo::Bar` or `::Foo` (leading-empty parts denote root). */
export interface QualifiedName extends NodeBase {
  kind: 'QualifiedName';
  parts: string[];
  /** Per-part source ranges, parallel to `parts`. */
  partRanges: PartRange[];
}

export type LiteralType = 'int' | 'float' | 'string' | 'bool' | 'null';

export interface LiteralExpr extends NodeBase {
  kind: 'LiteralExpr';
  literalType: LiteralType;
  /** For string literals this is the raw source text (with surrounding quotes). */
  value: string;
}

export interface ThisExpr extends NodeBase {
  kind: 'ThisExpr';
}

/** `{ e0, e1, ... }` -- array / aggregate initializer literal. */
export interface InitListExpr extends NodeBase {
  kind: 'InitListExpr';
  elements: Expression[];
}

/**
 * Anonymous function expression: `function(params) [returnType] { body }`.
 * Commonly used as an inline callback argument.
 */
export interface AnonymousFunctionExpr extends NodeBase {
  kind: 'AnonymousFunctionExpr';
  params: Parameter[];
  /** Optional explicit return type; null when AS infers from the body. */
  returnType: TypeRef | null;
  body: BlockStmt;
}

// ----- aggregate unions --------------------------------------------------

export type Declaration =
  | ImportDecl
  | NamespaceDecl
  | ClassDecl
  | InterfaceDecl
  | EnumDecl
  | FuncDefDecl
  | TypeDefDecl
  | FunctionDecl
  | VariableDecl;

export type Statement =
  | BlockStmt
  | IfStmt
  | WhileStmt
  | DoWhileStmt
  | ForStmt
  | SwitchStmt
  | BreakStmt
  | ContinueStmt
  | ReturnStmt
  | TryStmt
  | ExprStmt
  | VarDeclStmt;

export type Expression =
  | AssignmentExpr
  | TernaryExpr
  | BinaryExpr
  | UnaryExpr
  | PostfixExpr
  | CallExpr
  | MemberExpr
  | IndexExpr
  | CastExpr
  | NewExpr
  | HandleExpr
  | ParenExpr
  | Identifier
  | QualifiedName
  | LiteralExpr
  | ThisExpr
  | InitListExpr
  | AnonymousFunctionExpr;

export type AnyNode =
  | Module
  | Declaration
  | Statement
  | Expression
  | TypeRef
  | Parameter
  | EnumMember
  | CaseClause;

export interface ParseError {
  message: string;
  start: number;
  end: number;
  startPos: Position;
  endPos: Position;
}
