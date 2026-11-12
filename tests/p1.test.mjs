import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatSql, compressSql } from '../lib/sqlfmt.js';
import { parseLogs, buildTimeline } from '../lib/logx.js';
import { parseCidr, inCidr, ipToInt, intToIp } from '../lib/netx.js';
import { convertColor } from '../lib/colorx.js';
import { genFromSchema, genFromExample } from '../lib/mockx.js';
import { convertBase, convertAll, isValidInBase } from '../lib/basex.js';
import { formatCss, compressCss } from '../lib/cssfmt.js';
import { renderMarkdown } from '../lib/mdx.js';
import { explainGit } from '../lib/gitx.js';

// ---------- SQL ----------
test('SQL：格式化主要子句换行与大写', () => {
  const out = formatSql('select id,name from users where age > 18 order by id limit 10;');
  assert.ok(out.includes('SELECT'));
  assert.ok(out.includes('FROM'));
  assert.ok(out.includes('WHERE'));
  const lines = out.split('\n');
  assert.ok(lines.length >= 5, '应至少换行为 5 行');
});

test('SQL：括号不配平报错', () => {
  assert.throws(() => formatSql('select * from t where (a = 1'), /括号不配对/);
});

test('SQL：字符串内容不被改写', () => {
  const out = formatSql("select * from t where name = 'select x'");
  assert.ok(out.includes("'select x'"));
});

test('SQL：压缩为单行', () => {
  const out = compressSql(`select *
  from users
  -- 注释
  where id = 1;`);
  assert.ok(!out.includes('\n'));
  assert.ok(/^select/i.test(out));
  assert.ok(!out.includes('注释'));
});

// ---------- 日志 ----------
test('日志：解析级别 / 时间 / trace', () => {
  const text = '2026-11-12 10:00:01.123 INFO [main] TID:abc12345 ok\n2026-11-12 10:00:02.789 ERROR [io] TID:abc12345 NPE at Foo.java:88';
  const r = parseLogs(text);
  assert.equal(r.entries.length, 2);
  assert.equal(r.counts.INFO, 1);
  assert.equal(r.counts.ERROR, 1);
  assert.equal(r.entries[0].trace, 'abc12345');
  assert.ok(r.entries[0].ts);
  assert.ok(r.range);
});

test('日志：时间线聚合', () => {
  const text = Array.from({ length: 10 }, (_, i) => `2026-11-12 10:0${Math.floor(i / 6)}:0${i % 6}.000 INFO msg ${i}`).join('\n');
  const r = parseLogs(text);
  const tl = buildTimeline(r.entries, 60000);
  assert.ok(tl.length >= 1);
  assert.equal(tl[0].count, 6);
});

test('日志：无时间戳行仍可解析级别', () => {
  const r = parseLogs('plain WARN message without timestamp');
  assert.equal(r.entries[0].level, 'WARN');
  assert.equal(r.entries[0].ts, null);
});

// ---------- CIDR ----------
test('CIDR：/26 计算', () => {
  const c = parseCidr('192.168.1.130/26');
  assert.equal(c.network, '192.168.1.128');
  assert.equal(c.broadcast, '192.168.1.191');
  assert.equal(c.mask, '255.255.255.192');
  assert.equal(c.firstHost, '192.168.1.129');
  assert.equal(c.lastHost, '192.168.1.190');
  assert.equal(c.hostCount, 62);
});

test('CIDR：裸 IP 视为 /32，非法输入报错', () => {
  const c = parseCidr('10.0.0.1');
  assert.equal(c.prefix, 32);
  assert.throws(() => parseCidr('1.2.3.4/33'), /0-32/);
  assert.throws(() => parseCidr('1.2.3.300'), /不合法/);
});

test('CIDR：网段包含判断', () => {
  assert.equal(inCidr('192.168.1.0/24', '192.168.1.200'), true);
  assert.equal(inCidr('192.168.1.0/24', '192.168.2.1'), false);
});

test('IP 整数互转', () => {
  assert.equal(ipToInt('192.168.1.1'), 3232235777);
  assert.equal(intToIp(3232235777), '192.168.1.1');
});

// ---------- 颜色 ----------
test('颜色：HEX/RGB/HSL 互转一致', () => {
  const r = convertColor('#4f8cff');
  assert.equal(r.rgb, 'rgb(79, 140, 255)');
  assert.ok(r.hslObj.h >= 219 && r.hslObj.h <= 220, 'hue 应为 219-220');
  // 纯色往返应精确还原
  assert.equal(convertColor(convertColor('#ff0000').hsl).hex, '#ff0000');
  assert.equal(convertColor(convertColor('#00ff00').hsl).hex, '#00ff00');
});

