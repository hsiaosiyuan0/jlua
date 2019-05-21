import { Lexer, Source } from "../lexer";
import { Parser } from "../parser";
import { JsCodegen } from "./code";
import generate from "@babel/generator";

/**
 * @this {webpack.loader.LoaderContext}
 * @param source
 */
export default function(source) {
  const src = new Source(source, this.resourcePath);
  const lexer = new Lexer(src);
  const parser = new Parser(lexer);
  const chk = parser.parseChunk();
  const gen = new JsCodegen();
  const out = gen.visitChunk(chk);
  const { code, map } = generate(
    out,
    { sourceMaps: true, sourceFileName: this.resourcePath },
    {
      [this.resourcePath]: source
    }
  );
  this.callback(null, code, map);
}
