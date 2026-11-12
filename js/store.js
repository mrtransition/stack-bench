// 本地持久化：收藏 / 最近使用 / 主题 / Agent 配置（仅浏览器本地存储）
const KEYS = {
  favs: 'wb.favs',
  recents: 'wb.recents',
  theme: 'wb.theme',
  agent: 'wb.agent',
  httpHistory: 'wb.http.history'
};

function readJSON(key, def) {
  try {
    const v = JSON.parse(localStorage.getItem(key));
    return v == null ? def : v;
  } catch { return def; }
}
function writeJSON(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch { /* 忽略配额错误 */ }
}

export const store = {
  // ---- 收藏 ----
  favs() { return readJSON(KEYS.favs, []); },
  isFav(id) { return store.favs().includes(id); },
  toggleFav(id) {
    const f = store.favs();
    const i = f.indexOf(id);
    if (i >= 0) f.splice(i, 1); else f.unshift(id);
    writeJSON(KEYS.favs, f);
    return i < 0; // 返回是否已收藏
  },
  // ---- 最近使用 ----
  recents() { return readJSON(KEYS.recents, []); },
  pushRecent(id) {
    const r = store.recents().filter(x => x !== id);
    r.unshift(id);
    writeJSON(KEYS.recents, r.slice(0, 20));
  },
  clearRecents() { writeJSON(KEYS.recents, []); },
  // ---- 主题（默认赛博朋克）----
  theme() {
    try {
      return localStorage.getItem(KEYS.theme) || 'cyber';
    } catch { return 'cyber'; }
  },
  setTheme(t) { try { localStorage.setItem(KEYS.theme, t); } catch { } },
  // ---- 本地 Agent ----
  agent() { return readJSON(KEYS.agent, { url: 'http://127.0.0.1:7420', token: '' }); },
  setAgent(cfg) { writeJSON(KEYS.agent, cfg); },
  // ---- HTTP 调试历史（仅本地）----
  httpHistory() { return readJSON(KEYS.httpHistory, []); },
  pushHttpHistory(item) {
    const h = store.httpHistory();
    h.unshift(Object.assign({ ts: Date.now() }, item));
    writeJSON(KEYS.httpHistory, h.slice(0, 20));
  },
  clearHttpHistory() { writeJSON(KEYS.httpHistory, []); }
};
