import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCron, nextRuns, describeCron } from '../lib/cronx.js';
import { parseCurl, genCode } from '../lib/curls.js';
import { validateSchema } from '../lib/schemav.js';
import { parseJwt } from '../lib/jwtx.js';
import { normalizeTs, parseFlexible, fmtAll } from '../lib/timeu.js';

// ---------- Cron ----------
test('Cron：非法字段数报错', () => {
  assert.throws(() => parseCron('* * *'), /5 个或 6 个字段/);
});

test('Cron：范围越界报错', () => {
  assert.throws(() => parseCron('0 25 * * *'), /超出范围/);
  assert.throws(() => parseCron('0 0 0 * *'), /超出范围/); // 日不能为 0
});

test('Cron：5 字段每 5 分钟的下次执行', () => {
  const from = new Date(2026, 0, 1, 10, 3, 0);
  const next = nextRuns('*/5 * * * *', from, 3);
  assert.equal(next.length, 3);
  assert.equal(next[0].getMinutes(), 5);
  assert.equal(next[1].getMinutes(), 10);
  assert.equal(next[2].getMinutes(), 15);
});

test('Cron：6 字段（含秒）每天 09:30', () => {
  const from = new Date(2026, 0, 1, 10, 0, 0);
  const next = nextRuns('0 30 9 * * *', from, 1);
  assert.equal(next[0].getDate(), 2);
  assert.equal(next[0].getHours(), 9);
  assert.equal(next[0].getMinutes(), 30);
  assert.equal(next[0].getSeconds(), 0);
});

test('Cron：每周一 09:00', () => {
  // 2026-01-01 是周四
  const next = nextRuns('0 9 * * 1', new Date(2026, 0, 1, 0, 0, 0), 1);
  assert.equal(next[0].getDay(), 1);
  assert.equal(next[0].getHours(), 9);
  assert.equal(next[0].getMonth(), 0);
  assert.equal(next[0].getDate(), 5); // 下一个周一是 1 月 5 日
});

test('Cron：月份名称与星期名称', () => {
  const c = parseCron('0 0 1 JAN-MAR MON-FRI');
  assert.deepEqual(c.mon, [1, 2, 3]);
  assert.deepEqual(c.dow, [1, 2, 3, 4, 5]);
  assert.ok(describeCron('0 9 * * 1').includes('星期'));
});

// ---------- curl ----------
test('curl 解析：POST + headers + body', () => {
  const p = parseCurl(`curl -X POST 'https://api.example.com/v1/users' \\
  -H 'Content-Type: application/json' \\
  -H 'Authorization: Bearer abc123' \\
  -d '{"name":"huanja","age":18}'`);
  assert.equal(p.method, 'POST');
  assert.equal(p.url, 'https://api.example.com/v1/users');
  assert.equal(p.headers['Content-Type'], 'application/json');
  assert.equal(p.body, '{"name":"huanja","age":18}');
  assert.equal(p.notes.length, 0);
});

test('curl 解析：无 -X 时 -d 隐含 POST', () => {
  const p = parseCurl(`curl https://a.b/c -d "x=1"`);
  assert.equal(p.method, 'POST');
});

test('curl 解析：GET 默认 / 无协议补 http://', () => {
  const p = parseCurl('curl -H "Accept: */*" example.com/api');
  assert.equal(p.method, 'GET');
  assert.equal(p.url, 'http://example.com/api');
  assert.equal(p.headers['Accept'], '*/*');
});

test('curl 解析：不支持参数进入 notes', () => {
  const p = parseCurl(`curl -F "file=@a.png" -F "name=x" https://a.b/up`);
  assert.ok(p.notes.some(n => n.includes('-F')));
});

test('curl 解析：-u 转 Basic Auth', () => {
  const p = parseCurl(`curl -u user:pass https://a.b/`);
  assert.equal(p.headers['Authorization'], 'Basic ' + Buffer.from('user:pass').toString('base64'));
});

test('curl 生成：五种目标语言', () => {
  const p = parseCurl(`curl -X POST 'https://api.example.com/x' -H 'Content-Type: application/json' -d '{"a":1}'`);
  for (const target of ['fetch', 'axios', 'go', 'python', 'java']) {
    const { code } = genCode(p, target);
    assert.ok(code.length > 50, target + ' 应生成代码');
  }
  const fetchCode = genCode(p, 'fetch').code;
  assert.ok(fetchCode.includes('"https://api.example.com/x"'));
  assert.ok(fetchCode.includes('method: "POST"'));
});

