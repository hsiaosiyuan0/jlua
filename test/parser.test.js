import { Lexer, Source, Parser } from "../src";
import { TestAstVisitor } from "../src/visitor";
import * as yaml from "js-yaml";

const raw = String.raw;

function parse(code, tree) {
  const src = new Source(code);
  const lexer = new Lexer(src);
  const parser = new Parser(lexer);
  const node = parser.parseChunk();
  const v = new TestAstVisitor();
  const out = v.visitChunk(node);
  test(code, () => {
    expect(yaml.dump(out).trim()).toBe(tree.trim());
  });
}

/**
 * Great thanks to @andremm, some of below tests are taken from:
 * https://github.com/andremm/lua-parser/blob/master/test.lua
 */

let code = raw`
function f(a,b,c) 
  do
    a = 1
  end
end
`;
let tree = raw`
type: Chunk
body:
  - type: FunDecStmt
    id:
      type: Id
      value: f
    params:
      - type: Id
        value: a
      - type: Id
        value: b
      - type: Id
        value: c
    body:
      - type: DoStmt
        body:
          - type: AssignStmt
            left:
              - type: Id
                value: a
            right:
              - type: Number
                value: '1'
    isLocal: false
`;
parse(code, tree);

// anonymous functions
code = raw`
local a,b,c = function () end
`;
tree = raw`
type: Chunk
body:
  - type: VarDecStmt
    nameList:
      - type: Id
        value: a
      - type: Id
        value: b
      - type: Id
        value: c
    exprList:
      - type: FunDecExpr
        id: null
        params: []
        body: []
        isLocal: false
`;
parse(code, tree);

code = raw`
local test = function ( a , b , ... ) end
`;
tree = raw`
type: Chunk
body:
  - type: VarDecStmt
    nameList:
      - type: Id
        value: test
    exprList:
      - type: FunDecExpr
        id: null
        params:
          - type: Id
            value: a
          - type: Id
            value: b
          - type: VarArg
        body: []
        isLocal: false
`;
parse(code, tree);

code = raw`
test = function (...) return ...,0 end
`;
tree = raw`
type: Chunk
body:
  - type: AssignStmt
    left:
      - type: Id
        value: test
    right:
      - type: FunDecExpr
        id: null
        params:
          - type: VarArg
        body:
          - type: ReturnStmt
            body:
              - type: VarArg
              - type: Number
                value: '0'
        isLocal: false
`;
parse(code, tree);

// arithmetic expressions
code = raw`
arithmetic = 1 - 2 * 3 + 4
`;
tree = raw`
type: Chunk
body:
  - type: AssignStmt
    left:
      - type: Id
        value: arithmetic
    right:
      - type: BinaryExpr
        op: +
        left:
          type: BinaryExpr
          op: '-'
          left:
            type: Number
            value: '1'
          right:
            type: BinaryExpr
            op: '*'
            left:
              type: Number
              value: '2'
            right:
              type: Number
              value: '3'
        right:
          type: Number
          value: '4'
        
`;
parse(code, tree);

code = raw`
pow = -3^-2^2
`;
tree = raw`
type: Chunk
body:
  - type: AssignStmt
    left:
      - type: Id
        value: pow
    right:
      - type: UnaryExpr
        op: '-'
        arg:
          type: BinaryExpr
          op: ^
          left:
            type: Number
            value: '3'
          right:
            type: UnaryExpr
            op: '-'
            arg:
              type: BinaryExpr
              op: ^
              left:
                type: Number
                value: '2'
              right:
                type: Number
                value: '2'
`;
parse(code, tree);

code = raw`
q, r, f = 3//2, 3%2, 3/2
`;
tree = raw`
type: Chunk
body:
  - type: AssignStmt
    left:
      - type: Id
        value: q
      - type: Id
        value: r
      - type: Id
        value: f
    right:
      - type: BinaryExpr
        op: //
        left:
          type: Number
          value: '3'
        right:
          type: Number
          value: '2'
      - type: BinaryExpr
        op: '%'
        left:
          type: Number
          value: '3'
        right:
          type: Number
          value: '2'
      - type: BinaryExpr
        op: /
        left:
          type: Number
          value: '3'
        right:
          type: Number
          value: '2'
`;
parse(code, tree);

