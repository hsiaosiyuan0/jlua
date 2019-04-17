import { Token, TokenType, keywords } from "./token";
import { Source, EOF, EOL } from "./source";

export class Lexer {
  /**
   *
   * @param src {Source}
   */
  constructor(src) {
    this.src = src;
    this.token = null;
  }

  static isDigit(ch) {
    return ch >= "0" && ch <= "9";
  }

  static isLetter(ch) {
    return (ch >= "a" && ch <= "z") || (ch >= "A" && ch <= "Z");
  }

  static isWhitespace(ch) {
    return ch === "\r" || ch === "\n" || ch === " " || ch === "\t";
  }

  static isKeyword(name) {
    return keywords.indexOf(name) !== -1;
  }

  static isNameBegin(ch) {
    return Lexer.isLetter(ch) || ch === "_";
  }

  static isNameChar(ch) {
    return Lexer.isNameBegin(ch) || Lexer.isDigit(ch);
  }

  static isHexDigit(ch) {
    return (
      Lexer.isDigit(ch) || (ch >= "a" && ch <= "f") || (ch >= "A" && ch <= "F")
    );
  }

  /**
   *
   * @returns {Token}
   */
  next() {
    this.skipWhitespace();
    if ((this.token = this.readComment()) && this.token) return this.token;
    if ((this.token = this.readName()) && this.token) return this.token;
    if ((this.token = this.readNumber()) && this.token) return this.token;
    if ((this.token = this.readString()) && this.token) return this.token;
    if ((this.token = this.readSign()) && this.token) return this.token;
    if ((this.token = this.readEof()) && this.token) return this.token;
    this.raiseUnknownCharErr();
  }

  /**
   *
   * @returns {Token}
   */
  peek() {
    this.src.pushPos();
    const tok = this.next();
    this.src.restorePos();
    return tok;
  }

  skipWhitespace() {
    while (true) {
      const ch = this.src.peek();
      if (!Lexer.isWhitespace(ch)) break;
      this.src.read();
    }
  }

  makeUnknownCharError(ch, line, col) {
    line = line || this.src.line;
    col = col || this.src.col;
    ch = ch || this.src.ch;
    return new LexerError(
      `Unknown character '${ch}' at line #${line} column #${col}`
    );
  }

  raiseUnexpectedEofErr() {
    const line = this.src.line;
    const col = this.src.col;
    throw new LexerError(`Unexpected EOF near line #${line} column #${col}`);
  }

  raiseUnknownCharErr(ch, line, col) {
    throw this.makeUnknownCharError(ch, line, col);
  }

  makeUnexpectedErr(expect, actual) {
    if (actual === undefined) actual = this.src.ch;
    return new LexerError(
      `expect '${expect}' but got '${actual}' at line #${
        this.src.line
      } column #${this.src.col}`
    );
  }

  raiseUnexpectedErr(expect, actual) {
    throw this.makeUnexpectedErr(expect, actual);
  }

  nextMustBe(expect, msg = "") {
    return this.subSeqMustBe(expect, 1, msg);
  }

  subSeqMustBe(expect, cnt = 1, msg = "") {
    let validate;
    const chs = [];
    if (typeof expect === "string") {
      validate = (ch, idx) => {
        if (ch === expect[idx]) return null;
        return this.makeUnexpectedErr(expect[idx], ch);
      };
      cnt = expect.length;
    } else {
      validate = expect;
    }
    for (let i = 0; i < cnt; i++) {
      const ch = this.src.read();
      const err = validate(ch, i);
      if (err instanceof Error) {
        throw err;
      } else if (err === false) {
        this.raiseUnexpectedErr(validate.name || msg, ch);
      }
      chs.push(ch);
    }
    return chs.join("");
  }

  subSeqTest(expect, cnt = 1) {
    let test;
    if (typeof expect === "string") {
      test = (ch, idx) => ch === expect[idx];
      cnt = expect.length;
    } else {
      test = expect;
    }
    const next = this.src.peek(cnt);
    for (let i = 0; i < cnt; i++) {
      if (!test(next[i], i)) return false;
    }
    return true;
  }

