// 输出区复制按钮：给每个输出容器自动挂一个悬浮「复制」按钮
//
// 约定：工具渲染输出时使用 pre.out / div.out / id 以 -out 结尾的容器，
// 或显式标注 data-copy；本模块自动包裹并注入按钮，工具侧无需改动。
// 输出内容变化时（工具执行、清空、报错）由 MutationObserver 自动同步。
import { copyText } from './toast.js';

const OUTPUT_SELECTOR = 'pre.out, div.out, [id$="-out"], [data-copy], .diff-wrap';
const WRAP_CLASS = 'copy-wrap';
const CHIP_CLASS = 'copy-chip';

let currentScope = null;
let observer = null;
let scheduled = false;
let selfMutating = false;

/** 占位提示（「粘贴后点击解析」之类）不给复制按钮 */
function isPlaceholder(el) {
  if (el.classList.contains('info-box')) return true;
  if (el.childElementCount !== 1) return false;
  const only = el.firstElementChild;
  return !!only && only.classList.contains('info-box');
}

/** 表格 → 制表符分隔文本，粘到 Excel / 飞书表格可直接分列 */
export function rowsToTsv(rows) {
  return rows
    .map(cells => cells.map(c => String(c == null ? '' : c).replace(/\s+/g, ' ').trim()).join('\t'))
    .join('\n');
}

function tableToTsv(table) {
  const rows = [...table.rows].map(row => [...row.cells].map(cell => cell.innerText || cell.textContent || ''));
  return rowsToTsv(rows);
}

const BLOCK_TAGS = /^(DIV|P|LI|UL|OL|TR|SECTION|ARTICLE|HEADER|FOOTER|H[1-6]|DETAILS|SUMMARY|BLOCKQUOTE)$/;

/** 提取复制文本：pre/code 原样，块级元素各占一行，表格转 TSV */
export function extractText(el) {
  if (!el) return '';
  const tag = el.tagName;
  if (tag === 'PRE' || tag === 'CODE' || tag === 'TEXTAREA') return (el.textContent || '').trim();

  const lines = [];
  let buf = '';
  const flush = () => {
    const t = buf.replace(/[ \t]+/g, ' ').trim();
    if (t) lines.push(t);
    buf = '';
  };
  const visit = node => {
    for (const child of node.childNodes) {
      if (child.nodeType === 3) { buf += child.textContent; continue; }
      if (child.nodeType !== 1) continue;
      const t = child.tagName;
      if (t === 'BR') { flush(); continue; }
      if (t === 'PRE' || t === 'CODE') {
        flush();
        const s = (child.textContent || '').trim();
        if (s) lines.push(s);
        continue;
      }
      if (t === 'TABLE') { flush(); lines.push(tableToTsv(child)); continue; }
      if (BLOCK_TAGS.test(t)) { flush(); visit(child); flush(); }
      else visit(child);
    }
  };
  visit(el);
  flush();
  return lines.join('\n').trim();
}

function isOutermost(el) {
  const parent = el.parentElement;
  if (!parent) return false;
  if (parent.classList.contains(WRAP_CLASS)) return true;
  return !parent.closest(OUTPUT_SELECTOR);
}

function hasContent(el) {
  if (isPlaceholder(el)) return false;
  return (el.textContent || '').trim().length > 0;
}

function createChip(el) {
  const chip = document.createElement('button');
  chip.type = 'button';
  chip.className = CHIP_CLASS;
  chip.textContent = '复制';
  chip.title = '复制这段输出';
  chip.setAttribute('aria-label', '复制这段输出');

  let timer = null;
  chip.addEventListener('click', async () => {
    const text = extractText(el);
    if (!text) return;
    const ok = await copyText(text);
    chip.textContent = ok ? '✓ 已复制' : '复制失败';
    chip.classList.toggle('is-done', ok);
    chip.classList.toggle('is-fail', !ok);
    clearTimeout(timer);
    timer = setTimeout(() => {
      chip.textContent = '复制';
      chip.classList.remove('is-done', 'is-fail');
    }, 1400);
  });
  return chip;
}

function wrapOutput(el) {
  const parent = el.parentElement;
  if (parent && parent.classList.contains(WRAP_CLASS)) {
    const chip = parent.querySelector(':scope > .' + CHIP_CLASS);
    if (chip) chip.classList.toggle('is-empty', !hasContent(el));
    return parent;
  }
  if (!isOutermost(el)) return null;

  const wrap = document.createElement('div');
  wrap.className = WRAP_CLASS;
  el.parentNode.insertBefore(wrap, el);
  wrap.appendChild(el);
  const chip = createChip(el);
  chip.classList.toggle('is-empty', !hasContent(el));
  wrap.appendChild(chip);
  return wrap;
}

function sync() {
  scheduled = false;
  const scope = currentScope;
  if (!scope || !scope.isConnected) return;
  selfMutating = true;
  try {
    for (const el of scope.querySelectorAll(OUTPUT_SELECTOR)) wrapOutput(el);
  } finally {
    selfMutating = false;
  }
}

function requestSync() {
  if (scheduled) return;
  scheduled = true;
  if (typeof requestAnimationFrame === 'function') requestAnimationFrame(sync);
  else setTimeout(sync, 16);
}

/**
 * 在工具内容容器上启用「输出自动复制按钮」。
 * 切换工具时对新的容器重新挂载，旧的观察器自动断开。
 */
export function mountCopyAffix(scope) {
  if (!scope) return;
  if (currentScope === scope && observer) return requestSync();
  if (observer) observer.disconnect();
  currentScope = scope;
  observer = new MutationObserver(() => {
    if (selfMutating) return;
    requestSync();
  });
  observer.observe(scope, { childList: true, subtree: true, characterData: true });
  requestSync();
}
