import long from "long";
import * as os from "os";

export const kLuaMaxShortStrLen = 40;

export const kLuacData = Buffer.from("19930d0a1a0a", "hex");
// int for check the endianness of lua int
export const kLuacInt = 0x5678;
// double for check the endianness of lua num
export const kLuacNum = 370.5;

export class LuaConstant {}

export class LuaString extends LuaConstant {
  /**
   *
   * @param size {!Long}
   * @param raw {Buffer}
   */
  constructor(size, raw) {
    super();
    this.size = size;
    this.raw = raw;
  }

  toString() {
    if (this.size === 0) return null;
    return this.raw.toString();
  }
}

export class LuaNumber extends LuaConstant {
  /**
   *
   * @param isInt {boolean}
   * @param raw {Buffer}
   */
  constructor(isInt, raw) {
    super();
    this.isInt = isInt;
    this.raw = raw;
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
  /** @type LuaString */
  name = null;
  inStack = 0;
  idx = 0;
}

export class LuaLocalVar {
  /** @type LuaString */
  name = null;
  startPC = long.ZERO;
  endPC = long.ZERO;
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
  locals = [];
}

export class LuaInstruction {
  /**
   *
   * @param raw {number}
   */
  constructor(raw) {
    this.raw = raw;
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
DefaultChunkHeader.sig = Buffer.from("1b4c7561", "hex");
DefaultChunkHeader.version = 53;
DefaultChunkHeader.format = 0;
DefaultChunkHeader.luacData = kLuacData;
DefaultChunkHeader.intSize = archWordSize(os.arch()) === 32 ? 4 : 8;
DefaultChunkHeader.sizetSize = DefaultChunkHeader.intSize;
DefaultChunkHeader.instSize = 4;
DefaultChunkHeader.luaIntSize = DefaultChunkHeader.intSize;
DefaultChunkHeader.luaNumSize = 8;
DefaultChunkHeader.luacInt = kLuacInt;
DefaultChunkHeader.luacNum = kLuacNum;
ChunkHeader.default = DefaultChunkHeader;

export class Chunk {
  header = new ChunkHeader();
  upvalueCnt = 0;
  topFn = new LuaFunction();
}
