import long from "long";
import * as os from "os";
import { BufferWriter } from "../buffer";

export const kLuaMaxShortStrLen = 40;

export const kLuacData = Buffer.from("19930d0a1a0a", "hex");
// int for check the endianness of lua int
export const kLuacInt = 0x5678;
// double for check the endianness of lua num
export const kLuacNum = 370.5;

export class LuaConstantType {
  static String = 0;
  static Number = 1;
}

export class LuaConstant {
  constructor(type) {
    this.type = type;
  }

  /**
   * @return {Boolean}
   */
  equals(x) {
    throw new Error("method not implemented");
  }
}

export class LuaString extends LuaConstant {
  /**
   *
   * @param size {!Long}
   * @param raw {Buffer}
   */
  constructor(size, raw) {
    super(LuaConstantType.String);
    this.size = size;
    this.raw = raw;
  }

  toString() {
    if (this.size === 0) return null;
    return this.raw.toString();
  }

  static fromString(s) {
    const raw = Buffer.from(s, "utf8");
    let len = raw.length + 1;
    len = len <= kLuaMaxShortStrLen ? len : len - 1;
    return new LuaString(long.fromNumber(len), raw);
  }

  equals(s) {
    if (typeof s === "string") return this.raw.equals(Buffer.from(s, "utf8"));
    return this.raw.equals(s.raw);
  }
}

export class LuaNumber extends LuaConstant {
  /**
   *
   * @param isInt {boolean}
   * @param raw {Buffer}
   */
  constructor(isInt, raw) {
    super(LuaConstantType.Number);
    this.isInt = isInt;
    this.raw = raw;
  }

  equals(n) {
    return this.raw.equals(n.raw);
  }

  static fromNumber(n) {
    if (typeof n === "string") n = parseFloat(n);
    const size = ChunkHeader.default.luaNumSize;
    const buf = new BufferWriter(size);
    const isInt = Number.isInteger(n);
    if (isInt) {
      if (size === 4) buf.writeInt32(n);
      else buf.writeInt64(n);
    } else buf.writeDouble(n);
    return new LuaNumber(isInt, buf.wb);
  }
}

export class LuaNil extends LuaConstant {}

export class LuaBoolean extends LuaConstant {
  constructor(v) {
    super();
    this.value = v;
  }
}

export class LuaType {
  static Nil = 0;
  static Boolean = 1;
  static LightUserData = 2;
  static Number = 3;
  static String = 4;
  static Table = 5;
  static Function = 6;
  static UserData = 7;

  static StrShr = LuaType.String | (0 << 4);
  static StrLng = LuaType.String | (1 << 4);

  static NumFlt = LuaType.Number | (0 << 4);
  static NumInt = LuaType.Number | (1 << 4);
}

export class LuaUpvalue {
  /**
   *
   * @param name {LuaString}
   * @param inStack
   * @param idx
   */
  constructor(name = null, inStack = 0, idx = 0) {
    this.name = name;
    this.inStack = inStack;
    this.idx = idx;
  }
}

export class LuaLocalVar {
  /**
   *
   * @param name {LuaString}
   * @param startPC
   * @param endPC
   */
  constructor(name, startPC = long.ZERO, endPC = long.ZERO) {
    this.name = name;
    this.startPC = startPC;
    this.endPC = endPC;
  }
}

export class LuaFunction {
  /** @type LuaString */
  src = null;
  line = 0;
  lastLine = 0;
  paramCnt = 0;
  isVararg = 0;
  maxStackSize = 0;
  /** @type {Array<LuaInstruction>} */
  code = [];
  /** @type {Array<LuaConstant>} */
  consts = [];
  /** @type {Array<LuaUpvalue>} */
  upvalues = [];
  /** @type {Array<LuaFunction>} */
  protos = [];
  lines = [];
  /** @type {Array<LuaLocalVar>}  */
  locals = [];
}

export class LuaInstruction {
  /**
   *
   * @param raw {number}
   */
  constructor(raw = 0) {
    this.raw = raw;
  }

  get opcode() {
    return this.raw & 0x3f;
  }

  get A() {
    return (this.raw >> 6) & 0xff;
  }

  get B() {
    return (this.raw >> 14) & 0x3ffff;
  }

  get C() {
    return (this.raw >> 14) & 0x1ff;
  }

  get Bx() {
    return (this.raw >> 14) & 0x3ffff;
  }

  get sBx() {
    return ((this.raw >> 14) & 0x3ffff) - 131071;
  }

  set opcode(c) {
    c = c instanceof OpCode ? c.v : c;
    this.raw = (this.raw & ~0x3f) | c;
  }

  set A(a) {
    this.raw = (this.raw & ~(0xff << 6)) | (a << 6);
  }

  set C(b) {
    this.raw = (this.raw & ~(0x1ff << 14)) | (b << 14);
  }

  set B(c) {
    this.raw = (this.raw & ~(0x1ff << 23)) | (c << 23);
  }

  set Bx(bx) {
    this.raw = (this.raw & ~(0x3ffff << 14)) | (bx << 14);
  }

