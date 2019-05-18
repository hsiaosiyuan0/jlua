import { AstVisitor } from "../visitor";
import * as t from "@babel/types";
import template from "@babel/template";
import {
  FunctionDecExpr,
  NilLiteral,
  NodeType,
  NumericLiteral
} from "../parser";

export class Scope {
  constructor(parent = null) {
    this.parent = parent;
    this.slots = [];
  }

  isLocal(name) {
    return this.slots.indexOf(name) !== -1;
  }

  addLocal(name) {
    if (!this.isLocal(name)) this.slots.push(name);
  }

  isGlobal(name) {
    if (this.isLocal(name)) return false;
    let parent = this;
    while ((parent = parent.parent) !== null) {
      if (parent.isLocal(name)) return false;
    }
    return true;
  }

  enter() {
    return new Scope(this);
  }
}

export const opMap = {
  "==": "===",
  "~=": "!==",
  and: "&&",
  or: "||",
  "..": "+",
  "^": "**",
  "//": "/",
  not: "!"
};

export class JsCodegen extends AstVisitor {
  constructor() {
    super();
    this.scope = new Scope();
  }

  enterScope() {
    this.scope = this.scope.enter();
  }

  leaveScope() {
    this.scope = this.scope.parent;
  }

  static prepareRuntime() {
    return template.ast(`
  global.print = console.log
  global.__eq__ = (lhs, rhs) => {
    lhs = lhs === undefined ? null : lhs;
    rhs = rhs === undefined ? null : rhs;
    return lhs === rhs;
  };
  global.__neq__ = (lhs, rhs) => {
    lhs = lhs === undefined ? null : lhs;
    rhs = rhs === undefined ? null : rhs;
    return lhs !== rhs;
  };
  global.pairs = (o) => {
    if(Array.isArray(o)) return o.entries();
    return o;
  };
`);
  }

  visitChunk(node) {
    this.enterScope();
    let body = JsCodegen.prepareRuntime();
    body = body.concat(node.body.map(stmt => this.visitStmt(stmt)));
    this.leaveScope();
    return t.program(body);
  }

  visitAssignStmt(node) {
    const assign = node.expr;
    const left = assign.left.expressions;
    const lLen = left.length;
    const right = assign.right.expressions;
    const rLen = right.length;
    const rLast = rLen - 1;
    const rLastExpr = right[rLast];
    const rLastCanRetMulti =
      rLastExpr.type === NodeType.CallExpression ||
      rLastExpr.type === NodeType.VarArgExpression;
    const rMiss = lLen - rLen;

    let lhs = null;
    if (lLen === 1) {
      lhs = this.visitExpr(left[0]);
    } else {
      lhs = left.map(expr => this.visitExpr(expr));
      lhs = t.arrayPattern(lhs);
    }

    if (!rLastCanRetMulti && rMiss > 0) {
      for (let i = 0; i < rMiss; i++) {
        right.push(new NilLiteral());
      }
    }

    let rhs = null;
    if (rLen === 1) {
      rhs = this.visitExpr(right[0]);
    } else {
      rhs = [];
      for (let i = 0; i < lLen; i++) {
        rhs.push(this.visitExpr(right[i]));
      }
      rhs = t.arrayExpression(rhs);
    }
    const assignExpr = t.assignmentExpression("=", lhs, rhs);
    return t.expressionStatement(assignExpr);
  }