// assignments
code = raw`
local i,j; j = i*j+i
`;
tree = raw`
type: Chunk
body:
  - type: VarDecStmt
    nameList:
      - type: Id
        value: i
      - type: Id
        value: j
    exprList: []
  - type: AssignStmt
    left:
      - type: Id
        value: j
    right:
      - type: BinaryExpr
        op: +
        left:
          type: BinaryExpr
          op: '*'
          left:
            type: Id
            value: i
          right:
            type: Id
            value: j
        right:
          type: Id
          value: i
`;
parse(code, tree);

code = raw`
a = f()[1]
`;
tree=raw`
type: Chunk
body:
  - type: AssignStmt
    left:
      - type: Id
        value: a
    right:
      - type: MemberExpr
        obj:
          type: CallExpr
          callee:
            type: Id
            value: f
          args: []
        prop:
          type: Number
          value: '1'
        computed: true
`;
parse(code, tree);

code = raw`
a()[1] = 1;
`;
tree = raw`
type: Chunk
body:
  - type: AssignStmt
    left:
      - type: MemberExpr
        obj:
          type: CallExpr
          callee:
            type: Id
            value: a
          args: []
        prop:
          type: Number
          value: '1'
        computed: true
    right:
      - type: Number
        value: '1'
`;
parse(code, tree);

code = raw`
i = a.f(1)
`;
tree = raw`
type: Chunk
body:
  - type: AssignStmt
    left:
      - type: Id
        value: i
    right:
      - type: CallExpr
        callee:
          type: MemberExpr
          obj:
            type: Id
            value: a
          prop:
            type: Id
            value: f
          computed: false
        args:
          - type: Number
            value: '1'
`;
parse(code, tree);

code = raw`
i = a[f(1)]
`;
tree = raw`
type: Chunk
body:
  - type: AssignStmt
    left:
      - type: Id
        value: i
    right:
      - type: MemberExpr
        obj:
          type: Id
          value: a
        prop:
          type: CallExpr
          callee:
            type: Id
            value: f
          args:
            - type: Number
              value: '1'
        computed: true
`;
parse(code, tree);

code = raw`
a[f()] = sub
`;
tree = raw`
type: Chunk
body:
  - type: AssignStmt
    left:
      - type: MemberExpr
        obj:
          type: Id
          value: a
        prop:
          type: CallExpr
          callee:
            type: Id
            value: f
          args: []
        computed: true
    right:
      - type: Id
        value: sub
`;
parse(code, tree);

code = raw`
a:b(1)._ = some_value
`;
tree = raw`
type: Chunk
body:
  - type: AssignStmt
    left:
      - type: MemberExpr
        obj:
          type: CallExpr
          callee:
            type: BinaryExpr
            op: ':'
            left:
              type: Id
              value: a
            right:
              type: Id
              value: b
          args:
            - type: Number
              value: '1'
        prop:
          type: Id
          value: _
        computed: false
    right:
      - type: Id
        value: some_value
`;
parse(code, tree);

// bitwise expressions
code = raw`
b = 1 & 0 | 1 ~ 1
`;
tree = raw`
type: Chunk
body:
  - type: AssignStmt
    left:
      - type: Id
        value: b
    right:
      - type: BinaryExpr
        op: '|'
        left:
          type: BinaryExpr
          op: '&'
          left:
            type: Number
            value: '1'
          right:
            type: Number
            value: '0'
        right:
          type: BinaryExpr
          op: '~'
          left:
            type: Number
            value: '1'
          right:
            type: Number
            value: '1'
`;
parse(code, tree);

