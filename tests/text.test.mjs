import { test } from 'node:test';
import assert from 'node:assert/strict';
import { diffLines } from '../lib/diffl.js';
import { locateJsonError } from '../lib/jsonerr.js';
import { parseEnv, formatEnv } from '../lib/envx.js';

test('Diff：单行修改', () => {
  const ops = diffLines(['a', 'b', 'c'], ['a', 'x', 'c']);
  const seq = ops.map(o => o.t).join('');
  assert.equal(seq, '=-+=');
  const del = ops.find(o => o.t === '-');
  const add = ops.find(o => o.t === '+');
  assert.equal(del.a, 1);
  assert.equal(add.b, 1);
});

test('Diff：纯新增 / 纯删除 / 空输入', () => {
  assert.equal(diffLines([], ['x', 'y']).map(o => o.t).join(''), '++');
  assert.equal(diffLines(['x', 'y'], []).map(o => o.t).join(''), '--');
  assert.deepEqual(diffLines([], []), []);
});

test('Diff：中文与重复行', () => {
  const ops = diffLines(['你好', '世界', '你好'], ['你好', '世界', '你好', '!']);
  assert.equal(ops.filter(o => o.t === '+').length, 1);
  assert.equal(ops.filter(o => o.t === '=').length, 3);
});

test('Diff：交错修改', () => {
  const ops = diffLines(
    ['1', '2', '3', '4', '5'],
    ['1', '2', 'X', '4', '5', '6']
  );
  const dels = ops.filter(o => o.t === '-').length;
  const adds = ops.filter(o => o.t === '+').length;
  assert.equal(dels, 1);
  assert.equal(adds, 2);
});

test('JSON 错误定位', () => {
  const text = '{"a":1,\n "b":2,}';
  const err = new SyntaxError('Unexpected token } in JSON at position 15');
  const loc = locateJsonError(text, err);
  assert.equal(loc.line, 2);
  assert.equal(loc.col, 8);
  assert.ok(/第 2 行/.test(loc.message));
});

test('JSON 错误定位：无位置信息时不崩溃', () => {
  const loc = locateJsonError('{}', new SyntaxError('weird failure'));
  assert.equal(loc.line, null);
  assert.ok(loc.message);
});

test('.env 解析：重复 key / 错误行 / 注释', () => {
  const r = parseEnv('# 注释\nA=1\nA=2\nBAD LINE\n\nB=hello');
  assert.deepEqual(r.dups, ['A']);
  assert.equal(r.issues[0].line, 4);
  assert.equal(r.comments.length, 1);
  assert.equal(r.entries.length, 3);
});

test('.env 格式化：排序 + 脱敏', () => {
  const r = formatEnv('Z=9\n# 说明\nAPI_TOKEN=secret-abc\nAPP=dev', { sort: true, mask: true });
  const lines = r.output.split('\n');
  assert.equal(lines[0], '# 说明');
  assert.ok(lines.findIndex(l => l.startsWith('APP=')) < lines.findIndex(l => l.startsWith('Z=')));
  assert.ok(lines.some(l => l === 'API_TOKEN=******'));
  assert.ok(!r.output.includes('secret-abc'));
});

test('.env 格式化：脱敏判断（含 PASSWORD/KEY）', () => {
  const r = parseEnv('DB_PASSWORD=p1\nMY_KEY=k2\nNORMAL=v3');
  const sens = r.entries.filter(e => e.sensitive).map(e => e.key);
  assert.deepEqual(sens, ['DB_PASSWORD', 'MY_KEY']);
});
