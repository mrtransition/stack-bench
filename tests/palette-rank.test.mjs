import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rank } from '../js/palette.js';

const T = {
  id: 'json-yaml',
  name: 'JSON ↔ YAML 互转',
  desc: '把 JSON 转成 YAML，或反过来',
  category: '数据格式',
  keywords: ['yaml', 'yml', 'convert'],
  aliases: ['互转']
};

test('rank：名称完全匹配排最前', () => {
  assert.equal(rank({ ...T, name: 'yaml' }, 'yaml'), 0);
});

test('rank：名称前缀 > 名称包含 > id > 关键词 > 别名 > 分类 > 描述', () => {
  const B = { id: 'x', name: 'n', desc: 'd', category: 'c', keywords: [], aliases: [] };
  const cases = [
    [{ ...B, name: 'yaml' }, 0],
    [{ ...B, name: 'yaml 转换器' }, 1],
    [{ ...B, name: 'JSON 转 yaml' }, 2],
    [{ ...B, id: 'yaml' }, 3],
    [{ ...B, id: 'x-yaml' }, 4],
    [{ ...B, keywords: ['yaml'] }, 5],
    [{ ...B, aliases: ['yaml'] }, 6],
    [{ ...B, category: 'yaml' }, 7],
    [{ ...B, desc: 'yaml' }, 8]
  ];
  for (const [tool, want] of cases) assert.equal(rank(tool, 'yaml'), want);
});

test('rank：不匹配返回 -1，大小写不敏感', () => {
  assert.equal(rank(T, 'zsh'), -1);
  assert.equal(rank(T, ''), 0);
  assert.equal(rank({ ...T, name: 'HTTP 调试' }, 'http'), 1);
});