code = raw`
b = 1 & 0 | 1 >> 1 ~ 1
`;
tree = raw`
type: Chunk
body:
  - type: AssignStmt
    left:
      - type: Id
        value: b
    right:
      - type: BinaryExpr
        op: '|'
        left:
          type: BinaryExpr
          op: '&'
          left:
            type: Number
            value: '1'
          right:
            type: Number
            value: '0'
        right:
          type: BinaryExpr
          op: '~'
          left:
            type: BinaryExpr
            op: '>>'
            left:
              type: Number
              value: '1'
            right:
              type: Number
              value: '1'
          right:
            type: Number
            value: '1'
`;
parse(code, tree);

// break
code = raw`
while 1 do
  break
end
`;
tree = raw`
type: Chunk
body:
  - type: WhileStmt
    test:
      type: Number
      value: '1'
    body:
      - type: BreakStmt
`;
parse(code, tree);

code = raw`
while 1 do
  while 1 do
    break
  end
  break
end
`;
tree = raw`
type: Chunk
body:
  - type: WhileStmt
    test:
      type: Number
      value: '1'
    body:
      - type: WhileStmt
        test:
          type: Number
          value: '1'
        body:
          - type: BreakStmt
      - type: BreakStmt
`;
parse(code, tree);

code = raw`
repeat
  if 2 > 1 then break end
until 1
`;
tree = raw`
type: Chunk
body:
  - type: RepeatStmt
    body:
      - type: IfStmt
        test:
          type: BinaryExpr
          op: '>'
          left:
            type: Number
            value: '2'
          right:
            type: Number
            value: '1'
        then:
          - type: BreakStmt
        else: null
    test:
      type: Number
      value: '1'
`;
parse(code, tree);

code = raw`
for i=1,10 do
  do
    break
    break
    return
  end
end
`;
tree = raw`
type: Chunk
body:
  - type: ForStmt
    init:
      - type: AssignExpr
        left:
          - type: Id
            value: i
        right:
          - type: Number
            value: '1'
      - type: Number
        value: '10'
      - null
    body:
      - type: DoStmt
        body:
          - type: BreakStmt
          - type: BreakStmt
          - type: ReturnStmt
            body: []
`;
parse(code, tree);

// block statements
code = raw`
do
  var = 2+2;
  return
end
`;
tree = raw`
type: Chunk
body:
  - type: DoStmt
    body:
      - type: AssignStmt
        left:
          - type: Id
            value: var
        right:
          - type: BinaryExpr
            op: +
            left:
              type: Number
              value: '2'
            right:
              type: Number
              value: '2'
      - type: ReturnStmt
        body: []
`;
parse(code, tree);

// concatenation expressions
code = raw`
concat1 = 1 .. 2^3
`;
tree = raw`
type: Chunk
body:
  - type: AssignStmt
    left:
      - type: Id
        value: concat1
    right:
      - type: BinaryExpr
        op: ..
        left:
          type: Number
          value: '1'
        right:
          type: BinaryExpr
          op: ^
          left:
            type: Number
            value: '2'
          right:
            type: Number
            value: '3'
`;
parse(code, tree);

// empty files
code = raw`
;
`;
tree = raw`
type: Chunk
body: []
`;
parse(code, tree);

// for generic
code = raw`
for k,v in pairs(t) do print (k,v) end
`;
tree = raw`
type: Chunk
body:
  - type: ForInStmt
    nameList:
      - type: Id
        value: k
      - type: Id
        value: v
    exprList:
      - type: CallExpr
        callee:
          type: Id
          value: pairs
        args:
          - type: Id
            value: t
    body:
      - type: CallStmt
        callee:
          type: Id
          value: print
        args:
          - type: Id
            value: k
          - type: Id
            value: v
`;
parse(code, tree);

// for numeric
code = raw`
for i = 1 , 10 , 2 do end
`;
tree = raw`
type: Chunk
body:
  - type: ForStmt
    init:
      - type: AssignExpr
        left:
          - type: Id
            value: i
        right:
          - type: Number
            value: '1'
      - type: Number
        value: '10'
      - type: Number
        value: '2'
    body: []
`;
parse(code, tree);

