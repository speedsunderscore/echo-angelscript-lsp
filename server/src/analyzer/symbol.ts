import {
  ClassDecl,
  EnumDecl,
  EnumMember,
  FuncDefDecl,
  FunctionDecl,
  InterfaceDecl,
  NamespaceDecl,
  Parameter,
  TypeDefDecl,
  VariableDecl,
} from '../parser';
import { Position } from '../parser';
import type { Scope } from './scope';

export type SymKind =
  | 'class'
  | 'interface'
  | 'enum'
  | 'enum-member'
  | 'namespace'
  | 'function'
  | 'method'
  | 'constructor'
  | 'destructor'
  | 'field'
  | 'global-variable'
  | 'local-variable'
  | 'parameter'
  | 'funcdef'
  | 'typedef';

export type SymDecl =
  | ClassDecl
  | InterfaceDecl
  | EnumDecl
  | EnumMember
  | NamespaceDecl
  | FunctionDecl
  | VariableDecl
  | Parameter
  | FuncDefDecl
  | TypeDefDecl;

export interface PosRange {
  start: Position;
  end: Position;
}

export interface Sym {
  /** Bare name (no qualification). */
  name: string;
  kind: SymKind;
  /** AST node where the symbol was declared. */
  decl: SymDecl;
  /** Range of the name only -- used as LSP `selectionRange` on go-to-def. */
  selectionRange: PosRange;
  /** Range of the whole declaration -- used as LSP `range` on go-to-def. */
  range: PosRange;
  /** The scope this symbol was declared into. */
  scope: Scope;
  /**
   * For type-like symbols (class, interface, enum, namespace, funcdef) this
   * is the inner scope where members are looked up. Null otherwise.
   */
  innerScope?: Scope;
  /**
   * For symbols loaded from a bundled API declaration file, the URI of
   * the on-disk copy of that file. Undefined for user-document symbols.
   */
  sourceUri?: string;
}

/** A single source-level reference to a symbol. */
export interface Reference {
  /** Position range of the identifier in source. */
  range: PosRange;
  /** Bare name as it appeared in source. */
  name: string;
  /** Resolved symbol -- null if no declaration was found. */
  symbol: Sym | null;
}
