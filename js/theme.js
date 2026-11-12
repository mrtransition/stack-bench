// 主题控制：深色（默认）/ 浅色 / 赛博朋克（彩蛋）
// 循环顺序 dark → light → cyber，首次访问跟随系统（见 index.html 预加载）
import { store } from './store.js';
import { icon } from './icons.js';

export const THEMES = [
  { id: 'dark', icon: 'moon', name: '深色' },
  { id: 'light', icon: 'sun', name: '浅色' },
  { id: 'cyber', icon: 'zap', name: '赛博朋克' }
];

export function currentTheme() {
  const t = document.documentElement.dataset.theme;
  return THEMES.some(x => x.id === t) ? t : 'dark';
}

export function applyTheme(id) {
  const cur = THEMES.find(x => x.id === id) || THEMES[0];
  document.documentElement.dataset.theme = cur.id;
  store.setTheme(cur.id);
  const btn = document.getElementById('theme-toggle');
  if (btn) {
    btn.innerHTML = icon(cur.icon, 16);
    btn.title = `当前：${cur.name} · 点击切换`;
  }
  window.dispatchEvent(new CustomEvent('wb:theme-changed', { detail: cur.id }));
}

export function initTheme() {
  applyTheme(currentTheme());
  const btn = document.getElementById('theme-toggle');
  if (!btn) return;
  btn.addEventListener('click', () => {
    const i = THEMES.findIndex(x => x.id === currentTheme());
    applyTheme(THEMES[(i + 1) % THEMES.length].id);
  });
}