  visitVarDecStmt(node) {
    const left = node.nameList;
    const lLen = left.length;
    const right = node.exprList;
    const rLen = right.length;
    const rLast = rLen - 1;
    const rLastExpr = right[rLast];
    const rLastCanRetMulti =
      rLastExpr.type === NodeType.CallExpression ||
      rLastExpr.type === NodeType.VarArgExpression;
    const rMiss = lLen - rLen;

    let lhs = null;
    if (lLen === 1) {
      lhs = t.identifier(left[0].name);
      this.scope.addLocal(left[0].name);
    } else {
      lhs = left.map(expr => {
        this.scope.addLocal(expr.name);
        return t.identifier(expr.name);
      });
      lhs = t.arrayPattern(lhs);
    }

    if (!rLastCanRetMulti && rMiss > 0) {
      for (let i = 0; i < rMiss; i++) {
        right.push(new NilLiteral());
      }
    }

    let rhs = null;
    if (rLen === 1) {
      rhs = this.visitExpr(right[0]);
    } else {
      rhs = [];
      for (let i = 0; i < lLen; i++) {
        rhs.push(this.visitExpr(right[i]));
      }
      rhs = t.arrayExpression(rhs);
    }

    const decor = t.variableDeclarator(lhs, rhs);
    return t.variableDeclaration("let", [decor]);
  }

  visitDoStmt(node) {
    const body = node.body.map(stmt => this.visitStmt(stmt));
    return t.blockStatement(body);
  }

  visitCallStmt(node) {
    return t.expressionStatement(this.visitExpr(node.expr));
  }

  visitBlockStmt(node) {
    return t.blockStatement(node.body.map(stmt => this.visitStmt(stmt)));
  }

  visitIfStmt(node) {
    return t.ifStatement(
      this.visitExpr(node.test),
      t.blockStatement(node.consequent.map(stmt => this.visitStmt(stmt))),
      node.alternate && this.visitStmt(node.alternate)
    );
  }

  visitFuncDecStmt(node) {
    const id = node.id && t.identifier(node.id.name);
    const params = node.params.map(expr => t.identifier(expr, name));
    const body = t.blockStatement(node.body.map(stmt => this.visitStmt(stmt)));
    if (node.isLocal) {
      return t.variableDeclaration("let", [
        t.variableDeclarator(id, t.functionExpression(null, params, body))
      ]);
    }
    return t.expressionStatement(
      t.assignmentExpression(
        "=",
        t.memberExpression(t.identifier("global"), id),
        t.functionExpression(null, params, body)
      )
    );
  }

  visitReturnStmt(node) {
    const args = node.body;
    const argsLen = args.length;
    if (argsLen === 0) return t.returnStatement();
    if (argsLen === 1) return t.returnStatement(this.visitExpr(args[0]));
    return t.returnStatement(
      t.arrayExpression(args.map(expr => this.visitExpr(expr)))
    );
  }

  visitBreakStmt(node) {
    return t.breakStatement();
  }

  visitWhileStmt(node) {
    return t.whileStatement(
      this.visitExpr(node.test),
      t.blockStatement(node.body.map(stmt => this.visitStmt(stmt)))
    );
  }

  visitRepeatStmt(node) {
    return t.doWhileStatement(
      t.unaryExpression(
        "!",
        t.parenthesizedExpression(this.visitExpr(node.test))
      ),
      t.blockStatement(node.body.map(stmt => this.visitStmt(stmt)))
    );
  }

  visitForStmt(node) {
    const initLeft = node.expr1.left.expressions[0];
    const initRight = node.expr1.right.expressions[0];
    const id = t.identifier(initLeft.name);
    this.scope.addLocal(initLeft.name);
    const from = t.identifier("__from");
    const to = t.identifier("__to__");
    const step = t.identifier("__step__");
    let expr3 = node.expr3;
    if (expr3 === null) {
      expr3 = new NumericLiteral();
      expr3.value = "1";
    }
    const init = t.variableDeclaration("let", [
      t.variableDeclarator(id, this.visitExpr(initRight)),
      t.variableDeclarator(from, this.visitExpr(initRight)),
      t.variableDeclarator(to, this.visitExpr(node.expr2)),
      t.variableDeclarator(step, this.visitExpr(expr3))
    ]);
    const test = t.conditionalExpression(
      t.binaryExpression(">", from, to),
      t.binaryExpression(">=", id, to),
      t.binaryExpression("<=", id, to)
    );
    const update = t.assignmentExpression("+=", id, step);
    return t.forStatement(
      init,
      test,
      update,
      t.blockStatement(node.body.map(stmt => this.visitStmt(stmt)))
    );
  }

