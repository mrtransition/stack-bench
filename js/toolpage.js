// 工具页统一外壳：面包屑 + 标题行 + 吸顶操作栏 + 双栏 / 单栏内容 + 说明区
import { get as getTool, EXEC_LABEL } from './registry.js';
import { store } from './store.js';
import { notify, copyText } from './toast.js';
import { encodeParams } from '../lib/codec.js';

function esc(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

const SPLIT_KEY = id => 'wb.split.' + id;
const NOTES_KEY = id => 'wb.notes.' + id;

function initSplit(body, id) {
  const grip = document.createElement('div');
  grip.className = 'split-grip';
  grip.title = '拖拽调整输入 / 输出比例，双击复位';
  body.prepend(grip);

  let saved = NaN;
  try { saved = Number(localStorage.getItem(SPLIT_KEY(id))); } catch { /* 忽略 */ }
  if (saved >= 30 && saved <= 70) body.style.setProperty('--split', saved + '%');

  let dragging = false;
  grip.addEventListener('pointerdown', e => {
    dragging = true;
    grip.setPointerCapture(e.pointerId);
    document.body.classList.add('col-resizing');
  });
  grip.addEventListener('pointermove', e => {
    if (!dragging) return;
    const r = body.getBoundingClientRect();
    if (!r.width) return;
    const pct = Math.max(30, Math.min(70, ((e.clientX - r.left) / r.width) * 100));
    body.style.setProperty('--split', pct.toFixed(2) + '%');
  });
  const end = () => {
    if (!dragging) return;
    dragging = false;
    document.body.classList.remove('col-resizing');
    const pct = parseFloat(body.style.getPropertyValue('--split'));
    if (pct) { try { localStorage.setItem(SPLIT_KEY(id), String(Math.round(pct))); } catch { /* 忽略 */ } }
  };
  grip.addEventListener('pointerup', end);
  grip.addEventListener('pointercancel', end);
  grip.addEventListener('dblclick', () => {
    body.style.removeProperty('--split');
    try { localStorage.removeItem(SPLIT_KEY(id)); } catch { /* 忽略 */ }
  });
}

export async function openTool(root, id, params) {
  const t = getTool(id);
  if (!t) {
    root.innerHTML = `
      <div class="tool-page">
        <nav class="crumbs"><a href="#/">首页</a><span class="sep">/</span><b>工具不存在</b></nav>
        <h1>工具不存在</h1>
        <p class="empty-tip">未找到 id 为「${esc(id)}」的工具。<a href="#/">返回首页</a></p>
      </div>`;
    return;
  }
  store.pushRecent(id);

  const mod = await import(t.module);
  const firstVisit = (() => {
    try { return !localStorage.getItem(NOTES_KEY(id)); } catch { return false; }
  })();

  root.innerHTML = `
    <div class="tool-page">
      <nav class="crumbs">
        <a href="#/">首页</a><span class="sep">/</span>
        <span class="crumb-cat">${esc(t.category)}</span><span class="sep">/</span>
        <b>${esc(t.name)}</b>
      </nav>

      <div class="tool-head">
        <div class="tool-title">
          <h1>${esc(t.name)}</h1>
          <p class="muted">${esc(t.desc)}</p>
          <div class="badge-row">
            <span class="badge exec-${t.executor}">⚙ ${EXEC_LABEL[t.executor] || t.executor}</span>
            ${t.sensitive ? '<span class="badge sensitive">🔒 本地处理 · 不上传</span>' : '<span class="badge">↗ 可分享</span>'}
          </div>
        </div>
        <div class="head-actions">
          <button id="fav-btn" class="icon-btn ${store.isFav(id) ? 'fav-on' : ''}" title="收藏 / 取消收藏" aria-label="收藏">★</button>
          <button id="share-btn" class="icon-btn" title="${t.shareable ? '生成分享链接' : '敏感工具不生成包含输入的分享链接'}" ${t.shareable ? '' : 'disabled'}>↗ 分享</button>
        </div>
      </div>

      <div class="action-bar">
        <button id="act-run" class="btn primary">${esc(t.actionLabel || '执行')}</button>
        <button id="act-clear" class="btn">清空</button>
        <button id="act-example" class="btn">加载示例</button>
        <button id="act-copy" class="btn">复制结果</button>
        <span id="act-status" class="act-status">就绪</span>
      </div>

      <div id="tool-body" class="${t.layout === 'split' ? 'layout-split' : ''}"></div>

      <details class="tool-notes" ${firstVisit ? 'open' : ''}>
        <summary>说明与安全提示</summary>
        <div class="notes-body">
          <p>${esc(t.notes || '')}</p>
          ${t.security ? `<p class="sec">🔒 ${esc(t.security)}</p>` : ''}
          ${t.inputSchema ? `<details><summary>输入 Schema</summary><pre class="out">${esc(JSON.stringify(t.inputSchema, null, 2))}</pre></details>` : ''}
          ${t.outputSchema ? `<details><summary>输出 Schema</summary><pre class="out">${esc(JSON.stringify(t.outputSchema, null, 2))}</pre></details>` : ''}
          ${t.examples && t.examples.length ? `<details><summary>示例数据</summary><pre class="out">${esc(t.examples[0])}</pre></details>` : ''}
        </div>
      </details>
    </div>`;

  try { localStorage.setItem(NOTES_KEY(id), '1'); } catch { /* 忽略 */ }

  const body = root.querySelector('#tool-body');
  if (t.layout === 'split') initSplit(body, id);

  const statusEl = root.querySelector('#act-status');
  const setStatus = (text, kind) => {
    statusEl.textContent = text;
    statusEl.className = 'act-status' + (kind ? ' is-' + kind : '');
  };

  const ctx = {
    params: params || {},
    notify,
    copyText,
    setStatus,
    handlers: {},
    tool: t
  };

  await mod.render(body, ctx);

  const favBtn = root.querySelector('#fav-btn');
  const syncFav = () => {
    const on = store.isFav(id);
    favBtn.classList.toggle('fav-on', on);
    favBtn.style.color = on ? '' : '';
  };
  favBtn.addEventListener('click', () => {
    const on = store.toggleFav(id);
    syncFav();
    notify(on ? '已加入本地收藏' : '已取消收藏');
    window.dispatchEvent(new CustomEvent('wb:fav-changed'));
  });
  syncFav();

  const doRun = async () => {
    if (!ctx.handlers.run) { notify('当前工具无需手动执行'); return; }
    setStatus('执行中…', 'run');
    const t0 = performance.now();
    try {
      await ctx.handlers.run();
      setStatus(`完成 · ${Math.round(performance.now() - t0)} ms`, 'ok');
    } catch (err) {
      setStatus('失败：' + (err && err.message ? err.message : err), 'err');
    }
  };

  root.querySelector('#act-run').addEventListener('click', doRun);
  root.querySelector('#act-clear').addEventListener('click', () => {
    if (ctx.handlers.clear) ctx.handlers.clear();
    setStatus('就绪', '');
  });
  root.querySelector('#act-copy').addEventListener('click', async () => {
    if (ctx.handlers.copy) await ctx.handlers.copy();
    else notify('当前工具没有可复制的结果');
  });
  root.querySelector('#act-example').addEventListener('click', () => ctx.handlers.example && ctx.handlers.example());

  const shareBtn = root.querySelector('#share-btn');
  shareBtn.addEventListener('click', () => {
    if (!t.shareable) { notify('敏感工具不生成分享链接'); return; }
    const getShare = ctx.handlers.share;
    if (!getShare) { notify('当前工具暂不支持分享'); return; }
    const state = getShare();
    const url = `${location.origin}${location.pathname}#/tool/${t.id}?p=${encodeParams(state)}`;
    copyText(url);
  });

  // 带参数打开时自动执行一次
  if (params && Object.keys(params).length && ctx.handlers.run) doRun();
}
