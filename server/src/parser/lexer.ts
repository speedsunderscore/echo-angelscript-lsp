import {
  KEYWORDS,
  LexError,
  Position,
  Token,
  TokenKind,
} from './tokens';

export interface LexerOptions {
  /** If true, comments and whitespace are emitted as tokens. Defaults to false. */
  includeTrivia?: boolean;
}

export interface LexResult {
  tokens: Token[];
  errors: LexError[];
  /**
   * Map from token-index -> preceding doc comment (`/** ... *\/`), cleaned.
   * Only entries for tokens that have a doc comment immediately before them
   * are present.
   */
  docs: Map<number, string>;
}

/**
 * Hand-written lexer for AngelScript 2.37.
 *
 * Produces a flat token stream + a list of lex errors (unterminated string,
 * unterminated block comment, invalid escape, stray character). The parser
 * consumes the token stream; the language server surfaces the errors as
 * diagnostics.
 */
export class Lexer {
  private pos = 0;
  private line = 0;
  private column = 0;
  private readonly tokens: Token[] = [];
  private readonly errors: LexError[] = [];
  private readonly docs = new Map<number, string>();
  /** Doc-comment text waiting to be attached to the next non-trivia token. */
  private pendingDoc: string | null = null;

  constructor(
    private readonly source: string,
    private readonly options: LexerOptions = {},
  ) {}

  tokenize(): LexResult {
    while (this.pos < this.source.length) {
      this.scanToken();
    }
    this.emitHere(TokenKind.EndOfFile, '');
    return { tokens: this.tokens, errors: this.errors, docs: this.docs };
  }

  // ----- core scanning ----------------------------------------------------

  private scanToken(): void {
    const startPos = this.snapshot();
    const start = this.pos;
    const c = this.peek();

    // Whitespace / newlines
    if (c === ' ' || c === '\t' || c === '\r') {
      this.advance();
      while (this.pos < this.source.length) {
        const n = this.peek();
        if (n === ' ' || n === '\t' || n === '\r') this.advance();
        else break;
      }
      if (this.options.includeTrivia) {
        this.emit(TokenKind.Whitespace, start, startPos);
      }
      return;
    }
    if (c === '\n') {
      this.advance();
      if (this.options.includeTrivia) {
        this.emit(TokenKind.Newline, start, startPos);
      }
      return;
    }

    // Comments
    if (c === '/' && this.peek(1) === '/') {
      this.scanLineComment(start, startPos);
      return;
    }
    if (c === '/' && this.peek(1) === '*') {
      this.scanBlockComment(start, startPos);
      return;
    }

    // Preprocessor -- '#' at column 0 (or only whitespace before it on the line)
    if (c === '#' && this.atLineStart()) {
      this.scanPreprocessor(start, startPos);
      return;
    }

    // Strings
    if (c === '"' && this.peek(1) === '"' && this.peek(2) === '"') {
      this.scanTripleString(start, startPos);
      return;
    }
    if (c === '"' || c === "'") {
      this.scanString(c, start, startPos);
      return;
    }

    // Numbers
    if (this.isDigit(c)) {
      this.scanNumber(start, startPos);
      return;
    }

    // Identifiers / keywords
    if (this.isIdentStart(c)) {
      this.scanIdentifier(start, startPos);
      return;
    }

    // Operators & punctuation
    if (this.scanOperator(start, startPos)) return;

    // Anything else is unknown
    this.advance();
    const endPos = this.snapshot();
    this.errors.push({
      message: `Unexpected character '${c}'.`,
      start,
      end: this.pos,
      startPos,
      endPos,
    });
    this.tokens.push({
      kind: TokenKind.Unknown,
      value: this.source.slice(start, this.pos),
      start,
      end: this.pos,
      startPos,
      endPos,
    });
  }

  // ----- sub-scanners -----------------------------------------------------

  private scanLineComment(start: number, startPos: Position): void {
    while (this.pos < this.source.length && this.peek() !== '\n') {
      this.advance();
    }
    if (this.options.includeTrivia) {
      this.emit(TokenKind.LineComment, start, startPos);
    }
  }

  private scanBlockComment(start: number, startPos: Position): void {
    this.advance(); // /
    this.advance(); // *
    // /** ... */ is a doc comment (but /**/ and /***/ are not, by convention).
    const isDoc = this.peek() === '*' && this.peek(1) !== '/';
    if (isDoc) this.advance();
    while (this.pos < this.source.length) {
      if (this.peek() === '*' && this.peek(1) === '/') {
        this.advance();
        this.advance();
        if (isDoc) {
          const inner = this.source.slice(start + 3, this.pos - 2);
          this.pendingDoc = cleanDocText(inner);
        }
        if (this.options.includeTrivia) {
          this.emit(TokenKind.BlockComment, start, startPos);
        }
        return;
      }
      this.advance();
    }
    // Reached EOF without closing */
    const endPos = this.snapshot();
    this.errors.push({
      message: 'Unterminated block comment.',
      start,
      end: this.pos,
      startPos,
      endPos,
    });
    if (this.options.includeTrivia) {
      this.emit(TokenKind.BlockComment, start, startPos);
    }
  }

