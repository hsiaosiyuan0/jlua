import { SourceLoc } from "./source";

export class Keyword {
  static And = "and";
  static Break = "break";
  static Do = "do";
  static Else = "else";
  static Elseif = "elseif";
  static End = "end";
  static False = "false";
  static For = "for";
  static Function = "function";
  static Fun = "fun";
  static If = "if";
  static In = "in";
  static Local = "local";
  static Let = "let";
  static Nil = "nil";
  static Not = "not";
  static Or = "or";
  static Repeat = "repeat";
  static Return = "return";
  static Then = "then";
  static True = "true";
  static Until = "until";
  static While = "while";
}

export const keywords = Object.values(Keyword);

export class Sign {
  static BitAnd = "&";
  static BitOr = "|";
  static BitNot = "~";
  static BitSR = ">>";
  static BitSL = "<<";
  static Plus = "+";
  static Minus = "-";
  static Star = "*";
  static Slash = "/";
  static Slash2 = "//";
  static Modulo = "%";
  static Power = "^";
  static Pound = "#";
  static Eq = "==";
  static NotEq = "~=";
  static LE = "<=";
  static GE = ">=";
  static LT = "<";
  static GT = ">";
  static Assign = "=";
  static ParenL = "(";
  static ParenR = ")";
  static BraceL = "{";
  static BraceR = "}";
  static BracketL = "[";
  static BracketR = "]";
  static Semi = ";";
  static Colon = ":";
  static Comma = ",";
  static Dot = ".";
  static Dot2 = "..";
  static Dot3 = "...";
}

export class TokenType {
  static Error = "Error";
  static Comment = "Comment";
  static Keyword = "Keyword";
  static Sign = "Sign";
  static Name = "Name";
  static String = "String";
  static Number = "Number";
  static Nil = "Nil";
  static Boolean = "Boolean";
  static Eof = "Eof";
}

// see https://www.lua.org/manual/5.3/manual.html#3.4.8
export class Precedence {
  static table = {};

  /**
   *
   * @param prec {number}
   * @param signs {string[]|string}
   * @param unary {boolean}
   */
  static define(prec, signs, unary = false) {
    if (typeof signs === "string") signs = [signs];
    signs.forEach(s => {
      let item = this.table[s];
      if (item === undefined) item = [0, 0];
      if (unary) item[1] = prec;
      else item[0] = prec;
      this.table[s] = item;
    });
  }

  static of(s, unary = false) {
    const entry = this.table[s];
    if (entry === undefined) return 0;
    return unary ? entry[1] : entry[0];
  }
}

Precedence.define(14, "(", true);
Precedence.define(13, ["[", "(", "."]);
Precedence.define(12, ["not"]);
Precedence.define(12, ["!", "~", "-"], true);
Precedence.define(11, "^");
Precedence.define(10, "#", true);
Precedence.define(9, ["*", "/", "%", "//"]);
Precedence.define(8, ["+", "-"]);
Precedence.define(7, ["<<", ">>"]);
Precedence.define(6, ["<", "<=", ">", ">="]);
Precedence.define(5, ["==", "~="]);
Precedence.define(4, "&");
Precedence.define(3, "~");
Precedence.define(2, "and");
Precedence.define(1, "or");

export class Token {
  constructor(type, loc, text) {
    this.type = type || TokenType.Error;
    this.loc = loc || new SourceLoc();
    this.text = text;
  }

  get prec() {
    return Precedence.of(this.text);
  }

  setStart(lex) {
    this.loc.source = lex.src.file;
    this.loc.start = lex.src.pos;
    return this;
  }

  setEnd(lex) {
    this.loc.source = lex.src.file;
    this.loc.end = lex.src.pos;
    return this;
  }

  isSign(s) {
    if (s === undefined) return this.type === TokenType.Sign;
    return this.type === TokenType.Sign && this.text === s;
  }

  isComment() {
    return this.type === TokenType.Comment;
  }

  isBinOp() {
    return (
      [
        "or",
        "and",
        ">",
        "<",
        "<=",
        ">=",
        "~=",
        "==",
        "~",
        "&",
        ">>",
        "<<",
        "..",
        "+",
        "*",
        "-",
        "/",
        "//",
        "%",
        "^",
        "."
      ].indexOf(this.text) !== -1
    );
  }

  isUnary() {
    return (
      (this.type === TokenType.Keyword || this.type === TokenType.Sign) &&
      ["not", "#", "-", "~"].indexOf(this.text) !== -1
    );
  }

  isAssocRight() {
    return ["..", "^"].indexOf(this.text) !== -1;
  }

  isEof() {
    return this.type === TokenType.Eof;
  }

  isKeyword(k) {
    return this.type === TokenType.Keyword && this.text === k;
  }

  isOneOfKeywords(ks) {
    return ks.findIndex(k => this.isKeyword(k)) !== -1;
  }

  isName() {
    return this.type === TokenType.Name;
  }

  isNil() {
    return this.type === TokenType.Nil;
  }

  isBoolean() {
    return this.type === TokenType.Boolean;
  }

  isNumber() {
    return this.type === TokenType.Number;
  }

  isString() {
    return this.type === TokenType.String;
  }
}
