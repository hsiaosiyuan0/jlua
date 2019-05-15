import { AstVisitor } from "../visitor";
import {
  LuaFunction,
  LuaInstruction,
  LuaLocalVar,
  LuaNumber,
  LuaString,
  LuaUpvalue,
  OpCode
} from "./chunk";
import assert from "assert";
import {
  FunctionDecExpr,
  NilLiteral,
  NodeType,
  NumericLiteral,
  ObjectProperty
} from "../parser";

export class FnState extends LuaFunction {
  /**
   *
   * @param parent {FnState}
   */
  constructor(parent = null) {
    super();
    this.protoCounter = 0;
    this.parent = parent;
    this.src = parent ? parent.src : null;
    this.protoIdx = parent ? parent.protoCounter++ : -1;
    this.upvalueIdx = 0;
    this._nextReg = 0;
    this._freeRegs = [];
    this._set2reg = [];
    this._retNum = [];
  }

  newProp() {
    const p = new FnState(this);
    this.protos.push(p);
    return p;
  }

  hasLocal(name) {
    return this.locals.findIndex(v => v.name.equals(name)) !== -1;
  }

  get top() {
    return this._nextReg - 1;
  }

  get nextReg() {
    this.maxStackSize = Math.max(this.maxStackSize, this._nextReg + 1);
    return this._nextReg++;
  }

  setNextReg(n) {
    this.maxStackSize = Math.max(this.maxStackSize, n);
    this._nextReg = n;
    this._freeRegs = this._freeRegs.filter(r => r < n);
  }

  get usableReg() {
    // TODO:: divides temp and local registers, collect the useless tmp registers for later reuse
    // in some situations we can not use free regs since those situations requires
    // the involved registers muse be sequential, eg. `CALL` requires the registers used
    // by it's arguments are sequential and closely flow the `RA` part in `CALL` instruction.
    // to resolve the problem shown by prior `CALL` example, we can introduce a scope
    // notion which can indicate the expressions in it cannot use free register otherwise
    // it's fine to use the free ones
    if (this._freeRegs.length > 0) return this._freeRegs.pop();
    return this.nextReg;
  }

  freeReg(reg) {
    this._freeRegs.push(reg);
  }

  defLocal(name, reg = -1) {
    const v = new LuaLocalVar(LuaString.fromString(name));
    v.reg = reg === -1 ? this.usableReg : reg;
    this.locals.push(v);
  }

  removeLocal(name) {
    const reg = this.local2reg(name);
    this.locals = this.locals.filter(v => !v.name.equals(name));
    this.freeReg(reg);
  }

  local2reg(name) {
    const i = this.locals.findIndex(v => v.name.equals(name));
    assert.ok(i !== -1, "invalid local var: " + name);
    return this.locals[i].reg;
  }

  hasUpvalue(name) {
    return this.upvalues.findIndex(v => v.name.equals(name)) !== -1;
  }

  addUpvalue(name) {
    if (this.hasUpvalue(name)) return;

    let parent = this.parent;
    let found = false;
    let depth = 0;
    const spans = [];
    let v = new LuaUpvalue(LuaString.fromString(name), 0, this.upvalueIdx++);
    while (parent !== null) {
      if (parent.hasLocal(name)) {
        found = true;
        if (depth === 0 && name !== "_ENV") v.inStack = 1;
        this.upvalues.push(v);
        break;
      }
      if (parent.hasUpvalue(name)) {
        found = true;
        v.idx = parent.getUpvalue(name).idx;
        this.upvalues.push(v);
        break;
      }
      spans.push(parent);
      parent = parent.parent;
      depth++;
    }
    spans.forEach(s => s.upvalues.push(v));
    return found;
  }

  getUpvalue(name) {
    for (let i = 0, len = this.upvalues.length; i < len; i++) {
      const v = this.upvalues[i];
      if (v.name.equals(name)) return v;
    }
    return null;
  }

  hasConst(c) {
    return this.consts.findIndex(cc => cc.equals(c)) !== -1;
  }

  addConst(c) {
    if (!this.hasConst(c)) this.consts.push(c);
  }

  const2idx(c) {
    return this.consts.findIndex(cc => cc.equals(c));
  }

  appendInst(inst) {
    this.code.push(inst);
  }

  pushRetNum(n) {
    this._retNum.push(n);
  }

  setRetNum(n) {
    this._retNum[this._retNum.length - 1] = n;
  }

