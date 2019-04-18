import { Lexer, TokenType, Token, Sign, Keyword } from "../lexer";
import {
  AssignmentExpression,
  BlockStatement,
  BooleanLiteral,
  BreakStatement,
  CallExpression,
  Chunk,
  DoStatement,
  ForInStatement,
  ForStatement,
  FunctionDefStmt,
  MemberExpression,
  NilLiteral,
  NumericLiteral,
  RepeatStatement,
  SequenceExpression,
  StringLiteral,
  UnaryExpression,
  VariableDeclaration,
  WhileStatement,
  Identifier,
  BinaryExpression,
  ReturnStatement,
  IfStatement
} from "./node";

// grammar details can be referenced from http://www.lua.org/manual/5.1/manual.html#2.2
// there is a complete grammar at the bottom of that page

export class Parser {
  /**
   * @param lexer {Lexer}
   */
  constructor(lexer) {
    this.lexer = lexer;
  }

  parseChunk() {
    const node = new Chunk();
    node.body = this.parseStmts();
    return node;
  }

  parseFunDefStmt() {
    this.lexer.next();
    const node = new FunctionDefStmt();
    node.id = this.parseFunName();
    node.params = this.parseFunFormalArgs();
    node.body = this.parseStmts(Keyword.End);
    return node;
  }

  parseFunName() {
    const name = this.nextMustBeName();
    const tok = this.lexer.peek();
    const left = new Identifier();
    left.name = name.text;
    left.loc = name.loc;
    if (tok.isSign(Sign.Colon)) {
      const node = new BinaryExpression();
      node.operator = Sign.Colon;
      node.left = left;
      const r = this.nextMustBeName();
      const rhs = new Identifier();
      rhs.name = r.text;
      rhs.loc = r.loc;
      node.right = rhs;
      return node;
    }
    return left;
  }

  parseFunFormalArgs() {
    this.nextMustBeSign(Sign.ParenL);
    const args = [];
    while (true) {
      let tok = this.lexer.peek();
      if (tok.isSign(Sign.ParenR) || tok.isEof()) break;
      else if (tok.isSign(Sign.Comma)) {
        this.lexer.next();
        continue;
      }
      tok = this.nextMustBeName();
      const id = new Identifier();
      id.name = tok.text;
      id.loc = tok.loc;
      args.push(id);
    }
    this.nextMustBeSign(Sign.ParenR);
    return args;
  }

  parseStmt() {
    const tok = this.lexer.peek();
    if (tok.isSign(Sign.Semi)) {
      this.lexer.next();
      return this.parseStmt();
    } else if (tok.isKeyword(Keyword.Function)) {
      return this.parseFunDefStmt();
    } else if (tok.isKeyword(Keyword.Break)) {
      return this.parseBreakStmt;
    } else if (tok.isKeyword(Keyword.Do)) {
      return this.parseDoStmt();
    } else if (tok.isKeyword(Keyword.While)) {
      return this.parseWhileStmt();
    } else if (tok.isKeyword(Keyword.Repeat)) {
      return this.parseRepeatStmt();
    } else if (tok.isKeyword(Keyword.For)) {
      return this.parseForStmt();
    } else if (tok.isKeyword(Keyword.If)) {
      return this.parseIfStmt();
    } else if (tok.isKeyword(Keyword.Local)) {
      return this.parseVarDecStmt();
    } else if (tok.isKeyword(Keyword.Return)) {
      return this.parseReturnStmt();
    } else {
      return this.parseVarList();
    }
  }

  parseStmts(stop) {
    const stmts = [];
    while (true) {
      let tok = this.lexer.peek();
      if ((stop !== undefined && tok.isKeyword(stop)) || tok.isEof()) break;
      stmts.push(this.parseStmt());
    }
    if (stop !== undefined) this.nextMustBeKeyword(stop);
    return stmts;
  }

