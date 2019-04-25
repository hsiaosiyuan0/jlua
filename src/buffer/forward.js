import {
  kSizeofUInt16,
  kSizeofUInt32,
  kSizeofUInt64,
  kSizeofUInt8
} from "./size";
import os from "os";
import long from "long";
import { assertSafeNum } from "../util";

export class ForwardBuffer {
  /**
   *
   * @param buf {Buffer}
   * @param offset {number}
   */
  constructor(buf, offset = 0) {
    this.buf = buf;
    this.ofst = offset;
    this.endian = os.endianness();
  }

  readUInt8() {
    const n = this.buf.readUInt8(this.ofst);
    this.ofst += kSizeofUInt8;
    return n;
  }

  readUInt16BE() {
    const n = this.buf.readUInt16BE(this.ofst);
    this.ofst += kSizeofUInt16;
    return n;
  }

  readUInt32BE() {
    const n = this.buf.readUInt32BE(this.ofst);
    this.ofst += kSizeofUInt32;
    return n;
  }

  readUInt16LE() {
    const n = this.buf.readUInt16LE(this.ofst);
    this.ofst += kSizeofUInt16;
    return n;
  }

  readUInt32LE() {
    const n = this.buf.readUInt32LE(this.ofst);
    this.ofst += kSizeofUInt32;
    return n;
  }

  readInt8() {
    const n = this.buf.readInt8(this.ofst);
    this.ofst += kSizeofUInt8;
    return n;
  }

  readInt16BE() {
    const n = this.buf.readInt16BE(this.ofst);
    this.ofst += kSizeofUInt16;
    return n;
  }

  readInt32BE() {
    const n = this.buf.readInt32BE(this.ofst);
    this.ofst += kSizeofUInt32;
    return n;
  }

  readInt16LE() {
    const n = this.buf.readInt16LE(this.ofst);
    this.ofst += kSizeofUInt16;
    return n;
  }

  readInt32LE() {
    const n = this.buf.readInt32LE(this.ofst);
    this.ofst += kSizeofUInt32;
    return n;
  }

  readDoubleBE() {
    const n = this.buf.readDoubleBE(this.ofst);
    this.ofst += kSizeofUInt64;
    return n;
  }

  readDoubleLE() {
    const n = this.buf.readDoubleLE(this.ofst);
    this.ofst += kSizeofUInt64;
    return n;
  }

  readUInt16() {
    if (this.endian === "BE") return this.readUInt16BE();
    return this.readUInt16LE();
  }

  readUInt32() {
    if (this.endian === "BE") return this.readUInt32BE();
    return this.readUInt32LE();
  }

  readUInt64() {
    const raw = this.forward(8, true).buf;
    if (this.endian === "BE") return long.fromBytesBE(raw, true);
    return long.fromBytesLE(raw, true);
  }

  readInt16() {
    if (this.endian === "BE") return this.readInt16BE();
    return this.readInt16LE();
  }

  readInt32() {
    if (this.endian === "BE") return this.readInt32BE();
    return this.readInt32LE();
  }

  readInt64() {
    const raw = this.forward(8, true).buf;
    if (this.endian === "BE") return long.fromBytesBE(raw, false);
    return long.fromBytesLE(raw, false);
  }

  readDouble() {
    if (this.endian === "BE") return this.readDoubleBE();
    return this.readDoubleLE();
  }

  forward(cnt, wrap = false) {
    cnt = assertSafeNum(cnt);
    // does not use a Buffer.slice here
    // since we need a boundary check
    const r = Buffer.alloc(cnt);
    for (let i = 0; i < cnt; ++i) {
      r.writeUInt8(this.readUInt8(), i);
    }
    if (wrap) return new ForwardBuffer(r, 0);
    return r;
  }

  advance(cnt) {
    cnt = ForwardBuffer.assertSafeNum(cnt);
    this.ofst += cnt;
  }

  branch(offset = 0) {
    offset = ForwardBuffer.assertSafeNum(offset);
    return new ForwardBuffer(this.buf, offset);
  }
}