  getRetNum() {
    const n = this._retNum[this._retNum.length - 1];
    return n === undefined ? 0 : n;
  }

  popRetNum() {
    this._retNum.pop();
  }

  pushSet2reg(r) {
    this.maxStackSize = Math.max(this.maxStackSize, r);
    this._set2reg.push(r);
  }

  get set2reg() {
    const r = this._set2reg[this._set2reg.length - 1];
    return r === undefined ? -1 : r;
  }

  popSet2reg() {
    this._set2reg.pop();
  }
}

export const kBitRK = 1 << 8;
export const kstIdxToRK = i => i | kBitRK;

export const binop2opcode = {
  "+": OpCode.ADD,
  "-": OpCode.SUB,
  "*": OpCode.MUL,
  "/": OpCode.DIV,
  "%": OpCode.MOD,
  "^": OpCode.POW,
  "==": OpCode.EQ,
  "<": OpCode.LT,
  "<=": OpCode.LE,
  "~=": OpCode.EQ,
  ">": OpCode.LT,
  ">=": OpCode.LE,
  "..": OpCode.CONCAT
};

export const unaryop2opcode = {
  "-": OpCode.UNM,
  not: OpCode.NOT,
  "#": OpCode.LEN
};

export class Codegen extends AstVisitor {
  /** @type {FnState}  */
  fnState = null;

  visitChunk(node, src) {
    this.fnState = new FnState();
    this.fnState.src = src;
    this.fnState.upvalues.push(
      new LuaUpvalue(LuaString.fromString("_ENV"), 1, 0)
    );
    node.body.forEach(stmt => this.visitStmt(stmt));
    const ret = new LuaInstruction();
    ret.opcode = OpCode.RETURN;
    ret.A = 0;
    ret.B = 1;
    this.fnState.appendInst(ret);
    return this.fnState;
  }

  get set2reg() {
    return this.fnState.set2reg === -1
      ? this.fnState.usableReg
      : this.fnState.set2reg;
  }

  visitVarDecStmt(node) {
    const nameList = node.nameList;
    const exprList = node.exprList;
    const nameListLen = nameList.length;
    const exprListLen = exprList.length;
    const excessNamesLen = nameListLen - exprListLen;
    const lastExprIdx = exprListLen - 1;
    const lastExpr = nameList[lastExprIdx];
    const lastExprCanRetMulti =
      lastExpr && lastExpr.type === NodeType.CallExpression;

    for (let i = 0; i < nameListLen; i++) {
      const nameNode = nameList[i];
      const name = nameNode.name;
      this.fnState.defLocal(name);
      const set2reg = this.fnState.local2reg(name);

      if (i <= lastExprIdx) {
        // consider this stmt: local a, b = type("string"), here we need the rhs expr
        // to emit instruction to return multiple results.
        // use below variable `lastIsMultiRet` to indicate whether the last rhs expr
        // can return multiple results and sequentially use `this.fnState.retNum`
        // to notify that expr to emit specified number of results if required
        if (i === lastExprIdx && lastExprCanRetMulti) {
          this.fnState.pushRetNum(excessNamesLen);
        } else this.fnState.pushRetNum(1);

        this.fnState.pushSet2reg(set2reg);
        this.visitExpr(exprList[i]);
        this.fnState.popSet2reg();
        this.fnState.popRetNum();

        // if last expr can return multiple results then use the returned register directly
        if (i === lastExprIdx && lastExprCanRetMulti) {
          // calc the first index of the excess lhs
          const n = nameListLen - excessNamesLen + 1;
          for (let i = n, j = set2reg + 1; i < nameListLen; i++, j++) {
            this.fnState.defLocal(node.nameList[i].name, j);
          }
          break;
        }
      } else {
        const inst = new LuaInstruction();
        inst.A = set2reg;
        inst.opcode = OpCode.LOADNI;
        inst.B = 0;
        this.fnState.appendInst(inst);
      }
    }
  }

  visitAssignStmt(node) {
    // delegate to assignment expression
    this.visitExpr(node.expr);
  }

