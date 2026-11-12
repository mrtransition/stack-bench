// 全局骨架：左侧导航（收藏 / 最近 / 分类 / 设置）、折叠记忆、移动端抽屉
import { all, CATEGORIES } from './registry.js';
import { store } from './store.js';
import { icon, CAT_ICON } from './icons.js';

const NAV_KEY = 'wb.nav.collapsed';
const EXPAND_KEY = 'wb.nav.expanded';

let shellEl, sidebarEl, bodyEl, scrimEl, toggleBtn;
let activeId = null;
let activeRoute = '/';
let expanded = new Set();

function esc(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function isMobile() { return window.matchMedia('(max-width: 767px)').matches; }

function loadExpanded() {
  try {
    const v = JSON.parse(localStorage.getItem(EXPAND_KEY));
    expanded = new Set(Array.isArray(v) ? v : []);
  } catch { expanded = new Set(); }
}
function saveExpanded() {
  try { localStorage.setItem(EXPAND_KEY, JSON.stringify([...expanded])); } catch { /* 忽略 */ }
}

export function isCollapsed() {
  try {
    const v = localStorage.getItem(NAV_KEY);
    if (v === '1') return true;
    if (v === '0') return false;
  } catch { /* 忽略 */ }
  return window.innerWidth < 1024; // 窄屏默认收起为图标栏
}
function setCollapsed(v) {
  try { localStorage.setItem(NAV_KEY, v ? '1' : '0'); } catch { /* 忽略 */ }
  shellEl.classList.toggle('nav-collapsed', v);
  toggleBtn.title = v ? '展开导航' : '折叠导航';
  toggleBtn.innerHTML = icon(v ? 'panel' : 'menu', 16);
}

function render() {
  const collapsed = isCollapsed();
  shellEl.classList.toggle('nav-collapsed', collapsed);
  if (toggleBtn) {
    toggleBtn.innerHTML = icon(collapsed ? 'panel' : 'menu', 16);
    toggleBtn.title = collapsed ? '展开导航' : '折叠导航';
  }

  const favs = store.favs();
  const recents = store.recents();
  const cat = activeId ? (all().find(t => t.id === activeId) || {}).category : null;
  if (cat && !expanded.has(cat)) expanded.add(cat);

  const catHtml = CATEGORIES.map(c => {
    const list = all().filter(t => t.category === c);
    if (!list.length) return '';
    const open = expanded.has(c);
    return `
      <div class="cat ${open ? 'open' : ''} ${cat === c ? 'cur' : ''}">
        <button class="cat-head" type="button" data-cat="${esc(c)}" title="${esc(c)}">
          <span class="chev">${icon('chevron', 11)}</span>
          <span class="si-cat">${icon(CAT_ICON[c] || 'dot', 14)}</span>
          <span class="sl">${esc(c)}</span>
          <span class="sc">${list.length}</span>
        </button>
        <div class="cat-tools ${open ? '' : 'hidden'}">
          ${list.map(t => `<a class="cat-tool ${t.id === activeId ? 'on' : ''}" href="#/tool/${t.id}" title="${esc(t.name)}">${esc(t.name)}</a>`).join('')}
        </div>
      </div>`;
  }).join('');

  bodyEl.innerHTML = `
    <nav class="side-nav">
      <div class="side-group">
        <a class="side-item ${activeRoute === '/favorites' ? 'on' : ''}" href="#/favorites" title="收藏">
          <span class="si">${icon('star', 15)}</span><span class="sl">收藏</span><span class="sc">${favs.length}</span>
        </a>
        <a class="side-item ${activeRoute === '/recent' ? 'on' : ''}" href="#/recent" title="最近使用">
          <span class="si">${icon('clock', 15)}</span><span class="sl">最近使用</span><span class="sc">${recents.length}</span>
        </a>
      </div>
      <div class="side-sep"></div>
      <div class="side-title">分类</div>
      <div class="cat-list">${catHtml}</div>
      <div class="side-sep"></div>
      <a class="side-item ${activeRoute === '/settings' ? 'on' : ''}" href="#/settings" title="设置">
        <span class="si">${icon('gearUi', 15)}</span><span class="sl">设置</span>
      </a>
      <div class="side-foot">数据默认本地处理<br>敏感操作走本机 Agent</div>
    </nav>`;

  bodyEl.querySelectorAll('.cat-head').forEach(btn => {
    btn.addEventListener('click', () => {
      if (isCollapsed() && !isMobile()) { setCollapsed(false); expanded.add(btn.dataset.cat); saveExpanded(); render(); return; }
      const c = btn.dataset.cat;
      expanded.has(c) ? expanded.delete(c) : expanded.add(c);
      saveExpanded();
      render();
    });
  });
  bodyEl.querySelectorAll('a[href^="#/"]').forEach(a => {
    a.addEventListener('click', () => closeDrawer());
  });
}

export function refreshSidebar(id, route) {
  if (id !== undefined) activeId = id;
  if (route !== undefined) activeRoute = route;
  render();
}

export function openDrawer() {
  shellEl.classList.add('drawer-open');
  scrimEl.classList.remove('hidden');
}
export function closeDrawer() {
  shellEl.classList.remove('drawer-open');
  scrimEl.classList.add('hidden');
}

export function initShell() {
  shellEl = document.getElementById('shell');
  sidebarEl = document.getElementById('sidebar');
  bodyEl = document.getElementById('sidebar-body');
  scrimEl = document.getElementById('sidebar-scrim');
  toggleBtn = document.getElementById('sidebar-toggle');
  loadExpanded();

  toggleBtn.addEventListener('click', () => {
    if (isMobile()) { shellEl.classList.contains('drawer-open') ? closeDrawer() : openDrawer(); return; }
    setCollapsed(!isCollapsed());
    render();
  });
  scrimEl.addEventListener('click', closeDrawer);
  window.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeDrawer();
  });
  window.addEventListener('resize', () => {
    if (!isMobile()) closeDrawer();
  });
  window.addEventListener('wb:fav-changed', () => render());

  render();
}