  readComment() {
    let ch = this.src.peek(2);
    if (ch !== "--") return null;

    // consume --
    this.src.read(2);
    const tok = new Token(TokenType.Comment);
    tok.setStart(this);

    const chs = [];
    ch = this.src.peek(2);
    if (ch === "[[") {
      // consume [[
      this.src.read(2);
      while (true) {
        ch = this.src.read();
        if (ch === EOF) {
          this.raiseUnexpectedEofErr();
        } else if (ch === "]") {
          this.nextMustBe("]");
          break;
        }
        chs.push(ch);
      }
    } else {
      while (true) {
        ch = this.src.read();
        if (ch === EOL || ch === EOF) break;
        chs.push(ch);
      }
    }
    tok.text = chs.join("");
    return tok.setEnd(this);
  }

  readName() {
    let ch = this.src.peek();
    if (!Lexer.isNameBegin(ch)) return null;

    const chs = [this.src.read()];
    const tok = new Token();
    tok.setStart(this);

    while (true) {
      ch = this.src.peek();
      if (Lexer.isWhitespace(ch) || ch === EOF || !Lexer.isNameChar(ch)) break;
      chs.push(this.src.read());
    }
    const name = chs.join("");
    let type = TokenType.Name;
    if (Lexer.isKeyword(name)) type = TokenType.Keyword;
    else if (name === "nil") type = TokenType.Nil;
    else if (name === "true" || name === "false") type = TokenType.Boolean;
    tok.type = type;
    tok.text = name;
    return tok.setEnd(this);
  }

  readNumber() {
    let ch = this.src.peek();
    if (!Lexer.isDigit(ch)) return null;

    const chs = [this.src.read()];
    const tok = new Token(TokenType.Number);
    tok.setStart(this);

    let ahead;
    if (ch === "0" && ((ahead = this.src.peek()) === "x" || ahead === "X")) {
      // push 'x'
      chs.push(this.src.read());
      while (true) {
        ch = this.src.peek();
        if (Lexer.isWhitespace(ch) || ch === EOF) {
          break;
        } else if (Lexer.isHexDigit(ch)) {
          chs.push(this.src.read());
        } else {
          this.raiseUnexpectedErr("[a-zA-Z0-9]");
        }
      }
    } else {
      let isFloat = false;
      let hasExp = false;
      while (true) {
        ch = this.src.peek();
        if (Lexer.isWhitespace(ch) || ch === EOF) {
          break;
        } else if ((ch === "e" || ch === "E") && hasExp === false) {
          hasExp = true;
          // push 'e'
          chs.push(this.src.read());
          ch = this.nextMustBe(
            ch => Lexer.isDigit(ch) || ch === "+" || ch === "-",
            "[0-9+-]"
          );
          // push sign or digit
          chs.push(ch);
          continue;
        } else if (ch === "." && isFloat === false && hasExp === false) {
          isFloat = true;
        } else if (!Lexer.isDigit(ch)) {
          break;
        }
        chs.push(this.src.read());
      }
    }
    tok.text = chs.join("");
    return tok.setEnd(this);
  }