  visitAssignExpr(node) {
    const left = node.left.expressions;
    const right = node.right.expressions;
    const leftLen = left.length;
    const rightLen = right.length;
    const excessLeftLen = leftLen - rightLen;
    const lastExprIdx = rightLen - 1;
    const lastExpr = right[lastExprIdx];
    const lastExprCanRetMulti =
      lastExpr && lastExpr.type === NodeType.CallExpression;

    if (!lastExprCanRetMulti) {
      for (let i = 0; i < excessLeftLen; i++) {
        right.push(new NilLiteral());
      }
    }

    const uvs = []; // save used upvalues
    const gbs = []; // save used global variables
    let lastCallReg = -1;
    for (let i = 0; i < leftLen; i++) {
      const name = left[i].name;
      if (this.fnState.hasLocal(name)) {
        this.fnState.pushSet2reg(this.fnState.local2reg(name));
      } else {
        const foundUpvalue = this.fnState.addUpvalue(name);
        this.fnState.pushSet2reg(
          lastCallReg > 0 ? lastCallReg++ : this.set2reg
        );

        if (foundUpvalue) {
          // for emit `SETUPVAL` later
          uvs.push([this.fnState.getUpvalue(name), this.fnState.set2reg]);
        } else {
          // reaching here means name references a global variable
          // so we need add `_ENV` as upvalue
          this.fnState.addUpvalue("_ENV");
          const c = LuaString.fromString(name);
          this.fnState.addConst(c);
          // for emit `SETTABUP` later
          gbs.push([
            kstIdxToRK(this.fnState.const2idx(c)),
            this.fnState.set2reg
          ]);
        }
      }

      if (i === lastExprIdx && lastExprCanRetMulti && excessLeftLen) {
        lastCallReg = this.fnState.set2reg;
        this.fnState.pushRetNum(excessLeftLen);
      } else this.fnState.pushRetNum(1);

      // if `lastExprCanRetMulti` is true then next expression are all
      // dummy `NilLiteral`
      this.visitExpr(right[i]);
      this.fnState.popSet2reg();
      this.fnState.popRetNum();
    }

    uvs.forEach(uv => {
      const inst = new LuaInstruction();
      inst.opcode = OpCode.SETUPVAL;
      inst.A = uv[1];
      inst.B = uv[0].idx;
      this.fnState.appendInst(inst);
    });

    gbs.forEach(gb => {
      const inst = new LuaInstruction();
      inst.opcode = OpCode.SETTABUP;
      inst.A = 0;
      inst.B = gb[0];
      inst.C = gb[1];
      this.fnState.appendInst(inst);
    });
  }

  visitIfStmt(node) {
    const set2reg = this.fnState.usableReg;
    this.fnState.pushSet2reg(set2reg);
    this.fnState.pushRetNum(1);
    this.visitExpr(node.test);
    this.fnState.popRetNum();
    this.fnState.popSet2reg();

    const test = new LuaInstruction();
    test.opcode = OpCode.TEST;
    test.A = set2reg;
    test.C = 0;
    this.fnState.appendInst(test);

    const elseJump = new LuaInstruction();
    elseJump.opcode = OpCode.JMP;
    elseJump.A = 0;
    this.fnState.appendInst(elseJump);
    elseJump.sBx = this.fnState.code.length;

    node.consequent.forEach(stmt => this.visitStmt(stmt));
    const jmp = new LuaInstruction();
    jmp.opcode = OpCode.JMP;
    this.fnState.appendInst(jmp);
    jmp.sBx = this.fnState.code.length;

    // fix else-jump to jump to the beginning of the else branch
    elseJump.sBx = this.fnState.code.length - elseJump.sBx;

    if (node.alternate) {
      this.visitStmt(node.alternate);
    }

    // fix jmp to skip code of else branch
    jmp.sBx = this.fnState.code.length - jmp.sBx;
  }

  visitForStmt(node) {
    const a = this.fnState.nextReg; // initial value
    const a1 = this.fnState.nextReg; // limit
    const a2 = this.fnState.nextReg; // stepping value
    const a3 = this.fnState.nextReg; // local var

    const localVar = node.expr1.left.expressions[0];
    const initial = node.expr1.right.expressions[0];
    this.fnState.pushSet2reg(a);
    this.visitExpr(initial);
    this.fnState.popSet2reg();

    this.fnState.pushSet2reg(a1);
    this.visitExpr(node.expr2);
    this.fnState.popSet2reg();

    let expr3 = node.expr3;
    if (expr3 === null) {
      expr3 = new NumericLiteral();
      expr3.value = "1";
    }
    this.fnState.pushSet2reg(a2);
    this.visitExpr(expr3);
    this.fnState.popSet2reg();

    this.fnState.defLocal(localVar.name, a3);

    const forprep = new LuaInstruction();
    forprep.opcode = OpCode.FORPREP;
    forprep.A = a;
    this.fnState.appendInst(forprep);
    forprep.sBx = this.fnState.code.length;

    node.body.forEach(stmt => this.visitStmt(stmt));
    forprep.sBx = this.fnState.code.length - forprep.sBx;

    const forloop = new LuaInstruction();
    forloop.opcode = OpCode.FORLOOP;
    forloop.A = a;
    forloop.sBx = -(forprep.sBx + 1);
    this.fnState.appendInst(forloop);

    this.fnState.removeLocal(localVar.name);
    // free registers used by forloop
    this.fnState.setNextReg(a);
  }

