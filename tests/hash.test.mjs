import { test } from 'node:test';
import assert from 'node:assert/strict';
import { md5 } from '../lib/md5.js';
import { sha } from '../lib/shau.js';
import { uuidv4, uuidv7 } from '../lib/uuidx.js';

test('MD5 标准向量', () => {
  assert.equal(md5(''), 'd41d8cd98f00b204e9800998ecf8427e');
  assert.equal(md5('abc'), '900150983cd24fb0d6963f7d28e17f72');
  assert.equal(md5('hello world'), '5eb63bbbe01eeed093cb22bb8f5acdc3');
  assert.equal(md5('你好，世界'), 'dbefd3ada018615b35588a01e216ae6e');
});

test('SHA 系列', async () => {
  assert.equal(await sha('SHA-1', 'abc'), 'a9993e364706816aba3e25717850c26c9cd0d89d');
  assert.equal(await sha('SHA-256', 'abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  assert.equal(await sha('SHA-256', 'hello world'), 'b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9');
  const s512 = await sha('SHA-512', '');
  assert.equal(s512.length, 128);
});

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

test('UUID v4 格式与版本位', async () => {
  for (let i = 0; i < 20; i++) {
    const u = await uuidv4({});
    assert.match(u, UUID_RE);
    assert.equal(u[14], '4');
    assert.match(u[19], /[89ab]/);
  }
});

test('UUID v7 时间戳与版本位', async () => {
  const before = Date.now();
  const u = await uuidv7({});
  const after = Date.now();
  assert.match(u, UUID_RE);
  assert.equal(u[14], '7');
  assert.match(u[19], /[89ab]/);
  const tsHex = u.slice(0, 8) + u.slice(9, 13);
  const ts = parseInt(tsHex, 16);
  assert.ok(ts >= before - 5 && ts <= after + 5, 'v7 头部应为当前毫秒时间戳');
});

test('UUID 无连字符 / 大写', async () => {
  const u = await uuidv4({ hyphen: false, upper: true });
  assert.match(u, /^[0-9A-F]{32}$/);
});
