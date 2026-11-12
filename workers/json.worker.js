// JSON 处理 Worker（FR-P0-03）：格式化 / 压缩 / 校验
import { locateJsonError } from '../lib/jsonerr.js';

self.onmessage = e => {
  const { op, text, indent } = e.data;
  try {
    const data = JSON.parse(text);
    if (op === 'validate') {
      self.postMessage({ ok: true, result: '✅ JSON 语法校验通过', valid: true });
    } else if (op === 'compress') {
      self.postMessage({ ok: true, result: JSON.stringify(data) });
    } else {
      const ind = indent === 'tab' ? '\t' : Number(indent) || 2;
      self.postMessage({ ok: true, result: JSON.stringify(data, null, ind) });
    }
  } catch (err) {
    const loc = locateJsonError(text, err);
    self.postMessage({ ok: false, error: loc.message, line: loc.line, col: loc.col });
  }
};