  set sBx(sbx) {
    sbx += 131071;
    this.raw = (this.raw & ~(0x3ffff << 14)) | (sbx << 14);
  }
}

export class ChunkHeader {
  /** @type Buffer  */
  sig = null;
  version = 0;
  format = 0;
  /** @type Buffer  */
  luacData = null;
  intSize = 0;
  sizetSize = 0;
  instSize = 0;
  luaIntSize = 0;
  luaNumSize = 0;
  luacInt = long.ZERO;
  /** @type number  */
  luacNum = 0;
}

const archWordSize = arch => {
  switch (arch) {
    case "arm":
    case "ia32":
    case "mips":
    case "mipsel":
    case "ppc":
    case "s390":
    case "x32":
      return 32;
    case "arm64":
    case "ppc64":
    case "s390x":
    case "x64":
      return 64;
    default:
      throw new Error("unknown arch: " + arch);
  }
};

const DefaultChunkHeader = new ChunkHeader();
const osWordSize = archWordSize(os.arch()) === 32 ? 4 : 8;
DefaultChunkHeader.sig = Buffer.from("1b4c7561", "hex");
DefaultChunkHeader.version = 0x53;
DefaultChunkHeader.format = 0;
DefaultChunkHeader.luacData = kLuacData;
DefaultChunkHeader.intSize = 4;
DefaultChunkHeader.sizetSize = osWordSize;
DefaultChunkHeader.instSize = 4;
DefaultChunkHeader.luaIntSize = osWordSize;
DefaultChunkHeader.luaNumSize = 8;
DefaultChunkHeader.luacInt = kLuacInt;
DefaultChunkHeader.luacNum = kLuacNum;
ChunkHeader.default = DefaultChunkHeader;

export class Chunk {
  header = new ChunkHeader();
  upvalueCnt = 0;
  topFn = new LuaFunction();
}

const iABC = 0;
const iABx = 1;
const iAsBx = 2;
const iAx = 3;

export class OpMode {
  static iABC = iABC;
  static iABx = iABx;
  static iAsBx = iAsBx;
  static iAx = iAx;
}

export class OpCode {
  static _v = 0;

  static MOVE = new OpCode("MOVE", iABC);
  static LOADK = new OpCode("LOADK", iABx);
  static LOADKX = new OpCode("LOADKX", iABx);
  static LOADBOO = new OpCode("LOADBOO", iABC);
  static LOADNI = new OpCode("LOADNI", iABC);
  static GETUPVAL = new OpCode("GETUPVAL", iABC);
  static GETTABUP = new OpCode("GETTABUP", iABC);
  static GETTABLE = new OpCode("GETTABLE", iABC);
  static SETTABUP = new OpCode("SETTABUP", iABC);
  static SETUPVAL = new OpCode("SETUPVAL", iABC);
  static SETTABLE = new OpCode("SETTABLE", iABC);
  static NEWTABLE = new OpCode("NEWTABLE", iABC);
  static SELF = new OpCode("SELF", iABC);
  static ADD = new OpCode("ADD", iABC);
  static SUB = new OpCode("SUB", iABC);
  static MUL = new OpCode("MUL", iABC);
  static MOD = new OpCode("MOD", iABC);
  static POW = new OpCode("POW", iABC);
  static DIV = new OpCode("DIV", iABC);
  static IDIV = new OpCode("IDIV", iABC);
  static BAND = new OpCode("BAND", iABC);
  static BOR = new OpCode("BOR", iABC);
  static BXOR = new OpCode("BXOR", iABC);
  static SHL = new OpCode("SHL", iABC);
  static SHR = new OpCode("SHR", iABC);
  static UNM = new OpCode("UNM", iABC);
  static BNOT = new OpCode("BNOT", iABC);
  static NOT = new OpCode("NOT", iABC);
  static LEN = new OpCode("LEN", iABC);
  static CONCAT = new OpCode("CONCAT", iABC);
  static JMP = new OpCode("JMP", iAsBx);
  static EQ = new OpCode("EQ", iABC);
  static LT = new OpCode("LT", iABC);
  static LE = new OpCode("LE", iABC);
  static TEST = new OpCode("TEST", iABC);
  static TESTSET = new OpCode("TESTSET", iABC);
  static CALL = new OpCode("CALL", iABC);
  static TAILCALL = new OpCode("TAILCALL", iABC);
  static RETURN = new OpCode("RETURN", iABC);
  static FORLOOP = new OpCode("FORLOOP", iAsBx);
  static FORPREP = new OpCode("FORPREP", iAsBx);
  static TFORCALL = new OpCode("TFORCALL", iABC);
  static TFORLOOP = new OpCode("TFORLOOP", iAsBx);
  static SETLIST = new OpCode("SETLIST", iABC);
  static CLOSURE = new OpCode("CLOSURE", iABx);
  static VARARG = new OpCode("VARARG", iABC);
  static EXTRAARG = new OpCode("EXTRAARG", iAx);

  constructor(name, mode) {
    this.v = OpCode._v++;
    this.n = name;
    this.m = mode;
  }
}
