// 应用入口：路由 + 首页 / 收藏 / 最近 / 设置
import { all, get, CATEGORIES } from './registry.js';
import { openTool } from './toolpage.js';
import { renderSettings } from './settings.js';
import { store } from './store.js';
import { initPalette } from './palette.js';
import { decodeParams } from '../lib/codec.js';
import { notify } from './toast.js';
import { initShell, refreshSidebar, closeDrawer } from './shell.js';
import { initTheme } from './theme.js';
import { initAgentStatus } from './agent-status.js';
import { icon, CAT_ICON } from './icons.js';

const app = document.getElementById('app');

export function esc(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function execBadge(t) {
  const label = { browser: '本地', worker: 'Worker', agent: 'Agent', hybrid: '本地 / Agent' }[t.executor] || t.executor;
  return `<span class="badge exec-${t.executor}"><i class="dot" aria-hidden="true"></i>${label}</span>${t.sensitive ? `<span class="badge sensitive">${icon('lock', 11)} 敏感</span>` : ''}`;
}

function card(t) {
  return `
    <a class="tool-card" href="#/tool/${t.id}" data-cat="${esc(t.category)}">
      <div class="tc-top">
        <span class="tc-icon">${icon(CAT_ICON[t.category] || 'dot', 16)}</span>
        <h3>${esc(t.name)}</h3>
        <button class="fav-btn ${store.isFav(t.id) ? 'on' : ''}" data-fav="${t.id}" title="收藏 / 取消收藏" aria-label="收藏 / 取消收藏">${icon('star', 15)}</button>
      </div>
      <p>${esc(t.desc)}</p>
      <div class="badge-row">${execBadge(t)}</div>
    </a>`;
}

function bindFav(root) {
  root.querySelectorAll('[data-fav]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.preventDefault();
      e.stopPropagation();
      const on = store.toggleFav(btn.dataset.fav);
      btn.classList.toggle('on', on);
      notify(on ? '已加入本地收藏' : '已取消收藏');
      window.dispatchEvent(new CustomEvent('wb:fav-changed'));
    });
  });
}

const HOT_KEYWORDS = ['json', 'jwt', 'diff', 'color', 'http', 'yaml', 'cron', 'base64'];

function chip(t) {
  return `<a class="chip" href="#/tool/${t.id}">${icon(CAT_ICON[t.category] || 'dot', 12)}${esc(t.name)}</a>`;
}

function renderHome() {
  const tools = all();
  const favs = tools.filter(t => store.isFav(t.id)).slice(0, 8);
  const recents = store.recents().map(id => get(id)).filter(Boolean).slice(0, 6);
  const total = tools.length;

  const tabs = [`<button class="cat-tab on" data-cat="*" type="button">${icon('home', 14)}全部<span class="tab-count">${total}</span></button>`]
    .concat(CATEGORIES.map(c => {
      const n = tools.filter(t => t.category === c).length;
      if (!n) return '';
      return `<button class="cat-tab" data-cat="${esc(c)}" type="button">${icon(CAT_ICON[c] || 'dot', 14)}${esc(c)}<span class="tab-count">${n}</span></button>`;
    })).join('');

  app.innerHTML = `
    <section class="home-hero">
      <div class="hero-kicker">全栈工程师 · 本地优先工具箱</div>
      <h1>StackBench</h1>
      <p class="hero-sub">${total} 个常用工具 · 所有数据在浏览器本地处理，不上传服务器</p>
      <button class="home-search" id="home-search" type="button">
        ${icon('search', 16, 'hs-ico')}
        <span class="hs-txt">搜索 ${total} 个工具…</span>
        <kbd>Ctrl K</kbd>
      </button>
      <div class="kw-row">
        <span class="kw-label">热门</span>
        ${HOT_KEYWORDS.map(k => `<button class="kw" type="button" data-kw="${k}">${k}</button>`).join('')}
      </div>
    </section>

    <section class="quick-row">
      <div class="quick-col">
        <div class="quick-head">${icon('star', 13)}收藏<a class="sec-more" href="#/favorites">全部</a></div>
        ${favs.length
          ? `<div class="chip-row">${favs.map(chip).join('')}</div>`
          : `<div class="empty-tip">还没有收藏，点工具卡片右上角的星标即可固定（最多展示 8 个）。</div>`}
      </div>
      <div class="quick-col">
        <div class="quick-head">${icon('clock', 13)}最近使用<a class="sec-more" href="#/recent">全部</a></div>
        ${recents.length
          ? `<div class="chip-row">${recents.map(chip).join('')}</div>`
          : `<div class="empty-tip">打开任意工具后会记录在这里，最多保留 20 条。</div>`}
      </div>
    </section>

    <nav class="cat-tabs" id="cat-tabs" aria-label="按分类筛选工具">${tabs}</nav>
    <div class="grid home-grid" id="home-grid">${tools.map(card).join('')}</div>

    <details class="safe-line">
      <summary>${icon('lock', 13)}安全约定：所有工具默认在浏览器本地处理数据；敏感操作走 <b>127.0.0.1 本地 Agent</b>；分享链接不含敏感字段<span class="more">详情</span></summary>
      <div class="safe-detail">需要密钥、证书或内网请求的工具通过本机 Agent 执行，Agent 未启动时不会发送任何数据，也不会降级为云端上传；分享链接只编码非敏感输入参数，可在「设置 → 本地数据」一键清空所有本地记录。</div>
    </details>`;

  const grid = app.querySelector('#home-grid');
  app.querySelectorAll('.cat-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      app.querySelectorAll('.cat-tab').forEach(t => t.classList.toggle('on', t === tab));
      const cat = tab.dataset.cat;
      grid.querySelectorAll('.tool-card').forEach(c => {
        c.hidden = cat !== '*' && c.dataset.cat !== cat;
      });
    });
  });

  const hs = app.querySelector('#home-search');
  hs.addEventListener('click', () => document.getElementById('open-search').click());
  // 关键词快捷入口：带入查询唤起面板
  app.querySelectorAll('[data-kw]').forEach(btn => {
    btn.addEventListener('click', () => {
      window.dispatchEvent(new CustomEvent('wb:open-palette', { detail: btn.dataset.kw }));
    });
  });
  bindFav(app);
}