  parseIfStmt() {
    this.lexer.next();
    const node = new IfStatement();
    node.test = this.parseExp();
    this.nextMustBeKeyword(Keyword.Then);
    let tok;
    while (true) {
      node.consequent.push(this.parseStmt());
      tok = this.lexer.peek();
      if (tok.isOneOfKeywords([Keyword.Elseif, Keyword.Else, Keyword.End]))
        break;
      else this.raiseUnexpectedTokErr("branch or end", tok);
    }
    if (tok.isKeyword(Keyword.End)) {
      this.lexer.next();
      return node;
    } else if (tok.isKeyword(Keyword.Else)) {
      this.lexer.next();
      const alt = new BlockStatement();
      alt.body = this.parseStmts(Keyword.End);
      node.alternate = alt;
      return node;
    } else if (tok.isKeyword(Keyword.Elseif)) {
      node.alternate = this.parseIfStmt();
      return node;
    }
  }

  parseVarDecStmt() {
    this.lexer.next();
    let tok = this.lexer.peek();
    if (tok.isKeyword(Keyword.Function)) {
      this.lexer.next();
      const name = this.nextMustBeName();
      const node = new FunctionDefStmt();
      node.id = new Identifier();
      node.id.name = name.text;
      node.id.loc = name.loc;
      node.params = this.parseFunFormalArgs();
      node.body = this.parseStmts(Keyword.End);
      node.isLocal = true;
      return node;
    }

    const name = this.nextMustBeName();
    const first = new Identifier();
    first.name = name.text;
    first.loc = name.loc;
    const node = new VariableDeclaration();
    node.nameList = this.parseNameList(first);
    tok = this.lexer.peek();
    if (tok.isSign(Sign.Assign)) {
      this.lexer.next();
      node.expList = this.parseExpList();
    }
    return node;
  }

  parseForStmt() {
    this.lexer.next();
    const name = this.nextMustBeName();
    let tok = this.lexer.next();
    const id = new Identifier();
    id.name = name.text;
    id.loc = name.loc;
    if (tok.isSign(Sign.Comma)) return this.parseForInStmt(id);

    this.nextMustBeSign(Sign.Assign);
    const exp1 = new AssignmentExpression();
    exp1.left = new SequenceExpression();
    exp1.left.expressions.push(id);
    exp1.right = new SequenceExpression();
    exp1.right.expressions.push(this.parseExp());
    const exp23 = [null, null];
    for (let i = 0; i < 2; i++) {
      tok = this.lexer.peek();
      if (tok.isSign(Sign.Comma)) this.lexer.next();
      else if (tok.isKeyword(Keyword.Do)) break;
      exp23[i] = this.parseExp();
    }
    this.nextMustBeKeyword(Keyword.Do);
    const node = new ForStatement();
    node.exp1 = exp1;
    node.exp2 = exp23[0];
    node.exp3 = exp23[1];
    node.body = this.parseStmts(Keyword.End);
  }

  parseForInStmt(first) {
    const node = new ForInStatement();
    node.nameList = this.parseNameList(first, Keyword.In);
    node.expList = this.parseExpList(Keyword.Do);
    node.body = this.parseStmts(Keyword.End);
    return node;
  }

  parseNameList(first, stop) {
    const names = [];
    if (first) names.push(first);
    while (true) {
      const tok = this.lexer.peek();
      if (tok.isSign(Sign.Comma)) this.lexer.next();
      else break;
      const name = this.nextMustBeName();
      const id = new Identifier();
      id.name = name.text;
      id.loc = name.loc;
      names.push(id);
    }
    if (stop !== undefined) this.nextMustBeKeyword(stop);
    return names;
  }

  parseExpList(stop) {
    const expList = [];
    while (true) {
      const exp = this.parseExp();
      if (exp === null)
        this.raiseUnexpectedTokErr("Expression", this.lexer.token);
      expList.push(exp);
      const tok = this.lexer.peek();
      if (tok.isSign(Sign.Comma)) this.lexer.next();
      else break;
    }
    if (stop !== undefined) this.nextMustBeKeyword(stop);
    return expList;
  }

  parseRepeatStmt() {
    this.lexer.next();
    const stmts = this.parseStmts(Keyword.Until);
    const test = this.parseExp();
    const node = new RepeatStatement();
    if (test === null)
      this.raiseUnexpectedTokErr("expression", this.lexer.token);
    node.test = test;
    node.body = stmts;
    return node;
  }

