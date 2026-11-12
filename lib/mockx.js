// Mock / 测试数据生成：按 JSON Schema 或示例模板生成
import { validateSchema } from './schemav.js';

const FIRST = ['Alice', 'Bob', 'Carol', 'Dave', 'Eve', 'Frank', 'Grace', 'Henry', 'Ivy', 'Jack'];
const CITIES = ['北京', '上海', '广州', '深圳', '杭州', '成都', '武汉', '南京'];
const WORDS = ['alpha', 'bravo', 'charlie', 'delta', 'echo', 'foxtrot', 'golf', 'hotel'];

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function randFloat(min, max, digits = 2) { return +(Math.random() * (max - min) + min).toFixed(digits); }

function hex(n) {
  let s = '';
  for (let i = 0; i < n; i++) s += '0123456789abcdef'[randInt(0, 15)];
  return s;
}

function fakeUuid() {
  return `${hex(8)}-${hex(4)}-4${hex(3)}-${pick(['8', '9', 'a', 'b'])}${hex(3)}-${hex(12)}`;
}

function valueFromSchema(key, schema, depth) {
  if (depth > 8) return null;
  if (!schema || typeof schema !== 'object') return null;
  if ('const' in schema) return schema.const;
  if (Array.isArray(schema.enum)) return pick(schema.enum);
  if (schema.examples && schema.examples.length) return schema.examples[0];

  const name = String(key || '').toLowerCase();
  const format = schema.format || '';

  const types = Array.isArray(schema.type) ? schema.type : [schema.type];
  const type = types.find(t => t && t !== 'null') || (schema.properties || schema.items ? 'object' : null);

  switch (type) {
    case 'string': {
      if (format === 'email' || name.includes('email') || name.includes('mail')) return `${pick(WORDS)}.${pick(WORDS)}@example.com`;
      if (format === 'uuid' || name.includes('uuid') || name === 'id' || name.endsWith('id') && name.length > 2 && name.includes('uid')) return fakeUuid();
      if (format === 'date-time') return new Date().toISOString();
      if (format === 'date') return new Date().toISOString().slice(0, 10);
      if (format === 'uri' || format === 'url' || name.includes('url') || name.includes('link')) return `https://example.com/${pick(WORDS)}`;
      if (name.includes('phone') || name.includes('mobile')) return '1' + pick(['3', '5', '8']) + String(randInt(100000000, 999999999));
      if (name.includes('name') && !name.includes('file')) return pick(FIRST);
      if (name.includes('city') || name.includes('addr')) return pick(CITIES);
      if (name.includes('amount') || name.includes('price') || name.includes('money')) return randFloat(1, 9999);
      if (name.includes('desc') || name.includes('remark') || name.includes('comment')) return `${pick(WORDS)} 说明文本 #${randInt(1, 999)}`;
      const min = typeof schema.minLength === 'number' ? schema.minLength : 6;
      const max = typeof schema.maxLength === 'number' ? Math.max(schema.maxLength, min) : min + 8;
      return hex(Math.max(1, Math.min(24, randInt(min, max))));
    }
    case 'number': case 'integer': {
      const min = typeof schema.minimum === 'number' ? schema.minimum : 0;
      const max = typeof schema.maximum === 'number' ? schema.maximum : Math.max(min + 100, min);
      const v = type === 'integer' ? randInt(Math.ceil(min), Math.floor(max)) : randFloat(min, max);
      if (typeof schema.multipleOf === 'number' && schema.multipleOf > 0) return Math.round(v / schema.multipleOf) * schema.multipleOf;
      return v;
    }
    case 'boolean':
      return Math.random() < 0.5;
    case 'array': {
      const min = typeof schema.minItems === 'number' ? schema.minItems : 2;
      const max = typeof schema.maxItems === 'number' ? schema.maxItems : Math.max(min + 1, 3);
      const n = randInt(min, Math.max(min, max));
      const out = [];
      for (let i = 0; i < n; i++) out.push(generate(schema.items, depth + 1));
      return out;
    }
    case 'object': {
      const out = {};
      const props = schema.properties || {};
      const keys = Object.keys(props);
      if (keys.length) {
        for (const k of keys) out[k] = valueFromSchema(k, props[k], depth + 1);
      } else {
        for (let i = 0; i < 3; i++) out[`${pick(WORDS)}_${i + 1}`] = hex(8);
      }
      return out;
    }
    default:
      return null;
  }
}

function generate(schema, depth = 0) {
  if (!schema || typeof schema !== 'object') return null;
  return valueFromSchema('id', schema, depth) ?? null;
}

/** 按 JSON Schema 生成 count 条 Mock 数据 */
export function genFromSchema(schema, count = 1) {
  const errors = validateSchema({}, schema); // 只做基本合法性探测（空数据）
  const out = [];
  for (let i = 0; i < count; i++) out.push(generate(schema));
  return { data: out, errors };
}

/** 按示例 JSON 模板生成：保留结构，按字段名/类型重造标量 */
export function genFromExample(example, count = 1) {
  const out = [];
  for (let i = 0; i < count; i++) out.push(transform(example, undefined, 0));
  return { data: out };

  function transform(node, key, depth) {
    if (depth > 8) return node;
    if (typeof node === 'string') {
      return valueFromSchema(key, { type: 'string' }, depth + 1);
    }
    if (typeof node === 'number') {
      return Number.isInteger(node) ? randInt(1, 1000) : randFloat(0, 1000);
    }
    if (typeof node === 'boolean') return Math.random() < 0.5;
    if (node === null) return null;
    if (Array.isArray(node)) {
      if (!node.length) return [valueFromSchema(key, { type: 'string' }, depth + 1)];
      return [transform(node[0], key, depth + 1)];
    }
    if (typeof node === 'object') {
      const out = {};
      for (const [k, v] of Object.entries(node)) out[k] = transform(v, k, depth + 1);
      return out;
    }
    return node;
  }
}