  private scanPreprocessor(start: number, startPos: Position): void {
    while (this.pos < this.source.length && this.peek() !== '\n') {
      this.advance();
    }
    this.emit(TokenKind.Preprocessor, start, startPos);
  }

  private scanString(quote: string, start: number, startPos: Position): void {
    this.advance(); // opening quote
    while (this.pos < this.source.length) {
      const c = this.peek();
      if (c === '\n') {
        const endPos = this.snapshot();
        this.errors.push({
          message: 'Unterminated string literal.',
          start,
          end: this.pos,
          startPos,
          endPos,
        });
        this.emit(TokenKind.StringLiteral, start, startPos);
        return;
      }
      if (c === '\\') {
        this.advance();
        if (this.pos < this.source.length) this.advance();
        continue;
      }
      if (c === quote) {
        this.advance();
        this.emit(TokenKind.StringLiteral, start, startPos);
        return;
      }
      this.advance();
    }
    // EOF without closing quote
    const endPos = this.snapshot();
    this.errors.push({
      message: 'Unterminated string literal.',
      start,
      end: this.pos,
      startPos,
      endPos,
    });
    this.emit(TokenKind.StringLiteral, start, startPos);
  }

  private scanTripleString(start: number, startPos: Position): void {
    this.advance(); this.advance(); this.advance(); // """
    while (this.pos < this.source.length) {
      if (this.peek() === '"' && this.peek(1) === '"' && this.peek(2) === '"') {
        this.advance(); this.advance(); this.advance();
        this.emit(TokenKind.StringLiteral, start, startPos);
        return;
      }
      this.advance();
    }
    const endPos = this.snapshot();
    this.errors.push({
      message: 'Unterminated triple-quoted string.',
      start,
      end: this.pos,
      startPos,
      endPos,
    });
    this.emit(TokenKind.StringLiteral, start, startPos);
  }

  private scanNumber(start: number, startPos: Position): void {
    // Prefix bases: 0x.., 0o.., 0b..
    if (this.peek() === '0' && (this.peek(1) === 'x' || this.peek(1) === 'X')) {
      this.advance(); this.advance();
      while (this.pos < this.source.length && this.isHexDigit(this.peek())) this.advance();
      this.emit(TokenKind.IntLiteral, start, startPos);
      return;
    }
    if (this.peek() === '0' && (this.peek(1) === 'o' || this.peek(1) === 'O')) {
      this.advance(); this.advance();
      while (this.pos < this.source.length && this.isOctDigit(this.peek())) this.advance();
      this.emit(TokenKind.IntLiteral, start, startPos);
      return;
    }
    if (this.peek() === '0' && (this.peek(1) === 'b' || this.peek(1) === 'B')) {
      this.advance(); this.advance();
      while (this.pos < this.source.length && this.isBinDigit(this.peek())) this.advance();
      this.emit(TokenKind.IntLiteral, start, startPos);
      return;
    }

    while (this.pos < this.source.length && this.isDigit(this.peek())) this.advance();

    let isFloat = false;
    // Fractional part -- but ".." or trailing "." not followed by digit stays as int+dot
    if (this.peek() === '.' && this.isDigit(this.peek(1))) {
      isFloat = true;
      this.advance(); // .
      while (this.pos < this.source.length && this.isDigit(this.peek())) this.advance();
    }
    // Exponent
    if (this.peek() === 'e' || this.peek() === 'E') {
      isFloat = true;
      this.advance();
      if (this.peek() === '+' || this.peek() === '-') this.advance();
      while (this.pos < this.source.length && this.isDigit(this.peek())) this.advance();
    }
    // Suffix: f, F, d, D
    const suf = this.peek();
    if (suf === 'f' || suf === 'F' || suf === 'd' || suf === 'D') {
      isFloat = true;
      this.advance();
    }
    this.emit(isFloat ? TokenKind.FloatLiteral : TokenKind.IntLiteral, start, startPos);
  }

