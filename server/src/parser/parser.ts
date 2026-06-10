import {
  AssignmentOp,
  BinaryOp,
  BlockStmt,
  CaseClause,
  ClassDecl,
  Declaration,
  EnumDecl,
  EnumMember,
  Expression,
  FuncDefDecl,
  FunctionDecl,
  ImportDecl,
  InterfaceDecl,
  LiteralType,
  Module,
  NamespaceDecl,
  NodeBase,
  Parameter,
  ParseError,
  Statement,
  TypeDefDecl,
  TypeRef,
  VarDeclStmt,
  VariableDecl,
} from './ast';
import { Token, TokenKind, Position } from './tokens';

/* eslint-disable @typescript-eslint/no-explicit-any */

const MODIFIER_KEYWORDS = new Set([
  'private', 'protected', 'public',
  'shared', 'external',
  'final', 'abstract',
  'mixin',
  'const',
]);

const POSTFIX_METHOD_MODIFIERS = new Set([
  'const', 'final', 'override', 'abstract', 'property', 'explicit',
]);

const PRIMITIVE_TYPES = new Set([
  'void', 'bool',
  'int', 'int8', 'int16', 'int32', 'int64',
  'uint', 'uint8', 'uint16', 'uint32', 'uint64',
  'float', 'double',
  '?',
]);

class ParseException extends Error {}

export interface ParseResult {
  module: Module;
  errors: ParseError[];
}

/**
 * Recursive-descent parser for AngelScript 2.37.
 *
 * Consumes the lexer's token stream (trivia-free) and produces a Module
 * AST plus a list of parse errors. Uses panic-mode recovery: on error,
 * the parser throws a ParseException and the nearest declaration/statement
 * boundary catches and resynchronizes.
 *
 * The optional `docs` map (from the lexer) attaches `/** ... *\/` doc
 * comments to the declaration whose first token they precede.
 */
export class Parser {
  private pos = 0;
  private readonly errors: ParseError[] = [];

  constructor(
    private readonly tokens: Token[],
    private readonly docs: Map<number, string> = new Map(),
  ) {}

  parse(): ParseResult {
    const start = this.peek();
    const declarations: Declaration[] = [];

    while (!this.isAtEnd()) {
      // Skip stray preprocessor lines (treated as opaque trivia at AST level).
      if (this.check(TokenKind.Preprocessor)) {
        this.advance();
        continue;
      }
      try {
        const decls = this.parseDeclaration();
        declarations.push(...decls);
      } catch (e) {
        if (e instanceof ParseException) {
          this.synchronizeTopLevel();
        } else {
          throw e;
        }
      }
    }

    const end = this.previous();
    return {
      module: {
        kind: 'Module',
        declarations,
        ...this.rangeOf(start, end),
      },
      errors: this.errors,
    };
  }

  // =========================================================================
  // Declarations
  // =========================================================================

  /**
   * Parse one top-level declaration. Returns an array because multi-
   * declarator variable statements (`int a, b, c;`) expand to multiple
   * sibling Declarations.
   */
  private parseDeclaration(): Declaration[] {
    const doc = this.docs.get(this.pos);
    const startTok = this.peek();
    const decls = this.parseDeclarationInner(startTok);
    if (decls.length > 0 && doc !== undefined) decls[0].doc = doc;
    return decls;
  }

  private parseDeclarationInner(startTok: Token): Declaration[] {
    if (this.matchKeyword('import')) return [this.parseImport(startTok)];
    if (this.matchKeyword('namespace')) return [this.parseNamespace(startTok)];
    if (this.matchKeyword('typedef')) return [this.parseTypedef(startTok)];
    if (this.matchKeyword('funcdef')) return [this.parseFuncDef(startTok)];

    // Modifier-prefixed decls -- collect modifiers then dispatch
    const modifiers = this.parseLeadingModifiers();

    if (this.matchKeyword('class')) return [this.parseClass(startTok, modifiers)];
    if (this.matchKeyword('interface')) return [this.parseInterface(startTok, modifiers)];
    if (this.matchKeyword('enum')) return [this.parseEnum(startTok, modifiers)];
    if (this.matchKeyword('funcdef')) return [this.parseFuncDef(startTok, modifiers)];
    if (this.matchKeyword('typedef')) return [this.parseTypedef(startTok)];

    // Otherwise it must be a function or variable declaration.
    return this.parseFunctionOrVariable(startTok, modifiers);
  }

  private parseLeadingModifiers(): string[] {
    const mods: string[] = [];
    while (this.check(TokenKind.Keyword) && MODIFIER_KEYWORDS.has(this.peek().value)) {
      mods.push(this.advance().value);
    }
    return mods;
  }

  private parseImport(startTok: Token): ImportDecl {
    // import ReturnType Name(params) from "module";
    // (or variable form -- rare; we accept both.)
    const inner = this.parseFunctionOrVariable(startTok, []);
    this.consumeKeyword('from', "Expected 'from' in import declaration.");
    const stringTok = this.consume(TokenKind.StringLiteral, 'Expected module name string after "from".');
    this.consume(TokenKind.Semicolon, "Expected ';' after import declaration.");
    const first = inner[0];
    if (!first || (first.kind !== 'FunctionDecl' && first.kind !== 'VariableDecl')) {
      this.error(startTok, 'Import requires a function or variable declaration.');
      throw new ParseException();
    }
    const end = this.previous();
    return {
      kind: 'ImportDecl',
      signature: first,
      fromModule: this.stripQuotes(stringTok.value),
      ...this.rangeOf(startTok, end),
    };
  }

  private parseNamespace(startTok: Token): NamespaceDecl {
    const nameParts: string[] = [];
    nameParts.push(this.consume(TokenKind.Identifier, 'Expected namespace name.').value);
    while (this.match(TokenKind.ColonColon)) {
      nameParts.push(this.consume(TokenKind.Identifier, "Expected identifier after '::'.").value);
    }
    this.consume(TokenKind.LBrace, "Expected '{' to open namespace body.");
    const declarations: Declaration[] = [];
    while (!this.check(TokenKind.RBrace) && !this.isAtEnd()) {
      if (this.check(TokenKind.Preprocessor)) { this.advance(); continue; }
      try {
        declarations.push(...this.parseDeclaration());
      } catch (e) {
        if (e instanceof ParseException) this.synchronizeTopLevel();
        else throw e;
      }
    }
    this.consume(TokenKind.RBrace, "Expected '}' to close namespace body.");
    return {
      kind: 'NamespaceDecl',
      name: nameParts,
      declarations,
      ...this.rangeOf(startTok, this.previous()),
    };
  }

