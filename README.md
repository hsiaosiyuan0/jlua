# jlua

Yet another Lua implementation in pure JavaScript. It encapsulates:

* Frontend infrastructure like `Lexer` and `Parser` to generate AST
* Some subclasses of `AstVisitors` like `YamlVisitor` and `Codegen` generate YAML reflects the AST and
 bytecode for LuaVM, respectively
* Particularly, `JsCodegen` translates Lua to JavaScript for running Lua on JavaScript runtime directly

This a [demo](http://jlua.hsiaosiyuan.com) and here is the [source](https://github.com/hsiaosiyuan0/jlua-demo) of it.
