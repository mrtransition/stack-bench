// 输入区增强：拖拽文件 / 粘贴即填（JSON、YAML、日志等文本工具通用）
// 约定：工具渲染出的第一个 textarea.io（或 textarea / input.txt）作为填充目标。
import { notify } from './toast.js';

let controller = null;

function pickTarget(scope) {
  return scope.querySelector('textarea.io:not([disabled]), textarea:not([disabled]), input.txt:not([disabled])');
}

function hasFiles(e) {
  const dt = e.dataTransfer;
  if (!dt) return false;
  return Array.from(dt.types || []).includes('Files');
}

function fill(scope, text, source) {
  const target = pickTarget(scope);
  if (!target) return false;
  target.value = text;
  target.dispatchEvent(new Event('input', { bubbles: true }));
  target.dispatchEvent(new Event('change', { bubbles: true }));
  target.focus();
  target.scrollIntoView({ block: 'nearest' });
  notify(source ? `已填入 ${source}` : '已填入剪贴板内容');
  return true;
}

/**
 * 在工具内容容器上启用拖拽 / 粘贴填充。切换工具时自动解绑上一次的监听。
 * @param {HTMLElement} scope #tool-body
 */
export function mountInputDrop(scope) {
  if (!scope) return;
  if (controller) controller.abort();
  controller = new AbortController();
  const { signal } = controller;

  let depth = 0;
  const highlight = on => scope.classList.toggle('drop-active', on);

  scope.addEventListener('dragenter', e => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    depth++;
    highlight(true);
  }, { signal });

  scope.addEventListener('dragover', e => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
    highlight(true);
  }, { signal });

  scope.addEventListener('dragleave', () => {
    depth = Math.max(0, depth - 1);
    if (!depth) highlight(false);
  }, { signal });

  scope.addEventListener('drop', async e => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    depth = 0;
    highlight(false);
    const file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      notify('文件超过 2 MB，建议直接粘贴需要的片段');
      return;
    }
    try {
      const text = await file.text();
      fill(scope, text, file.name);
    } catch (err) {
      notify('读取文件失败：' + (err && err.message ? err.message : err));
    }
  }, { signal });

  // 页面任意处粘贴：焦点不在输入框时，填入工具的第一个输入框
  document.addEventListener('paste', e => {
    if (!scope.isConnected) return;
    const ae = document.activeElement;
    if (ae && (ae.tagName === 'TEXTAREA' || (ae.tagName === 'INPUT' && ae.type === 'text'))) return;
    const text = e.clipboardData && e.clipboardData.getData('text');
    if (!text || !text.trim()) return;
    if (fill(scope, text, '')) e.preventDefault();
  }, { signal });
}