  private parseClass(startTok: Token, modifiers: string[]): ClassDecl {
    const name = this.consume(TokenKind.Identifier, 'Expected class name.').value;
    const bases: string[] = [];
    if (this.match(TokenKind.Colon)) {
      bases.push(this.parseQualifiedIdent());
      while (this.match(TokenKind.Comma)) bases.push(this.parseQualifiedIdent());
    }
    this.consume(TokenKind.LBrace, "Expected '{' to open class body.");
    const members: Declaration[] = [];
    while (!this.check(TokenKind.RBrace) && !this.isAtEnd()) {
      if (this.check(TokenKind.Preprocessor)) { this.advance(); continue; }
      try {
        members.push(...this.parseClassMember());
      } catch (e) {
        if (e instanceof ParseException) this.synchronizeMember();
        else throw e;
      }
    }
    this.consume(TokenKind.RBrace, "Expected '}' to close class body.");
    return {
      kind: 'ClassDecl',
      name,
      modifiers,
      bases,
      members,
      ...this.rangeOf(startTok, this.previous()),
    };
  }

  private parseInterface(startTok: Token, modifiers: string[]): InterfaceDecl {
    const name = this.consume(TokenKind.Identifier, 'Expected interface name.').value;
    const bases: string[] = [];
    if (this.match(TokenKind.Colon)) {
      bases.push(this.parseQualifiedIdent());
      while (this.match(TokenKind.Comma)) bases.push(this.parseQualifiedIdent());
    }
    this.consume(TokenKind.LBrace, "Expected '{' to open interface body.");
    const members: Declaration[] = [];
    while (!this.check(TokenKind.RBrace) && !this.isAtEnd()) {
      if (this.check(TokenKind.Preprocessor)) { this.advance(); continue; }
      try {
        members.push(...this.parseClassMember());
      } catch (e) {
        if (e instanceof ParseException) this.synchronizeMember();
        else throw e;
      }
    }
    this.consume(TokenKind.RBrace, "Expected '}' to close interface body.");
    return {
      kind: 'InterfaceDecl',
      name,
      modifiers,
      bases,
      members,
      ...this.rangeOf(startTok, this.previous()),
    };
  }

  private parseClassMember(): Declaration[] {
    const doc = this.docs.get(this.pos);
    const startTok = this.peek();
    const modifiers = this.parseLeadingModifiers();
    let decls: Declaration[];
    if (this.matchKeyword('enum')) decls = [this.parseEnum(startTok, modifiers)];
    else if (this.matchKeyword('funcdef')) decls = [this.parseFuncDef(startTok, modifiers)];
    else if (this.matchKeyword('typedef')) decls = [this.parseTypedef(startTok)];
    else decls = this.parseFunctionOrVariable(startTok, modifiers);
    if (decls.length > 0 && doc !== undefined) decls[0].doc = doc;
    return decls;
  }

  private parseEnum(startTok: Token, modifiers: string[]): EnumDecl {
    const name = this.consume(TokenKind.Identifier, 'Expected enum name.').value;
    this.consume(TokenKind.LBrace, "Expected '{' to open enum body.");
    const members: EnumMember[] = [];
    while (!this.check(TokenKind.RBrace) && !this.isAtEnd()) {
      const memberDoc = this.docs.get(this.pos);
      const memberStart = this.peek();
      // Accept Identifier OR Keyword as the member name -- Echo defines
      // enum members like `op_visibility::explicit` that collide with AS
      // reserved keywords.
      let memberName: string;
      if (this.check(TokenKind.Identifier) || this.check(TokenKind.Keyword)) {
        memberName = this.advance().value;
      } else {
        this.error(this.peek(), 'Expected enum member name.');
        throw new ParseException();
      }
      let value: Expression | undefined;
      if (this.match(TokenKind.Assign)) value = this.parseExpression();
      members.push({
        kind: 'EnumMember',
        name: memberName,
        value,
        doc: memberDoc,
        ...this.rangeOf(memberStart, this.previous()),
      });
      if (!this.match(TokenKind.Comma)) break;
    }
    this.consume(TokenKind.RBrace, "Expected '}' to close enum body.");
    return {
      kind: 'EnumDecl',
      name,
      modifiers,
      members,
      ...this.rangeOf(startTok, this.previous()),
    };
  }

  private parseFuncDef(startTok: Token, modifiers: string[] = []): FuncDefDecl {
    const returnType = this.parseTypeRef();
    const name = this.consume(TokenKind.Identifier, 'Expected name in funcdef declaration.').value;
    const params = this.parseParameterList();
    this.consume(TokenKind.Semicolon, "Expected ';' after funcdef declaration.");
    return {
      kind: 'FuncDefDecl',
      name,
      modifiers,
      returnType,
      params,
      ...this.rangeOf(startTok, this.previous()),
    };
  }

  private parseTypedef(startTok: Token): TypeDefDecl {
    const aliased = this.parseTypeRef();
    const name = this.consume(TokenKind.Identifier, 'Expected new name in typedef declaration.').value;
    this.consume(TokenKind.Semicolon, "Expected ';' after typedef declaration.");
    return {
      kind: 'TypeDefDecl',
      name,
      aliased,
      ...this.rangeOf(startTok, this.previous()),
    };
  }

