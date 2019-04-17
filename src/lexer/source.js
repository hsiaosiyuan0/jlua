import { LexerError } from "../lexer";

export const NL = "\n";
export const CR = "\r";
export const EOL = "\n";
export const EOF = "\0";

export class Position {
  constructor(ofst = -1, line = 1, column = 0) {
    this.ofst = ofst;
    this.line = line;
    this.column = column;
  }
}

export class Source {
  constructor(code = "", file = "") {
    this.code = code;
    this.file = file;
    this.ch = "";
    this.ofst = -1;
    this.line = 1;
    this.col = 0;
    this.posStack = [];
  }

  get pos() {
    return new Position(this.ofst, this.line, this.col);
  }

  read(cnt = 1) {
    const ret = [];
    while (cnt) {
      const next = this.ofst + 1;
      let c = this.code[next];
      if (c === undefined) {
        ret.push(EOF);
        break;
      }
      this.ofst = next;
      if (c === CR || c === NL) {
        if (c === CR && this.code[next + 1] === NL) this.ofst++;
        this.line++;
        this.col = 0;
        c = EOL;
      } else this.col++;
      this.ch = c;
      ret.push(c);
      cnt--;
    }
    return ret.join("");
  }

  peek(cnt = 1) {
    const ret = [];
    let ofst = this.ofst;
    while (cnt) {
      const next = ofst + 1;
      let c = this.code[next];
      if (c === undefined) {
        ret.push(EOF);
        break;
      }
      ofst = next;
      if (c === CR || c === NL) {
        if (c === CR && this.code[next + 1] === NL) {
          ofst++;
        }
        c = EOL;
      }
      ret.push(c);
      cnt--;
    }
    return ret.join("");
  }

  pushPos() {
    this.posStack.push(this.pos);
  }

  restorePos() {
    const pos = this.posStack.pop();
    if (pos === undefined)
      throw new LexerError("Unbalanced popping of position stack");
    this.ofst = pos.ofst;
    this.line = pos.line;
    this.col = pos.column;
  }
}

export class SourceLoc {
  constructor(source = "", start = new Position(), end = new Position()) {
    this.source = source;
    this.start = start;
    this.end = end;
  }
}
