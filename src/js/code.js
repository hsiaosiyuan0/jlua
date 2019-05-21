import { AstVisitor } from "../visitor";
import * as t from "@babel/types";
import template from "@babel/template";
import {
  FunctionDecExpr,
  Identifier,
  NilLiteral,
  NodeType,
  NumericLiteral
} from "../parser";
import * as runtime from "./runtime";

const hasRuntimeDef = name => runtime[name] !== undefined;

export class ClassDef {
  constructor(name, parent = null) {
    this.name = name;
    this.parent = parent;
  }
}

export class Scope {
  constructor(parent = null) {
    this.parent = parent;
    this.slots = [];
    this.depth = parent ? parent.depth + 1 : 0;
    this.inFnDec = false;
    this.inClassMethod = false;
    this.inClass = null;
    this.classDefs = {};
    this.ctor = null;
  }

  isLocal(name) {
    return this.slots.indexOf(name) !== -1;
  }

  addLocal(name) {
    if (!this.isLocal(name)) this.slots.push(name);
  }

  addClassDef(name, parent) {
    parent = this.getClassDef(parent);
    if (!parent) parent = new ClassDef(parent);
    const def = new ClassDef(name, parent);
    this.classDefs[def.name] = def;
  }

  getClassDef(name) {
    let parent = this;
    while (parent) {
      const def = parent.classDefs[name];
      if (def !== undefined) return def;
      parent = parent.parent;
    }
    return null;
  }

  isClassDef(name) {
    let parent = this;
    while (parent) {
      if (parent.classDefs[name] !== undefined) return true;
      parent = parent.parent;
    }
    return false;
  }

  isGlobal(name) {
    if (this.isLocal(name)) return false;
    let parent = this;
    while (parent !== null) {
      if (parent.isLocal(name)) return false;
      parent = parent.parent;
    }
    return true;
  }

  enter() {
    return new Scope(this);
  }

  isInClassMethod() {
    let parent = this;
    while (parent !== null) {
      if (parent.inClassMethod) return true;
      parent = parent.parent;
    }
    return false;
  }

  getInClass() {
    let parent = this;
    while (parent !== null) {
      if (parent.inClass) return this.getClassDef(parent.inClass);
      parent = parent.parent;
    }
    return null;
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
    this.exportCnt = 0;
    this.scope = new Scope();
  }

  enterScope() {
    this.scope = this.scope.enter();
  }

  leaveScope() {
    this.scope = this.scope.parent;
  }

  static prepareRuntime() {
    const ast = template.ast(`
  const __jlua__ =  require("jlua/lib/js/runtime");
`);
    return Array.isArray(ast) ? ast : [ast];
  }