code = raw`
for i=1,10 do end
`;
tree = raw`
type: Chunk
body:
  - type: ForStmt
    init:
      - type: AssignExpr
        left:
          - type: Id
            value: i
        right:
          - type: Number
            value: '1'
      - type: Number
        value: '10'
      - null
    body: []
`;
parse(code, tree);

code = raw`
for key,value in next,t,nil do print(key,value) end
`;
tree = raw`
type: Chunk
body:
  - type: ForInStmt
    nameList:
      - type: Id
        value: key
      - type: Id
        value: value
    exprList:
      - type: Id
        value: next
      - type: Id
        value: t
      - type: Nil
    body:
      - type: CallStmt
        callee:
          type: Id
          value: print
        args:
          - type: Id
            value: key
          - type: Id
            value: value
`;
parse(code, tree);

// global functions
code = raw`
function test(a , b , ...) end
`;
tree = raw`
type: Chunk
body:
  - type: FunDecStmt
    id:
      type: Id
      value: test
    params:
      - type: Id
        value: a
      - type: Id
        value: b
      - type: VarArg
    body: []
    isLocal: false
`;
parse(code, tree);

code = raw`
function test (...) end
`;
tree = raw`
type: Chunk
body:
  - type: FunDecStmt
    id:
      type: Id
      value: test
    params:
      - type: VarArg
    body: []
    isLocal: false
`;
parse(code, tree);

code = raw`
function t.a:b() end
`;
tree = raw`
type: Chunk
body:
  - type: FunDecStmt
    id:
      type: BinaryExpr
      op: ':'
      left:
        type: MemberExpr
        obj:
          type: Id
          value: t
        prop:
          type: Id
          value: a
        computed: false
      right:
        type: Id
        value: b
    params: []
    body: []
    isLocal: false
`;
parse(code, tree);

code = raw`
function t.a() end
`;
tree = raw`
type: Chunk
body:
  - type: FunDecStmt
    id:
      type: MemberExpr
      obj:
        type: Id
        value: t
      prop:
        type: Id
        value: a
      computed: false
    params: []
    body: []
    isLocal: false
`;
parse(code, tree);

code = raw`
function testando . funcao . com : espcacos ( e, com , parametros, ... ) end
`;
tree = raw`
type: Chunk
body:
  - type: FunDecStmt
    id:
      type: BinaryExpr
      op: ':'
      left:
        type: MemberExpr
        obj:
          type: MemberExpr
          obj:
            type: Id
            value: testando
          prop:
            type: Id
            value: funcao
          computed: false
        prop:
          type: Id
          value: com
        computed: false
      right:
        type: Id
        value: espcacos
    params:
      - type: Id
        value: e
      - type: Id
        value: com
      - type: Id
        value: parametros
      - type: VarArg
    body: []
    isLocal: false
`;
parse(code, tree);

// if-else
code = raw`
if a then end
`;
tree = raw`
type: Chunk
body:
  - type: IfStmt
    test:
      type: Id
      value: a
    then: []
    else: null
`;
parse(code, tree);

code = raw`
if a then return a else return end
`;
tree = raw`
type: Chunk
body:
  - type: IfStmt
    test:
      type: Id
      value: a
    then:
      - type: ReturnStmt
        body:
          - type: Id
            value: a
    else:
      type: BlockStmt
      body:
        - type: ReturnStmt
          body: []
`;
parse(code, tree);

code = raw`
if a then
  return a
else
  local c = d
  d = d + 1
  return d
end
`;
tree = raw`
type: Chunk
body:
  - type: IfStmt
    test:
      type: Id
      value: a
    then:
      - type: ReturnStmt
        body:
          - type: Id
            value: a
    else:
      type: BlockStmt
      body:
        - type: VarDecStmt
          nameList:
            - type: Id
              value: c
          exprList:
            - type: Id
              value: d
        - type: AssignStmt
          left:
            - type: Id
              value: d
          right:
            - type: BinaryExpr
              op: +
              left:
                type: Id
                value: d
              right:
                type: Number
                value: '1'
        - type: ReturnStmt
          body:
            - type: Id
              value: d
          
`;
parse(code, tree);

