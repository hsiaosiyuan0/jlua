import { Undumper } from "../src/asm";
import { ForwardBuffer } from "../src/buffer";
import { Dumper } from "../src/asm/dump";

test("dump", () => {
  const asm =
    "1b4c7561530019930d0a1a0a040804080878560000000000000000000000287740010a40746573742e6c7561000000000000000000010305000000010000004640400080000000644000012600800002000000040c68656c6c6f20776f726c6404067072696e7401000000010000000000050000000100000002000000020000000200000002000000010000000261010000000500000001000000055f454e56";
  const undumper = new Undumper(new ForwardBuffer(Buffer.from(asm, "hex")));
  const chunk = undumper.process();
  const dumper = new Dumper(chunk);
  const out = dumper
    .process()
    .toBytes()
    .toString("hex");
  expect(out).toBe(asm);
});