  visitForInStmt(node) {
    if (node.exprList.length !== 1)
      throw new Error("custom expression list in for-in is not supported");
    const left = t.variableDeclaration("let", [
      t.variableDeclarator(
        t.arrayPattern(
          node.nameList.map(n => {
            this.scope.addLocal(n.name);
            return t.identifier(n.name);
          })
        )
      )
    ]);
    const right = this.visitExpr(node.exprList[0]);
    return t.forOfStatement(
      left,
      right,
      t.blockStatement(node.body.map(stmt => this.visitStmt(stmt)))
    );
  }

  visitMemberExpr(node) {
    let prop;
    if (node.computed) prop = this.visitExpr(node.property);
    else prop = t.identifier(node.property.name);
    return t.memberExpression(this.visitExpr(node.object), prop, node.computed);
  }

  visitFunctionDecExpr(node) {
    const id = node.id && t.identifier(node.id.name);
    const params = node.params.map(expr => t.identifier(expr.name));
    const body = node.body.map(stmt => this.visitStmt(stmt));
    return t.functionExpression(id, params, t.blockStatement(body));
  }

  visitCallExpr(node) {
    const callee = this.visitExpr(node.callee);
    const args = node.args.map(expr => this.visitExpr(expr));
    return t.callExpression(callee, args);
  }

  visitObjectExpression(node) {
    if (node.isArray)
      return t.arrayExpression(
        node.properties.map(m => {
          if (m.type === NodeType.ObjectProperty)
            return this.visitExpr(m.value);
          const fn = new FunctionDecExpr();
          fn.params = m.params;
          fn.body = m.body;
          return this.visitExpr(fn);
        })
      );
    return t.objectExpression(
      node.properties.map(m => this.visitObjectMember(m))
    );
  }

  visitObjectMember(node) {
    if (node.type === NodeType.ObjectProperty)
      return this.visitObjectProperty(node);
    return this.visitObjectMethod(node);
  }

  visitObjectProperty(node) {
    return t.objectProperty(
      this.visitExpr(node.key),
      this.visitExpr(node.value),
      node.computed
    );
  }

  visitObjectMethod(node) {
    const params = node.params.map(expr => t.identifier(expr.name));
    const body = t.blockStatement(node.body.map(stmt => this.visitStmt(stmt)));
    return t.objectMethod(
      "method",
      this.visitExpr(node.key),
      params,
      body,
      node.computed
    );
  }

  visitParenthesizedExpr(node) {
    return t.parenthesizedExpression(this.visitExpr(node.expr));
  }

  visitBinaryExpr(node) {
    let op = node.operator;
    op = opMap[op] || op;
    const left = this.visitExpr(node.left);
    const right = this.visitExpr(node.right);
    if (op === "===") {
      return t.callExpression(t.identifier("__eq__"), [left, right]);
    } else if (op === "!==") {
      return t.callExpression(t.identifier("__neq__"), [left, right]);
    }
    return t.binaryExpression(op, left, right);
  }

  visitUnaryExpr(node) {
    let op = node.operator;
    op = opMap[op] || op;
    if (op === "#") {
      return t.parenthesizedExpression(
        t.memberExpression(
          this.visitExpr(node.argument),
          t.identifier("length")
        )
      );
    }
    return t.unaryExpression(op, this.visitExpr(node.argument));
  }

  visitStringLiteral(node) {
    return t.stringLiteral(node.value);
  }

  visitIdentifier(node) {
    if (this.scope.isGlobal(node.name)) {
      return t.memberExpression(
        t.identifier("global"),
        t.identifier(node.name)
      );
    }
    return t.identifier(node.name);
  }

  visitNumberLiteral(node) {
    return t.numericLiteral(parseFloat(node.value));
  }

  visitBooleanLiteral(node) {
    return t.booleanLiteral(node.value === "true");
  }

  visitNilLiteral(node) {
    return t.nullLiteral();
  }
}