code = raw`
if a then
  return a
elseif b then
  return b
elseif c then
  return c
end
`;
tree = raw`
type: Chunk
body:
  - type: IfStmt
    test:
      type: Id
      value: a
    then:
      - type: ReturnStmt
        body:
          - type: Id
            value: a
    else:
      type: IfStmt
      test:
        type: Id
        value: b
      then:
        - type: ReturnStmt
          body:
            - type: Id
              value: b
      else:
        type: IfStmt
        test:
          type: Id
          value: c
        then:
          - type: ReturnStmt
            body:
              - type: Id
                value: c
        else: null
`;
parse(code, tree);

code = raw`
if a then return a
elseif b then return
else ;
end
`;
tree = raw`
type: Chunk
body:
  - type: IfStmt
    test:
      type: Id
      value: a
    then:
      - type: ReturnStmt
        body:
          - type: Id
            value: a
    else:
      type: IfStmt
      test:
        type: Id
        value: b
      then:
        - type: ReturnStmt
          body: []
      else:
        type: BlockStmt
        body: []
`;
parse(code, tree);

code = raw`
if a then
  return
elseif c then
end
`;
tree = raw`
type: Chunk
body:
  - type: IfStmt
    test:
      type: Id
      value: a
    then:
      - type: ReturnStmt
        body: []
    else:
      type: IfStmt
      test:
        type: Id
        value: c
      then: []
      else: null
`;
parse(code, tree);

// locals
code = raw`
local a
`;
tree = raw`
type: Chunk
body:
  - type: VarDecStmt
    nameList:
      - type: Id
        value: a
    exprList: []
`;
parse(code, tree);

code = raw`
local a,b,c
`;
tree = raw`
type: Chunk
body:
  - type: VarDecStmt
    nameList:
      - type: Id
        value: a
      - type: Id
        value: b
      - type: Id
        value: c
    exprList: []
`;
parse(code, tree);

code = raw`
local a = 1 , 1 + 2, 5.1
`;
tree = raw`
type: Chunk
body:
  - type: VarDecStmt
    nameList:
      - type: Id
        value: a
    exprList:
      - type: Number
        value: '1'
      - type: BinaryExpr
        op: +
        left:
          type: Number
          value: '1'
        right:
          type: Number
          value: '2'
      - type: Number
        value: '5.1'
`;
parse(code, tree);

code = raw`
local a,b,c = 1.9
`;
tree = raw`
type: Chunk
body:
  - type: VarDecStmt
    nameList:
      - type: Id
        value: a
      - type: Id
        value: b
      - type: Id
        value: c
    exprList:
      - type: Number
        value: '1.9'
`;
parse(code, tree);

code = raw`
local function test() end
`;
tree = raw`
type: Chunk
body:
  - type: FunDecStmt
    id:
      type: Id
      value: test
    params: []
    body: []
    isLocal: true
`;
parse(code, tree);

code = raw`
local function test ( a , b , c , ... ) end
`;
tree = raw`
type: Chunk
body:
  - type: FunDecStmt
    id:
      type: Id
      value: test
    params:
      - type: Id
        value: a
      - type: Id
        value: b
      - type: Id
        value: c
      - type: VarArg
    body: []
    isLocal: true
`;
parse(code, tree);

code = raw`
local function test(...) return ... end
`;
tree = raw`
type: Chunk
body:
  - type: FunDecStmt
    id:
      type: Id
      value: test
    params:
      - type: VarArg
    body:
      - type: ReturnStmt
        body:
          - type: VarArg
    isLocal: true
`;
parse(code, tree);

