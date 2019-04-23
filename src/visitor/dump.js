import { AstVisitor } from "./visitor";
import { ObjectProperty } from "../parser";

export class DumpVisitor extends AstVisitor {
  visitChunk(node) {
    return {
      type: node.type,
      body: node.body.map(stmt => this.visitStmt(stmt))
    };
  }

  visitAssignStmt(node) {
    const assign = node.expr;
    let left = assign.left.expressions.map(expr => this.visitExpr(expr));
    let right = assign.right.expressions.map(expr => this.visitExpr(expr));
    return { type: "AssignStmt", left, right };
  }

  visitDoStmt(node) {
    return {
      type: "DoStmt",
      body: node.body.map(stmt => this.visitStmt(stmt))
    };
  }

  visitBlockStmt(node) {
    return {
      type: "BlockStmt",
      body: node.body.map(stmt => this.visitStmt(stmt))
    };
  }

  visitBreakStmt(node) {
    return { type: "BreakStmt" };
  }

  visitWhileStmt(node) {
    return {
      type: "WhileStmt",
      test: this.visitExpr(node.test),
      body: node.body.map(stmt => this.visitStmt(stmt))
    };
  }

  visitRepeatStmt(node) {
    return {
      type: "RepeatStmt",
      body: node.body.map(stmt => this.visitStmt(stmt)),
      test: this.visitExpr(node.test)
    };
  }

  visitForStmt(node) {
    return {
      type: "ForStmt",
      init: [node.exp1, node.exp2, node.exp3].map(
        expr => expr && this.visitExpr(expr)
      ),
      body: node.body.map(stmt => this.visitStmt(stmt))
    };
  }

  visitForInStmt(node) {
    return {
      type: "ForInStmt",
      nameList: node.nameList.map(expr => this.visitExpr(expr)),
      exprList: node.exprList.map(expr => this.visitExpr(expr)),
      body: node.body.map(stmt => this.visitStmt(stmt))
    };
  }

  visitVarDecStmt(node) {
    return {
      type: "VarDecStmt",
      nameList: node.nameList.map(expr => this.visitExpr(expr)),
      exprList: node.exprList.map(expr => this.visitExpr(expr))
    };
  }

  visitReturnStmt(node) {
    return {
      type: "ReturnStmt",
      body: node.body.map(expr => this.visitExpr(expr))
    };
  }

  visitCallStmt(node) {
    node = node.expr;
    return {
      type: "CallStmt",
      callee: this.visitExpr(node.callee),
      args: node.args.map(arg => this.visitExpr(arg))
    };
  }

  visitIfStmt(node) {
    return {
      type: "IfStmt",
      test: this.visitExpr(node.test),
      then: node.consequent.map(stmt => this.visitStmt(stmt)),
      else: node.alternate === null ? null : this.visitStmt(node.alternate)
    };
  }

  visitFuncDecStmt(node) {
    return {
      type: "FunDecStmt",
      id: this.visitExpr(node.id),
      params: node.params.map(p => this.visitExpr(p)),
      body: node.body.map(expr => this.visitStmt(expr)),
      isLocal: node.isLocal
    };
  }

  visitIdentifier(node) {
    return { type: "Id", value: node.name };
  }

  visitStringLiteral(node) {
    return { type: "String", value: node.value };
  }

  visitNumberLiteral(node) {
    return { type: "Number", value: node.value };
  }

  visitNilLiteral(node) {
    return { type: "Nil" };
  }

  visitBinaryExpr(node) {
    return {
      type: "BinaryExpr",
      op: node.operator,
      left: this.visitExpr(node.left),
      right: this.visitExpr(node.right)
    };
  }

  visitMemberExpr(node) {
    return {
      type: "MemberExpr",
      obj: this.visitExpr(node.object),
      prop: this.visitExpr(node.property),
      computed: node.computed
    };
  }

  visitUnaryExpr(node) {
    return {
      type: "UnaryExpr",
      op: node.operator,
      arg: this.visitExpr(node.argument)
    };
  }

  visitVarArgExpr(node) {
    return {
      type: "VarArg"
    };
  }

  visitCallExpr(node) {
    return {
      type: "CallExpr",
      callee: this.visitExpr(node.callee),
      args: node.args.map(arg => this.visitExpr(arg))
    };
  }

  visitAssignExpr(node) {
    let left = node.left.expressions.map(expr => this.visitExpr(expr));
    let right = node.right.expressions.map(expr => this.visitExpr(expr));
    return { type: "AssignExpr", left, right };
  }

  visitFunctionDecExpr(node) {
    return {
      type: "FunDecExpr",
      id: node.id,
      params: node.params.map(p => this.visitExpr(p)),
      body: node.body.map(expr => this.visitStmt(expr)),
      isLocal: node.isLocal
    };
  }

  visitObjectExpression(node) {
    return {
      type: "ObjExpr",
      props: node.properties.map(mbr => this.visitObjectMember(mbr))
    };
  }

  visitObjectMember(node) {
    if (node instanceof ObjectProperty) return this.visitObjectProperty(node);
    return this.visitObjectMethod(node);
  }

  visitObjectProperty(node) {
    return {
      type: "ObjProp",
      key: this.visitExpr(node.key),
      value: this.visitExpr(node.value),
      computed: node.computed
    };
  }

  visitObjectMethod(node) {
    return {
      type: "ObjMethod",
      key: this.visitExpr(node.key),
      params: node.params.map(p => this.visitExpr(p)),
      body: node.body.map(expr => this.visitStmt(expr)),
      isLocal: node.isLocal
    };
  }
}