  /**
   * Parse a function declaration or one-or-more variable declarations.
   * Both forms start with [modifiers] Type Identifier; disambiguate on
   * what follows the first identifier:
   *   `(`  -> function (returns a one-element array)
   *   `=`, `,`, `;` -> variable(s) (returns one element per declarator)
   */
  private parseFunctionOrVariable(startTok: Token, modifiers: string[]): Declaration[] {
    // Constructors / destructors: `~ClassName(...)` or `ClassName(...)` inside a class.
    if (this.check(TokenKind.Tilde) && this.peekAt(1)?.kind === TokenKind.Identifier
        && this.peekAt(2)?.kind === TokenKind.LParen) {
      this.advance(); // ~
      const name = '~' + this.advance().value;
      const params = this.parseParameterList();
      const { body, isConst } = this.parseFunctionTail();
      return [{
        kind: 'FunctionDecl',
        name,
        modifiers,
        returnType: null,
        params,
        isConst,
        body,
        ...this.rangeOf(startTok, this.previous()),
      }];
    }
    // Bare constructor form: `ClassName(args) { ... }` -- we can't tell from
    // just lookahead that it's not a function call statement, so we use type
    // speculation below; constructors fall through to the general path.

    const type = this.parseTypeRef();
    const nameTok = this.peek();

    // Constructor case: in a class, the "type" was actually the class name and
    // the next token is `(`. We detect this by: no name identifier follows,
    // immediately `(`.
    if (nameTok.kind === TokenKind.LParen
        && type.name.length === 1
        && !type.isHandle && !type.isReference
        && type.arrayDepth === 0
        && type.templateArgs.length === 0
        && !type.isConst) {
      const ctorName = type.name[0];
      const params = this.parseParameterList();
      const { body, isConst } = this.parseFunctionTail();
      return [{
        kind: 'FunctionDecl',
        name: ctorName,
        modifiers,
        returnType: null,
        params,
        isConst,
        body,
        ...this.rangeOf(startTok, this.previous()),
      }];
    }

    const name = this.consumeName('Expected declaration name.').value;

    if (this.check(TokenKind.LParen)) {
      // `Type name(...)` is ambiguous at this position:
      //   - function declaration: `Type name(Type p1, ...) { body }` or `;`
      //   - variable with constructor init: `Type name(arg1, arg2);`
      // Speculatively try the function-decl path; on failure, rewind and
      // fall through to the var-decl path (which uses parseOptionalInitializer
      // to handle the constructor-call form).
      const savedPos = this.pos;
      const savedErrors = this.errors.length;
      let params: Parameter[] | null = null;
      try {
        params = this.parseParameterList();
      } catch (e) {
        if (!(e instanceof ParseException)) throw e;
        this.pos = savedPos;
        this.errors.length = savedErrors;
      }

      if (params !== null) {
        const { body, isConst } = this.parseFunctionTail();
        return [{
          kind: 'FunctionDecl',
          name,
          modifiers,
          returnType: type,
          params,
          isConst,
          body,
          ...this.rangeOf(startTok, this.previous()),
        }];
      }
      // Fall through to variable-decl path; parseOptionalInitializer
      // consumes the `(args)` form below.
    }

    // Variable declaration (possibly multi-declarator).
    const firstInit = this.parseOptionalInitializer();
    const declarations: VariableDecl[] = [];
    declarations.push({
      kind: 'VariableDecl',
      name,
      modifiers,
      type,
      initializer: firstInit,
      declaratorIndex: 0,
      ...this.rangeOf(startTok, this.previous()),
    });
    while (this.match(TokenKind.Comma)) {
      const declTok = this.peek();
      const nextName = this.consumeName('Expected variable name.').value;
      const init = this.parseOptionalInitializer();
      declarations.push({
        kind: 'VariableDecl',
        name: nextName,
        modifiers,
        type,
        initializer: init,
        declaratorIndex: declarations.length,
        ...this.rangeOf(declTok, this.previous()),
      });
    }
    this.consume(TokenKind.Semicolon, "Expected ';' after variable declaration.");

    return declarations;
  }

  private parseOptionalInitializer(): Expression | undefined {
    if (this.match(TokenKind.Assign)) {
      return this.parseAssignment();
    }
    if (this.check(TokenKind.LParen)) {
      // Constructor-call initializer `Type name(args);`
      const callStart = this.peek();
      this.advance(); // (
      const args: Expression[] = [];
      if (!this.check(TokenKind.RParen)) {
        args.push(this.parseAssignment());
        while (this.match(TokenKind.Comma)) args.push(this.parseAssignment());
      }
      const rparen = this.consume(TokenKind.RParen, "Expected ')' after constructor arguments.");
      // Synthesize as a CallExpr on a placeholder identifier; sema can rewrite.
      return {
        kind: 'CallExpr',
        callee: {
          kind: 'Identifier',
          name: '<ctor>',
          ...this.rangeOf(callStart, callStart),
        },
        args,
        ...this.rangeOf(callStart, rparen),
      };
    }
    return undefined;
  }

  private parseParameterList(): Parameter[] {
    this.consume(TokenKind.LParen, "Expected '(' to open parameter list.");
    const params: Parameter[] = [];
    if (!this.check(TokenKind.RParen)) {
      // Special case: `(void)` -- empty parameter list spelled with void.
      if (this.checkKeyword('void') && this.peekAt(1)?.kind === TokenKind.RParen) {
        this.advance();
      } else {
        params.push(this.parseParameter());
        while (this.match(TokenKind.Comma)) params.push(this.parseParameter());
      }
    }
    this.consume(TokenKind.RParen, "Expected ')' to close parameter list.");
    return params;
  }

  private parseParameter(): Parameter {
    const startTok = this.peek();
    const type = this.parseTypeRef();
    let direction: Parameter['direction'];
    if (this.checkKeyword('in')) { this.advance(); direction = 'in'; }
    else if (this.checkKeyword('out')) { this.advance(); direction = 'out'; }
    else if (this.checkKeyword('inout')) { this.advance(); direction = 'inout'; }
    let name: string | undefined;
    // Accept Identifier OR Keyword as the parameter name (contextual
    // keywords like `from`, `property`, etc. are valid identifier names).
    // Stop short of `,` `)` `=` which terminate the parameter.
    if (this.check(TokenKind.Identifier) || this.check(TokenKind.Keyword)) {
      name = this.advance().value;
    }
    let defaultValue: Expression | undefined;
    if (this.match(TokenKind.Assign)) defaultValue = this.parseAssignment();
    return {
      kind: 'Parameter',
      direction,
      type,
      name,
      defaultValue,
      ...this.rangeOf(startTok, this.previous()),
    };
  }

  /**
   * Parse the postfix modifiers (`const`, `final`, `override`, etc.) and
   * the body (or `;` for declaration-only).
   */
  private parseFunctionTail(): { body: BlockStmt | null; isConst: boolean } {
    let isConst = false;
    while (this.check(TokenKind.Keyword) && POSTFIX_METHOD_MODIFIERS.has(this.peek().value)) {
      const kw = this.advance().value;
      if (kw === 'const') isConst = true;
    }
    if (this.match(TokenKind.Semicolon)) return { body: null, isConst };
    const body = this.parseBlock();
    return { body, isConst };
  }

  // =========================================================================
  // Types
  // =========================================================================

