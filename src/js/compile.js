import { Lexer, Source } from "../lexer";
import { Parser } from "../parser";
import { JsCodegen } from "./code";
import generate from "@babel/generator";

/**
 * @param source
 * @param file
 */
export default function(source, file) {
  const src = new Source(source, file);
  const lexer = new Lexer(src);
  const parser = new Parser(lexer);
  const chk = parser.parseChunk();
  const gen = new JsCodegen();
  const out = gen.visitChunk(chk);
  const { code, map } = generate(
    out,
    { sourceMaps: true, sourceFileName: file },
    {
      [file]: source
    }
  );
  return { code, map };
}
