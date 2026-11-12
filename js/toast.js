// 轻量 Toast 提示
let el = null, timer = null;

export function notify(msg, ms = 2000) {
  if (!el) el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.classList.remove('hidden');
  clearTimeout(timer);
  timer = setTimeout(() => el.classList.add('hidden'), ms);
}

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    notify('已复制到剪贴板');
    return true;
  } catch {
    // 降级方案
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch { ok = false; }
    ta.remove();
    notify(ok ? '已复制到剪贴板' : '复制失败，请手动复制');
    return ok;
  }
}
