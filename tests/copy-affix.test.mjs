/**
 * 输出复制按钮的纯逻辑测试（DOM 部分由 examples-selftest 在真实浏览器中覆盖）
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rowsToTsv, guessExt } from '../js/copy-affix.js';

test('rowsToTsv：单元格用制表符、行用换行', () => {
  assert.equal(
    rowsToTsv([['方法', '路径', '状态'], ['GET', '/users', '200']]),
    '方法\t路径\t状态\nGET\t/users\t200'
  );
});

test('rowsToTsv：压缩单元格内换行与制表符，避免破坏分列', () => {
  assert.equal(rowsToTsv([['a\nb', 'c\td', '  e  f  ']]), 'a b\tc d\te f');
});

test('rowsToTsv：空值与缺失单元格保留占位', () => {
  assert.equal(rowsToTsv([['x', null, undefined, '']]), 'x\t\t\t');
});

test('rowsToTsv：空表格返回空字符串', () => {
  assert.equal(rowsToTsv([]), '');
});

test('guessExt：按工具类型给扩展名', () => {
  assert.equal(guessExt('a: 1', 'json-yaml'), 'yaml');
  assert.equal(guessExt('SELECT 1', 'sql-format'), 'sql');
  assert.equal(guessExt('- a\n+ b', 'text-diff'), 'diff');
});

test('guessExt：按内容识别 JSON / XML / 证书', () => {
  assert.equal(guessExt('{"a":1}'), 'json');
  assert.equal(guessExt('[1,2]'), 'json');
  assert.equal(guessExt('<?xml version="1.0"?><a/>'), 'xml');
  assert.equal(guessExt('-----BEGIN CERTIFICATE-----\nMIIB\n-----END CERTIFICATE-----'), 'pem');
  assert.equal(guessExt('-----BEGIN RSA PRIVATE KEY-----\nMIIB'), 'key');
});

test('guessExt：无法判断时回退 txt', () => {
  assert.equal(guessExt('hello world'), 'txt');
  assert.equal(guessExt('{bad json'), 'txt');
  assert.equal(guessExt(''), 'txt');
});

