// 设置页：外观主题 / 本地 Agent / 本地数据 / 快捷键
import { store } from './store.js';
import { notify } from './toast.js';
import { THEMES, applyTheme, currentTheme } from './theme.js';
import { probeAgent } from './agent-status.js';
import { icon } from './icons.js';

function esc(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

const SWATCH = {
  cyber: ['#05040c', '#ff2ea6', '#00e7ff'],
  dark: ['#0f1115', '#4f8cff', '#22c8e0'],
  light: ['#f5f6f8', '#2f6fe4', '#0d8fa8']
};

export function renderSettings(app) {
  const agent = store.agent();
  const favN = store.favs().length;
  const recentN = store.recents().length;
  const histN = store.httpHistory().length;

  app.innerHTML = `
    <nav class="crumbs"><a href="#/">首页</a><span class="sep">/</span><b>设置</b></nav>
    <div class="tool-head">
      <div>
        <h1>${icon('gearUi', 18)} 设置</h1>
        <p class="muted">外观、本地 Agent 与本地数据管理。所有配置只保存在当前浏览器。</p>
      </div>
    </div>

    <section class="set-sec">
      <h2>外观主题</h2>
      <div class="theme-cards" id="theme-cards">
        ${THEMES.map(t => `
          <button class="theme-card ${currentTheme() === t.id ? 'on' : ''}" data-theme-id="${t.id}" type="button">
            <span class="tc-swatch">${SWATCH[t.id].map(c => `<i style="background:${c}"></i>`).join('')}</span>
            <span class="tc-name">${icon(t.icon, 14)} ${t.name}</span>
            <span class="tc-desc">${t.id === 'dark' ? '默认 · 低干扰中性深色' : t.id === 'light' ? '明亮环境使用' : '彩蛋 · 霓虹描边与网格底纹'}</span>
          </button>`).join('')}
      </div>
    </section>

    <section class="set-sec">
      <h2>本地 Agent</h2>
      <p class="set-desc">HTTP 调试、证书解析、HMAC / JWT 验签、YAML 校验通过本机 Agent 执行。Agent 仅监听 127.0.0.1，并校验 Origin 与随机 Token。</p>
      <div class="set-grid">
        <div class="field">
          <label for="set-agent-url">Agent 地址</label>
          <input id="set-agent-url" class="txt" value="${esc(agent.url || 'http://127.0.0.1:7420')}" spellcheck="false">
        </div>
        <div class="field">
          <label for="set-agent-token">访问 Token（启动 Agent 时终端打印）</label>
          <input id="set-agent-token" class="txt" value="${esc(agent.token || '')}" placeholder="粘贴终端里的 Token" spellcheck="false">
        </div>
      </div>
      <div class="action-bar" style="margin-top:4px">
        <button id="set-agent-save" class="btn primary" type="button">保存</button>
        <button id="set-agent-test" class="btn" type="button">测试连接</button>
        <span id="set-agent-result" class="act-status"></span>
      </div>
      <details class="set-details">
        <summary>如何启动本地 Agent</summary>
        <pre class="out"># 在项目根目录执行（推荐，一条命令起站点 + Agent）
npm run dev

# 只启动 Agent
npm run agent

# 自定义端口
AGENT_PORT=7420 npm run agent</pre>
        <p class="set-desc">启动后终端会打印完整地址（如 <code>http://127.0.0.1:7420</code>）与随机 Token，填入上方保存即可。Agent 未启动时敏感工具不会发送任何数据，也不会降级为云端上传。</p>
      </details>
    </section>

    <section class="set-sec">
      <h2>本地数据</h2>
      <div class="data-rows">
        <div class="data-row"><span>收藏工具</span><b>${favN}</b><button class="btn" data-clear="favs" ${favN ? '' : 'disabled'}>清空</button></div>
        <div class="data-row"><span>最近使用</span><b>${recentN}</b><button class="btn" data-clear="recents" ${recentN ? '' : 'disabled'}>清空</button></div>
        <div class="data-row"><span>HTTP 请求历史</span><b>${histN}</b><button class="btn" data-clear="history" ${histN ? '' : 'disabled'}>清空</button></div>
      </div>
      <p class="set-desc">以上数据保存在 localStorage，仅当前浏览器可见。分享链接只包含工具参数，不包含密钥。</p>
    </section>

    <section class="set-sec">
      <h2>快捷键</h2>
      <div class="kv-table">
        <div class="kv-t"><kbd>Ctrl</kbd> / <kbd>Cmd</kbd> + <kbd>K</kbd><span>唤起命令面板</span></div>
        <div class="kv-t"><kbd>↑</kbd> <kbd>↓</kbd><span>在面板中移动选择</span></div>
        <div class="kv-t"><kbd>Enter</kbd><span>打开选中工具</span></div>
        <div class="kv-t"><kbd>Esc</kbd><span>关闭面板 / 抽屉</span></div>
        <div class="kv-t"><kbd>${icon('menu', 11)}</kbd><span>折叠 / 展开左侧导航（顶栏左侧按钮）</span></div>
      </div>
    </section>

    <section class="set-sec">
      <h2>关于</h2>
      <p class="set-desc">StackBench · 全栈工程师工具集。零构建静态站点（原生 ES Module），工具逻辑与 UI 分离，核心逻辑有 node:test 单测覆盖。</p>
    </section>`;

  // 主题
  app.querySelectorAll('[data-theme-id]').forEach(btn => {
    btn.addEventListener('click', () => {
      applyTheme(btn.dataset.themeId);
      app.querySelectorAll('[data-theme-id]').forEach(b => b.classList.toggle('on', b === btn));
    });
  });

  // Agent 配置
  const urlEl = app.querySelector('#set-agent-url');
  const tokenEl = app.querySelector('#set-agent-token');
  const resultEl = app.querySelector('#set-agent-result');
  app.querySelector('#set-agent-save').addEventListener('click', () => {
    const url = urlEl.value.trim().replace(/\/+$/, '') || 'http://127.0.0.1:7420';
    store.setAgent({ url, token: tokenEl.value.trim() });
    notify('Agent 配置已保存');
    window.dispatchEvent(new CustomEvent('wb:agent-changed'));
  });
  app.querySelector('#set-agent-test').addEventListener('click', async () => {
    const url = (urlEl.value.trim() || 'http://127.0.0.1:7420').replace(/\/+$/, '');
    resultEl.textContent = '连接中…';
    resultEl.className = 'act-status is-run';
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 2500);
      const r = await fetch(url + '/ping', { signal: ctrl.signal, cache: 'no-store' });
      clearTimeout(t);
      const j = await r.json().catch(() => null);
      if (r.ok && j && j.ok) {
        resultEl.textContent = '连接正常';
        resultEl.className = 'act-status is-ok';
      } else {
        resultEl.textContent = '异常：' + ((j && j.error) || ('HTTP ' + r.status));
        resultEl.className = 'act-status is-err';
      }
    } catch {
      resultEl.textContent = '无法连接，请确认 Agent 已启动';
      resultEl.className = 'act-status is-err';
    }
    probeAgent();
  });

  // 清空本地数据
  const KEYS = { favs: 'wb.favs', recents: 'wb.recents', history: 'wb.http.history' };
  app.querySelectorAll('[data-clear]').forEach(btn => {
    btn.addEventListener('click', () => {
      const k = btn.dataset.clear;
      if (!confirm('确定清空该本地数据？此操作不可恢复。')) return;
      localStorage.removeItem(KEYS[k]);
      notify('已清空');
      window.dispatchEvent(new CustomEvent('wb:fav-changed'));
      renderSettings(app);
    });
  });
}
