import { ForwardBuffer } from "../buffer";
import assert from "assert";
import long from "long";
import {
  Chunk,
  ChunkHeader,
  kLuacData,
  kLuacInt,
  kLuacNum,
  kLuaMaxShortStrLen,
  LuaBoolean,
  LuaFunction,
  LuaInstruction,
  LuaLocalVar,
  LuaNil,
  LuaNumber,
  LuaString,
  LuaType,
  LuaUpvalue
} from "./chunk";
import { loop } from "../util";

export class Undumper {
  /**
   *
   * @param buf {ForwardBuffer}
   */
  constructor(buf) {
    this.buf = buf;
    this.chunk = new Chunk();
    this.header = this.chunk.header;
  }

  process() {
    this.loadHeader();
    this.chunk.upvalueCnt = this.buf.readUInt8();
    this.loadTopFn();
    return this.chunk;
  }

  loadHeader() {
    const header = new ChunkHeader();
    header.sig = this.buf.forward(4);
    assert.ok(header.sig.equals(Buffer.from("1b4c7561", "hex")));

    header.version = this.buf.readUInt8();
    header.format = this.buf.readUInt8();

    header.luacData = this.buf.forward(6);
    assert.ok(header.luacData.equals(kLuacData), "mismatch luac_data");

    header.intSize = this.buf.readUInt8();
    let ok = header.intSize === 4;
    assert.ok(ok, "unsupported int_size");

    header.sizetSize = this.buf.readUInt8();
    ok = header.sizetSize === 4 || header.sizetSize === 8;
    assert.ok(ok, "unsupported size_t_size");

    header.instSize = this.buf.readUInt8();
    assert.ok(header.instSize === 4, "unsupported inst_size");

    header.luaIntSize = this.buf.readUInt8();
    ok = header.luaIntSize === 4 || header.sizetSize === 8;
    assert.ok(ok, "unsupported lua_int_size");

    header.luaNumSize = this.buf.readUInt8();
    assert.ok(header.luaNumSize === 8, "unsupported lua_num_size");

    this.chunk.header = header;
    this.header = header;
    header.luacInt = this.loadLuaInt();
    assert.ok(header.luacInt.eq(kLuacInt), "mismatch luac_int");
    header.luacNum = this.loadLuaNum();
    assert.ok(header.luacNum === kLuacNum, "mismatch luac_num");
  }

  loadInt() {
    if (this.header.intSize === 4) return long.fromNumber(this.buf.readInt32());
    return this.buf.readInt64();
  }

  loadSizet() {
    if (this.header.sizetSize === 4)
      return long.fromNumber(this.buf.readInt32());
    return this.buf.readInt64();
  }

  loadLuaInt() {
    if (this.header.luaIntSize === 4)
      return long.fromNumber(this.buf.readInt32());
    return this.buf.readInt64();
  }

  loadLuaNum() {
    return this.buf.readDouble();
  }

  loadLuaString() {
    let size = long.fromNumber(this.buf.readUInt8());
    if (size === 0xff) size = this.loadSizet();
    const str = new LuaString(size, null);
    if (size.eq(0)) return str;
    else if (size.le(kLuaMaxShortStrLen))
      str.raw = this.buf.forward(size.sub(1));
    else str.raw = this.buf.forward(size);
    return str;
  }

  loadTopFn() {
    this.chunk.topFn = this.loadFunction();
  }

  loadFunction(src) {
    const fn = new LuaFunction();
    fn.src = this.loadLuaString();
    if (fn.src.size === 0) fn.src = src;
    fn.line = this.loadInt();
    fn.lastLine = this.loadInt();
    fn.paramCnt = this.buf.readUInt8();
    fn.isVararg = this.buf.readUInt8();
    fn.maxStackSize = this.buf.readUInt8();
    fn.code = this.loadCode();
    fn.consts = this.loadConstants();
    fn.upvalues = this.loadUpvalues();
    this.loadProtos(fn);
    this.loadDebug(fn);
    return fn;
  }

  loadCode() {
    const code = [];
    const n = this.loadInt();
    loop(() => {
      code.push(new LuaInstruction(this.loadInt()));
    }, n);
    return code;
  }

  loadLuaBoolean() {
    return new LuaBoolean(this.buf.readUInt8() === 1);
  }

  loadLuaNumber(isInt = true) {
    return new LuaNumber(isInt, this.buf.forward(this.header.luaIntSize));
  }

  loadConstants() {
    const cs = [];
    const n = this.loadInt();
    loop(() => {
      const t = this.buf.readUInt8();
      switch (t) {
        case LuaType.Nil: {
          cs.push(new LuaNil());
          break;
        }
        case LuaType.Boolean: {
          cs.push(this.loadLuaBoolean());
          break;
        }
        case LuaType.NumFlt: {
          cs.push(this.loadLuaNumber(false));
          break;
        }
        case LuaType.NumInt: {
          cs.push(this.loadLuaNumber());
          break;
        }
        case LuaType.StrShr:
        case LuaType.StrLng: {
          cs.push(this.loadLuaString());
          break;
        }
        default:
          throw new Error("unsupported lua type: " + t);
      }
    }, n);
    return cs;
  }

  loadUpvalues() {
    const vs = [];
    const n = this.loadInt();
    loop(() => {
      const v = new LuaUpvalue();
      v.inStack = this.buf.readUInt8();
      v.idx = this.buf.readUInt8();
      vs.push(v);
    }, n);
    return vs;
  }

  /**
   *
   * @param fn {LuaFunction}
   */
  loadProtos(fn) {
    const n = this.loadInt();
    loop(() => {
      fn.protos.push(this.loadFunction(fn.src));
    }, n);
  }

  /**
   *
   * @param fn {LuaFunction}
   */
  loadDebug(fn) {
    let n = this.loadInt();
    loop(() => {
      fn.lines.push(this.loadInt());
    }, n);

    n = this.loadInt();
    loop(() => {
      const lv = new LuaLocalVar();
      lv.name = this.loadLuaString();
      lv.startPC = this.loadInt();
      lv.endPC = this.loadInt();
      fn.locals.push(lv);
    }, n);

    n = this.loadInt();
    loop(i => {
      fn.upvalues[i].name = this.loadLuaString();
    }, n);
  }
}
