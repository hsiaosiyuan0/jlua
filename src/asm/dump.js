import { BufferWriter } from "../buffer";
import long from "long";
import {
  Chunk,
  ChunkHeader,
  kLuaMaxShortStrLen,
  LuaBoolean,
  LuaFunction,
  LuaNil,
  LuaNumber,
  LuaString,
  LuaType
} from "./chunk";
import fs from "fs";
import util from "util";

const write = util.promisify(fs.writeFile);

export class Dumper {
  /**
   *
   * @param chunk {Chunk}
   * @param useDefaultHeader
   */
  constructor(chunk, useDefaultHeader = false) {
    this.chunk = chunk;
    if (useDefaultHeader) this.header = ChunkHeader.default;
    else this.header = chunk.header;
    this.wb = new BufferWriter();
  }

  writeByte(n) {
    this.wb.writeUInt8(n);
  }

  writeInt(n) {
    if (this.header.intSize === 4) {
      if (long.isLong(n)) n = n.toNumber();
      this.wb.writeInt32(n);
    } else this.wb.writeInt64(n);
  }

  writeSizet(n) {
    if (this.header.sizetSize === 4) {
      if (long.isLong(n)) n = n.toNumber();
      this.wb.writeInt32(n);
    } else this.wb.writeInt64(n);
  }

  writeLuaInt(n) {
    if (this.header.luaIntSize === 4) {
      if (long.isLong(n)) n = n.toNumber();
      this.wb.writeInt32(n);
    } else this.wb.writeInt64(n);
  }

  writeLuaNum(n) {
    this.wb.writeDouble(n);
  }

  /**
   *
   * @param s {LuaString}
   */
  writeLuaString(s) {
    if (s.size.le(kLuaMaxShortStrLen)) {
      this.wb.writeUInt8(s.size.toNumber());
    } else {
      this.wb.writeUInt8(0xff);
      this.wb.writeSizet(s.size);
    }
    this.wb.write(s.raw);
  }

  process() {
    this.writeHeader();
    this.writeByte(this.chunk.topFn.upvalues.length);
    this.writeFunction(this.chunk.topFn);
    return this;
  }

  /**
   *
   * @returns {Buffer}
   */
  toBytes() {
    return this.wb.wb.slice(0, this.wb.len);
  }

  writeHeader() {
    const h = this.header;
    this.wb.write(h.sig);
    this.writeByte(h.version);
    this.writeByte(h.format);
    this.wb.write(h.luacData);
    this.writeByte(h.intSize);
    this.writeByte(h.sizetSize);
    this.writeByte(h.instSize);
    this.writeByte(h.luaIntSize);
    this.writeByte(h.luaNumSize);
    this.writeLuaInt(h.luacInt);
    this.writeLuaNum(h.luacNum);
  }

  /**
   *
   * @param f {LuaFunction}
   */
  writeFunction(f) {
    this.writeLuaString(f.src);
    this.writeInt(f.line);
    this.writeInt(f.lastLine);
    this.writeByte(f.paramCnt);
    this.writeByte(f.isVararg);
    this.writeByte(f.maxStackSize);
    this.writeCode(f);
    this.writeConsts(f);
    this.writeUpvalues(f);
    this.writeProtos(f);
    this.writeDebug(f);
  }

  /**
   *
   * @param f {LuaFunction}
   */
  writeCode(f) {
    const code = f.code;
    this.writeInt(code.length);
    code.forEach(i => this.writeInt(i.raw));
  }

  /**
   *
   * @param f {LuaFunction}
   */
  writeConsts(f) {
    const consts = f.consts;
    this.writeInt(consts.length);
    consts.forEach(c => {
      if (c instanceof LuaNil) {
        this.writeByte(LuaType.Nil);
      } else if (c instanceof LuaBoolean) {
        this.writeByte(LuaType.Boolean);
        this.writeByte(c.value ? 1 : 0);
      } else if (c instanceof LuaNumber) {
        if (c.isInt) {
          this.writeByte(LuaType.NumInt);
          this.writeLuaInt(c.raw);
        } else {
          this.writeByte(LuaType.NumFlt);
          this.writeLuaNum(c.raw);
        }
      } else if (c instanceof LuaString) {
        if (c.size <= kLuaMaxShortStrLen) this.writeByte(LuaType.StrShr);
        else this.writeByte(LuaType.StrLng);

        this.writeLuaString(c);
      } else {
        throw new Error("unsupported lua type: " + c);
      }
    });
  }

  /**
   *
   * @param f {LuaFunction}
   */
  writeUpvalues(f) {
    const vs = f.upvalues;
    this.writeInt(vs.length);
    vs.forEach(v => {
      this.writeByte(v.inStack);
      this.writeByte(v.idx);
    });
  }

  /**
   *
   * @param f {LuaFunction}
   */
  writeProtos(f) {
    const ps = f.protos;
    this.writeInt(ps.length);
    ps.forEach(p => this.writeFunction(p));
  }

  /**
   *
   * @param f {LuaFunction}
   */
  writeDebug(f) {
    const ls = f.lines;
    this.writeInt(ls.length);
    ls.forEach(l => this.writeInt(l));

    const lvs = f.locals;
    this.writeInt(lvs.length);
    lvs.forEach(lv => {
      this.writeLuaString(lv.name);
      this.writeInt(lv.startPC);
      this.writeInt(lv.endPC);
    });

    const uvs = f.upvalues;
    this.writeInt(uvs.length);
    uvs.forEach(uv => this.writeLuaString(uv.name));
  }

  async saveAs(file) {
    await write(file, this.toBytes());
  }
}