// relational expressions
code = raw`
relational = 1 < 2 >= 3 == 4 ~= 5 < 6 <= 7
`;
// below tree is not equal to @andremm's result.
// it takes the precedences from https://www.lua.org/manual/5.3/manual.html#3.4.8,
// in that page precedences from top-down and left-right(maybe?) have lower to higher priorities.
// so the operator '<' should be the lowest one among the operators in above right-hand expression,
// hence becomes the top node
tree = raw`
type: Chunk
body:
  - type: AssignStmt
    left:
      - type: Id
        value: relational
    right:
      - type: BinaryExpr
        op: <
        left:
          type: BinaryExpr
          op: <
          left:
            type: Number
            value: '1'
          right:
            type: BinaryExpr
            op: '>='
            left:
              type: Number
              value: '2'
            right:
              type: BinaryExpr
              op: ~=
              left:
                type: BinaryExpr
                op: ==
                left:
                  type: Number
                  value: '3'
                right:
                  type: Number
                  value: '4'
              right:
                type: Number
                value: '5'
        right:
          type: BinaryExpr
          op: <=
          left:
            type: Number
            value: '6'
          right:
            type: Number
            value: '7'
`;
parse(code, tree);

code = raw`
repeat
  a,b,c = 1+1,2+2,3+3
  break
until a < 1
`;
tree = raw`
type: Chunk
body:
  - type: RepeatStmt
    body:
      - type: AssignStmt
        left:
          - type: Id
            value: a
          - type: Id
            value: b
          - type: Id
            value: c
        right:
          - type: BinaryExpr
            op: +
            left:
              type: Number
              value: '1'
            right:
              type: Number
              value: '1'
          - type: BinaryExpr
            op: +
            left:
              type: Number
              value: '2'
            right:
              type: Number
              value: '2'
          - type: BinaryExpr
            op: +
            left:
              type: Number
              value: '3'
            right:
              type: Number
              value: '3'
      - type: BreakStmt
    test:
      type: BinaryExpr
      op: <
      left:
        type: Id
        value: a
      right:
        type: Number
        value: '1'
`;
parse(code, tree);

// return
code = raw`
return
`;
tree = raw`
type: Chunk
body:
  - type: ReturnStmt
    body: []
`;
parse(code, tree);

code = raw`
return 1
`;
tree = raw`
type: Chunk
body:
  - type: ReturnStmt
    body:
      - type: Number
        value: '1'
`;
parse(code, tree);

code = raw`
return 1,1-2*3+4,"alo"
`;
tree = raw`
type: Chunk
body:
  - type: ReturnStmt
    body:
      - type: Number
        value: '1'
      - type: BinaryExpr
        op: +
        left:
          type: BinaryExpr
          op: '-'
          left:
            type: Number
            value: '1'
          right:
            type: BinaryExpr
            op: '*'
            left:
              type: Number
              value: '2'
            right:
              type: Number
              value: '3'
        right:
          type: Number
          value: '4'
      - type: String
        value: alo
`;
parse(code, tree);

code = raw`
return;
`;
tree = raw`
type: Chunk
body:
  - type: ReturnStmt
    body: []
`;
parse(code, tree);

code = raw`
return 1;
`;
tree = raw`
type: Chunk
body:
  - type: ReturnStmt
    body:
      - type: Number
        value: '1'
`;
parse(code, tree);

code = raw`
return 1,1-2*3+4,"alo";
`;
tree = raw`
type: Chunk
body:
  - type: ReturnStmt
    body:
      - type: Number
        value: '1'
      - type: BinaryExpr
        op: +
        left:
          type: BinaryExpr
          op: '-'
          left:
            type: Number
            value: '1'
          right:
            type: BinaryExpr
            op: '*'
            left:
              type: Number
              value: '2'
            right:
              type: Number
              value: '3'
        right:
          type: Number
          value: '4'
      - type: String
        value: alo
`;
parse(code, tree);

// tables
code = raw`
t = { [1] = "alo", alo = 1, 2; }
`;
tree = raw`

`;

code = raw`
t = { 1.5 }
`;
tree = raw`

`;

code = raw`
t = {1,2;
3,
4,
5}
`;
tree = raw`

`;

code = raw`
t = {[1]=1,[2]=2;
[3]=3,
[4]=4,
[5]=5}
`;
tree = raw`

`;

code = raw`
local t = {{{}}, {"alo"}}
`;
tree = raw`

`;

code = raw`
local x = 0
local t = {x}
`;
tree = raw`

`;

code = raw`
local x = 0
local t = {x = 1}
`;
tree = raw`

`;