// ---------- JSON Schema ----------
test('Schema：类型与必填校验', () => {
  const schema = { type: 'object', required: ['name'], properties: { name: { type: 'string' }, age: { type: 'integer' } } };
  assert.deepEqual(validateSchema({ name: 'x', age: 20 }, schema), []);
  const errs = validateSchema({ age: 1.5 }, schema);
  assert.equal(errs.length, 2);
  assert.ok(errs.some(e => e.path === '$' && /缺少必填属性/.test(e.message)));
  assert.ok(errs.some(e => /类型应为 integer/.test(e.message)));
});

test('Schema：字符串约束与枚举', () => {
  const schema = { type: 'string', minLength: 2, maxLength: 4, enum: ['a', 'ab', 'abc'] };
  assert.deepEqual(validateSchema('ab', schema), []);
  assert.ok(validateSchema('a', schema).length === 1);
  assert.ok(validateSchema('abcde', schema).length === 2);
  assert.ok(validateSchema('xyz', schema).some(e => /枚举/.test(e.message)));
});

test('Schema：additionalProperties=false', () => {
  const schema = { type: 'object', properties: { a: { type: 'string' } }, additionalProperties: false };
  const errs = validateSchema({ a: '1', b: 2 }, schema);
  assert.ok(errs.some(e => /不允许的属性 "b"/.test(e.message)));
});

test('Schema：数组 uniqueItems / items', () => {
  const schema = { type: 'array', items: { type: 'string' }, uniqueItems: true, maxItems: 2 };
  assert.deepEqual(validateSchema(['x', 'y'], schema), []);
  assert.ok(validateSchema(['x', 1], schema).length === 1);
  assert.ok(validateSchema(['x', 'x', 'x'], schema).length === 2);
});

test('Schema：$ref 提示', () => {
  const errs = validateSchema({}, { $ref: '#/definitions/x' });
  assert.ok(errs.some(e => /ref/.test(e.message)));
});

// ---------- JWT ----------
function b64urlJson(o) {
  return Buffer.from(JSON.stringify(o)).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
test('JWT 解析与过期判断', () => {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'HS256', typ: 'JWT' };
  const payload = { sub: 'u1', iat: now - 3600, exp: now - 1800 };
  const token = `${b64urlJson(header)}.${b64urlJson(payload)}.${'c2ln'}`;
  const r = parseJwt(token);
  assert.equal(r.header.alg, 'HS256');
  assert.equal(r.payload.sub, 'u1');
  assert.equal(r.expired, true);
  assert.equal(r.signature, 'c2ln');
});

test('JWT：非三段式报错', () => {
  assert.throws(() => parseJwt('abc.def'), /三段式/);
});

test('JWT：未过期 + nbf', () => {
  const now = Math.floor(Date.now() / 1000);
  const payload = { iat: now - 10, exp: now + 3600, nbf: now + 600 };
  const r = parseJwt(`${b64urlJson({ alg: 'none' })}.${b64urlJson(payload)}.${'x'}`);
  assert.equal(r.expired, false);
  assert.equal(r.notYet, true);
});

// ---------- 时间戳 ----------
test('时间戳：秒/毫秒自动识别', () => {
  const d1 = normalizeTs('1000000000'); // 2001-09-09T01:46:40Z
  assert.equal(d1.getTime(), 1000000000000);
  const d2 = normalizeTs('1000000000000');
  assert.equal(d2.getTime(), 1000000000000);
  assert.throws(() => normalizeTs('12a3'), /纯数字/);
});

test('时间戳：格式化输出', () => {
  const f = fmtAll(new Date(Date.UTC(2026, 0, 1, 0, 0, 0)));
  assert.equal(f.iso, '2026-01-01T00:00:00.000Z');
  assert.equal(f.sec, Math.floor(new Date(Date.UTC(2026, 0, 1, 0, 0, 0)).getTime() / 1000));
  assert.ok(f.local.length > 0);
});

test('日期字符串解析', () => {
  const d = parseFlexible('2026-01-01 12:00:00');
  assert.equal(d.getFullYear(), 2026);
  assert.equal(d.getHours(), 12);
  assert.throws(() => parseFlexible('not-a-date'), /无法识别/);
});