  /**
   * Parse a type reference. Handles: const, primitive/named, namespace
   * qualification, template args, handle (@, @+), array ([]), reference (&).
   */
  private parseTypeRef(): TypeRef {
    const startTok = this.peek();
    let isConst = false;
    if (this.matchKeyword('const')) isConst = true;

    const name: string[] = [];
    const nameRanges: { start: number; end: number; startPos: Position; endPos: Position }[] = [];
    const pushPart = (t: Token) => {
      name.push(t.value);
      nameRanges.push({ start: t.start, end: t.end, startPos: t.startPos, endPos: t.endPos });
    };
    if (this.check(TokenKind.Question)) {
      // AS variant type: `?` (typically used as `?&in` / `?&out` for
      // generic-arg parameters like `void print(?&in msg)`).
      pushPart(this.advance());
    } else if (this.check(TokenKind.Keyword) && PRIMITIVE_TYPES.has(this.peek().value)) {
      pushPart(this.advance());
    } else if (this.check(TokenKind.Keyword) && this.peek().value === 'auto') {
      pushPart(this.advance());
    } else {
      pushPart(this.consume(TokenKind.Identifier, 'Expected type name.'));
      while (this.match(TokenKind.ColonColon)) {
        pushPart(this.consume(TokenKind.Identifier, "Expected identifier after '::'."));
      }
    }

    // Template args -- only valid on named (not primitive) types but we allow it.
    const templateArgs: TypeRef[] = [];
    if (this.check(TokenKind.Lt)) {
      // Speculative: this could also be `<` (comparison) in odd contexts.
      // In a type position, treat as template.
      this.advance();
      templateArgs.push(this.parseTypeRef());
      while (this.match(TokenKind.Comma)) templateArgs.push(this.parseTypeRef());
      // Handle `>>` lexed as Shr -> split into two Gt.
      this.consumeGreaterThan();
    }

    let arrayDepth = 0;
    let isHandle = false;
    let isHandleConst = false;
    let isReference = false;

    // Suffixes -- order can vary: [], @, @+, &
    while (true) {
      if (this.match(TokenKind.LBracket)) {
        this.consume(TokenKind.RBracket, "Expected ']' in array type.");
        arrayDepth++;
        continue;
      }
      if (this.check(TokenKind.At)) {
        this.advance();
        isHandle = true;
        if (this.check(TokenKind.Plus)) { this.advance(); isHandleConst = true; }
        continue;
      }
      if (this.check(TokenKind.Amp) && !isReference) {
        this.advance();
        isReference = true;
        continue;
      }
      break;
    }

    return {
      kind: 'TypeRef',
      name,
      nameRanges,
      isConst,
      templateArgs,
      arrayDepth,
      isHandle,
      isHandleConst,
      isReference,
      ...this.rangeOf(startTok, this.previous()),
    };
  }

  /** Consume `>` -- if current token is `>>` or `>>>`, split it. */
  private consumeGreaterThan(): void {
    const t = this.peek();
    if (t.kind === TokenKind.Gt) { this.advance(); return; }
    if (t.kind === TokenKind.Shr) {
      // Replace `>>` with `>` and leave a `>` for the outer caller.
      this.tokens[this.pos] = { ...t, kind: TokenKind.Gt, value: '>', start: t.start + 1, startPos: { ...t.startPos, column: t.startPos.column + 1 } };
      return;
    }
    if (t.kind === TokenKind.UShr) {
      this.tokens[this.pos] = { ...t, kind: TokenKind.Shr, value: '>>', start: t.start + 1, startPos: { ...t.startPos, column: t.startPos.column + 1 } };
      return;
    }
    this.error(t, "Expected '>' to close template arguments.");
    throw new ParseException();
  }

  private parseQualifiedIdent(): string {
    const parts: string[] = [];
    parts.push(this.consume(TokenKind.Identifier, 'Expected identifier.').value);
    while (this.match(TokenKind.ColonColon)) {
      parts.push(this.consume(TokenKind.Identifier, "Expected identifier after '::'.").value);
    }
    return parts.join('::');
  }

  // =========================================================================
  // Statements
  // =========================================================================

  private parseBlock(): BlockStmt {
    const startTok = this.consume(TokenKind.LBrace, "Expected '{'.");
    const statements: Statement[] = [];
    while (!this.check(TokenKind.RBrace) && !this.isAtEnd()) {
      if (this.check(TokenKind.Preprocessor)) { this.advance(); continue; }
      try {
        const s = this.parseStatement();
        if (s) statements.push(s);
      } catch (e) {
        if (e instanceof ParseException) this.synchronizeStatement();
        else throw e;
      }
    }
    this.consume(TokenKind.RBrace, "Expected '}'.");
    return {
      kind: 'BlockStmt',
      statements,
      ...this.rangeOf(startTok, this.previous()),
    };
  }

  private parseStatement(): Statement | null {
    const startTok = this.peek();
    if (this.check(TokenKind.LBrace)) return this.parseBlock();
    if (this.matchKeyword('if')) return this.parseIf(startTok);
    if (this.matchKeyword('while')) return this.parseWhile(startTok);
    if (this.matchKeyword('do')) return this.parseDoWhile(startTok);
    if (this.matchKeyword('for')) return this.parseFor(startTok);
    if (this.matchKeyword('switch')) return this.parseSwitch(startTok);
    if (this.matchKeyword('break')) {
      this.consume(TokenKind.Semicolon, "Expected ';' after 'break'.");
      return { kind: 'BreakStmt', ...this.rangeOf(startTok, this.previous()) };
    }
    if (this.matchKeyword('continue')) {
      this.consume(TokenKind.Semicolon, "Expected ';' after 'continue'.");
      return { kind: 'ContinueStmt', ...this.rangeOf(startTok, this.previous()) };
    }
    if (this.matchKeyword('return')) return this.parseReturn(startTok);
    if (this.matchKeyword('try')) return this.parseTry(startTok);

    // Disambiguate variable declaration vs expression statement.
    if (this.looksLikeVarDecl()) return this.parseVarDeclStmt(startTok);

    const expr = this.parseExpression();
    this.consume(TokenKind.Semicolon, "Expected ';' after expression.");
    return { kind: 'ExprStmt', expression: expr, ...this.rangeOf(startTok, this.previous()) };
  }

  private parseIf(startTok: Token): Statement {
    this.consume(TokenKind.LParen, "Expected '(' after 'if'.");
    const condition = this.parseExpression();
    this.consume(TokenKind.RParen, "Expected ')' after if condition.");
    const then = this.requireStatement();
    let elseStmt: Statement | undefined;
    if (this.matchKeyword('else')) elseStmt = this.requireStatement();
    return { kind: 'IfStmt', condition, then, else: elseStmt, ...this.rangeOf(startTok, this.previous()) };
  }

  private parseWhile(startTok: Token): Statement {
    this.consume(TokenKind.LParen, "Expected '(' after 'while'.");
    const condition = this.parseExpression();
    this.consume(TokenKind.RParen, "Expected ')' after while condition.");
    const body = this.requireStatement();
    return { kind: 'WhileStmt', condition, body, ...this.rangeOf(startTok, this.previous()) };
  }

  private parseDoWhile(startTok: Token): Statement {
    const body = this.requireStatement();
    this.consumeKeyword('while', "Expected 'while' after do-block.");
    this.consume(TokenKind.LParen, "Expected '(' after 'while'.");
    const condition = this.parseExpression();
    this.consume(TokenKind.RParen, "Expected ')' after while condition.");
    this.consume(TokenKind.Semicolon, "Expected ';' after do-while.");
    return { kind: 'DoWhileStmt', body, condition, ...this.rangeOf(startTok, this.previous()) };
  }

