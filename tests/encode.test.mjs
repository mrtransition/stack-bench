import { test } from 'node:test';
import assert from 'node:assert/strict';
import { b64encode, b64decode, urlEncode, urlDecode } from '../lib/base64x.js';
import { encodeParams, decodeParams } from '../lib/codec.js';

test('Base64 编解码往返（含中文与特殊字符）', () => {
  const samples = ['hello world', '你好，全栈工程师', 'Hello+World/2026', '🎉✨', 'a=b&c=d?e#f'];
  for (const s of samples) {
    assert.equal(b64decode(b64encode(s)), s);
  }
});

test('URL-safe Base64', () => {
  const s = 'subjects?_test+done/';
  const enc = b64encode(s, true);
  assert.doesNotMatch(enc, /[+/=]/);
  assert.equal(b64decode(enc), s);
});

test('非法 Base64 报错', () => {
  assert.throws(() => b64decode('a@@b!!'), /非法 Base64/);
});

test('URL 编解码', () => {
  const s = 'a=1&b=中文 c';
  assert.equal(urlDecode(urlEncode(s)), s);
  assert.equal(urlEncode('a b&c'), 'a%20b%26c');
  assert.throws(() => urlDecode('%zz'), /URL 解码失败/);
  assert.equal(urlDecode('a+b'), 'a b'); // + 视为空格
});

test('分享参数编解码', () => {
  const obj = { text: '{"x":1}', op: 'format', indent: 2 };
  const enc = encodeParams(obj);
  assert.doesNotMatch(enc, /[+/=]/);
  assert.deepEqual(decodeParams(enc), obj);
  assert.equal(decodeParams('!!!不合法!!!'), null);
});
