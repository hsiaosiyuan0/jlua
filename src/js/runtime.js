export const print = console.log;

export const eq = (lhs, rhs) => {
  lhs = lhs === undefined ? null : lhs;
  rhs = rhs === undefined ? null : rhs;
  return lhs === rhs;
};

export const neq = (lhs, rhs) => {
  lhs = lhs === undefined ? null : lhs;
  rhs = rhs === undefined ? null : rhs;
  return lhs !== rhs;
};

export const add = (lhs, rhs) => {
  let add =
    typeof lhs.__add === "function"
      ? lhs.__add
      : typeof rhs.__add === "function"
      ? rhs.__add
      : (l, r) => l + r;
  return add(lhs, rhs);
};

export const pairs = o => {
  if (Array.isArray(o)) return o.entries();
  return o;
};

module.exports.class = (name, base, init) => {
  if (init === undefined) {
    init = base;
    base = false;
    if (!init) init = function() {};
  }
  const wrap = {
    [name]: function(...args) {
      let obj = {};
      let proto = wrap[name].prototype;
      let parent = {};
      if (base) {
        parent = base(...args);
        Object.setPrototypeOf(proto, parent);
      }
      init.call(obj, ...args);
      Object.setPrototypeOf(obj, proto);
      return obj;
    }
  };
  return wrap[name];
};

export const isInstanceOf = (obj, klass) => obj instanceof klass;
