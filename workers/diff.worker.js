// 文本 Diff Worker（FR-P0-10）
import { diffLines } from '../lib/diffl.js';

self.onmessage = e => {
  const { aText, bText, ignoreWs } = e.data;
  try {
    const split = t => String(t).replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
    const rawA = split(aText), rawB = split(bText);
    const cmpA = ignoreWs ? rawA.map(l => l.replace(/\s+/g, ' ').trim()) : rawA;
    const cmpB = ignoreWs ? rawB.map(l => l.replace(/\s+/g, ' ').trim()) : rawB;
    const ops = diffLines(cmpA, cmpB);
    self.postMessage({ ok: true, ops, rawA, rawB });
  } catch (err) {
    self.postMessage({ ok: false, error: err.message || '差异计算失败' });
  }
};
