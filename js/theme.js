// 主题控制：赛博朋克（默认）/ 深色 / 浅色
import { store } from './store.js';

export const THEMES = [
  { id: 'cyber', icon: '⚡', name: '赛博朋克' },
  { id: 'dark', icon: '🌙', name: '深色' },
  { id: 'light', icon: '☀️', name: '浅色' }
];

export function currentTheme() {
  return document.documentElement.dataset.theme || 'cyber';
}

export function applyTheme(id) {
  const cur = THEMES.find(x => x.id === id) || THEMES[0];
  document.documentElement.dataset.theme = cur.id;
  store.setTheme(cur.id);
  const btn = document.getElementById('theme-toggle');
  if (btn) {
    btn.textContent = cur.icon;
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
