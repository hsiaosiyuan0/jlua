import long from "long";

export function assertSafeNum(num) {
  if (long.isLong(num)) {
    if (num.gt(Number.MAX_SAFE_INTEGER)) throw new Error("too large size");
    num = num.toNumber();
  }
  return num;
}

export function loop(fn, n) {
  n = assertSafeNum(n);
  for (let i = 0; i < n; i++) {
    if (fn(i) === false) break;
  }
}