  private scanIdentifier(start: number, startPos: Position): void {
    this.advance();
    while (this.pos < this.source.length && this.isIdentPart(this.peek())) this.advance();
    const text = this.source.slice(start, this.pos);
    let kind: TokenKind;
    if (text === 'true' || text === 'false') kind = TokenKind.BoolLiteral;
    else if (text === 'null') kind = TokenKind.NullLiteral;
    else if (KEYWORDS.has(text)) kind = TokenKind.Keyword;
    else kind = TokenKind.Identifier;
    this.emit(kind, start, startPos);
  }

  /**
   * Returns true if the next chars form an operator/punctuation token.
   * Tries longest-match first.
   */
  private scanOperator(start: number, startPos: Position): boolean {
    const c0 = this.peek();
    const c1 = this.peek(1);
    const c2 = this.peek(2);
    const c3 = this.peek(3);

    // 4-char: >>>=
    if (c0 === '>' && c1 === '>' && c2 === '>' && c3 === '=') {
      this.advanceN(4);
      this.emit(TokenKind.UShrAssign, start, startPos);
      return true;
    }
    // 3-char: >>>, <<=, >>=, **=, ...
    if (c0 === '>' && c1 === '>' && c2 === '>') { this.advanceN(3); this.emit(TokenKind.UShr, start, startPos); return true; }
    if (c0 === '<' && c1 === '<' && c2 === '=') { this.advanceN(3); this.emit(TokenKind.ShlAssign, start, startPos); return true; }
    if (c0 === '>' && c1 === '>' && c2 === '=') { this.advanceN(3); this.emit(TokenKind.ShrAssign, start, startPos); return true; }
    if (c0 === '*' && c1 === '*' && c2 === '=') { this.advanceN(3); this.emit(TokenKind.StarStarAssign, start, startPos); return true; }
    if (c0 === '.' && c1 === '.' && c2 === '.') { this.advanceN(3); this.emit(TokenKind.Ellipsis, start, startPos); return true; }

    // 2-char
    const two = c0 + c1;
    switch (two) {
      case '==': this.advanceN(2); this.emit(TokenKind.Eq, start, startPos); return true;
      case '!=': this.advanceN(2); this.emit(TokenKind.Neq, start, startPos); return true;
      case '<=': this.advanceN(2); this.emit(TokenKind.Le, start, startPos); return true;
      case '>=': this.advanceN(2); this.emit(TokenKind.Ge, start, startPos); return true;
      case '&&': this.advanceN(2); this.emit(TokenKind.AndAnd, start, startPos); return true;
      case '||': this.advanceN(2); this.emit(TokenKind.OrOr, start, startPos); return true;
      case '<<': this.advanceN(2); this.emit(TokenKind.Shl, start, startPos); return true;
      case '>>': this.advanceN(2); this.emit(TokenKind.Shr, start, startPos); return true;
      case '**': this.advanceN(2); this.emit(TokenKind.StarStar, start, startPos); return true;
      case '++': this.advanceN(2); this.emit(TokenKind.PlusPlus, start, startPos); return true;
      case '--': this.advanceN(2); this.emit(TokenKind.MinusMinus, start, startPos); return true;
      case '+=': this.advanceN(2); this.emit(TokenKind.PlusAssign, start, startPos); return true;
      case '-=': this.advanceN(2); this.emit(TokenKind.MinusAssign, start, startPos); return true;
      case '*=': this.advanceN(2); this.emit(TokenKind.StarAssign, start, startPos); return true;
      case '/=': this.advanceN(2); this.emit(TokenKind.SlashAssign, start, startPos); return true;
      case '%=': this.advanceN(2); this.emit(TokenKind.PercentAssign, start, startPos); return true;
      case '&=': this.advanceN(2); this.emit(TokenKind.AndAssign, start, startPos); return true;
      case '|=': this.advanceN(2); this.emit(TokenKind.OrAssign, start, startPos); return true;
      case '^=': this.advanceN(2); this.emit(TokenKind.XorAssign, start, startPos); return true;
      case '::': this.advanceN(2); this.emit(TokenKind.ColonColon, start, startPos); return true;
      case '@=': this.advanceN(2); this.emit(TokenKind.HandleAssign, start, startPos); return true;
    }

    // 1-char
    switch (c0) {
      case '(': this.advance(); this.emit(TokenKind.LParen, start, startPos); return true;
      case ')': this.advance(); this.emit(TokenKind.RParen, start, startPos); return true;
      case '{': this.advance(); this.emit(TokenKind.LBrace, start, startPos); return true;
      case '}': this.advance(); this.emit(TokenKind.RBrace, start, startPos); return true;
      case '[': this.advance(); this.emit(TokenKind.LBracket, start, startPos); return true;
      case ']': this.advance(); this.emit(TokenKind.RBracket, start, startPos); return true;
      case ',': this.advance(); this.emit(TokenKind.Comma, start, startPos); return true;
      case ';': this.advance(); this.emit(TokenKind.Semicolon, start, startPos); return true;
      case ':': this.advance(); this.emit(TokenKind.Colon, start, startPos); return true;
      case '.': this.advance(); this.emit(TokenKind.Dot, start, startPos); return true;
      case '?': this.advance(); this.emit(TokenKind.Question, start, startPos); return true;
      case '@': this.advance(); this.emit(TokenKind.At, start, startPos); return true;
      case '=': this.advance(); this.emit(TokenKind.Assign, start, startPos); return true;
      case '<': this.advance(); this.emit(TokenKind.Lt, start, startPos); return true;
      case '>': this.advance(); this.emit(TokenKind.Gt, start, startPos); return true;
      case '!': this.advance(); this.emit(TokenKind.Bang, start, startPos); return true;
      case '&': this.advance(); this.emit(TokenKind.Amp, start, startPos); return true;
      case '|': this.advance(); this.emit(TokenKind.Pipe, start, startPos); return true;
      case '^': this.advance(); this.emit(TokenKind.Caret, start, startPos); return true;
      case '~': this.advance(); this.emit(TokenKind.Tilde, start, startPos); return true;
      case '+': this.advance(); this.emit(TokenKind.Plus, start, startPos); return true;
      case '-': this.advance(); this.emit(TokenKind.Minus, start, startPos); return true;
      case '*': this.advance(); this.emit(TokenKind.Star, start, startPos); return true;
      case '/': this.advance(); this.emit(TokenKind.Slash, start, startPos); return true;
      case '%': this.advance(); this.emit(TokenKind.Percent, start, startPos); return true;
    }

    return false;
  }