  private parseFor(startTok: Token): Statement {
    this.consume(TokenKind.LParen, "Expected '(' after 'for'.");
    let init: Statement | null = null;
    if (this.match(TokenKind.Semicolon)) {
      init = null;
    } else if (this.looksLikeVarDecl()) {
      init = this.parseVarDeclStmt(this.peek());
    } else {
      const exprStart = this.peek();
      const expr = this.parseExpression();
      this.consume(TokenKind.Semicolon, "Expected ';' after for-init.");
      init = { kind: 'ExprStmt', expression: expr, ...this.rangeOf(exprStart, this.previous()) };
    }
    let condition: Expression | null = null;
    if (!this.check(TokenKind.Semicolon)) condition = this.parseExpression();
    this.consume(TokenKind.Semicolon, "Expected ';' after for-condition.");
    const update: Expression[] = [];
    if (!this.check(TokenKind.RParen)) {
      update.push(this.parseExpression());
      while (this.match(TokenKind.Comma)) update.push(this.parseExpression());
    }
    this.consume(TokenKind.RParen, "Expected ')' after for-clause.");
    const body = this.requireStatement();
    return { kind: 'ForStmt', init, condition, update, body, ...this.rangeOf(startTok, this.previous()) };
  }

  private parseSwitch(startTok: Token): Statement {
    this.consume(TokenKind.LParen, "Expected '(' after 'switch'.");
    const discriminant = this.parseExpression();
    this.consume(TokenKind.RParen, "Expected ')' after switch discriminant.");
    this.consume(TokenKind.LBrace, "Expected '{' to open switch body.");
    const cases: CaseClause[] = [];
    while (!this.check(TokenKind.RBrace) && !this.isAtEnd()) {
      const cStart = this.peek();
      let match: Expression | null = null;
      if (this.matchKeyword('case')) {
        match = this.parseExpression();
      } else if (this.matchKeyword('default')) {
        match = null;
      } else {
        this.error(this.peek(), "Expected 'case' or 'default' in switch.");
        throw new ParseException();
      }
      this.consume(TokenKind.Colon, "Expected ':' after case label.");
      const stmts: Statement[] = [];
      while (!this.check(TokenKind.RBrace)
          && !this.checkKeyword('case')
          && !this.checkKeyword('default')
          && !this.isAtEnd()) {
        try {
          const s = this.parseStatement();
          if (s) stmts.push(s);
        } catch (e) {
          if (e instanceof ParseException) this.synchronizeStatement();
          else throw e;
        }
      }
      cases.push({
        kind: 'CaseClause',
        match,
        statements: stmts,
        ...this.rangeOf(cStart, this.previous()),
      });
    }
    this.consume(TokenKind.RBrace, "Expected '}' to close switch body.");
    return { kind: 'SwitchStmt', discriminant, cases, ...this.rangeOf(startTok, this.previous()) };
  }

  private parseReturn(startTok: Token): Statement {
    let value: Expression | undefined;
    if (!this.check(TokenKind.Semicolon)) value = this.parseExpression();
    this.consume(TokenKind.Semicolon, "Expected ';' after return.");
    return { kind: 'ReturnStmt', value, ...this.rangeOf(startTok, this.previous()) };
  }

  private parseTry(startTok: Token): Statement {
    const block = this.parseBlock();
    this.consumeKeyword('catch', "Expected 'catch' after try-block.");
    const catchBlock = this.parseBlock();
    return { kind: 'TryStmt', block, catchBlock, ...this.rangeOf(startTok, this.previous()) };
  }

  private parseVarDeclStmt(startTok: Token): VarDeclStmt {
    const modifiers = this.parseLeadingModifiers();
    const type = this.parseTypeRef();
    const declarations: VariableDecl[] = [];
    const firstStart = this.peek();
    const firstName = this.consumeName('Expected variable name.').value;
    const firstInit = this.parseOptionalInitializer();
    declarations.push({
      kind: 'VariableDecl',
      name: firstName,
      modifiers,
      type,
      initializer: firstInit,
      declaratorIndex: 0,
      ...this.rangeOf(firstStart, this.previous()),
    });
    while (this.match(TokenKind.Comma)) {
      const dStart = this.peek();
      const dName = this.consume(TokenKind.Identifier, 'Expected variable name.').value;
      const dInit = this.parseOptionalInitializer();
      declarations.push({
        kind: 'VariableDecl',
        name: dName,
        modifiers,
        type,
        initializer: dInit,
        declaratorIndex: declarations.length,
        ...this.rangeOf(dStart, this.previous()),
      });
    }
    this.consume(TokenKind.Semicolon, "Expected ';' after variable declaration.");
    return {
      kind: 'VarDeclStmt',
      declarations,
      ...this.rangeOf(startTok, this.previous()),
    };
  }

  private requireStatement(): Statement {
    const s = this.parseStatement();
    if (!s) {
      this.error(this.peek(), 'Expected statement.');
      throw new ParseException();
    }
    return s;
  }

  /**
   * Speculative lookahead: does the cursor sit at the start of a variable
   * declaration in statement position?
   */
  private looksLikeVarDecl(): boolean {
    const save = this.pos;
    const errs = this.errors.length;
    try {
      // Skip modifiers
      while (this.check(TokenKind.Keyword) && MODIFIER_KEYWORDS.has(this.peek().value)) this.advance();
      this.parseTypeRef();
      // Accept Identifier or any Keyword as the name -- AS has many
      // contextual keywords (in/out/inout/from/property/etc.) that are
      // valid identifier names in this position.
      if (!this.check(TokenKind.Identifier) && !this.check(TokenKind.Keyword)) return false;
      const afterIdent = this.peekAt(1);
      if (!afterIdent) return false;
      switch (afterIdent.kind) {
        case TokenKind.Assign:
        case TokenKind.Semicolon:
        case TokenKind.Comma:
        case TokenKind.LParen: // constructor-style init
          return true;
        default:
          return false;
      }
    } catch {
      return false;
    } finally {
      this.pos = save;
      this.errors.length = errs;
    }
  }

  /**
   * Consume a "name" token -- Identifier or any Keyword. AngelScript has a
   * lot of contextual keywords (`in`, `out`, `inout`, `from`, `property`,
   * `explicit`, etc.) that are valid identifier names everywhere except
   * the position where the keyword form is interpreted.
   */
  private consumeName(msg: string): Token {
    if (this.check(TokenKind.Identifier) || this.check(TokenKind.Keyword)) {
      return this.advance();
    }
    this.error(this.peek(), msg);
    throw new ParseException();
  }

  // =========================================================================
  // Expressions -- precedence climbing
  // =========================================================================

  private parseExpression(): Expression {
    return this.parseAssignment();
  }