  parseWhileStmt() {
    this.lexer.next();
    const exp = this.parseExp();
    this.nextMustBeKeyword(Keyword.Do);
    const block = this.parseBlockStmt();
    const node = new WhileStatement();
    node.test = exp;
    node.body = block.body;
    return node;
  }

  parseBlockStmt() {
    const node = new BlockStatement();
    node.body = this.parseStmts(Keyword.End);
    return node;
  }

  parseBreakStmt() {
    const tok = this.lexer.next();
    const node = new BreakStatement();
    node.loc = tok.loc;
    return node;
  }

  parseDoStmt() {
    this.lexer.next();
    const node = new DoStatement();
    node.body = this.parseStmts(Keyword.End);
    return node;
  }

  parseReturnStmt() {
    const tok = this.lexer.next();
    const node = new ReturnStatement();
    node.loc = tok.loc;
    node.body = this.parseExpList();
    return node;
  }

  parseVarList() {
    const left = new SequenceExpression();
    const right = new SequenceExpression();
    while (true) {
      const exp = this.parseVar();
      if (exp === null) this.raiseUnexpectedTokErr("var-expr");
      left.expressions.push(exp);
      let tok = this.lexer.peek();
      if (tok.isSign(Sign.Comma)) this.lexer.next();
      else break;
    }

    // if the ahead token is Assign then the subsequent expression is a expression-list
    // they together construct a assignment-expression otherwise if there is only one child
    // of left.expressions and it's a CallExpression that also means succeeded
    let tok = this.lexer.peek();
    if (
      !tok.isSign(Sign.Assign) &&
      left.expressions.length === 1 &&
      left.expressions[0] instanceof CallExpression
    ) {
      return left.expressions[0];
    }
    this.nextMustBeSign(Sign.Assign);

    while (true) {
      const exp = this.parseExp();
      if (exp === null) this.raiseUnexpectedTokErr("expr");
      right.expressions.push(exp);
      tok = this.lexer.peek();
      if (tok.isSign(Sign.Comma)) this.lexer.next();
      else break;
    }
    const node = new AssignmentExpression();
    node.left = left;
    node.right = right;
    return node;
  }

  parseExp() {
    const node = this.parsePrimary();
    if (node === null) return null;
    return this.parseExpOp(node, 0);
  }

  /**
   *
   * @param left {Expression}
   * @param prec {number}
   */
  parseExpOp(left, prec) {
    let ahead = this.lexer.peek();
    while (ahead.isBinOp() && ahead.prec >= prec) {
      let op = this.lexer.next();
      let rhs = this.parsePrimary();
      ahead = this.lexer.peek();
      while (
        (ahead.isBinOp() && ahead.prec > op.prec) ||
        (ahead.isAssocRight() && ahead.prec === op.prec)
      ) {
        rhs = this.parseExpOp(rhs, ahead.prec);
        ahead = this.lexer.peek();
      }
      let lhs = new BinaryExpression();
      lhs.operator = op.text;
      lhs.left = left;
      lhs.right = rhs;
      left = lhs;
    }
    return left;
  }

  parsePrimary() {
    let tok = this.lexer.peek();
    if (tok.isNumber()) {
      tok = this.lexer.next();
      const node = new NumericLiteral();
      node.loc = tok.loc;
      node.setValue(tok.text);
      return node;
    }
    if (tok.isString()) {
      tok = this.lexer.next();
      const node = new StringLiteral();
      node.value = tok.text;
      node.loc = tok.loc;
      return node;
    }
    if (tok.isBoolean()) {
      tok = this.lexer.next();
      const node = new BooleanLiteral();
      node.setValue(tok.text);
      node.loc = tok.loc;
      return node;
    }
    if (tok.isNil()) {
      tok = this.lexer.next();
      const node = new NilLiteral();
      node.loc = tok.loc;
      return node;
    }
    if (tok.isName()) {
      tok = this.lexer.next();
      return this.parsePrefixExp(tok);
    }
    if (tok.isSign(Sign.ParenL)) {
      this.lexer.next();
      const node = this.parseExp();
      this.nextMustBeSign(Sign.ParenR);
      return node;
    }
    if (tok.isUnary()) {
      tok = this.lexer.next();
      const node = new UnaryExpression();
      node.operator = tok.text;
      node.argument = this.parsePrimary();
      return node;
    }
    return null;
  }

