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

let code =  raw`
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
