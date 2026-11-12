// 轻量 JSON Schema 校验器（支持常用关键字，$ref 不支持并提示）
function typeOf(v) {
  if (v === null) return 'null';
  if (Array.isArray(v)) return 'array';
  if (typeof v === 'number') return Number.isInteger(v) ? 'integer' : 'number';
  return typeof v;
}

const ALL_TYPES = ['string', 'number', 'integer', 'boolean', 'array', 'object', 'null'];

/**
 * 校验数据是否符合 schema。
 * 返回错误数组 [{path, message}]；空数组表示校验通过。
 */
export function validateSchema(data, schema) {
  const errors = [];
  if (schema && schema.$ref) {
    errors.push({ path: '$schema', message: '该 Schema 使用了 $ref 引用，此工具不支持，请手动展开后再校验' });
    return errors;
  }
  walk(data, schema, '$', errors);
  return errors;
}

function walk(v, s, path, errs) {
  if (!s || typeof s !== 'object' || Array.isArray(s)) return;

  const types = Array.isArray(s.type) ? s.type : (s.type ? [s.type] : []);
  for (const t of types) {
    if (!ALL_TYPES.includes(t)) errs.push({ path, message: `未知的类型声明: ${t}` });
  }
  if (types.length) {
    const actual = typeOf(v);
    const ok = types.some(t => t === actual || (t === 'number' && actual === 'integer') || (t === 'integer' && actual === 'integer'));
    if (!ok) {
      errs.push({ path, message: `类型应为 ${types.join(' / ')}，实际为 ${actual}` });
      return;
    }
  }

  if ('const' in s && JSON.stringify(v) !== JSON.stringify(s.const)) {
    errs.push({ path, message: `应为常量 ${JSON.stringify(s.const)}，实际为 ${JSON.stringify(v)}` });
  }
  if (Array.isArray(s.enum) && !s.enum.some(x => JSON.stringify(x) === JSON.stringify(v))) {
    errs.push({ path, message: `值 ${JSON.stringify(v)} 不在枚举 [${s.enum.map(x => JSON.stringify(x)).join(', ')}] 中` });
  }

  const t = typeOf(v);
  if (t === 'string') {
    if (typeof s.minLength === 'number' && v.length < s.minLength) errs.push({ path, message: `长度应 ≥ ${s.minLength}，实际 ${v.length}` });
    if (typeof s.maxLength === 'number' && v.length > s.maxLength) errs.push({ path, message: `长度应 ≤ ${s.maxLength}，实际 ${v.length}` });
    if (typeof s.pattern === 'string') {
      try { if (!(new RegExp(s.pattern)).test(v)) errs.push({ path, message: `不匹配模式 ${s.pattern}` }); }
      catch { errs.push({ path, message: `Schema 中的 pattern 不合法: ${s.pattern}` }); }
    }
  }
  if (t === 'number' || t === 'integer') {
    if (typeof s.minimum === 'number' && v < s.minimum) errs.push({ path, message: `应 ≥ ${s.minimum}，实际 ${v}` });
    if (typeof s.maximum === 'number' && v > s.maximum) errs.push({ path, message: `应 ≤ ${s.maximum}，实际 ${v}` });
    if (typeof s.exclusiveMinimum === 'number' && v <= s.exclusiveMinimum) errs.push({ path, message: `应 > ${s.exclusiveMinimum}，实际 ${v}` });
    if (typeof s.exclusiveMaximum === 'number' && v >= s.exclusiveMaximum) errs.push({ path, message: `应 < ${s.exclusiveMaximum}，实际 ${v}` });
    if (typeof s.multipleOf === 'number' && s.multipleOf > 0) {
      const q = v / s.multipleOf;
      if (Math.abs(q - Math.round(q)) > 1e-9) errs.push({ path, message: `应为 ${s.multipleOf} 的倍数，实际 ${v}` });
    }
  }
  if (t === 'array') {
    if (typeof s.minItems === 'number' && v.length < s.minItems) errs.push({ path, message: `元素数量应 ≥ ${s.minItems}，实际 ${v.length}` });
    if (typeof s.maxItems === 'number' && v.length > s.maxItems) errs.push({ path, message: `元素数量应 ≤ ${s.maxItems}，实际 ${v.length}` });
    if (s.uniqueItems) {
      const seen = new Set();
      for (const item of v) {
        const key = JSON.stringify(item);
        if (seen.has(key)) { errs.push({ path, message: '数组元素应唯一，存在重复项' }); break; }
        seen.add(key);
      }
    }
    if (s.items && typeof s.items === 'object' && !Array.isArray(s.items)) {
      v.forEach((item, i) => walk(item, s.items, `${path}[${i}]`, errs));
    }
  }
  if (t === 'object') {
    if (Array.isArray(s.required)) {
      for (const r of s.required) {
        if (!(r in v)) errs.push({ path, message: `缺少必填属性 "${r}"` });
      }
    }
    if (s.properties && typeof s.properties === 'object') {
      for (const [k, sub] of Object.entries(s.properties)) {
        if (k in v) walk(v[k], sub, `${path}.${k}`, errs);
      }
    }
    if (s.additionalProperties === false && s.properties) {
      for (const k of Object.keys(v)) {
        if (!(k in s.properties)) errs.push({ path, message: `存在不允许的属性 "${k}"` });
      }
    } else if (s.additionalProperties && typeof s.additionalProperties === 'object') {
      for (const k of Object.keys(v)) {
        if (s.properties && k in s.properties) continue;
        walk(v[k], s.additionalProperties, `${path}.${k}`, errs);
      }
    }
  }
}