  parseVar() {
    let tok = this.lexer.peek();
    if (tok.isName() || tok.isSign(Sign.ParenL)) {
      const left = this.lexer.next();
      return this.parsePrefixExp(left);
    }
    return null;
  }

  parsePrefixExp(left) {
    if (left.isSign && left.isSign(Sign.ParenL)) {
      left = this.parseExp();
      left = this.parsePrefixExp(left);
      this.nextMustBeSign(Sign.ParenR);
    }
    if (left.isName && left.isName()) {
      const node = new Identifier();
      node.name = left.text;
      node.loc = left.loc;
      left = node;
    }
    while (true) {
      let tok = this.lexer.peek();
      if (tok.isSign(Sign.Colon)) {
        this.lexer.next();
        const rhs = this.lexer.next();
        if (!rhs.isName()) this.raiseUnexpectedTokErr(TokenType.Name, rhs);
        const callee = new BinaryExpression();
        callee.operator = Sign.Colon;
        callee.left = left;
        callee.right = rhs;
        left = this.parseFunCall(callee);
      } else if (tok.isSign(Sign.ParenL)) {
        left = this.parseFunCall(left);
      } else if (tok.isSign(Sign.BracketL)) {
        left = this.parseSubscript(left);
      } else if (tok.isSign(Sign.Dot)) {
        left = this.parseMemberAccess(left);
      } else break;
    }
    return left;
  }

  parseFunCall(callee) {
    const node = new CallExpression();
    node.callee = callee;
    node.args = this.parseFunCallArgs();
    return node;
  }

  parseFunCallArgs() {
    this.lexer.next();
    const args = [];
    while (true) {
      const arg = this.parseExp();
      if (arg) args.push(arg);
      let tok = this.lexer.peek();
      if (tok.isSign(Sign.Comma)) {
        this.lexer.next();
      } else if (tok.isSign(Sign.ParenR)) {
        this.lexer.next();
        break;
      } else this.raiseUnexpectedTokErr("[,)]", tok);
    }
    return args;
  }

  nextMustBeSign(s) {
    const tok = this.lexer.next();
    if (!tok.isSign(s)) this.raiseUnexpectedTokErr(s, tok);
    return tok;
  }

  nextMustBeName() {
    const tok = this.lexer.next();
    if (!tok.isName()) this.raiseUnexpectedTokErr(TokenType.Name, tok);
    return tok;
  }

  nextMustBeKeyword(k) {
    const tok = this.lexer.next();
    if (!tok.isKeyword(k)) this.raiseUnexpectedTokErr(TokenType.Name, tok);
    return tok;
  }

  parseSubscript(left) {
    this.lexer.next();
    const node = new MemberExpression();
    node.object = left;
    node.property = this.parseExp();
    this.nextMustBeSign(Sign.BracketR);
    return node;
  }

  parseMemberAccess(left) {
    this.lexer.next();
    const node = new MemberExpression();
    node.object = left;
    node.property = this.nextMustBeName();
    node.computed = false;
    return node;
  }

  /**
   *
   * @param expectType {string}
   * @param tok {Token}
   * @returns {ParserError}
   */
  makeUnexpectedTokErr(expectType, tok) {
    tok = tok || this.lexer.token;
    const pos = tok.loc.start;
    return new ParserError(
      `Unexpected token near line #${pos.line} column #${
        pos.column
      }, expect \`${expectType}\`, got \`${tok.text}\``
    );
  }

  /**
   *
   * @param expectType {string}
   * @param tok {Token}
   * @throws
   */
  raiseUnexpectedTokErr(expectType, tok = null) {
    throw this.makeUnexpectedTokErr(expectType, tok);
  }
}

export class ParserError extends Error {
  constructor(s) {
    super();
    this.message = s;
  }
}

export * from "./node";