  private parseAssignment(): Expression {
    const left = this.parseTernary();
    const assignKinds: Record<number, AssignmentOp | undefined> = {
      [TokenKind.Assign]: '=',
      [TokenKind.PlusAssign]: '+=',
      [TokenKind.MinusAssign]: '-=',
      [TokenKind.StarAssign]: '*=',
      [TokenKind.SlashAssign]: '/=',
      [TokenKind.PercentAssign]: '%=',
      [TokenKind.AndAssign]: '&=',
      [TokenKind.OrAssign]: '|=',
      [TokenKind.XorAssign]: '^=',
      [TokenKind.ShlAssign]: '<<=',
      [TokenKind.ShrAssign]: '>>=',
      [TokenKind.UShrAssign]: '>>>=',
      [TokenKind.StarStarAssign]: '**=',
      [TokenKind.HandleAssign]: '@=',
    };
    const op = assignKinds[this.peek().kind];
    if (op) {
      this.advance();
      const value = this.parseAssignment();
      return {
        kind: 'AssignmentExpr',
        op,
        target: left,
        value,
        ...this.rangeBetween(left, value),
      };
    }
    return left;
  }

  private parseTernary(): Expression {
    const cond = this.parseLogicalOr();
    if (this.match(TokenKind.Question)) {
      const whenTrue = this.parseAssignment();
      this.consume(TokenKind.Colon, "Expected ':' in ternary.");
      const whenFalse = this.parseAssignment();
      return {
        kind: 'TernaryExpr',
        condition: cond,
        whenTrue,
        whenFalse,
        ...this.rangeBetween(cond, whenFalse),
      };
    }
    return cond;
  }

  private parseLogicalOr(): Expression {
    let left = this.parseLogicalAnd();
    while (this.check(TokenKind.OrOr) || this.checkKeyword('or') || this.checkKeyword('xor')) {
      const opTok = this.advance();
      const op: BinaryOp = (opTok.kind === TokenKind.OrOr ? '||' : (opTok.value as BinaryOp));
      const right = this.parseLogicalAnd();
      left = this.mkBinary(op, left, right);
    }
    return left;
  }

  private parseLogicalAnd(): Expression {
    let left = this.parseBitwiseOr();
    while (this.check(TokenKind.AndAnd) || this.checkKeyword('and')) {
      const opTok = this.advance();
      const op: BinaryOp = (opTok.kind === TokenKind.AndAnd ? '&&' : 'and');
      const right = this.parseBitwiseOr();
      left = this.mkBinary(op, left, right);
    }
    return left;
  }

  private parseBitwiseOr(): Expression {
    let left = this.parseBitwiseXor();
    while (this.check(TokenKind.Pipe)) {
      this.advance();
      const right = this.parseBitwiseXor();
      left = this.mkBinary('|', left, right);
    }
    return left;
  }

  private parseBitwiseXor(): Expression {
    let left = this.parseBitwiseAnd();
    while (this.check(TokenKind.Caret)) {
      this.advance();
      const right = this.parseBitwiseAnd();
      left = this.mkBinary('^', left, right);
    }
    return left;
  }

  private parseBitwiseAnd(): Expression {
    let left = this.parseEquality();
    while (this.check(TokenKind.Amp)) {
      this.advance();
      const right = this.parseEquality();
      left = this.mkBinary('&', left, right);
    }
    return left;
  }

  private parseEquality(): Expression {
    let left = this.parseComparison();
    while (true) {
      if (this.check(TokenKind.Eq)) { this.advance(); left = this.mkBinary('==', left, this.parseComparison()); continue; }
      if (this.check(TokenKind.Neq)) { this.advance(); left = this.mkBinary('!=', left, this.parseComparison()); continue; }
      if (this.checkKeyword('is')) { this.advance(); left = this.mkBinary('is', left, this.parseComparison()); continue; }
      // !is -- Bang followed by 'is' keyword
      if (this.check(TokenKind.Bang) && this.checkKeywordAt(1, 'is')) {
        this.advance(); this.advance();
        left = this.mkBinary('!is', left, this.parseComparison());
        continue;
      }
      break;
    }
    return left;
  }

  private parseComparison(): Expression {
    let left = this.parseShift();
    while (true) {
      if (this.check(TokenKind.Lt)) { this.advance(); left = this.mkBinary('<', left, this.parseShift()); continue; }
      if (this.check(TokenKind.Gt)) { this.advance(); left = this.mkBinary('>', left, this.parseShift()); continue; }
      if (this.check(TokenKind.Le)) { this.advance(); left = this.mkBinary('<=', left, this.parseShift()); continue; }
      if (this.check(TokenKind.Ge)) { this.advance(); left = this.mkBinary('>=', left, this.parseShift()); continue; }
      if (this.checkKeyword('in')) { this.advance(); left = this.mkBinary('in', left, this.parseShift()); continue; }
      break;
    }
    return left;
  }

  private parseShift(): Expression {
    let left = this.parseAdditive();
    while (true) {
      if (this.check(TokenKind.Shl)) { this.advance(); left = this.mkBinary('<<', left, this.parseAdditive()); continue; }
      if (this.check(TokenKind.Shr)) { this.advance(); left = this.mkBinary('>>', left, this.parseAdditive()); continue; }
      if (this.check(TokenKind.UShr)) { this.advance(); left = this.mkBinary('>>>', left, this.parseAdditive()); continue; }
      break;
    }
    return left;
  }

  private parseAdditive(): Expression {
    let left = this.parseMultiplicative();
    while (true) {
      if (this.check(TokenKind.Plus)) { this.advance(); left = this.mkBinary('+', left, this.parseMultiplicative()); continue; }
      if (this.check(TokenKind.Minus)) { this.advance(); left = this.mkBinary('-', left, this.parseMultiplicative()); continue; }
      break;
    }
    return left;
  }

  private parseMultiplicative(): Expression {
    let left = this.parsePower();
    while (true) {
      if (this.check(TokenKind.Star)) { this.advance(); left = this.mkBinary('*', left, this.parsePower()); continue; }
      if (this.check(TokenKind.Slash)) { this.advance(); left = this.mkBinary('/', left, this.parsePower()); continue; }
      if (this.check(TokenKind.Percent)) { this.advance(); left = this.mkBinary('%', left, this.parsePower()); continue; }
      break;
    }
    return left;
  }

  /** Right-associative. */
  private parsePower(): Expression {
    const left = this.parseUnary();
    if (this.check(TokenKind.StarStar)) {
      this.advance();
      const right = this.parsePower();
      return this.mkBinary('**', left, right);
    }
    return left;
  }

