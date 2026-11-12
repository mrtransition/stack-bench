// 内联 SVG 图标（线性、stroke: currentColor，零依赖零 CDN）
// 用法：import { icon, CAT_ICON } from './icons.js';
//       icon('search', 16)  → <svg ...>
//       CAT_ICON['数据格式'] → 'braces'

const PATHS = {
  // ---- 分类 ----
  braces: '<path d="M8.5 4c-2 0-3 1.1-3 3v2.2c0 1.4-.7 2.3-2 2.8 1.3.5 2 1.4 2 2.8V17c0 1.9 1 3 3 3"/><path d="M15.5 4c2 0 3 1.1 3 3v2.2c0 1.4.7 2.3 2 2.8-1.3.5-2 1.4-2 2.8V17c0 1.9-1 3-3 3"/>',
  swap: '<path d="M4 8.5h13.5"/><path d="M14.5 5.5l3 3-3 3"/><path d="M20 15.5H6.5"/><path d="M9.5 12.5l-3 3 3 3"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  shield: '<path d="M12 3.5l6.5 2.6v4.9c0 4.3-2.8 7.9-6.5 9.5-3.7-1.6-6.5-5.2-6.5-9.5V6.1z"/><path d="M9.3 12l2 2 3.6-4.2"/>',
  text: '<path d="M4 6.5h16M4 12h16M4 17.5h9"/>',
  api: '<path d="M3.5 12H17"/><path d="M13.5 8l4 4-4 4"/><path d="M3.5 7v10"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 3v2.2M12 18.8V21M3 12h2.2M18.8 12H21M5.6 5.6l1.6 1.6M16.8 16.8l1.6 1.6M18.4 5.6l-1.6 1.6M7.2 16.8l-1.6 1.6"/>',
  diamond: '<path d="M12 3.5l8.5 8.5-8.5 8.5L3.5 12z"/><path d="M12 8l4 4-4 4-4-4z"/>',
  spark: '<path d="M12 4l1.7 4.8L18.5 10.5l-4.8 1.7L12 17l-1.7-4.8L5.5 10.5l4.8-1.7z"/><path d="M18.5 16.5l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z"/>',

  // ---- 通用 UI ----
  search: '<circle cx="11" cy="11" r="6.5"/><path d="M15.8 15.8L21 21"/>',
  star: '<path d="M12 3.8l2.5 5 5.5.8-4 3.9.9 5.5-4.9-2.6-4.9 2.6.9-5.5-4-3.9 5.5-.8z"/>',
  gearUi: '<circle cx="12" cy="12" r="3"/><path d="M12 3v2.2M12 18.8V21M3 12h2.2M18.8 12H21M5.6 5.6l1.6 1.6M16.8 16.8l1.6 1.6M18.4 5.6l-1.6 1.6M7.2 16.8l-1.6 1.6"/>',
  chevron: '<path d="M9.5 6.5l5.5 5.5-5.5 5.5"/>',
  chevronDown: '<path d="M6.5 9.5L12 15l5.5-5.5"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  panel: '<path d="M10 5H5v5M14 5h5v5M10 19H5v-5M14 19h5v-5"/>',
  moon: '<path d="M20 14.5A8.2 8.2 0 1 1 9.5 4 6.6 6.6 0 0 0 20 14.5z"/>',
  sun: '<circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M4.9 4.9l1.6 1.6M17.5 17.5l1.6 1.6M19.1 4.9l-1.6 1.6M6.5 17.5l-1.6 1.6"/>',
  zap: '<path d="M13 3L5.5 13.5h5.5l-1 7.5L18.5 10.5H13z"/>',
  copy: '<rect x="9" y="9" width="11.5" height="11.5" rx="2"/><path d="M4.5 14.5V6A2 2 0 0 1 6.5 4h8.5"/>',
  download: '<path d="M12 4v10.5M8 11l4 4 4-4M5 19.5h14"/>',
  trash: '<path d="M4.5 7h15M9.5 7V5.5A1.5 1.5 0 0 1 11 4h2a1.5 1.5 0 0 1 1.5 1.5V7M6.8 7l.9 12.2a1.5 1.5 0 0 0 1.5 1.3h5.6a1.5 1.5 0 0 0 1.5-1.3L17.2 7"/>',
  share: '<path d="M14 4.5h5.5V10"/><path d="M19.5 4.5L11 13"/><path d="M19.5 13.5v4A1.5 1.5 0 0 1 18 19H6a1.5 1.5 0 0 1-1.5-1.5v-12A1.5 1.5 0 0 1 6 4h4.5"/>',
  lock: '<rect x="5.5" y="10.5" width="13" height="9.5" rx="2"/><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5"/><path d="M12 14v2.5"/>',
  terminal: '<path d="M4.5 7.5l4.5 4.5-4.5 4.5M12 17h7.5"/>',
  play: '<path d="M8 5.5v13l10.5-6.5z"/>',
  wand: '<path d="M6 18L17.5 6.5"/><path d="M15.5 4.5l1 2 2 1-2 1-1 2-1-2-2-1 2-1z"/><path d="M5.5 5.5l.6 1.4 1.4.6-1.4.6-.6 1.4-.6-1.4L3.5 7.5l1.4-.6z"/>',
  eraser: '<path d="M5 16.5L13.5 8a2 2 0 0 1 2.8 0l2.7 2.7a2 2 0 0 1 0 2.8L12 20.5H8z"/><path d="M9 20.5h10.5"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 8.5"/>',
  warn: '<path d="M12 4.5L2.8 20h18.4z"/><path d="M12 10v4.2"/><path d="M12 17.2v.1"/>',
  info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11.2V16"/><path d="M12 8.2v.1"/>',
  keyboard: '<rect x="3" y="7" width="18" height="10.5" rx="2"/><path d="M7 11h.1M10.5 11h.1M14 11h.1M17.5 11h.1M7.5 14.5h9"/>',
  bookmark: '<path d="M7 4.5h10a1 1 0 0 1 1 1V20l-6-3.5L6 20V5.5a1 1 0 0 1 1-1z"/>',
  home: '<path d="M4.5 11L12 4.5l7.5 6.5"/><path d="M6.5 10v9.5h11V10"/>',
  palette: '<circle cx="12" cy="12" r="8.5"/><circle cx="9" cy="10" r="1"/><circle cx="14.5" cy="8.8" r="1"/><circle cx="15.8" cy="13.5" r="1"/><path d="M12 20.5c-1.8 0-3-1.2-3-2.7 0-1.6 1.3-2.3 3-2.3s2.8-.5 2.8-2"/>',
  dot: '<circle cx="12" cy="12" r="3.5" fill="currentColor" stroke="none"/>',
  agent: '<rect x="3.5" y="5" width="17" height="14" rx="2"/><path d="M7.5 9.5l3 2.5-3 2.5M12.5 15h4"/>'
};

export function icon(name, size = 16, cls = '') {
  const body = PATHS[name] || PATHS.dot;
  const s = `width="${size}" height="${size}"`;
  const c = cls ? ` class="${cls}"` : '';
  return `<svg${c} ${s} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${body}</svg>`;
}

/** 分类 → 图标名 */
export const CAT_ICON = {
  '数据格式': 'braces',
  '编码转换': 'swap',
  '时间与任务': 'clock',
  '安全与鉴权': 'shield',
  '文本处理': 'text',
  'API 调试': 'api',
  '配置与网络': 'gear',
  '前端资源': 'diamond',
  '通用工具': 'spark'
};