  visitForInStmt(node) {
    const rItFn = this.fnState.nextReg;
    const rState = rItFn + 1;
    const rCtrl = rState + 1;
    const ri = rCtrl + 1;
    const rv = ri + 1;

    const nameList = node.nameList;
    const nameListLen = nameList.length;
    if (nameListLen > 2) throw new Error("deformed iterator lhs");
    if (nameList[0] !== undefined) this.fnState.defLocal(nameList[0].name, ri);
    if (nameList[1] !== undefined) this.fnState.defLocal(nameList[1].name, rv);

    const exprList = node.exprList;
    const exprListLen = exprList.length;
    const itFnNode = exprList[0];
    if (exprListLen === 1 && itFnNode.type === NodeType.CallExpression) {
      this.fnState.pushSet2reg(rItFn);
      this.fnState.pushRetNum(3);
      this.visitExpr(exprList[0]);
      this.fnState.popSet2reg();
      this.fnState.popRetNum();
    } else if (exprListLen === 3) {
      this.fnState.pushSet2reg(rItFn);
      this.visitExpr(exprList[0]);
      this.fnState.popSet2reg();

      this.fnState.pushSet2reg(rState);
      this.visitExpr(exprList[1]);
      this.fnState.popSet2reg();

      this.fnState.pushSet2reg(rCtrl);
      this.visitExpr(exprList[2]);
      this.fnState.pushSet2reg();
    } else {
      throw new Error("deformed iterator rhs");
    }

    const jmp = new LuaInstruction();
    jmp.opcode = OpCode.JMP;
    jmp.A = 0;
    this.fnState.appendInst(jmp);
    jmp.sBx = this.fnState.code.length;

    this.fnState.setNextReg(rv + 1);
    node.body.forEach(stmt => this.visitStmt(stmt));
    jmp.sBx = this.fnState.code.length - jmp.sBx;

    const forcall = new LuaInstruction();
    forcall.opcode = OpCode.TFORCALL;
    forcall.A = rItFn;
    forcall.C = nameListLen;
    this.fnState.appendInst(forcall);

    const forloop = new LuaInstruction();
    forloop.opcode = OpCode.FORLOOP;
    forloop.A = rCtrl;
    this.fnState.appendInst(forloop);
    forloop.sBx = -(jmp.sBx + 2);

    this.fnState.removeLocal(nameList[0].name);
    if (nameList[1]) this.fnState.removeLocal(nameList[1].name);
    // free registers used by forloop
    this.fnState.setNextReg(rItFn);
  }