  // ----- helpers ----------------------------------------------------------

  private peek(offset = 0): string {
    return this.source.charAt(this.pos + offset);
  }

  private advance(): void {
    const c = this.source.charAt(this.pos);
    this.pos++;
    if (c === '\n') {
      this.line++;
      this.column = 0;
    } else {
      this.column++;
    }
  }

  private advanceN(n: number): void {
    for (let i = 0; i < n; i++) this.advance();
  }

  private snapshot(): Position {
    return { line: this.line, column: this.column };
  }

  private atLineStart(): boolean {
    // True if every character on the current line so far is whitespace.
    let i = this.pos - 1;
    while (i >= 0) {
      const c = this.source.charAt(i);
      if (c === '\n') return true;
      if (c !== ' ' && c !== '\t' && c !== '\r') return false;
      i--;
    }
    return true;
  }

  private isDigit(c: string): boolean {
    return c >= '0' && c <= '9';
  }
  private isHexDigit(c: string): boolean {
    return this.isDigit(c) || (c >= 'a' && c <= 'f') || (c >= 'A' && c <= 'F');
  }
  private isOctDigit(c: string): boolean {
    return c >= '0' && c <= '7';
  }
  private isBinDigit(c: string): boolean {
    return c === '0' || c === '1';
  }
  private isIdentStart(c: string): boolean {
    return (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || c === '_';
  }
  private isIdentPart(c: string): boolean {
    return this.isIdentStart(c) || this.isDigit(c);
  }

  private emit(kind: TokenKind, start: number, startPos: Position): void {
    if (this.pendingDoc !== null && !isTriviaKind(kind)) {
      this.docs.set(this.tokens.length, this.pendingDoc);
      this.pendingDoc = null;
    }
    const endPos = this.snapshot();
    this.tokens.push({
      kind,
      value: this.source.slice(start, this.pos),
      start,
      end: this.pos,
      startPos,
      endPos,
    });
  }

  private emitHere(kind: TokenKind, value: string): void {
    const here = this.snapshot();
    this.tokens.push({
      kind,
      value,
      start: this.pos,
      end: this.pos,
      startPos: here,
      endPos: here,
    });
  }
}

function isTriviaKind(kind: TokenKind): boolean {
  return kind === TokenKind.Whitespace
      || kind === TokenKind.Newline
      || kind === TokenKind.LineComment
      || kind === TokenKind.BlockComment;
}

/**
 * Strip `/** ... *\/` comment markers, leading ` * `, and surrounding blank
 * lines from a doc-comment body. The lexer hands us text from just past
 * `/**` to just before `*\/`.
 */
function cleanDocText(raw: string): string {
  const lines = raw.split(/\r?\n/).map(line =>
    line.replace(/^\s*\*?\s?/, '').replace(/\s+$/, ''),
  );
  while (lines.length && lines[0] === '') lines.shift();
  while (lines.length && lines[lines.length - 1] === '') lines.pop();
  return lines.join('\n');
}
