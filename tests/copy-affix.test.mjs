/**
 * 输出复制按钮的纯逻辑测试（DOM 部分由 examples-selftest 在真实浏览器中覆盖）
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rowsToTsv } from '../js/copy-affix.js';

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