  visitObjectExpression(node) {
    const ps = node.properties;
    const psLen = ps.length;
    const nt = new LuaInstruction();
    nt.opcode = OpCode.NEWTABLE;
    nt.A = this.set2reg;
    if (node.isArray) nt.B = LuaInstruction.int2fb(psLen);
    else nt.C = LuaInstruction.int2fb(psLen);
    this.fnState.appendInst(nt);

    if (node.isArray) {
      const FPF = 50;
      let lastIsCallOrVarArg = false;
      for (let i = 0, r = nt.A + 1; i < psLen; i++, r++) {
        this.fnState.pushSet2reg(r);
        const expr = ps[i].value;
        if (
          i === psLen - 1 &&
          (expr.type === NodeType.CallExpression ||
            expr.type === NodeType.VarArgExpression)
        ) {
          this.fnState.pushRetNum(-1);
          this.visitExpr(expr);
          this.fnState.popRetNum();
          lastIsCallOrVarArg = true;
        } else {
          this.visitExpr(expr);
        }
        this.fnState.popSet2reg();
        if (i !== 0 && (i + 1) % FPF === 0) {
          const sl = new LuaInstruction();
          sl.opcode = OpCode.SETLIST;
          sl.A = nt.A;
          if (i === psLen - 1 && lastIsCallOrVarArg) sl.B = 0;
          else sl.B = FPF;
          sl.C = (i + 1) / FPF;
          this.fnState.appendInst(sl);
          r = nt.A;
        }
      }
      const last = psLen % FPF;
      if (last > 0) {
        const sl = new LuaInstruction();
        sl.opcode = OpCode.SETLIST;
        sl.A = nt.A;
        if (lastIsCallOrVarArg) sl.B = 0;
        else sl.B = last;
        sl.C = Math.ceil(psLen / FPF);
        this.fnState.appendInst(sl);
      }
    } else {
      ps.forEach(p => {
        const sl = new LuaInstruction();
        sl.opcode = OpCode.SETTABLE;
        sl.A = nt.A;

        const c = LuaString.fromString(p.key.name);
        this.fnState.addConst(c);
        sl.B = kstIdxToRK(this.fnState.const2idx(c));

        const r = this.fnState.nextReg;
        sl.C = r;

        this.fnState.pushSet2reg(r);
        if (p instanceof ObjectProperty) {
          this.visitExpr(p.value);
        } else {
          const fn = new FunctionDecExpr();
          fn.params = p.params;
          fn.body = p.body;
          fn.isLocal = true;
          this.visitExpr(fn);
        }
        this.fnState.popSet2reg();

        this.fnState.appendInst(sl);
      });
    }
    this.fnState.setNextReg(nt.A);
  }

  visitBlockStmt(node) {
    node.body.forEach(stmt => this.visitStmt(stmt));
  }

  visitCallStmt(node) {
    this.visitCallExpr(node.expr);
  }

  appendDefaultRetInst() {
    const ret = new LuaInstruction();
    ret.opcode = OpCode.RETURN;
    ret.A = 0;
    ret.B = 1;
    this.fnState.appendInst(ret);
  }

  visitReturnStmt(node) {
    const pLen = node.body.length;
    const lastExpr = node.body[pLen - 1];
    const lastIsCallOrVarArg =
      lastExpr.type === NodeType.CallExpression ||
      lastExpr.type === NodeType.VarArgExpression;
    if (pLen === 0) {
      this.appendDefaultRetInst();
      return;
    }
    const firstRetReg = this.fnState.nextReg;
    let i = firstRetReg;
    node.body.forEach(expr => {
      this.fnState.pushSet2reg(i++);
      this.visitExpr(expr);
    });
    this.fnState.popSet2reg();
    const ret = new LuaInstruction();
    ret.opcode = OpCode.RETURN;
    ret.A = firstRetReg;
    ret.B = lastIsCallOrVarArg ? 0 : pLen + 1;
    this.fnState.appendInst(ret);
  }

  visitFuncDecStmt(node) {
    const proto = (this.fnState = this.fnState.newProp());
    this.visitFuncDecParams(node.params);
    this.visitFuncDecBody(node.body);
    this.fnState = this.fnState.parent;

    let set2reg = this.set2reg;
    if (node.isLocal) this.fnState.defLocal(node.id.name, set2reg);
    const instClosure = new LuaInstruction();
    instClosure.opcode = OpCode.CLOSURE;
    instClosure.A = set2reg;
    instClosure.Bx = proto.protoIdx;
    this.fnState.appendInst(instClosure);

    // set closure as global
    if (!node.isLocal) {
      const id = LuaString.fromString(node.id.name);
      this.fnState.addConst(id);
      const inst = new LuaInstruction();
      inst.opcode = OpCode.SETTABUP;
      inst.A = 0;
      inst.B = kstIdxToRK(this.fnState.const2idx(id));
      inst.C = instClosure.A;
      this.fnState.appendInst(inst);
    }
  }

  visitFuncDecParams(params) {
    params.forEach(p => {
      if (p.type === NodeType.Identifier) this.fnState.defLocal(p.name);
      else if (p.type === NodeType.VarArgExpression) this.fnState.isVararg = 1;
    });
  }

  visitFuncDecBody(body) {
    body.forEach(stmt => this.visitStmt(stmt));
    this.appendDefaultRetInst();
  }

