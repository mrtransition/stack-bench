// 输出区工具组：复制 / 下载 / 清空
//
// 约定：工具渲染输出时使用 pre.out / div.out / id 以 -out 结尾的容器，
// 或显式标注 data-copy；本模块自动包裹并注入按钮，工具侧无需改动。
// 输出内容变化时（工具执行、清空、报错）由 MutationObserver 自动同步。
import { copyText, notify } from './toast.js';
import { icon } from './icons.js';

const OUTPUT_SELECTOR = 'pre.out, div.out, [id$="-out"], [data-copy], .diff-wrap';
const WRAP_CLASS = 'copy-wrap';
const CHIP_CLASS = 'copy-chip';
const ACTS_CLASS = 'copy-acts';

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

/** 按工具类型与内容猜扩展名，下载后可直接被编辑器识别 */
export function guessExt(text, toolId = '') {
  const id = String(toolId).toLowerCase();
  const t = String(text || '').trim();
  if (/yaml|yml/.test(id)) return 'yaml';
  if (/sql/.test(id)) return 'sql';
  if (/diff/.test(id)) return 'diff';
  if (/env/.test(id)) return 'env';
  if (/json/.test(id) && /^[[{]/.test(t)) return 'json';
  if (/^[[{]/.test(t)) {
    try { JSON.parse(t); return 'json'; } catch { /* 不是合法 JSON */ }
  }
  if (/^<\?xml|^<[a-zA-Z!]/.test(t)) return 'xml';
  if (/-----BEGIN CERTIFICATE-----/.test(t)) return 'pem';
  if (/-----BEGIN [A-Z ]*PRIVATE KEY-----/.test(t)) return 'key';
  if (/^\w+=.*(&\w+=.*)+$/.test(t)) return 'txt';
  return 'txt';
}

export function downloadText(text, toolId) {
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  const a = document.createElement('a');
  a.href = url;
  a.download = `${toolId || 'output'}-${stamp}.${guessExt(text, toolId)}`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return a.download;
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

function currentToolId() {
  const m = location.hash.match(/#\/tool\/([\w-]+)/);
  return m ? m[1] : 'output';
}

function makeBtn(cls, name, label, onClick) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = cls;
  btn.title = label;
  btn.setAttribute('aria-label', label);
  btn.innerHTML = icon(name, 14);
  btn.addEventListener('click', onClick);
  return btn;
}

function createActions(el) {
  const box = document.createElement('div');
  box.className = ACTS_CLASS;

  const copyBtn = makeBtn(CHIP_CLASS, 'copy', '复制这段输出', async () => {
    const text = extractText(el);
    if (!text) return;
    const ok = await copyText(text);
    copyBtn.innerHTML = icon(ok ? 'check' : 'x', 14);
    copyBtn.classList.toggle('is-done', ok);
    copyBtn.classList.toggle('is-fail', !ok);
    clearTimeout(copyBtn._timer);
    copyBtn._timer = setTimeout(() => {
      copyBtn.innerHTML = icon('copy', 14);
      copyBtn.classList.remove('is-done', 'is-fail');
    }, 1400);
  });

  const dlBtn = makeBtn('copy-act', 'download', '下载为文件', () => {
    const text = extractText(el);
    if (!text) { notify('没有可下载的内容'); return; }
    const name = downloadText(text, currentToolId());
    notify('已下载 ' + name);
  });
  dlBtn.dataset.act = 'download';

  const clearBtn = makeBtn('copy-act', 'trash', '清空输入与输出', () => {
    const act = document.getElementById('act-clear');
    if (act) act.click();
    else notify('当前页面没有可清空的内容');
  });
  clearBtn.dataset.act = 'clear';

  box.append(copyBtn, dlBtn, clearBtn);
  return box;
}

function wrapOutput(el) {
  const parent = el.parentElement;
  if (parent && parent.classList.contains(WRAP_CLASS)) {
    const acts = parent.querySelector(':scope > .' + ACTS_CLASS);
    if (acts) acts.classList.toggle('is-empty', !hasContent(el));
    return parent;
  }
  if (!isOutermost(el)) return null;

  const wrap = document.createElement('div');
  wrap.className = WRAP_CLASS;
  el.parentNode.insertBefore(wrap, el);
  wrap.appendChild(el);
  const acts = createActions(el);
  acts.classList.toggle('is-empty', !hasContent(el));
  wrap.appendChild(acts);
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
 * 在工具内容容器上启用「输出工具组（复制 / 下载 / 清空）」。
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
