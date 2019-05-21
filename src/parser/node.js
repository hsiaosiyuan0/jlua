import { SourceLoc } from "../lexer";

export class NodeType {
  static Error = "Error";
  static Chunk = "Chunk";
  static Comment = "Comment";
  static Identifier = "Identifier";
  static StringLiteral = "StringLiteral";
  static BooleanLiteral = "BooleanLiteral";
  static NumericLiteral = "NumericLiteral";
  static NilLiteral = "NilLiteral";
  static BinaryExpression = "BinaryExpression";
  static MemberExpression = "MemberExpression";
  static UnaryExpression = "UnaryExpression";
  static VarArgExpression = "VarArgExpression";
  static SequenceExpression = "SequenceExpression";
  static CallExpression = "CallExpression";
  static FunctionDecExpr = "FunctionDecExpr";
  static AssignExpression = "AssignExpression";
  static ObjectExpression = "ObjectExpression";
  static ObjectMember = "ObjectMember";
  static ObjectProperty = "ObjectProperty";
  static ObjectMethod = "ObjectMethod";
  static ParenthesizedExpression = "ParenthesizedExpression";
  static CallStatement = "CallStatement";
  static AssignStatement = "AssignStatement";
  static Function = "Function";
  static BlockStatement = "BlockStatement";
  static BreakStatement = "BreakStatement";
  static DoStatement = "DoStatement";
  static WhileStatement = "WhileStatement";
  static RepeatStatement = "RepeatStatement";
  static ForStatement = "ForStatement";
  static ForInStatement = "ForInStatement";
  static VariableDeclaration = "VariableDeclaration";
  static ReturnStatement = "ReturnStatement";
  static IfStatement = "IfStatement";
}

export class Node {
  /** @type {string} */
  type = NodeType.Error;
  loc = new SourceLoc();

  setLocStart(parserOrNode) {
    if (parserOrNode.loc) {
      this.loc = parserOrNode.loc
    } else {
      this.loc.source = parserOrNode.lexer.src.file;
      this.loc.start = parserOrNode.lexer.src.pos;
    }
    return this;
  }

  setLocEnd(parserOrNode) {
    if (parserOrNode.loc) this.loc.end = parserOrNode.loc.end;
    else this.loc.end = parserOrNode.lexer.src.pos;
    return this;
  }
}

export class Statement extends Node {}

export class LastStatement extends Statement {}

export class Chunk extends Node {
  type = NodeType.Chunk;
  /** @type {Array<Statement|LastStatement>} */
  body = [];
}

export class Comment extends Node {
  type = NodeType.Comment;
  text = "";
}

export class Identifier extends Node {
  type = NodeType.Identifier;
  name = "";
}

export class Expression extends Node {}

export class Literal extends Expression {}

export class StringLiteral extends Literal {
  type = NodeType.StringLiteral;
  value = "";
}

export class BooleanLiteral extends Literal {
  type = NodeType.BooleanLiteral;
  value = "";
}

export class NumericLiteral extends Literal {
  type = NodeType.NumericLiteral;
  value = "";
}

export class BinaryExpression extends Expression {
  type = NodeType.BinaryExpression;
  operator = "";
  /** @type Expression|Identifier */
  left = null;
  /** @type Expression|Identifier */
  right = null;
}

export class UnaryExpression extends Expression {
  type = NodeType.UnaryExpression;
  operator = "";
  /** @type Expression */
  argument = null;
}

export class VarArgExpression extends Expression {
  type = NodeType.VarArgExpression;
}

export class NilLiteral extends Literal {
  type = NodeType.NilLiteral;
}

export class MemberExpression extends Expression {
  type = NodeType.MemberExpression;
  /** @type Expression|Identifier */
  object = null;
  /** @type Expression|Identifier */
  property = null;
  computed = false;
}

export class CallExpression extends Expression {
  type = NodeType.CallExpression;
  /** @type Expression */
  callee = null;
  /** @type Expression[] */
  args = [];
}

export class AssignExpression extends Expression {
  type = NodeType.AssignExpression;
  /** @type SequenceExpression */
  left = null;
  /** @type SequenceExpression */
  right = null;
}

export class FunctionDecExpr extends Expression {
  type = NodeType.FunctionDecExpr;
  id = null;
  params = [];
  /** @type Statement[] */
  body = null;
  isLocal = false;
}

export class SequenceExpression extends Expression {
  type = NodeType.SequenceExpression;
  /** @type Array<Expression|Identifier> */
  expressions = [];
}

export class ObjectExpression extends Expression {
  type = NodeType.ObjectExpression;
  /** @type Array<ObjectProperty|ObjectMethod> */
  properties = [];
  isArray = false;
}

export class ParenthesizedExpression extends Expression {
  type = NodeType.ParenthesizedExpression;
  /** @type Expression */
  expr = null;
}

export class ObjectMember extends Node {
  type = NodeType.ObjectMember;
  /** @type Expression|Identifier|NumericLiteral */
  key = null;
  computed = false;
}

export class ObjectProperty extends ObjectMember {
  type = NodeType.ObjectProperty;
  /** @type Expression */
  value = null;
}

export class ObjectMethod extends ObjectMember {
  type = NodeType.ObjectMethod;
  params = [];
  /** @type Statement[] */
  body = null;
  isLocal = true;
}

export class CallStatement extends Statement {
  type = NodeType.CallStatement;
  /** @type CallExpression */
  expr = null;
}

export class AssignStatement extends Statement {
  type = NodeType.AssignStatement;
  /** @type AssignExpression */
  expr = null;
}

export class BlockStatement extends Statement {
  type = NodeType.BlockStatement;
  /** @type Statement[] */
  body = [];
}

export class BreakStatement extends Statement {
  type = NodeType.BreakStatement;
  label = null;
}

export class DoStatement extends Statement {
  type = NodeType.DoStatement;
  /** @type Statement[] */
  body = [];
}

export class WhileStatement extends Statement {
  type = NodeType.WhileStatement;
  /** @type Expression */
  test = null;
  /** @type Statement[] */
  body = [];
}

export class RepeatStatement extends Statement {
  type = NodeType.RepeatStatement;
  /** @type Expression */
  test = null;
  /** @type Statement[] */
  body = [];
}

export class ForStatement extends Statement {
  type = NodeType.ForStatement;
  /** @type AssignExpression */
  expr1 = null;
  /** @type Expression */
  expr2 = null;
  /** @type Expression */
  expr3 = null;
  /** @type Statement[] */
  body = [];
}

export class ForInStatement extends Statement {
  type = NodeType.ForInStatement;
  /** @type Identifier[] */
  nameList = [];
  /** @type Expression[] */
  exprList = [];
  /** @type Statement[] */
  body = [];
}

export class IfStatement extends Statement {
  type = NodeType.IfStatement;
  /** @type Expression */
  test = null;
  /** @type Statement[] */
  consequent = [];
  /** @type Statement */
  alternate = null;
}

export class VariableDeclaration extends Statement {
  type = NodeType.VariableDeclaration;
  /** @type Identifier[] */
  nameList = [];
  /** @type Expression[] */
  exprList = [];
}

export class FunctionDecStmt extends Node {
  type = NodeType.Function;
  /** @type Identifier */
  id = null;
  params = [];
  /** @type Statement[] */
  body = null;
  isLocal = false;
}

export class ReturnStatement extends Statement {
  type = NodeType.ReturnStatement;
  /** @type Expression[] */
  body = [];
}
