// 命令面板（FR-P0-01）：Ctrl/Cmd+K 唤起，分组展示，键盘可完成全流程
import { all, get } from './registry.js';
import { store } from './store.js';

let paletteEl, inputEl, listEl;
let groups = [];     // [{ title, items: [] }]
let flat = [];       // 可键盘选中的工具（与分组顺序一致）
let active = 0;
let opened = false;

function score(tool, q) {
  if (!q) return 0;
  q = q.toLowerCase();
  let s = 0;
  const name = tool.name.toLowerCase();
  if (name === q) s += 100;
  else if (name.startsWith(q)) s += 80;
  else if (name.includes(q)) s += 60;
  if (tool.id.toLowerCase().includes(q)) s += 40;
  if (tool.keywords.some(k => k.toLowerCase().includes(q))) s += 50;
  if (tool.aliases.some(a => a.toLowerCase().includes(q))) s += 50;
  if (tool.category.toLowerCase().includes(q)) s += 30;
  if (s > 0) {
    if (store.recents().includes(tool.id)) s += 10;
    if (store.isFav(tool.id)) s += 5;
  }
  return s;
}

function search(q) {
  return all()
    .map(t => ({ t, s: score(t, q) }))
    .filter(x => x.s > 0)
    .sort((a, b) => b.s - a.s || a.t.name.localeCompare(b.t.name, 'zh'))
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
    if (rest.length) out.push({ title: used.size ? '搜索结果' : '全部结果', items: rest });
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
  return `<span class="p-meta"><span class="p-cat">${t.category}</span><span class="badge exec-${t.executor}">${label}</span></span>`;
}

function renderList() {
  flat = groups.flatMap(g => g.items);
  if (!flat.length) {
    listEl.innerHTML = '<li class="none">未找到工具 — 换个关键词试试，或用 Ctrl K 浏览全部。</li>';
    return;
  }
  let i = -1;
  listEl.innerHTML = groups.map(g => `
    <li class="p-group">${g.title}<span class="p-count">${g.items.length}</span></li>
    ${g.items.map(t => {
      i++;
      return `<li class="p-item ${i === active ? 'active' : ''}" data-i="${i}" role="option">
        <span class="t-name">${t.name}</span>
        <span class="t-desc">${t.desc}</span>
        ${badgeHtml(t)}
      </li>`;
    }).join('')}
  `).join('');
  const activeEl = listEl.querySelector('li.active');
  if (activeEl) activeEl.scrollIntoView({ block: 'nearest' });
  listEl.querySelectorAll('li.p-item').forEach(li => {
    li.addEventListener('mouseenter', () => { active = +li.dataset.i; renderList(); });
    li.addEventListener('click', () => openTool(flat[+li.dataset.i].id));
  });
}

function refresh() {
  groups = buildGroups(inputEl.value.trim());
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
  else if (e.key === 'ArrowDown') { e.preventDefault(); active = Math.min(active + 1, flat.length - 1); renderList(); }
  else if (e.key === 'ArrowUp') { e.preventDefault(); active = Math.max(active - 1, 0); renderList(); }
  else if (e.key === 'Enter') { e.preventDefault(); if (flat[active]) openTool(flat[active].id); }
}

export function initPalette() {
  paletteEl = document.getElementById('palette');
  inputEl = document.getElementById('palette-input');
  listEl = document.getElementById('palette-results');

  document.getElementById('open-search').addEventListener('click', () => open());
  paletteEl.addEventListener('mousedown', e => { if (e.target === paletteEl) close(); });
  inputEl.addEventListener('input', refresh);
  document.addEventListener('keydown', onKeyDown);
  window.addEventListener('wb:open-palette', e => open(e.detail || ''));
}

// 供首页搜索框直接带词唤起
export function openPaletteWith(q) { open(q); }