function renderCollection(kind) {
  const isFav = kind === 'fav';
  let list;
  if (isFav) list = all().filter(t => store.isFav(t.id));
  else list = store.recents().map(id => get(id)).filter(Boolean);

  app.innerHTML = `
    <nav class="crumbs"><a href="#/">首页</a><span class="sep">/</span><b>${isFav ? '收藏' : '最近使用'}</b></nav>
    <div class="tool-head">
      <div>
        <h1>${icon(isFav ? 'star' : 'clock', 18)} ${isFav ? '收藏' : '最近使用'}</h1>
        <p class="muted">${isFav ? '固定在首页与导航的高频工具。' : '按最近打开时间排序，最多保留 20 条。'}</p>
      </div>
      ${!isFav && list.length ? '<div class="head-actions"><button id="clear-recents" class="btn">清空记录</button></div>' : ''}
    </div>
    ${list.length
      ? `<div class="grid">${list.map(card).join('')}</div>`
      : `<div class="empty-tip">${isFav ? '暂无收藏，点击任意工具卡片右上角的星标即可收藏。' : '暂无记录，去首页挑一个工具开始吧。'}</div>`}`;

  bindFav(app);
  const clearBtn = app.querySelector('#clear-recents');
  if (clearBtn) clearBtn.addEventListener('click', () => { store.clearRecents(); renderCollection('recent'); refreshSidebar(null, '/recent'); });
}

function renderNotFound() {
  app.innerHTML = `
    <div class="tool-page">
      <h1>页面不存在</h1>
      <p class="empty-tip">链接可能已失效。<a href="#/">返回首页</a></p>
    </div>`;
}

async function route() {
  const hash = location.hash.replace(/^#/, '') || '/';
  const qi = hash.indexOf('?');
  const path = qi >= 0 ? hash.slice(0, qi) : hash;
  const query = new URLSearchParams(qi >= 0 ? hash.slice(qi + 1) : '');

  closeDrawer();
  let activeId = null;

  if (path === '/' || path === '') {
    renderHome();
  } else if (path.startsWith('/tool/')) {
    activeId = path.slice('/tool/'.length);
    let params = null;
    const p = query.get('p');
    if (p) {
      params = decodeParams(p);
      if (params === null) notify('分享链接参数无法解析');
    }
    await openTool(app, activeId, params);
  } else if (path === '/favorites') {
    renderCollection('fav');
  } else if (path === '/recent') {
    renderCollection('recent');
  } else if (path === '/settings') {
    renderSettings(app);
  } else {
    renderNotFound();
  }

  refreshSidebar(activeId, path);
  window.scrollTo(0, 0);
}

// 顶栏静态图标占位（index.html 中 data-icon 元素）
document.querySelectorAll('[data-icon]').forEach(el => {
  el.innerHTML = icon(el.dataset.icon, 16);
});

initTheme();
initShell();
initPalette();
initAgentStatus();
window.addEventListener('hashchange', route);
route();
