// Web Worker 调用封装：Promise 化 + 超时保护
// opts.module: true 时创建 ES Module Worker（用于 import ESM 的 worker）
export function runWorker(path, message, opts = {}) {
  const { timeoutMs = 60000, module = false } = opts;
  return new Promise((resolve, reject) => {
    let worker;
    try { worker = new Worker(path, module ? { type: 'module' } : undefined); }
    catch (err) { reject(new Error('无法创建 Web Worker：' + err.message)); return; }
    const timer = setTimeout(() => {
      worker.terminate();
      reject(new Error('处理超时（' + Math.round(timeoutMs / 1000) + 's），请检查输入规模'));
    }, timeoutMs);
    worker.onmessage = e => {
      clearTimeout(timer);
      worker.terminate();
      if (e.data && e.data.ok) resolve(e.data);
      else {
        const err = new Error((e.data && e.data.error) || '处理失败');
        if (e.data) { err.line = e.data.line; err.col = e.data.col; }
        reject(err);
      }
    };
    worker.onerror = e => {
      clearTimeout(timer);
      worker.terminate();
      reject(new Error('Worker 加载失败：' + (e.message || path)));
    };
    worker.postMessage(message);
  });
}