code = raw`
local x = 0
local t = {x == 1}
`;
tree = raw`

`;

// vararg
code = raw`
function f (...)
  return ...
end
`;
tree = raw`
type: Chunk
body:
  - type: FunDecStmt
    id:
      type: Id
      value: f
    params:
      - type: VarArg
    body:
      - type: ReturnStmt
        body:
          - type: VarArg
    isLocal: false
`;
parse(code, tree);

code = raw`
function f ()
  function g (x, y, ...)
    return ...,...,...
  end
end
`;
tree = raw`
type: Chunk
body:
  - type: FunDecStmt
    id:
      type: Id
      value: f
    params: []
    body:
      - type: FunDecStmt
        id:
          type: Id
          value: g
        params:
          - type: Id
            value: x
          - type: Id
            value: 'y'
          - type: VarArg
        body:
          - type: ReturnStmt
            body:
              - type: VarArg
              - type: VarArg
              - type: VarArg
        isLocal: false
    isLocal: false
`;
parse(code, tree);

code = raw`
local function f (x, ...)
  return ...
end
`;
tree = raw`
type: Chunk
body:
  - type: FunDecStmt
    id:
      type: Id
      value: f
    params:
      - type: Id
        value: x
      - type: VarArg
    body:
      - type: ReturnStmt
        body:
          - type: VarArg
    isLocal: true
`;
parse(code, tree);

// while
code = raw`
i = 0
while (i < 10)
do
  i = i + 1
end
`;
tree = raw`
type: Chunk
body:
  - type: AssignStmt
    left:
      - type: Id
        value: i
    right:
      - type: Number
        value: '0'
  - type: WhileStmt
    test:
      type: BinaryExpr
      op: <
      left:
        type: Id
        value: i
      right:
        type: Number
        value: '10'
    body:
      - type: AssignStmt
        left:
          - type: Id
            value: i
        right:
          - type: BinaryExpr
            op: +
            left:
              type: Id
              value: i
            right:
              type: Number
              value: '1'
`;
parse(code, tree);

code = raw`
gl_f_ct = 0
function f()
    if gl_f_ct <= 0 then
        gl_f_ct=1
        return 1000
    end
    return -1000
end
print( f("1st call") > f("2nd call") )
gl_f_ct = 0
print( f("1st call") < f("2nd call") )
`;
tree = raw`
type: Chunk
body:
  - type: AssignStmt
    left:
      - type: Id
        value: gl_f_ct
    right:
      - type: Number
        value: '0'
  - type: FunDecStmt
    id:
      type: Id
      value: f
    params: []
    body:
      - type: IfStmt
        test:
          type: BinaryExpr
          op: <=
          left:
            type: Id
            value: gl_f_ct
          right:
            type: Number
            value: '0'
        then:
          - type: AssignStmt
            left:
              - type: Id
                value: gl_f_ct
            right:
              - type: Number
                value: '1'
          - type: ReturnStmt
            body:
              - type: Number
                value: '1000'
        else: null
      - type: ReturnStmt
        body:
          - type: UnaryExpr
            op: '-'
            arg:
              type: Number
              value: '1000'
    isLocal: false
  - type: CallStmt
    callee:
      type: Id
      value: print
    args:
      - type: BinaryExpr
        op: '>'
        left:
          type: CallExpr
          callee:
            type: Id
            value: f
          args:
            - type: String
              value: 1st call
        right:
          type: CallExpr
          callee:
            type: Id
            value: f
          args:
            - type: String
              value: 2nd call
  - type: AssignStmt
    left:
      - type: Id
        value: gl_f_ct
    right:
      - type: Number
        value: '0'
  - type: CallStmt
    callee:
      type: Id
      value: print
    args:
      - type: BinaryExpr
        op: <
        left:
          type: CallExpr
          callee:
            type: Id
            value: f
          args:
            - type: String
              value: 1st call
        right:
          type: CallExpr
          callee:
            type: Id
            value: f
          args:
            - type: String
              value: 2nd call
`;
parse(code, tree);
