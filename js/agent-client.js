// 本地 Agent 调用封装（浏览器端）：读取 store 中的 Agent 地址与 Token
import { store } from './store.js';

export function agentCfg() {
  const cfg = store.agent();
  return {
    url: (cfg.url || 'http://127.0.0.1:7420').replace(/\/+$/, ''),
    token: cfg.token || ''
  };
}

/** 探测 Agent 是否可用（Origin 由浏览器自动携带） */
export async function pingAgent(timeoutMs = 4000) {
  const { url } = agentCfg();
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    const resp = await fetch(url + '/ping', { signal: ctrl.signal });
    clearTimeout(t);
    const data = await resp.json();
    return !!data.ok;
  } catch {
    return false;
  }
}

/**
 * 调用 Agent 业务端点（自动带 Token，校验 Origin 由 Agent 处理）。
 * Agent 不可用 / Token 未配置时抛出带友好提示的错误，绝不降级为其他通道。
 */
export async function callAgent(path, payload, timeoutMs = 20000) {
  const { url, token } = agentCfg();
  if (!token) throw new Error('未配置 Agent Token。启动 agent/agent.js 后，把终端打印的 Token 填入工具页设置。');
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const resp = await fetch(url + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Agent-Token': token },
      body: JSON.stringify(payload),
      signal: ctrl.signal
    });
    const data = await resp.json();
    if (!data.ok) throw new Error(data.error || 'Agent 返回错误');
    return data;
  } catch (err) {
    if (err.name === 'AbortError') throw new Error('Agent 请求超时');
    if (err.message.includes('Failed to fetch')) {
      throw new Error('无法连接本地 Agent（' + url + '）。请在 agent 目录运行 `node agent.js` 启动，并核对 Token。');
    }
    throw err;
  } finally {
    clearTimeout(t);
  }
}

/** Agent 状态提示条 HTML */
export function agentStatusHtml(ok) {
  const { url } = agentCfg();
  if (ok) return `<div class="info-box" style="border-color:var(--ok);color:var(--ok)">✅ 本地 Agent 已连接（${url}）</div>`;
  return `<div class="info-box">❌ 本地 Agent 未连接。此工具需要 Agent 在本机执行（密钥不离开本机）。<br>
    启动方式：<pre class="out" style="margin-top:6px">cd agent
node agent.js</pre>启动后将终端打印的随机 Token 填入下方设置并保存。</div>`;
}