  private parseUnary(): Expression {
    const startTok = this.peek();
    if (this.check(TokenKind.Plus)) { this.advance(); return this.mkUnary('+', this.parseUnary(), startTok); }
    if (this.check(TokenKind.Minus)) { this.advance(); return this.mkUnary('-', this.parseUnary(), startTok); }
    if (this.check(TokenKind.Bang)) { this.advance(); return this.mkUnary('!', this.parseUnary(), startTok); }
    if (this.check(TokenKind.Tilde)) { this.advance(); return this.mkUnary('~', this.parseUnary(), startTok); }
    if (this.check(TokenKind.PlusPlus)) { this.advance(); return this.mkUnary('++', this.parseUnary(), startTok); }
    if (this.check(TokenKind.MinusMinus)) { this.advance(); return this.mkUnary('--', this.parseUnary(), startTok); }
    if (this.checkKeyword('not')) { this.advance(); return this.mkUnary('not', this.parseUnary(), startTok); }
    if (this.check(TokenKind.At)) {
      this.advance();
      const operand = this.parseUnary();
      return { kind: 'HandleExpr', operand, ...this.rangeOf(startTok, this.previous()) };
    }
    return this.parsePostfix();
  }

  private parsePostfix(): Expression {
    let expr = this.parsePrimary();
    while (true) {
      if (this.match(TokenKind.Dot)) {
        const nameTok = this.consumeName("Expected member name after '.'.");
        expr = {
          kind: 'MemberExpr',
          object: expr,
          property: nameTok.value,
          propertyStart: nameTok.start,
          propertyEnd: nameTok.end,
          propertyStartPos: nameTok.startPos,
          propertyEndPos: nameTok.endPos,
          ...this.rangeBetween(expr, nameTok),
        };
        continue;
      }
      if (this.check(TokenKind.LParen)) {
        const lparen = this.advance();
        const args: Expression[] = [];
        if (!this.check(TokenKind.RParen)) {
          args.push(this.parseAssignment());
          while (this.match(TokenKind.Comma)) args.push(this.parseAssignment());
        }
        const rparen = this.consume(TokenKind.RParen, "Expected ')' after arguments.");
        expr = {
          kind: 'CallExpr',
          callee: expr,
          args,
          ...this.rangeBetween(expr, rparen),
        };
        // Suppress unused warning on lparen -- it's the open-paren we already consumed.
        void lparen;
        continue;
      }
      if (this.check(TokenKind.LBracket)) {
        this.advance();
        const index = this.parseExpression();
        const rbracket = this.consume(TokenKind.RBracket, "Expected ']' after index.");
        expr = {
          kind: 'IndexExpr',
          object: expr,
          index,
          ...this.rangeBetween(expr, rbracket),
        };
        continue;
      }
      if (this.check(TokenKind.PlusPlus)) {
        const t = this.advance();
        expr = { kind: 'PostfixExpr', op: '++', operand: expr, ...this.rangeBetween(expr, t) };
        continue;
      }
      if (this.check(TokenKind.MinusMinus)) {
        const t = this.advance();
        expr = { kind: 'PostfixExpr', op: '--', operand: expr, ...this.rangeBetween(expr, t) };
        continue;
      }
      break;
    }
    return expr;
  }

  private parsePrimary(): Expression {
    const t = this.peek();

    if (t.kind === TokenKind.IntLiteral) { this.advance(); return this.mkLit('int', t); }
    if (t.kind === TokenKind.FloatLiteral) { this.advance(); return this.mkLit('float', t); }
    if (t.kind === TokenKind.StringLiteral) { this.advance(); return this.mkLit('string', t); }
    if (t.kind === TokenKind.BoolLiteral) { this.advance(); return this.mkLit('bool', t); }
    if (t.kind === TokenKind.NullLiteral) { this.advance(); return this.mkLit('null', t); }

    if (this.checkKeyword('this')) {
      this.advance();
      return { kind: 'ThisExpr', ...this.rangeOf(t, t) };
    }

    if (this.matchKeyword('cast')) {
      this.consume(TokenKind.Lt, "Expected '<' after 'cast'.");
      const targetType = this.parseTypeRef();
      this.consumeGreaterThan();
      this.consume(TokenKind.LParen, "Expected '(' in cast.");
      const value = this.parseExpression();
      const rparen = this.consume(TokenKind.RParen, "Expected ')' in cast.");
      return {
        kind: 'CastExpr',
        targetType,
        value,
        ...this.rangeOf(t, rparen),
      };
    }

    if (this.checkKeyword('function')) {
      const fnStart = this.advance();
      const params = this.parseParameterList();
      // Optional explicit return type before the body. `{` ends the
      // signature; anything else (an identifier / primitive type) is a
      // return type that we parse as a TypeRef.
      let returnType: TypeRef | null = null;
      if (!this.check(TokenKind.LBrace)) {
        returnType = this.parseTypeRef();
      }
      const body = this.parseBlock();
      return {
        kind: 'AnonymousFunctionExpr',
        params,
        returnType,
        body,
        ...this.rangeOf(fnStart, this.previous()),
      };
    }

    if (this.matchKeyword('new')) {
      const type = this.parseTypeRef();
      const args: Expression[] = [];
      let endTok: Token = this.previous();
      if (this.match(TokenKind.LParen)) {
        if (!this.check(TokenKind.RParen)) {
          args.push(this.parseAssignment());
          while (this.match(TokenKind.Comma)) args.push(this.parseAssignment());
        }
        endTok = this.consume(TokenKind.RParen, "Expected ')' after new arguments.");
      }
      return { kind: 'NewExpr', type, args, ...this.rangeOf(t, endTok) };
    }

    if (this.match(TokenKind.LParen)) {
      const expr = this.parseExpression();
      const rparen = this.consume(TokenKind.RParen, "Expected ')'.");
      return { kind: 'ParenExpr', expression: expr, ...this.rangeOf(t, rparen) };
    }

    if (this.match(TokenKind.LBrace)) {
      // Initializer list: { e0, e1, ... } -- for array literals, struct
      // initializers, etc.
      const elements: Expression[] = [];
      if (!this.check(TokenKind.RBrace)) {
        elements.push(this.parseAssignment());
        while (this.match(TokenKind.Comma)) {
          if (this.check(TokenKind.RBrace)) break; // trailing comma allowed
          elements.push(this.parseAssignment());
        }
      }
      const rbrace = this.consume(TokenKind.RBrace, "Expected '}' to close initializer list.");
      return { kind: 'InitListExpr', elements, ...this.rangeOf(t, rbrace) };
    }

    if (t.kind === TokenKind.Identifier || t.kind === TokenKind.Keyword) {
      // Qualified name `A::B::c` becomes a QualifiedName; bare ident an Identifier.
      // Accept any Keyword as an identifier-position name -- covers contextual
      // keywords (out, in, inout, from, property, ...) used as variable names.
      const parts: string[] = [];
      const partRanges: { start: number; end: number; startPos: Position; endPos: Position }[] = [];
      const pushPart = (tok: Token) => {
        parts.push(tok.value);
        partRanges.push({ start: tok.start, end: tok.end, startPos: tok.startPos, endPos: tok.endPos });
      };
      pushPart(this.advance());
      while (this.match(TokenKind.ColonColon)) {
        pushPart(this.consumeName("Expected identifier after '::'."));
      }

      // Templated constructor call: `Ident<T, U>(args)` — `<` would
      // otherwise be parsed as a comparison operator. Only consume the
      // template args if they end with `>(` so we don't break legitimate
      // `a < b` comparisons. We discard the template-arg list here; the
      // following `(` is picked up by parsePostfix as a regular call.
      if (this.check(TokenKind.Lt)) {
        const savePos = this.pos;
        const saveErrs = this.errors.length;
        let ok = false;
        try {
          this.advance(); // <
          this.parseTypeRef();
          while (this.match(TokenKind.Comma)) this.parseTypeRef();
          this.consumeGreaterThan();
          ok = this.check(TokenKind.LParen);
        } catch (e) {
          if (!(e instanceof ParseException)) throw e;
          ok = false;
        }
        if (!ok) {
          this.pos = savePos;
          this.errors.length = saveErrs;
        }
      }

      const endTok = this.previous();
      if (parts.length === 1) {
        return { kind: 'Identifier', name: parts[0], ...this.rangeOf(t, endTok) };
      }
      return { kind: 'QualifiedName', parts, partRanges, ...this.rangeOf(t, endTok) };
    }

    this.error(t, `Unexpected token '${t.value || '<eof>'}' in expression.`);
    throw new ParseException();
  }