  visitFunctionDecExpr(node) {
    const proto = (this.fnState = this.fnState.newProp());
    this.visitFuncDecParams(node.params);
    this.visitFuncDecBody(node.body);
    this.fnState = this.fnState.parent;

    const instClosure = new LuaInstruction();
    instClosure.opcode = OpCode.CLOSURE;
    instClosure.A = this.set2reg;
    instClosure.Bx = proto.protoIdx;
    this.fnState.appendInst(instClosure);
  }

  visitVarArgExpr(node) {
    const inst = new LuaInstruction();
    inst.opcode = OpCode.VARARG;
    inst.A = this.set2reg;
    const rn = this.fnState.getRetNum();
    if (rn > 0) inst.B = rn + 1;
    else inst.B = 0;
    this.fnState.appendInst(inst);
  }

  visitMemberExpr(node) {
    const gtbl = new LuaInstruction();
    gtbl.opcode = OpCode.GETTABLE;
    gtbl.A = this.set2reg;

    const b = this.fnState.nextReg;
    this.fnState.pushSet2reg(b);
    this.visitExpr(node.object);
    this.fnState.popSet2reg();
    gtbl.B = b;

    if (node.computed) {
      const c = this.fnState.nextReg;
      this.fnState.pushSet2reg(c);
      this.visitExpr(node.property);
      gtbl.C = c;
    } else {
      const c = LuaString.fromString(node.property.name);
      this.fnState.addConst(c);
      gtbl.C = kstIdxToRK(this.fnState.const2idx(c));
    }
    this.fnState.appendInst(gtbl);
  }

  visitCallExpr(node) {
    const inst = new LuaInstruction();
    inst.opcode = OpCode.CALL;
    const callRet = this.set2reg;
    inst.A = callRet;
    this.fnState.pushSet2reg(callRet);
    this.visitExpr(node.callee);
    this.fnState.popSet2reg();

    const len = node.args.length;
    const lastIsMultiRet =
      len > 0 && node.args[len - 1].type === NodeType.CallExpression;
    if (len === 0) {
      inst.B = 1;
    } else {
      node.args.forEach((expr, i) => {
        this.fnState.pushSet2reg(callRet + i + 1);
        if (lastIsMultiRet && i === len - 1) {
          this.fnState.pushRetNum(-1);
        } else {
          this.fnState.pushRetNum(1);
        }
        this.visitExpr(expr);
        this.fnState.popSet2reg();
        this.fnState.popRetNum();
      });
      if (lastIsMultiRet) inst.B = 0;
      else inst.B = len + 1;
    }
    const retNum = this.fnState.getRetNum();
    if (retNum === -1) {
      inst.C = 0;
    } else if (retNum === 0) {
      inst.C = 1;
    } else {
      inst.C = retNum + 1;
      // shrink registers used by current call
      this.fnState.setNextReg(inst.A + retNum);
    }
    this.fnState.appendInst(inst);
  }

  visitBinaryExpr(node) {
    const inst = new LuaInstruction();
    inst.opcode = binop2opcode[node.operator];
    const isCmp =
      ["==", "<", "<=", ">", ">=", "~="].indexOf(node.operator) !== -1;
    const isLogic = !isCmp && ["and", "or"].indexOf(node.operator) !== -1;
    if (isCmp) {
      inst.A = 1;
      if (["~=", ">", ">="].indexOf(node.operator) !== -1) {
        inst.A = 0;
      }
    } else {
      inst.A = this.set2reg;
    }
    const isRK = ["..", "and", "or"].indexOf(node.operator) === -1;
    const addConst = c => {
      if (c.type === NodeType.NumericLiteral) {
        c = LuaNumber.fromNumber(c.value);
      } else if (c.type === NodeType.StringLiteral) {
        c = LuaString.fromString(c.value);
      }
      this.fnState.addConst(c);
      return kstIdxToRK(this.fnState.const2idx(c));
    };
    const lhs = node.left;
    const rhs = node.right;
    if (
      isRK &&
      (lhs.type === NodeType.NumericLiteral ||
        lhs.type === NodeType.StringLiteral)
    ) {
      inst.B = addConst(lhs);
    } else {
      this.fnState.pushSet2reg(this.fnState.usableReg);
      this.visitExpr(lhs);
      inst.B = this.fnState.set2reg;
      this.fnState.popSet2reg();
    }
    if (
      isRK &&
      (rhs.type === NodeType.NumericLiteral ||
        rhs.type === NodeType.StringLiteral)
    ) {
      inst.C = addConst(rhs);
    } else {
      this.fnState.pushSet2reg(this.fnState.usableReg);
      this.visitExpr(rhs);
      inst.C = this.fnState.set2reg;
      this.fnState.popSet2reg();
    }
    this.fnState.appendInst(inst);

    if (isCmp && this.fnState.getRetNum() === 1) {
      const jmp = new LuaInstruction();
      jmp.opcode = OpCode.JMP;
      jmp.A = 0;
      jmp.sBx = 1;
      this.fnState.appendInst(jmp);

      const tv = new LuaInstruction();
      tv.opcode = OpCode.LOADBOO;
      tv.A = this.set2reg;
      tv.B = 0;
      tv.C = 1;
      this.fnState.appendInst(tv);

      const fv = new LuaInstruction();
      fv.opcode = OpCode.LOADBOO;
      fv.A = this.set2reg;
      fv.B = 1;
      fv.C = 0;
      this.fnState.appendInst(fv);
    }

    if (isLogic && this.fnState.getRetNum() === 1) {
      const set2reg = this.set2reg;
      const ts = new LuaInstruction();
      ts.opcode = OpCode.TESTSET;
      ts.A = set2reg;
      ts.B = inst.B;
      ts.C = node.operator === "and" ? 0 : 1;
      this.fnState.appendInst(ts);

      const jmp = new LuaInstruction();
      jmp.opcode = OpCode.JMP;
      jmp.A = 0;
      jmp.sBx = 1;
      this.fnState.appendInst(jmp);

      const move = new LuaInstruction();
      move.opcode = OpCode.MOVE;
      move.A = set2reg;
      move.B = inst.C;
      this.fnState.appendInst(move);
    }
  }

