import path from "path";
import webpack from "webpack";
import memoryfs from "memory-fs";

const compile = (fixture, options = {}) => {
  const compiler = webpack({
    context: __dirname,
    devtool: "inline-source-map",
    entry: `./${fixture}`,
    output: {
      path: path.resolve(__dirname),
      filename: "bundle.js"
    },
    module: {
      rules: [
        {
          test: /\.lua$/,
          use: {
            loader: path.resolve(__dirname, "../src/js/loader.js")
          }
        }
      ]
    },
    plugins: [new webpack.IgnorePlugin(/jlua\/lib\/js\/runtime/)]
  });

  compiler.outputFileSystem = new memoryfs();

  return new Promise((resolve, reject) => {
    compiler.run((err, stats) => {
      if (err) reject(err);
      if (stats.hasErrors()) reject(new Error(stats.toJson().errors));

      resolve(stats);
    });
  });
};

test("Inserts name and outputs JavaScript", async () => {
  const stats = await compile("test.lua");
  const output = stats.toJson().modules[0].source;

  console.log(output);
  expect(output).toBe(`const __jlua__ = require("jlua/lib/js/runtime");

let a = 1;`
  );
});
