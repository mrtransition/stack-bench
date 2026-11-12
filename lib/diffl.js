// 文本行级 Diff（Myers O(ND) 算法，带公共前后缀快速裁剪与规模保护）
// 返回扁平操作序列：{t:'=',a:行号A,b:行号B} | {t:'-',a:行号A} | {t:'+',b:行号B}，行号从 0 开始
const CAP_D = 8000;      // Myers 路径长度上限，超过则降级
const CAP_SIZE = 300000; // 中段总行数上限，超过则降级

export function diffLines(A, B) {
  const N = A.length, M = B.length;
  // 公共前缀
  let pre = 0;
  while (pre < N && pre < M && A[pre] === B[pre]) pre++;
  // 公共后缀
  let endA = N - 1, endB = M - 1;
  while (endA >= pre && endB >= pre && A[endA] === B[endB]) { endA--; endB--; }
  const ops = [];
  for (let i = 0; i < pre; i++) ops.push({ t: '=', a: i, b: i });
  const midA = A.slice(pre, endA + 1), midB = B.slice(pre, endB + 1);
  ops.push(...myers(midA, midB, pre, pre));
  for (let i = 0; i < (N - 1 - endA); i++) ops.push({ t: '=', a: endA + 1 + i, b: endB + 1 + i });
  return ops;
}

function myers(A, B, aOff, bOff) {
  const N = A.length, M = B.length;
  if (N === 0 && M === 0) return [];
  if (N === 0) return B.map((_, j) => ({ t: '+', b: bOff + j }));
  if (M === 0) return A.map((_, i) => ({ t: '-', a: aOff + i }));
  if (N + M > CAP_SIZE) return fallback(A, B, aOff, bOff);

  const v = new Map([[1, 0]]);
  const trace = [];
  const max = N + M;
  let found = -1;
  for (let d = 0; d <= max; d++) {
    trace.push(new Map(v));
    for (let k = -d; k <= d; k += 2) {
      let x;
      const down = (v.get(k - 1) ?? -1) < (v.get(k + 1) ?? -1);
      if (k === -d || (k !== d && down)) x = v.get(k + 1) ?? 0;
      else x = (v.get(k - 1) ?? -1) + 1;
      let y = x - k;
      while (x < N && y < M && A[x] === B[y]) { x++; y++; }
      v.set(k, x);
      if (x >= N && y >= M) { found = d; break; }
    }
    if (found >= 0) break;
    if (d > CAP_D) break;
  }
  if (found >= 0) return backtrack(trace, A, B, found, aOff, bOff);
  return fallback(A, B, aOff, bOff);
}

function backtrack(trace, A, B, d, aOff, bOff) {
  const ops = [];
  let x = A.length, y = B.length;
  for (let dd = d; dd > 0; dd--) {
    const v = trace[dd]; // d = dd-1 时的状态
    const k = x - y;
    const down = (v.get(k - 1) ?? -1) < (v.get(k + 1) ?? -1);
    const prevK = (k === -dd || (k !== dd && down)) ? k + 1 : k - 1;
    const prevX = v.get(prevK) ?? 0;
    const prevY = prevX - prevK;
    while (x > prevX && y > prevY) { ops.unshift({ t: '=', a: aOff + x - 1, b: bOff + y - 1 }); x--; y--; }
    if (prevK === k + 1) { ops.unshift({ t: '+', b: bOff + y - 1 }); y--; }
    else { ops.unshift({ t: '-', a: aOff + x - 1 }); x--; }
  }
  while (x > 0 && y > 0) { ops.unshift({ t: '=', a: aOff + x - 1, b: bOff + y - 1 }); x--; y--; }
  while (x > 0) { ops.unshift({ t: '-', a: aOff + x - 1 }); x--; }
  while (y > 0) { ops.unshift({ t: '+', b: bOff + y - 1 }); y--; }
  return ops;
}

function fallback(A, B, aOff, bOff) {
  return [
    ...A.map((_, i) => ({ t: '-', a: aOff + i })),
    ...B.map((_, j) => ({ t: '+', b: bOff + j }))
  ];
}

/** 将扁平操作序列折叠为统一视图的行（可选展示原文） */
export function toUnified(ops, linesA, linesB) {
  const rows = [];
  for (const op of ops) {
    if (op.t === '=') rows.push({ type: 'eq', text: linesA[op.a], aNo: op.a + 1, bNo: op.b + 1 });
    else if (op.t === '-') rows.push({ type: 'del', text: linesA[op.a], aNo: op.a + 1 });
    else rows.push({ type: 'add', text: linesB[op.b], bNo: op.b + 1 });
  }
  return rows;
}
