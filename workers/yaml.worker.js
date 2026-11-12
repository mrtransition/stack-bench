// JSON ↔ YAML Worker（FR-P0-04）：经典 Worker + 本地 js-yaml
importScripts('../vendor/js-yaml.min.js');

self.onmessage = e => {
  const { op, text, indent } = e.data;
  try {
    if (op === 'json2yaml') {
      const data = JSON.parse(text);
      const out = jsyaml.dump(data, { indent: 2, lineWidth: 120, noRefs: true });
      self.postMessage({ ok: true, result: out });
    } else {
      const data = jsyaml.load(text);
      const ind = indent === 'tab' ? '\t' : Number(indent) || 2;
      self.postMessage({ ok: true, result: JSON.stringify(data, null, ind) });
    }
  } catch (err) {
    const extra = err.mark ? `（错误位置：第 ${err.mark.line + 1} 行，第 ${err.mark.column + 1} 列）` : '';
    self.postMessage({
      ok: false,
      error: (err.reason || err.message) + extra,
      line: err.mark ? err.mark.line + 1 : null,
      col: err.mark ? err.mark.column + 1 : null
    });
  }
};