test('颜色：解析 rgb() 与英文名', () => {
  assert.equal(convertColor('rgb(255, 0, 0)').hex, '#ff0000');
  assert.equal(convertColor('red').hex, '#ff0000');
  assert.equal(convertColor('#abc').hex, '#aabbcc');
  assert.throws(() => convertColor('not-a-color'), /无法识别/);
});

// ---------- Mock ----------
test('Mock：按 Schema 生成符合结构', () => {
  const schema = {
    type: 'object',
    required: ['id', 'name'],
    properties: {
      id: { type: 'string', format: 'uuid' },
      name: { type: 'string' },
      age: { type: 'integer', minimum: 18, maximum: 60 },
      email: { type: 'string', format: 'email' },
      active: { type: 'boolean' },
      tags: { type: 'array', items: { type: 'string' } }
    }
  };
  const { data } = genFromSchema(schema, 5);
  assert.equal(data.length, 5);
  for (const item of data) {
    assert.ok(typeof item.id === 'string' && item.id.length === 36);
    assert.ok(item.age >= 18 && item.age <= 60);
    assert.ok(item.email.includes('@'));
    assert.ok(Array.isArray(item.tags));
  }
});

test('Mock：按示例模板生成', () => {
  const { data } = genFromExample({ id: 'x', price: 9.9, ok: true, list: [1, 2] }, 3);
  assert.equal(data.length, 3);
  assert.equal(typeof data[0].price, 'number');
  assert.equal(data[0].list.length, 1);
});

test('Mock：enum 与 const', () => {
  const { data } = genFromSchema({ type: 'object', properties: { s: { enum: ['a', 'b'] }, c: { const: '固定' } } }, 1);
  assert.ok(['a', 'b'].includes(data[0].s));
  assert.equal(data[0].c, '固定');
});

// ---------- 进制 ----------
test('进制：2/8/10/16 互转', () => {
  assert.equal(convertBase('ff', 16, 10), '255');
  assert.equal(convertBase('255', 10, 2), '11111111');
  assert.equal(convertBase('777', 8, 10), '511');
  assert.equal(convertBase('1010', 2, 16), 'a');
});

test('进制：大数与负数', () => {
  const big = '123456789012345678901234567890';
  const hex = convertBase(big, 10, 16);
  assert.equal(convertBase(hex, 16, 10), big);
  assert.equal(convertBase('-ff', 16, 10), '-255');
});

test('进制：非法输入报错', () => {
  assert.equal(isValidInBase('1g', 16), false);
  assert.throws(() => convertBase('2', 2, 10), /进制/);
  const rows = convertAll('ff', 16);
  assert.deepEqual(rows.map(r => r.base), [2, 8, 10, 16]);
});

// ---------- CSS ----------
test('CSS：格式化', () => {
  const out = formatCss('body{color:red;margin:0}.a{padding:4px}');
  assert.ok(out.includes('body {'));
  assert.ok(out.includes('  color: red;'));
  assert.ok(out.includes('.a {'));
});

test('CSS：压缩', () => {
  const out = compressCss('/* 注释 */ body { color : red ; }');
  assert.equal(out, 'body{color:red}');
});

// ---------- Markdown ----------
test('Markdown：标题/列表/代码/链接', () => {
  const html = renderMarkdown('# 标题\n\n- a\n- b\n\n`code` [x](https://a.b)\n\n```js\nvar <x>\n```');
  assert.ok(html.includes('<h1>标题</h1>'));
  assert.ok(html.includes('<ul><li>a</li><li>b</li></ul>'));
  assert.ok(html.includes('<code>code</code>'));
  assert.ok(html.includes('href="https://a.b"'));
  assert.ok(html.includes('&lt;x&gt;'), '代码块内容需转义');
});

test('Markdown：HTML 注入被转义', () => {
  const html = renderMarkdown('<script>alert(1)</script>');
  assert.ok(!html.includes('<script>'));
  assert.ok(html.includes('&lt;script&gt;'));
});

test('Markdown：表格', () => {
  const html = renderMarkdown('| a | b |\n|---|---|\n| 1 | 2 |');
  assert.ok(html.includes('<th>a</th>'));
  assert.ok(html.includes('<td>1</td>'));
});

// ---------- Git ----------
test('Git：精确解释与参数提示', () => {
  const r = explainGit('git reset --soft HEAD~1');
  assert.equal(r.matched, true);
  assert.equal(r.cmd, 'git reset');
  assert.ok(r.options.some(o => o.includes('--soft')));
});

test('Git：未匹配给出建议', () => {
  const r = explainGit('git rebse origin/main');
  assert.equal(r.matched, false);
});
