// 命令面板（FR-P0-01）：Ctrl/Cmd+K 唤起，分组展示，键盘与鼠标都能完成全流程
import { all, get } from './registry.js';
import { store } from './store.js';

let paletteEl, inputEl, listEl, hintsEl;
let groups = [];     // [{ title, items: [] }]
let flat = [];       // 可键盘选中的工具（与分组顺序一致）
let active = 0;
let opened = false;
let query = '';

const HOT_KEYWORDS = ['json', 'jwt', 'diff', 'color', 'http', 'yaml', 'cron', 'base64'];

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/** 命中片段高亮（不构造正则，避免特殊字符报错） */
function hl(text, q) {
  const s = String(text == null ? '' : text);
  if (!q) return esc(s);
  const i = s.toLowerCase().indexOf(q.toLowerCase());
  if (i < 0) return esc(s);
  return esc(s.slice(0, i)) +
    '<mark class="p-hit">' + esc(s.slice(i, i + q.length)) + '</mark>' +
    esc(s.slice(i + q.length));
}

/**
 * 匹配优先级：名称完全匹配 > 名称前缀 > 名称包含 > id > 关键词 > 别名 > 分类 > 描述
 * 返回 -1 表示不匹配。
 */
export function rank(tool, q) {
  if (!q) return 0;
  const name = tool.name.toLowerCase();
  const id = tool.id.toLowerCase();
  if (name === q) return 0;
  if (name.startsWith(q)) return 1;
  if (name.includes(q)) return 2;
  if (id === q) return 3;
  if (id.includes(q)) return 4;
  if (tool.keywords.some(k => k.toLowerCase().includes(q))) return 5;
  if (tool.aliases.some(a => a.toLowerCase().includes(q))) return 6;
  if (tool.category.toLowerCase().includes(q)) return 7;
  if (tool.desc.toLowerCase().includes(q)) return 8;
  return -1;
}

function search(q) {
  if (!q) return [];
  return all()
    .map(t => ({ t, r: rank(t, q) }))
    .filter(x => x.r >= 0)
    .sort((a, b) => a.r - b.r || a.t.name.localeCompare(b.t.name, 'zh'))
    .map(x => x.t);
}

function buildGroups(q) {
  const recents = store.recents().map(id => get(id)).filter(Boolean);
  const favs = all().filter(t => store.isFav(t.id));

  if (q) {
    const results = search(q);
    const out = [];
    const used = new Set();
    const r = results.filter(t => recents.some(x => x.id === t.id)).slice(0, 4);
    if (r.length) { out.push({ title: '最近使用', items: r }); r.forEach(t => used.add(t.id)); }
    const f = results.filter(t => store.isFav(t.id) && !used.has(t.id)).slice(0, 4);
    if (f.length) { out.push({ title: '收藏', items: f }); f.forEach(t => used.add(t.id)); }
    const rest = results.filter(t => !used.has(t.id));
    if (rest.length) out.push({ title: used.size ? '其他结果' : '搜索结果', items: rest });
    return out;
  }

  const out = [];
  if (recents.length) out.push({ title: '最近使用', items: recents.slice(0, 6) });
  const used = new Set(recents.slice(0, 6).map(t => t.id));
  const f = favs.filter(t => !used.has(t.id)).slice(0, 8);
  if (f.length) { out.push({ title: '收藏', items: f }); f.forEach(t => used.add(t.id)); }
  const rest = all().filter(t => !used.has(t.id));
  if (rest.length) out.push({ title: '全部工具', items: rest });
  return out;
}

function badgeHtml(t) {
  const label = { browser: '本地', worker: 'Worker', agent: 'Agent', hybrid: '混合' }[t.executor] || t.executor;
  return `<span class="p-meta"><span class="p-cat">${esc(t.category)}</span><span class="badge exec-${t.executor}">${label}</span></span>`;
}

function renderHints(empty) {
  if (!hintsEl) return;
  const show = !query || empty;
  hintsEl.classList.toggle('hidden', !show);
  if (!show) return;
  hintsEl.innerHTML = `<span class="p-hint-label">热门</span>` +
    HOT_KEYWORDS.map(k => `<button type="button" class="p-hint" data-q="${k}">${k}</button>`).join('');
}