  visitChunk(node, src) {
    this.enterScope();
    this.scope.addLocal("require");
    let prepend = JsCodegen.prepareRuntime();
    let body = node.body.map(stmt => this.visitStmt(stmt));
    body = prepend.concat(body);
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

  assertClassDef(name) {
    if (!this.scope.isClassDef(name))
      throw new Error(`Class ${name} must be defined before it's being used`);
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

    if (
      rLen === 1 &&
      rLastExpr.type === NodeType.CallExpression &&
      rLastExpr.callee.name === "class"
    ) {
      if (lLen !== 1)
        throw new Error("only one lhs is permitted when defining class");
      const name = left[0].name;
      this.assertLocal(name);
      let parent;
      if (
        rLastExpr.args.length &&
        rLastExpr.args[0].type === NodeType.Identifier
      ) {
        parent = rLastExpr.args[0].name;
      }
      this.scope.ctor = name;
      this.scope.addClassDef(name, parent);
    }

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

  static refJlua(id) {
    return t.memberExpression(t.identifier("__jlua__"), id);
  }

  visitFuncDecStmt(node) {
    let id;
    if (node.id) {
      if (node.id.type === NodeType.Identifier) {
        this.assertLocal(node.id.name);
        this.scope.addLocal(node.id.name);
        id = t.identifier(node.id && node.id.name);
      } else if (
        node.id.type === NodeType.BinaryExpression &&
        node.id.operator === ":"
      ) {
        const klass = node.id.left;
        this.assertClassDef(klass.name);
        id = t.memberExpression(
          t.memberExpression(
            t.identifier(klass.name),
            t.identifier("prototype")
          ),
          t.identifier(node.id.right.name)
        );
        this.scope.inClassMethod = true;
        this.scope.inClass = klass.name;
      }
    }
    this.enterScope();
    this.scope.inFnDec = true;
    const params = node.params.map(expr => {
      this.scope.addLocal(expr.name);
      return t.identifier(expr.name);
    });
    const body = t.blockStatement(node.body.map(stmt => this.visitStmt(stmt)));
    if (node.isLocal) {
      return loc(
        t.variableDeclaration("let", [
          t.variableDeclarator(id, t.functionExpression(null, params, body))
        ]),
        node
      );
    }
    this.leaveScope();
    if (id.type === NodeType.Identifier) id = JsCodegen.refJlua(id);
    return loc(
      t.expressionStatement(
        t.assignmentExpression(
          "=",
          id,
          t.functionExpression(null, params, body)
        )
      ),
      node
    );
  }

  visitReturnStmt(node) {
    const args = node.body;
    const argsLen = args.length;

    // implement `exports.default`
    if (this.scope.depth === 1) {
      if (this.exportCnt > 1) throw new Error("only one export per module");
      if (argsLen !== 1) throw new Error("only one object per export");
      this.exportCnt++;
      return loc(t.exportDefaultDeclaration(this.visitExpr(args[0])), node);
      // return loc(
      //   t.expressionStatement(
      //     t.assignmentExpression(
      //       "=",
      //       t.memberExpression(
      //         t.identifier("exports"),
      //         t.identifier("default")
      //       ),
      //       this.visitExpr(args[0])
      //     )
      //   ),
      //   node
      // );
    }
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

  visitFunctionDecExpr(node) {
    let id;
    if (node.id) {
      this.assertLocal(node.id.name);
      this.scope.addLocal(node.id.name);
      id = t.identifier(node.id && node.id.name);
    }
    this.enterScope();
    this.scope.inFnDec = true;
    const params = node.params.map(expr => {
      this.scope.addLocal(expr.name);
      return t.identifier(expr.name);
    });
    const body = node.body.map(stmt => this.visitStmt(stmt));
    this.leaveScope();
    return loc(t.functionExpression(id, params, t.blockStatement(body)), node);
  }

  visitCallExpr(node) {
    const args = node.args.map(expr => this.visitExpr(expr));

    // `SomeClass.new(...args)` => `new SomeClass(...args)`
    if (
      node.callee.type === NodeType.MemberExpression &&
      node.callee.property.type === NodeType.Identifier &&
      node.callee.property.name === "new"
    ) {
      return loc(
        t.newExpression(this.visitExpr(node.callee.object), args),
        node
      );
    }

    // interopRequireDefault
    if (
      node.callee.type === NodeType.Identifier &&
      node.callee.name === "require"
    ) {
      const ipt = new Identifier();
      ipt.name = "interopRequireDefault";
      return loc(
        t.callExpression(this.visitExpr(ipt), [
          t.callExpression(t.identifier("require"), args)
        ]),
        node
      );
    }

    // implement `super`
    if (
      this.scope.isInClassMethod() &&
      node.callee.type === NodeType.MemberExpression &&
      node.callee.object.type === NodeType.Identifier &&
      node.callee.object.name === "super"
    ) {
      let tmp = `Object.getPrototypeOf(OBJ).METHOD.call(ARGS);`;
      if (node.computed) tmp = `Object.getPrototypeOf(OBJ)[METHOD].call(ARGS);`;
      let build = template(tmp);
      args.unshift(t.thisExpression());
      const klass = this.scope.getInClass();
      if (klass.parent === null) throw new Error(`class ${klass} has no super`);
      return loc(
        build({
          OBJ: t.memberExpression(
            t.identifier(klass.name),
            t.identifier("prototype")
          ),
          METHOD: this.visitExpr(node.callee.property),
          ARGS: args
        }).expression,
        node
      );
    }

    // normal
    const callee = this.visitExpr(node.callee);
    if (
      this.scope.ctor &&
      node.callee.type === NodeType.Identifier &&
      node.callee.name === "class"
    ) {
      args.unshift(t.stringLiteral(this.scope.ctor));
      this.scope.ctor = null;
    }
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
    this.enterScope();
    this.scope.inFnDec = true;
    const body = t.blockStatement(node.body.map(stmt => this.visitStmt(stmt)));
    this.leaveScope();
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
        t.callExpression(JsCodegen.refJlua(t.identifier("eq")), [left, right]),
        left,
        right
      );
    } else if (op === "!==") {
      return loc(
        t.callExpression(JsCodegen.refJlua(t.identifier("neq")), [left, right]),
        left,
        right
      );
    } else if (op === "&&" || op === "||") {
      return loc(t.logicalExpression(op, left, right), left, right);
    } else if (op === "+") {
      return loc(
        t.callExpression(JsCodegen.refJlua(t.identifier("add")), [left, right]),
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
    if (node.name === "self" && this.scope.inFnDec) {
      return loc(t.identifier("this"), node);
    }
    if (this.scope.isGlobal(node.name) && hasRuntimeDef(node.name)) {
      return loc(JsCodegen.refJlua(t.identifier(node.name)), node);
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
