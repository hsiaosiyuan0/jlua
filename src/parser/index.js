import { Lexer, TokenType, Token, Sign, Keyword } from "../lexer";
import {
  AssignExpression,
  AssignStatement,
  BlockStatement,
  BooleanLiteral,
  BreakStatement,
  BinaryExpression,
  CallExpression,
  CallStatement,
  Chunk,
  DoStatement,
  ForInStatement,
  ForStatement,
  FunctionDecExpr,
  FunctionDecStmt,
  Identifier,
  IfStatement,
  MemberExpression,
  NilLiteral,
  NumericLiteral,
  ObjectExpression,
  ObjectMethod,
  ObjectProperty,
  RepeatStatement,
  ReturnStatement,
  SequenceExpression,
  StringLiteral,
  UnaryExpression,
  VariableDeclaration,
  VarArgExpression,
  WhileStatement
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

  parseFunDecStmt() {
    this.lexer.next();
    const node = new FunctionDecStmt();
    node.id = this.parseFunName();
    node.params = this.parseFunFormalArgs();
    node.body = this.parseStmts(Keyword.End);
    return node;
  }

  parseFunName() {
    const name = this.nextMustBeName();
    let left = new Identifier();
    left.name = name.text;
    left.loc = name.loc;
    let metColon = false;
    while (true) {
      let tok = this.lexer.peek();
      if (tok.isSign(Sign.Dot)) {
        const node = new MemberExpression();
        node.object = left;
        this.lexer.next();
        const prop = this.nextMustBeName();
        node.property = new Identifier();
        node.property.name = prop.text;
        node.property.loc = prop.loc;
        left = node;
      } else if (tok.isSign(Sign.Colon)) {
        if (metColon) this.raiseUnexpectedTokErr("(");
        metColon = true;
        this.lexer.next();
        const node = new BinaryExpression();
        node.operator = Sign.Colon;
        node.left = left;
        const r = this.nextMustBeName();
        const rhs = new Identifier();
        rhs.name = r.text;
        rhs.loc = r.loc;
        node.right = rhs;
        left = node;
      } else break;
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
      tok = this.lexer.peek();
      if (tok.isName()) {
        this.lexer.next();
        const id = new Identifier();
        id.name = tok.text;
        id.loc = tok.loc;
        args.push(id);
      } else if (tok.isSign(Sign.Dot3)) {
        this.lexer.next();
        const arg = new VarArgExpression();
        arg.loc = tok.loc;
        args.push(arg);
      } else {
        this.raiseUnexpectedTokErr("name or varargs", tok);
      }
    }
    this.nextMustBeSign(Sign.ParenR);
    return args;
  }

  parseStmt() {
    const tok = this.lexer.peek();
    if (tok.isSign(Sign.Semi) || tok.isComment()) {
      this.lexer.next();
      return null;
    } else if (tok.isKeyword(Keyword.Function)) {
      return this.parseFunDecStmt();
    } else if (tok.isKeyword(Keyword.Break)) {
      return this.parseBreakStmt();
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
      const stmt = this.parseStmt();
      if (stmt !== null) stmts.push(stmt);
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
      tok = this.lexer.peek();
      let isEnd = tok.isOneOfKeywords([
        Keyword.Elseif,
        Keyword.Else,
        Keyword.End
      ]);
      if (isEnd || tok.isEof()) break;
      node.consequent.push(this.parseStmt());
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
      const node = new FunctionDecStmt();
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
      node.exprList = this.parseExprList();
    }
    return node;
  }

  parseForStmt() {
    this.lexer.next();
    const name = this.nextMustBeName();
    let tok = this.lexer.peek();
    const id = new Identifier();
    id.name = name.text;
    id.loc = name.loc;
    if (tok.isSign(Sign.Comma)) return this.parseForInStmt(id);

    this.nextMustBeSign(Sign.Assign);
    const exp1 = new AssignExpression();
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
    node.expr1 = exp1;
    node.expr2 = exp23[0];
    node.expr3 = exp23[1];
    node.body = this.parseStmts(Keyword.End);
    return node;
  }

  parseForInStmt(first) {
    const node = new ForInStatement();
    node.nameList = this.parseNameList(first, Keyword.In);
    node.exprList = this.parseExprList(Keyword.Do);
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

  parseExprList(stop) {
    const exprList = [];
    while (true) {
      const exp = this.parseExp();
      if (exp === null) break;
      exprList.push(exp);
      const tok = this.lexer.peek();
      if (tok.isSign(Sign.Comma)) this.lexer.next();
      else break;
    }
    if (stop !== undefined) this.nextMustBeKeyword(stop);
    return exprList;
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
    node.body = this.parseExprList();
    return node;
  }

  // parses VarList or CallStmt
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

    // if the ahead token is Assign and the subsequent expression is a expression-list
    // they together constructs a assignment-expression otherwise if there is only one child
    // of left.expressions and it's a CallExpression that also means succeeded
    let tok = this.lexer.peek();
    if (!tok.isSign(Sign.Assign) && left.expressions.length === 1) {
      const expr = left.expressions[0];
      if (expr instanceof CallExpression) {
        const node = new CallStatement();
        node.expr = expr;
        return node;
      }
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
    const node = new AssignStatement();
    const expr = new AssignExpression();
    expr.left = left;
    expr.right = right;
    node.expr = expr;
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
      node.value = tok.text;
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
      node.value = tok.text;
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
      let arg = this.parsePrimary();
      const ahead = this.lexer.peek();
      if (ahead.isSign() && ahead.prec > tok.getPrec(true))
        arg = this.parseExpOp(arg, 0);
      node.argument = arg;
      return node;
    }
    if (tok.isSign(Sign.Dot3)) {
      tok = this.lexer.next();
      const node = new VarArgExpression();
      node.loc = tok.loc;
      return node;
    }
    if (tok.isKeyword(Keyword.Function)) {
      tok = this.lexer.next();
      const node = new FunctionDecExpr();
      node.loc = tok.loc;
      node.params = this.parseFunFormalArgs();
      node.body = this.parseStmts(Keyword.End);
      return node;
    }
    if (tok.isSign(Sign.BraceL)) {
      return this.parseTableConstructor();
    }
    return null;
  }

  parseTableConstructor() {
    this.nextMustBeSign(Sign.BraceL);
    const node = new ObjectExpression();
    let idx = 1;
    while (true) {
      let prop;
      let key;
      let value;
      let computed = false;
      let tok = this.lexer.peek();
      if (tok.isSign(Sign.Comma) || tok.isSign(Sign.Semi)) {
        this.lexer.next();
        continue;
      }
      if (tok.isSign(Sign.BraceR) || tok.isEof()) {
        this.lexer.next();
        break;
      }
      if (tok.isSign(Sign.BracketL)) {
        this.lexer.next();
        key = this.parseExp();
        this.nextMustBeSign(Sign.BracketR);
        this.nextMustBeSign(Sign.Assign);
        value = this.parseExp();
        computed = true;
      } else {
        key = this.parseExp();
        if (key === null) this.raiseUnexpectedTokErr("expr");
        tok = this.lexer.peek();
        if (tok.isSign(Sign.Assign)) {
          if (!(key instanceof Identifier))
            this.raiseUnexpectedTokErr("identifier");
          this.lexer.next();
          value = this.parseExp();
        } else {
          value = key;
          key = new NumericLiteral();
          key.value = (idx++).toString();
        }
      }
      if (value instanceof FunctionDecExpr) {
        prop = new ObjectMethod();
        prop.params = value.params;
        prop.body = value.body;
        prop.key = key;
      } else {
        prop = new ObjectProperty();
        prop.key = key;
        prop.value = value;
        prop.computed = computed;
      }
      node.properties.push(prop);
    }
    return node;
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
        const id = new Identifier();
        id.name = rhs.text;
        id.loc = rhs.loc;
        callee.right = id;
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
    node.computed = true;
    this.nextMustBeSign(Sign.BracketR);
    return node;
  }

  parseMemberAccess(left) {
    this.lexer.next();
    const node = new MemberExpression();
    node.object = left;
    const tok = this.nextMustBeName();
    const id = new Identifier();
    id.name = tok.text;
    id.loc = tok.loc;
    node.property = id;
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
