# jlua

Yet another Lua implementation in pure JavaScript. It encapsulates:

* Frontend infrastructure like `Lexer` and `Parser` to generate AST
* Some subclasses of `AstVisitors` like `YamlVisitor` and `Codegen` generate YAML reflects the AST and
 bytecode for LuaVM, respectively
* Particularly, `JsCodegen` translates Lua to JavaScript for running Lua on JavaScript runtime directly, [more](https://github.com/hsiaosiyuan0/jlua/issues/4)

Here is a [demo](http://jlua.hsiaosiyuan.com) naturally built with jlua and [Vue.js](https://vuejs.org/), in other words we can use Lua within Single File Component, for example:
 
 ```vue
<template>
  <div>hi {{ lang }}</div>
</template>

<script lang="lua">
local m = {
  data = function () 
    return {
      lang = "Lua"
    }
  end
}
return m
</script>
```

here is the [source](https://github.com/hsiaosiyuan0/jlua-demo) of the demo.
