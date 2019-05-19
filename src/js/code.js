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

const loc = (node, start, end) => {
  start = start.source ? start : start.loc;
  end = end && end.source ? end : end && end.loc;
  let _loc = start;
  if (end) _loc.end = end.end;
  node.loc = _loc;
  return node;
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
  global.__add__ = (lhs, rhs) => {
    let add = typeof lhs['__add'] === 'function' ? lhs.__add :
      typeof rhs['__add'] === 'function' ? rhs.__add : (l, r) => l + r;
    return add(lhs, rhs);
  };
  global.pairs = (o) => {
    if(Array.isArray(o)) return o.entries();
    return o;
  };
`);
  }

  visitChunk(node, src) {
    this.enterScope();
    this.scope.addLocal("require");
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

  assertLocal(name) {
    if (this.scope.isLocal(name))
      throw new Error(`Identifier '${name}' already been declared`);
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
      const name = left[0].name;
      this.assertLocal(name);
      lhs = t.identifier(name);
      lhs.loc = left[0].loc;
      this.scope.addLocal(name);
    } else {
      lhs = left.map(expr => {
        this.assertLocal(expr.name);
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
    return loc(t.variableDeclaration("let", [decor]), node);
  }

  visitDoStmt(node) {
    const body = node.body.map(stmt => this.visitStmt(stmt));
    return t.blockStatement(body);
  }

  visitCallStmt(node) {
    return t.expressionStatement(this.visitExpr(node.expr));
  }

  visitBlockStmt(node) {
    this.enterScope();
    const n = t.blockStatement(node.body.map(stmt => this.visitStmt(stmt)));
    this.leaveScope();
    return n;
  }

  visitIfStmt(node) {
    const test = this.visitExpr(node.test);
    this.enterScope();
    const consequent = t.blockStatement(
      node.consequent.map(stmt => this.visitStmt(stmt))
    );
    this.leaveScope();
    return loc(
      t.ifStatement(
        test,
        consequent,
        node.alternate && loc(this.visitStmt(node.alternate), node.alternate)
      ),
      node
    );
  }

  visitFuncDecStmt(node) {
    let id;
    if (node.id) {
      this.assertLocal(node.id.name);
      this.scope.addLocal(node.id.name);
      id = t.identifier(node.id && node.id.name);
    }
    this.enterScope();
    const params = node.params.map(expr => {
      this.scope.addLocal(expr.name);
      return t.identifier(expr.name);
    });
    const body = t.blockStatement(node.body.map(stmt => this.visitStmt(stmt)));
    if (node.isLocal) {
      return t.variableDeclaration("let", [
        t.variableDeclarator(id, t.functionExpression(null, params, body))
      ]);
    }
    this.leaveScope();
    return loc(
      t.expressionStatement(
        t.assignmentExpression(
          "=",
          t.memberExpression(t.identifier("global"), id),
          t.functionExpression(null, params, body)
        )
      ),
      node
    );
  }

  visitReturnStmt(node) {
    const args = node.body;
    const argsLen = args.length;
    if (argsLen === 0) return loc(t.returnStatement(), node);
    if (argsLen === 1)
      return loc(t.returnStatement(this.visitExpr(args[0])), node);
    return loc(
      t.returnStatement(
        t.arrayExpression(args.map(expr => this.visitExpr(expr)))
      ),
      node
    );
  }

  visitBreakStmt(node) {
    return loc(t.breakStatement(), node);
  }

  visitWhileStmt(node) {
    return t.whileStatement(
      this.visitExpr(node.test),
      t.blockStatement(node.body.map(stmt => this.visitStmt(stmt)))
    );
  }

  visitRepeatStmt(node) {
    return loc(
      t.doWhileStatement(
        t.unaryExpression(
          "!",
          t.parenthesizedExpression(this.visitExpr(node.test))
        ),
        t.blockStatement(node.body.map(stmt => this.visitStmt(stmt)))
      ),
      node
    );
  }

  visitForStmt(node) {
    const initLeft = node.expr1.left.expressions[0];
    const initRight = node.expr1.right.expressions[0];
    const id = loc(t.identifier(initLeft.name), initLeft);
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
    return loc(
      t.forStatement(
        init,
        test,
        update,
        t.blockStatement(node.body.map(stmt => this.visitStmt(stmt)))
      ),
      node
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
    const right = t.callExpression(t.identifier("pairs"), [
      this.visitExpr(node.exprList[0])
    ]);
    return loc(
      t.forOfStatement(
        left,
        right,
        t.blockStatement(node.body.map(stmt => this.visitStmt(stmt)))
      ),
      node
    );
  }

  visitMemberExpr(node) {
    let prop;
    if (node.computed) prop = this.visitExpr(node.property);
    else prop = t.identifier(node.property.name);
    return loc(
      t.memberExpression(this.visitExpr(node.object), prop, node.computed),
      node
    );
  }

  visitFunctionDecExpr(node) {
    let id;
    if (node.id) {
      this.assertLocal(node.id.name);
      this.scope.addLocal(node.id.name);
      id = t.identifier(node.id && node.id.name);
    }
    this.enterScope();
    const params = node.params.map(expr => {
      this.scope.addLocal(expr.name);
      return t.identifier(expr.name);
    });
    const body = node.body.map(stmt => this.visitStmt(stmt));
    this.leaveScope();
    return loc(t.functionExpression(id, params, t.blockStatement(body)), node);
  }

  visitCallExpr(node) {
    const callee = this.visitExpr(node.callee);
    const args = node.args.map(expr => this.visitExpr(expr));
    return loc(t.callExpression(callee, args), callee);
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
    return loc(
      t.objectExpression(node.properties.map(m => this.visitObjectMember(m))),
      node
    );
  }

  visitObjectMember(node) {
    if (node.type === NodeType.ObjectProperty)
      return this.visitObjectProperty(node);
    return this.visitObjectMethod(node);
  }

  visitObjectProperty(node) {
    return loc(
      t.objectProperty(
        this.visitExpr(node.key),
        this.visitExpr(node.value),
        node.computed
      ),
      node
    );
  }

  visitObjectMethod(node) {
    const params = node.params.map(expr => t.identifier(expr.name));
    const body = t.blockStatement(node.body.map(stmt => this.visitStmt(stmt)));
    return loc(
      t.objectMethod(
        "method",
        this.visitExpr(node.key),
        params,
        body,
        node.computed
      ),
      node
    );
  }

  visitParenthesizedExpr(node) {
    return loc(t.parenthesizedExpression(this.visitExpr(node.expr)), node);
  }

  visitBinaryExpr(node) {
    let op = node.operator;
    op = opMap[op] || op;
    const left = this.visitExpr(node.left);
    const right = this.visitExpr(node.right);
    if (op === "===") {
      return loc(
        t.callExpression(t.identifier("__eq__"), [left, right]),
        left,
        right
      );
    } else if (op === "!==") {
      return loc(
        t.callExpression(t.identifier("__neq__"), [left, right]),
        left,
        right
      );
    } else if (op === "&&" || op === "||") {
      return loc(t.logicalExpression(op, left, right), left, right);
    } else if (op === "+") {
      return loc(
        t.callExpression(t.identifier("__add__"), [left, right]),
        left,
        right
      );
    }
    return loc(t.binaryExpression(op, left, right), left, right);
  }

  visitUnaryExpr(node) {
    let op = node.operator;
    op = opMap[op] || op;
    if (op === "#") {
      return loc(
        t.parenthesizedExpression(
          t.memberExpression(
            this.visitExpr(node.argument),
            t.identifier("length")
          )
        ),
        node
      );
    }
    return loc(t.unaryExpression(op, this.visitExpr(node.argument)), node);
  }

  visitStringLiteral(node) {
    return loc(t.stringLiteral(node.value), node);
  }

  visitIdentifier(node) {
    if (this.scope.isGlobal(node.name)) {
      return loc(
        t.memberExpression(t.identifier("global"), t.identifier(node.name)),
        node
      );
    }
    return loc(t.identifier(node.name), node);
  }

  visitNumberLiteral(node) {
    return loc(t.numericLiteral(parseFloat(node.value)), node);
  }

  visitBooleanLiteral(node) {
    return loc(t.booleanLiteral(node.value === "true"), node);
  }

  visitNilLiteral(node) {
    return loc(t.nullLiteral(), node);
  }
}