  visitUnaryExpr(node) {
    switch (node.operator) {
      case "-":
      case "not":
      case "#": {
        const inst = new LuaInstruction();
        inst.opcode = unaryop2opcode[node.operator];
        inst.A = this.set2reg;
        const set2reg = this.fnState.nextReg;
        this.fnState.pushSet2reg(set2reg);
        this.visitExpr(node.argument);
        this.fnState.popSet2reg();
        inst.B = set2reg;
        this.fnState.appendInst(inst);
        break;
      }
    }
  }

  visitStringLiteral(node) {
    const c = LuaString.fromString(node.value);
    this.fnState.addConst(c);
    const inst = new LuaInstruction();
    inst.opcode = OpCode.LOADK;
    inst.A = this.set2reg;
    inst.Bx = this.fnState.const2idx(c);
    this.fnState.appendInst(inst);
  }

  visitNilLiteral(node) {
    const inst = new LuaInstruction();
    inst.A = this.set2reg;
    inst.opcode = OpCode.LOADNI;
    inst.B = 0;
    this.fnState.appendInst(inst);
  }

  visitNumberLiteral(node) {
    const c = LuaNumber.fromNumber(node.value);
    this.fnState.addConst(c);
    const inst = new LuaInstruction();
    inst.opcode = OpCode.LOADK;
    inst.A = this.set2reg;
    inst.Bx = this.fnState.const2idx(c);
    this.fnState.appendInst(inst);
  }

  visitBooleanLiteral(node) {
    const inst = new LuaInstruction();
    inst.opcode = OpCode.LOADBOO;
    inst.A = this.set2reg;
    inst.B = node.value === "true" ? 1 : 0;
    inst.C = 0;
    this.fnState.appendInst(inst);
  }

  visitIdentifier(node) {
    const name = node.name;
    if (this.fnState.hasLocal(name)) {
      const inst = new LuaInstruction();
      inst.opcode = OpCode.MOVE;
      inst.A = this.set2reg;
      inst.B = this.fnState.local2reg(name);
      this.fnState.appendInst(inst);
    } else {
      const foundUpvalue = this.fnState.addUpvalue(name);
      if (foundUpvalue) {
        const inst = new LuaInstruction();
        inst.opcode = OpCode.GETUPVAL;
        inst.A = this.set2reg;
        inst.B = this.fnState.getUpvalue(name).idx;
        this.fnState.appendInst(inst);
      } else {
        this.fnState.addUpvalue("_ENV");
        const c = LuaString.fromString(name);
        this.fnState.addConst(c);
        const inst = new LuaInstruction();
        inst.opcode = OpCode.GETTABUP;
        inst.A = this.set2reg;
        inst.B = 0;
        inst.C = kstIdxToRK(this.fnState.const2idx(c));
        this.fnState.appendInst(inst);
      }
    }
  }
}
