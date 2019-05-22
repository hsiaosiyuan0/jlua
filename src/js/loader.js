import compile from "./compile";

/**
 * @this {webpack.loader.LoaderContext}
 * @param source
 */
export default function(source) {
  const { code, map } = compile(source, this.resourcePath);
  this.callback(null, code, map);
}
