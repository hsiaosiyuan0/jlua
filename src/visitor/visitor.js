import { NodeType } from "../parser";

export class AstVisitor {
  visitChunk(node) {}

  visitBlockStmt(node) {}
  visitBreakStmt(node) {}
  visitDoStmt(node) {}

  visitWhileStmt(node) {}
  visitWhileTest(node) {}
  visitWhileBody(node) {}

  visitRepeatStmt(node) {}
  visitRepeatTest(node, test) {}
  visitRepeatBody(node) {}

  visitForStmt(node) {}
  visitForInit(node) {}
  visitForBody(node) {}

  visitForInStmt(node) {}
  visitForInNameList(node, nameList) {}
  visitForInExprList(node, exprList) {}
  visitForInBody(node) {}

  visitVarDecStmt(node) {}
  visitVarDecStmtNameList(node) {}
  visitVarDecStmtExprList(node) {}

  visitReturnStmt(node) {}

  visitAssignStmt(node) {}
  visitCallStmt(node) {}

  visitIfStmt(node) {}
  visitIfStmtTest(node) {}
  visitIfStmtConsequent(node) {}
  visitIfStmtAlternate(node) {}

  visitFuncDecStmt(node) {}
  visitFuncDecParams(node) {}
  visitFuncDecBody(node) {}

  visitStringLiteral(node) {}
  visitBooleanLiteral(node) {}
  visitNumberLiteral(node) {}
  visitFunctionDecExpr(node) {}
  visitNilLiteral(node) {}
  visitBinaryExpr(node) {}
  visitMemberExpr(node) {}
  visitUnaryExpr(node) {}
  visitVarArgExpr(node) {}
  visitSequenceExpr(node) {}
  visitCallExpr(node) {}
  visitAssignExpr(node) {}
  visitIdentifier(node) {}
  visitObjectExpression(node) {}
  visitObjectMember(node) {}
  visitObjectProperty(node) {}
  visitObjectMethod(node) {}
  visitParenthesizedExpr(node) {}

  visitStmt(node) {
    switch (node.type) {
      case NodeType.Chunk:
        return this.visitChunk(node);
      case NodeType.Function:
        return this.visitFuncDecStmt(node);
      case NodeType.BlockStatement:
        return this.visitBlockStmt(node);
      case NodeType.BreakStatement:
        return this.visitBreakStmt(node);
      case NodeType.DoStatement:
        return this.visitDoStmt(node);
      case NodeType.WhileStatement:
        return this.visitWhileStmt(node);
      case NodeType.RepeatStatement:
        return this.visitRepeatStmt(node);
      case NodeType.ForStatement:
        return this.visitForStmt(node);
      case NodeType.ForInStatement:
        return this.visitForInStmt(node);
      case NodeType.VariableDeclaration:
        return this.visitVarDecStmt(node);
      case NodeType.ReturnStatement:
        return this.visitReturnStmt(node);
      case NodeType.IfStatement:
        return this.visitIfStmt(node);
      case NodeType.AssignStatement:
        return this.visitAssignStmt(node);
      case NodeType.CallStatement:
        return this.visitCallStmt(node);
    }
  }

  visitExpr(node) {
    switch (node.type) {
      case NodeType.BinaryExpression:
        return this.visitBinaryExpr(node);
      case NodeType.StringLiteral:
        return this.visitStringLiteral(node);
      case NodeType.BooleanLiteral:
        return this.visitBooleanLiteral(node);
      case NodeType.NumericLiteral:
        return this.visitNumberLiteral(node);
      case NodeType.NilLiteral:
        return this.visitNilLiteral(node);
      case NodeType.MemberExpression:
        return this.visitMemberExpr(node);
      case NodeType.UnaryExpression:
        return this.visitUnaryExpr(node);
      case NodeType.VarArgExpression:
        return this.visitVarArgExpr(node);
      case NodeType.SequenceExpression:
        return this.visitSequenceExpr(node);
      case NodeType.CallExpression:
        return this.visitCallExpr(node);
      case NodeType.AssignExpression:
        return this.visitAssignExpr(node);
      case NodeType.Identifier:
        return this.visitIdentifier(node);
      case NodeType.FunctionDecExpr:
        return this.visitFunctionDecExpr(node);
      case NodeType.ObjectExpression:
        return this.visitObjectExpression(node);
      case NodeType.ParenthesizedExpression:
        return this.visitParenthesizedExpr(node);
    }
  }
}
