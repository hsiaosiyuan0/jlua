const path = require("path");
process.env.BABEL_ENV = "client";

module.exports = {
  entry: "./src/index",
  mode: "production",
  output: {
    library: "jlua",
    path: path.resolve(__dirname, "dist"),
    filename: "jlua.bundle.js"
  },
  resolve: {
    extensions: [".js", ".json"]
  },
  module: {
    rules: [
      {
        test: /\.(js)x?$/,
        exclude: /node_modules/,
        loader: "babel-loader"
      }
    ]
  }
};
