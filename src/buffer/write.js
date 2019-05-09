import os from "os";
import {
  kSizeofUInt16,
  kSizeofUInt32,
  kSizeofUInt64,
  kSizeofUInt8
} from "./size";
import long from "long";

export class BufferWriter {
  constructor(cap = 512) {
    this.cap = cap;
    this.wb = Buffer.alloc(cap);
    this.len = 0;
    this.endian = os.endianness();
  }

  guard(len2write) {
    if (this.len + len2write > this.cap) {
      this.cap = (this.len + len2write) * 2;
      this.wb = Buffer.alloc(this.cap, this.wb);
    }
  }

  write(b) {
    this.guard(b.length);
    for (let i = 0, len = b.length; i < len; ++i) {
      this.wb.writeUInt8(b.readUInt8(i), this.len);
      this.len += kSizeofUInt8;
    }
  }

  writeInt8(n) {
    this.guard(kSizeofUInt8);
    this.wb.writeInt8(n, this.len);
    this.len += kSizeofUInt8;
  }

  writeInt16BE(n) {
    this.guard(kSizeofUInt16);
    this.wb.writeInt16BE(n, this.len);
    this.len += kSizeofUInt16;
  }

  writeInt32BE(n) {
    this.guard(kSizeofUInt32);
    this.wb.writeInt32BE(n, this.len);
    this.len += kSizeofUInt32;
  }

  writeUInt8(n) {
    this.guard(kSizeofUInt8);
    this.wb.writeUInt8(n, this.len);
    this.len += kSizeofUInt8;
  }

  writeUInt16BE(n) {
    this.guard(kSizeofUInt16);
    this.wb.writeUInt16BE(n, this.len);
    this.len += kSizeofUInt16;
  }

  writeUInt32BE(n) {
    this.guard(kSizeofUInt32);
    this.wb.writeUInt32BE(n, this.len);
    this.len += kSizeofUInt32;
  }

  writeInt16LE(n) {
    this.guard(kSizeofUInt16);
    this.wb.writeInt16LE(n, this.len);
    this.len += kSizeofUInt16;
  }

  writeInt32LE(n) {
    this.guard(kSizeofUInt16);
    this.wb.writeInt32LE(n, this.len);
    this.len += kSizeofUInt32;
  }

  writeUInt16LE(n) {
    this.guard(kSizeofUInt16);
    this.wb.writeUInt16LE(n, this.len);
    this.len += kSizeofUInt16;
  }

  writeUInt32LE(n) {
    this.guard(kSizeofUInt16);
    this.wb.writeUInt32LE(n, this.len);
    this.len += kSizeofUInt32;
  }

  writeInt16(n) {
    this.guard(kSizeofUInt16);
    if (this.endian === "BE") this.writeInt16BE(n);
    else this.writeInt16LE(n);
  }

  writeInt32(n) {
    this.guard(kSizeofUInt32);
    if (this.endian === "BE") this.writeInt32BE(n);
    else this.writeInt32LE(n);
  }

  writeUInt16(n) {
    this.guard(kSizeofUInt16);
    if (this.endian === "BE") this.writeUInt16BE(n);
    else this.writeUInt16LE(n);
  }

  writeUInt32(n) {
    this.guard(kSizeofUInt32);
    if (this.endian === "BE") this.writeUInt32BE(n);
    else this.writeUInt32LE(n);
  }

  /**
   *
   * @param n {!Long}
   */
  writeUInt64(n) {
    this.guard(kSizeofUInt64);
    n = n.toUnsigned();
    this.writeInt64(n);
  }

  writeInt64(n) {
    this.guard(kSizeofUInt64);
    n = long.isLong(n) ? n : long.fromNumber(n);
    this.guard(kSizeofUInt64);
    const bs = this.endian === "BE" ? n.toBytesBE() : n.toBytesLE();
    for (let i = 0; i < kSizeofUInt64; i++) this.writeUInt8(bs[i]);
  }

  writeDoubleBE(n) {
    this.guard(kSizeofUInt64);
    this.guard(kSizeofUInt64);
    this.wb.writeDoubleBE(n, this.len);
    this.len += kSizeofUInt64;
  }

  writeDoubleLE(n) {
    this.guard(kSizeofUInt64);
    this.guard(kSizeofUInt64);
    this.wb.writeDoubleLE(n, this.len);
    this.len += kSizeofUInt64;
  }

  writeDouble(n) {
    this.guard(kSizeofUInt64);
    if (this.endian === "BE") this.writeDoubleBE(n);
    else this.writeDoubleLE(n);
  }
}
