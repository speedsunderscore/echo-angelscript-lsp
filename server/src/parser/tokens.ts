/**
 * Token kinds produced by the AngelScript lexer.
 *
 * Grouped by category. The parser pattern-matches on these.
 */
export enum TokenKind {
  // Literals
  IntLiteral,
  FloatLiteral,
  StringLiteral,
  BoolLiteral,
  NullLiteral,

  // Identifiers & keywords
  Identifier,
  Keyword,

  // Punctuation
  LParen,        // (
  RParen,        // )
  LBrace,        // {
  RBrace,        // }
  LBracket,      // [
  RBracket,      // ]
  Comma,         // ,
  Semicolon,     // ;
  Colon,         // :
  ColonColon,    // ::
  Dot,           // .
  Ellipsis,      // ...
  Question,      // ?
  At,            // @

  // Assignment
  Assign,        // =
  PlusAssign,    // +=
  MinusAssign,   // -=
  StarAssign,    // *=
  SlashAssign,   // /=
  PercentAssign, // %=
  AndAssign,     // &=
  OrAssign,      // |=
  XorAssign,     // ^=
  ShlAssign,     // <<=
  ShrAssign,     // >>=
  UShrAssign,    // >>>=
  StarStarAssign,// **=
  HandleAssign,  // @=

  // Comparison
  Eq,            // ==
  Neq,           // !=
  Lt,            // <
  Gt,            // >
  Le,            // <=
  Ge,            // >=

  // Logical
  AndAnd,        // &&
  OrOr,          // ||
  Bang,          // !

  // Bitwise
  Amp,           // &
  Pipe,          // |
  Caret,         // ^
  Tilde,         // ~
  Shl,           // <<
  Shr,           // >>
  UShr,          // >>>

  // Arithmetic
  Plus,          // +
  Minus,         // -
  Star,          // *
  Slash,         // /
  Percent,       // %
  StarStar,      // **
  PlusPlus,      // ++
  MinusMinus,    // --

  // Trivia (lexer skips these by default; toggle via Lexer options)
  LineComment,
  BlockComment,
  Whitespace,
  Newline,

  // Preprocessor -- whole line ("#include ...", "#pragma ...", etc.)
  Preprocessor,

  // Sentinels
  EndOfFile,
  Unknown,
}

export interface Position {
  /** 0-based line index. */
  line: number;
  /** 0-based UTF-16 column index. */
  column: number;
}

export interface Token {
  kind: TokenKind;
  /** Exact source text of the token. */
  value: string;
  /** Absolute UTF-16 offset of the first character. */
  start: number;
  /** Absolute UTF-16 offset just past the last character. */
  end: number;
  startPos: Position;
  endPos: Position;
}

/**
 * AngelScript 2.37 reserved keywords. `true`, `false`, `null` are returned
 * with dedicated literal kinds -- they're recognised here only for the
 * keyword check.
 */
export const KEYWORDS: ReadonlySet<string> = new Set([
  'and', 'abstract', 'auto',
  'bool', 'break',
  'case', 'cast', 'catch', 'class', 'const', 'continue',
  'default', 'delete', 'do', 'double',
  'else', 'enum', 'explicit', 'external',
  'false', 'final', 'float', 'for', 'from', 'funcdef', 'function',
  // `get` is contextually reserved in AS (property accessors) -- left as a
  // plain identifier so APIs can use `get(...)` / `set(...)` as function names.
  'if', 'import', 'in', 'inout', 'int', 'int8', 'int16', 'int32', 'int64',
  'interface', 'is',
  'mixin',
  'namespace', 'not', 'null',
  'or', 'out', 'override',
  'private', 'property', 'protected', 'public',
  'return',
  'shared', 'super', 'switch',
  'this', 'true', 'try', 'typedef',
  'uint', 'uint8', 'uint16', 'uint32', 'uint64',
  'void',
  'while',
  'xor',
]);

export interface LexError {
  message: string;
  start: number;
  end: number;
  startPos: Position;
  endPos: Position;
}
