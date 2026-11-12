// 顶栏 Agent 状态：绿点在线 / 灰点未启动 / 红点异常，点击查看启动方式
import { store } from './store.js';

let pill, dot, pop, popState, popUrl, retryBtn;
let timer = null;
let state = 'checking';

function agentBase() {
  return (store.agent().url || 'http://127.0.0.1:7420').replace(/\/+$/, '');
}

function setState(s, detail = '') {
  state = s;
  const map = {
    online: ['在线', '在线 · 可处理敏感请求'],
    offline: ['未启动', '未启动 · 敏感工具不可用'],
    error: ['异常', '异常 · 请检查 Agent 日志'],
    checking: ['检测中', '检测中…']
  };
  const [short, full] = map[s] || map.checking;
  if (pill) {
    pill.className = 'agent-pill is-' + s;
    pill.title = '本地 Agent：' + full + (detail ? '（' + detail + '）' : '');
  }
  if (popState) popState.textContent = full;
  if (popUrl) popUrl.textContent = agentBase();
}

export async function probeAgent() {
  setState('checking');
  const url = agentBase() + '/ping';
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 2500);
  try {
    const r = await fetch(url, { signal: ctrl.signal, cache: 'no-store' });
    clearTimeout(t);
    if (!r.ok) { setState('error', 'HTTP ' + r.status); return state; }
    const j = await r.json().catch(() => null);
    setState(j && j.ok ? 'online' : 'error', j && j.ok ? '' : (j && j.error) || '');
  } catch (e) {
    clearTimeout(t);
    setState('offline');
  }
  return state;
}

function closePop() { if (pop) pop.classList.add('hidden'); }

export function initAgentStatus() {
  pill = document.getElementById('agent-pill');
  dot = pill && pill.querySelector('.agent-dot');
  pop = document.getElementById('agent-pop');
  popState = document.getElementById('agent-pop-state');
  popUrl = document.getElementById('agent-pop-url');
  retryBtn = document.getElementById('agent-retry');
  if (!pill || !pop) return;

  setState('checking');
  probeAgent();
  timer = setInterval(probeAgent, 30000);

  pill.addEventListener('click', e => {
    e.stopPropagation();
    const hidden = pop.classList.contains('hidden');
    pop.classList.toggle('hidden');
    if (hidden) probeAgent();
  });
  document.addEventListener('click', e => {
    if (!pop.classList.contains('hidden') && !pop.contains(e.target) && e.target !== pill) closePop();
  });
  pop.addEventListener('click', e => e.stopPropagation());
  if (retryBtn) retryBtn.addEventListener('click', probeAgent);

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) probeAgent();
  });
  window.addEventListener('wb:agent-changed', probeAgent);
}

export function stopAgentStatus() {
  if (timer) clearInterval(timer);
}
