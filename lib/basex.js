// 进制转换：2-36 任意进制（整数，支持 BigInt 大数）
export function isValidInBase(str, base) {
  const s = String(str).trim().toLowerCase();
  if (!s) return false;
  let body = s.replace(/^-/, '');
  if (!body) return false;
  for (const ch of body) {
    const v = parseInt(ch, 36);
    if (isNaN(v) || v >= base) return false;
  }
  return true;
}

function toBig(str, base) {
  const s = String(str).trim().toLowerCase().replace(/^-/, '');
  const digits = '0123456789abcdefghijklmnopqrstuvwxyz';
  let n = 0n;
  const b = BigInt(base);
  for (const ch of s) {
    const v = digits.indexOf(ch);
    if (v < 0 || v >= base) throw new Error(`字符 "${ch}" 不属于 ${base} 进制`);
    n = n * b + BigInt(v);
  }
  return n;
}

function fromBig(n, base) {
  const digits = '0123456789abcdefghijklmnopqrstuvwxyz';
  const b = BigInt(base);
  if (n === 0n) return '0';
  let out = '';
  while (n > 0n) {
    out = digits[Number(n % b)] + out;
    n = n / b;
  }
  return out;
}

/** 整数字符串在进制间转换；负号支持 */
export function convertBase(str, fromBase, toBase) {
  str = String(str).trim();
  const neg = str.startsWith('-');
  if (!isValidInBase(str, fromBase)) throw new Error(`不是合法的 ${fromBase} 进制数: ${str}`);
  const n = toBig(str, fromBase);
  const out = fromBig(n, toBase);
  return neg && n !== 0n ? '-' + out : out;
}

/** 输入数 + 原进制 → 全部常用进制（2/8/10/16） */
export function convertAll(str, fromBase) {
  return [2, 8, 10, 16].map(b => ({ base: b, value: convertBase(str, fromBase, b) }));
}