  // =========================================================================
  // Helpers -- token cursor, ranges, error reporting, recovery
  // =========================================================================

  private peek(): Token { return this.tokens[this.pos]; }
  private peekAt(offset: number): Token | undefined { return this.tokens[this.pos + offset]; }
  private previous(): Token { return this.tokens[Math.max(0, this.pos - 1)]; }
  private advance(): Token { const t = this.tokens[this.pos]; if (!this.isAtEnd()) this.pos++; return t; }
  private isAtEnd(): boolean { return this.peek().kind === TokenKind.EndOfFile; }

  private check(kind: TokenKind): boolean { return this.peek().kind === kind; }
  private checkKeyword(kw: string): boolean { const t = this.peek(); return t.kind === TokenKind.Keyword && t.value === kw; }
  private checkKeywordAt(offset: number, kw: string): boolean {
    const t = this.peekAt(offset);
    return !!t && t.kind === TokenKind.Keyword && t.value === kw;
  }
  private match(kind: TokenKind): boolean { if (this.check(kind)) { this.advance(); return true; } return false; }
  private matchKeyword(kw: string): boolean { if (this.checkKeyword(kw)) { this.advance(); return true; } return false; }

  private consume(kind: TokenKind, msg: string): Token {
    if (this.check(kind)) return this.advance();
    this.error(this.peek(), msg);
    throw new ParseException();
  }
  private consumeKeyword(kw: string, msg: string): Token {
    if (this.checkKeyword(kw)) return this.advance();
    this.error(this.peek(), msg);
    throw new ParseException();
  }

  private error(at: Token, message: string): void {
    this.errors.push({
      message,
      start: at.start,
      end: at.end,
      startPos: at.startPos,
      endPos: at.endPos,
    });
  }

  private rangeOf(startTok: Token, endTok: Token): Pick<NodeBase, 'start' | 'end' | 'startPos' | 'endPos'> {
    return {
      start: startTok.start,
      end: endTok.end,
      startPos: startTok.startPos,
      endPos: endTok.endPos,
    };
  }

  private rangeBetween(startNode: { start: number; startPos: Position }, endTok: { end: number; endPos: Position }):
    Pick<NodeBase, 'start' | 'end' | 'startPos' | 'endPos'> {
    return {
      start: startNode.start,
      end: endTok.end,
      startPos: startNode.startPos,
      endPos: endTok.endPos,
    };
  }

  private mkBinary(op: BinaryOp, left: Expression, right: Expression): Expression {
    return {
      kind: 'BinaryExpr',
      op,
      left,
      right,
      ...this.rangeBetween(left, right),
    };
  }

  private mkUnary(op: any, operand: Expression, startTok: Token): Expression {
    return {
      kind: 'UnaryExpr',
      op,
      operand,
      ...this.rangeBetween(startTok, operand),
    };
  }

  private mkLit(literalType: LiteralType, t: Token): Expression {
    return {
      kind: 'LiteralExpr',
      literalType,
      value: t.value,
      ...this.rangeOf(t, t),
    };
  }

  private stripQuotes(s: string): string {
    if (s.length >= 2 && (s[0] === '"' || s[0] === "'")) {
      return s.slice(1, -1);
    }
    return s;
  }

  // ----- recovery ---------------------------------------------------------

  private synchronizeTopLevel(): void {
    while (!this.isAtEnd()) {
      const t = this.peek();
      if (t.kind === TokenKind.Semicolon) { this.advance(); return; }
      if (t.kind === TokenKind.RBrace) { this.advance(); return; }
      if (t.kind === TokenKind.Keyword && (
        t.value === 'class' || t.value === 'interface' || t.value === 'enum' ||
        t.value === 'namespace' || t.value === 'funcdef' || t.value === 'typedef' ||
        t.value === 'import' || MODIFIER_KEYWORDS.has(t.value)
      )) return;
      this.advance();
    }
  }

  private synchronizeMember(): void {
    let depth = 0;
    while (!this.isAtEnd()) {
      const t = this.peek();
      if (t.kind === TokenKind.LBrace) { depth++; this.advance(); continue; }
      if (t.kind === TokenKind.RBrace) {
        if (depth === 0) return;
        depth--;
        this.advance();
        if (depth === 0) return;
        continue;
      }
      if (t.kind === TokenKind.Semicolon && depth === 0) { this.advance(); return; }
      this.advance();
    }
  }

  private synchronizeStatement(): void {
    while (!this.isAtEnd()) {
      const t = this.peek();
      if (t.kind === TokenKind.Semicolon) { this.advance(); return; }
      if (t.kind === TokenKind.RBrace) return;
      if (t.kind === TokenKind.Keyword) {
        const kw = t.value;
        if (kw === 'if' || kw === 'while' || kw === 'do' || kw === 'for'
            || kw === 'switch' || kw === 'return' || kw === 'break'
            || kw === 'continue' || kw === 'try') return;
      }
      this.advance();
    }
  }
}