  readString() {
    let ch = this.src.peek();
    if (
      ch !== "'" &&
      ch !== '"' &&
      !((Lexer.isWhitespace(this.src.ch) || this.src.ch === "") && ch === "[")
    )
      return null;

    this.src.read();
    const tok = new Token(TokenType.String);
    tok.setStart(this);

    const chs = [];
    if (ch === "'" || ch === '"') {
      const end = ch;
      const escapable = "abfnrtvz\"'\\".split("");
      while (true) {
        ch = this.src.read();
        if (ch === EOF) {
          this.raiseUnexpectedEofErr();
        } else if (ch === end) {
          break;
        } else if (ch === "\\") {
          // process escaping
          ch = this.src.read();
          if (escapable.indexOf(ch) !== -1) {
            // is one of legal escape chars
            chs.push("\\");
            chs.push(ch);
          } else if (ch === EOL) {
            // is a newline escaping
            chs.push("\\");
            chs.push(ch);
          } else if (Lexer.isDigit(ch)) {
            // is char digit, range is [0, 255]
            chs.push("\\");
            chs.push(ch);
            let len = 1;
            // if there are total three digits, it's reasonable to check
            // the first digit is one of [0, 1, 2], so here is saving the
            // first digit for checking it later
            const fd = ch;
            const fl = this.src.line;
            const fc = this.src.col;
            while (true) {
              ch = this.src.peek();
              if (!Lexer.isDigit(ch)) break;
              chs.push(this.src.read());
              if (++len > 3) {
                this.raiseUnknownCharErr();
              } else if (len === 3 && fd !== "0" && fd !== "1" && fd !== "2") {
                this.raiseUnknownCharErr(fd, fl, fc);
              }
            }
          } else if (ch === "x") {
            // hex mode `\xF0\x9F`
            chs.push("\\");
            chs.push("x");
            this.subSeqMustBe(Lexer.isHexDigit, 2)
              .split("")
              .forEach(c => chs.push(c));
          } else if (ch === "u") {
            // utf `\u{1F601}`
            chs.push("\\");
            chs.push("u");
            chs.push(this.nextMustBe("{"));
            chs.push(this.nextMustBe(Lexer.isHexDigit));
            while (true) {
              ch = this.src.read();
              if (!Lexer.isHexDigit(ch)) {
                if (ch === "}") {
                  chs.push("}");
                  break;
                } else this.raiseUnexpectedErr("}");
              }
              chs.push(ch);
            }
          } else {
            this.raiseUnknownCharErr();
          }
        } else {
          chs.push(ch);
        }
      }
    } else if (ch === "[") {
      ch = this.src.read();
      if (ch === "[") {
        while (true) {
          ch = this.src.read();
          if (ch === EOF) this.raiseUnexpectedEofErr();
          if (ch === "]") {
            ch = this.src.peek();
            if (ch === "]") {
              this.src.read();
              break;
            }
          }
          chs.push(ch);
        }
      } else if (ch === "=") {
        // nest mode
        let es = "=";
        while (true) {
          ch = this.src.read();
          if (ch === "=") es += "=";
          else if (ch === "[") break;
          else this.raiseUnexpectedErr("[ or =");
        }
        const end = es + "]";
        while (true) {
          ch = this.src.read();
          if (ch === EOF) this.raiseUnexpectedEofErr();
          if (ch === "]") {
            if (this.subSeqTest(end)) {
              this.src.read(end.length);
              break;
            }
          }
          chs.push(ch);
        }
      } else {
        this.raiseUnexpectedErr("[ or =");
      }
    }

    tok.text = chs.join("");
    return tok.setEnd(this);
  }

  readSign() {
    let ch = this.src.peek();
    let chs = [];

    const tok = new Token(TokenType.Sign);
    switch (ch) {
      case "&":
      case "|":
      case "+":
      case "-":
      case "*":
      case "%":
      case "^":
      case "#":
      case "(":
      case ")":
      case "{":
      case "}":
      case "[":
      case "]":
      case ":":
      case ";":
      case ",": {
        chs.push(this.src.read());
        tok.setStart(this);
        break;
      }
      case "/": {
        chs.push(this.src.read());
        tok.setStart(this);
        ch = this.src.peek();
        if (ch === "/") chs.push(this.src.read());
        break;
      }
      case "=": {
        chs.push(this.src.read());
        tok.setStart(this);
        ch = this.src.peek();
        if (ch === "=") chs.push(this.src.read());
        break;
      }
      case "~": {
        chs.push(this.src.read());
        tok.setStart(this);
        ch = this.src.peek();
        if (ch === "=") chs.push(ch);
        break;
      }
      case ">":
      case "<": {
        chs.push(this.src.read());
        tok.setStart(this);
        const ch1 = this.src.peek();
        if (ch1 === "=" || ch === ch1) chs.push(this.src.read());
        break;
      }
      case ".": {
        chs.push(this.src.read());
        tok.setStart(this);
        ch = this.src.peek();
        if (ch === ".") chs.push(this.src.read());
        ch = this.src.peek();
        if (ch === ".") chs.push(this.src.read());
        break;
      }
      default:
        return null;
    }

    tok.text = chs.join("");
    return tok.setEnd(this);
  }

  readEof() {
    const ch = this.src.peek();
    if (ch === EOF) return new Token(TokenType.Eof);
    return null;
  }
}

export class LexerError extends Error {
  constructor(s = "") {
    super();
    this.message = s;
  }
}

export * from "./token";
export * from "./source";
