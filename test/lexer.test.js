import { Lexer, Source, TokenType } from "../src/lexer";

const commentTests = [
  {
    code: "-- comment",
    val: " comment"
  },
  {
    code: String.raw`--[[
      multiline comment
    ]]`,
    val: "\n      multiline comment\n    "
  }
];
commentTests.forEach(t => {
  test(`comment: ${t.code}`, () => {
    const src = new Source(t.code);
    const lexer = new Lexer(src);
    const tok = lexer.next();
    expect(tok.type).toBe(TokenType.Comment);
    expect(tok.text).toBe(t.val);
  });
});

const numberTests = "4 0.4 4.57e-3 0.3E12 5e+20 0xFF 0Xff 4.".split(" ");
numberTests.forEach(t => {
  test(`number: ${t}`, () => {
    const src = new Source(t);
    const lexer = new Lexer(src);
    const tok = lexer.next();
    expect(tok.type).toBe(TokenType.Number);
    expect(tok.text).toBe(t);
  });
});

const stringTests = [
  {
    code: String.raw`"\xF0\x9F\x98\x81"`,
    val: String.raw`\xF0\x9F\x98\x81`
  },
  {
    code: String.raw`"\u{1F601}"`,
    val: String.raw`\u{1F601}`
  },
  {
    code: String.raw`[[
      \n
    ]]`,
    val: String.raw`
      \n
    `
  },
  {
    code: String.raw`"\tfirst line\
    \tsecond line"`,
    val: String.raw`\tfirst line\
    \tsecond line`
  },
  {
    code: String.raw`'alo\n123"'`,
    val: String.raw`alo\n123"`
  },
  {
    code: String.raw`'a backslash inside quotes: \'\\\''`,
    val: String.raw`a backslash inside quotes: \'\\\'`
  },
  {
    code: String.raw`[==[ ==]]==]`,
    val: " ==]"
  }
];

stringTests.forEach(t => {
  test(`string: ${t.code}`, () => {
    const src = new Source(t.code);
    const lexer = new Lexer(src);
    const tok = lexer.next();
    expect(tok.type).toBe(TokenType.String);
    expect(tok.text).toBe(t.val);
  });
});

const nameTests = [
  {
    code: "a",
    type: TokenType.Name
  },
  {
    code: "_a",
    type: TokenType.Name
  },
  {
    code: "_a0",
    type: TokenType.Name
  },
  {
    code: "function",
    type: TokenType.Keyword
  }
];

nameTests.forEach(t => {
  test(`name: ${t.code}`, () => {
    const src = new Source(t.code);
    const lexer = new Lexer(src);
    const tok = lexer.next();
    expect(tok.type).toBe(t.type);
    expect(tok.text).toBe(t.code);
  });
});

const signTests = [
  "&",
  "|",
  "+",
  "-",
  "/",
  "//",
  ">",
  "<",
  ">=",
  ">>",
  "<<",
  "<=",
  "=",
  "==",
  "~",
  "~=",
  ".",
  "..",
  "..."
];

signTests.forEach(t => {
  test(`sign: ${t}`, () => {
    const src = new Source(t);
    const lexer = new Lexer(src);
    const tok = lexer.next();
    expect(tok.type).toBe(TokenType.Sign);
    expect(tok.text).toBe(t);
  });
});