function renderList() {
  flat = groups.flatMap(g => g.items);
  renderHints(!flat.length);

  if (!flat.length) {
    listEl.innerHTML = `<li class="none">未找到「${esc(query)}」相关工具 — 换个关键词，或点上面的热门词试试。</li>`;
    return;
  }
  let i = -1;
  listEl.innerHTML = groups.map(g => `
    <li class="p-group">${g.title}<span class="p-count">${g.items.length}</span></li>
    ${g.items.map(t => {
      i++;
      return `<li class="p-item ${i === active ? 'active' : ''}" data-i="${i}" role="option" aria-selected="${i === active}">
        <span class="t-name">${hl(t.name, query)}</span>
        <span class="t-desc">${hl(t.desc, query)}</span>
        ${badgeHtml(t)}
      </li>`;
    }).join('')}
  `).join('');
  const activeEl = listEl.querySelector('li.active');
  if (activeEl) activeEl.scrollIntoView({ block: 'nearest' });
}

/**
 * 切换高亮项：只改 class，不重建列表。
 * 悬停若重建整表，鼠标按下与抬起会落在两个不同节点上，click 不会触发。
 */
function setActive(i, scroll = false) {
  active = i;
  for (const li of listEl.querySelectorAll('li.p-item')) {
    const on = Number(li.dataset.i) === i;
    li.classList.toggle('active', on);
    li.setAttribute('aria-selected', String(on));
    if (on && scroll) li.scrollIntoView({ block: 'nearest' });
  }
}

function refresh() {
  query = inputEl.value.trim().toLowerCase();
  groups = buildGroups(query);
  active = 0;
  renderList();
}

function openTool(id) {
  close();
  location.hash = `#/tool/${id}`;
}

function open(initialQuery = '') {
  opened = true;
  paletteEl.classList.remove('hidden');
  inputEl.value = initialQuery;
  refresh();
  inputEl.focus();
  inputEl.select();
}

function close() {
  opened = false;
  paletteEl.classList.add('hidden');
}

function onKeyDown(e) {
  if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
    e.preventDefault();
    opened ? close() : open();
    return;
  }
  if (!opened) return;
  if (e.key === 'Escape') { e.preventDefault(); close(); }
  else if (e.key === 'ArrowDown') { e.preventDefault(); setActive(Math.min(active + 1, flat.length - 1), true); }
  else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(Math.max(active - 1, 0), true); }
  else if (e.key === 'Enter') { e.preventDefault(); if (flat[active]) openTool(flat[active].id); }
}

export function initPalette() {
  paletteEl = document.getElementById('palette');
  inputEl = document.getElementById('palette-input');
  listEl = document.getElementById('palette-results');

  // 热门关键词行（空输入 / 无结果时出现）
  hintsEl = document.createElement('div');
  hintsEl.className = 'p-hints';
  inputEl.insertAdjacentElement('afterend', hintsEl);
  hintsEl.addEventListener('click', e => {
    const btn = e.target.closest('[data-q]');
    if (!btn) return;
    inputEl.value = btn.dataset.q;
    refresh();
    inputEl.focus();
  });

  document.getElementById('open-search').addEventListener('click', () => open());
  paletteEl.addEventListener('mousedown', e => { if (e.target === paletteEl) close(); });
  inputEl.addEventListener('input', refresh);
  document.addEventListener('keydown', onKeyDown);
  window.addEventListener('wb:open-palette', e => open(e.detail || ''));

  // 事件委托（listEl 常驻）：悬停高亮、点击整行直接跳转
  listEl.addEventListener('pointerover', e => {
    const li = e.target.closest('li.p-item');
    if (li) setActive(Number(li.dataset.i));
  });
  listEl.addEventListener('click', e => {
    const li = e.target.closest('li.p-item');
    if (!li) return;
    e.preventDefault();
    const tool = flat[Number(li.dataset.i)];
    if (tool) openTool(tool.id);
  });
}

// 供首页搜索框直接带词唤起
export function openPaletteWith(q) { open(q); }
