// FR-P1-14 Git 命令解释 / 常用命令生成
import { explainGit, GIT_COMMANDS, GIT_CHEATSHEET } from '../lib/gitx.js';

function escHtml(s) {
  return String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
}

export async function render(body, ctx) {
  body.innerHTML = `
    <div class="field radio-row">
      <input type="text" id="gh-in" class="txt" placeholder="输入 Git 命令，如 git reset --soft HEAD~1">
    </div>
    <div class="field">
      <label>解释结果</label>
      <div id="gh-out"><div class="info-box">输入命令后自动解释</div></div>
    </div>
    <div class="field">
      <label>常用命令速查（点击复制）</label>
      <div id="gh-sheet"></div>
    </div>`;

  const $ = id => body.querySelector('#' + id);
  const taIn = $('gh-in'), outEl = $('gh-out'), sheetEl = $('gh-sheet');

  function run() {
    const input = taIn.value.trim();
    if (!input) return;
    const r = explainGit(input);
    if (!r) return;
    if (r.matched) {
      outEl.innerHTML = `
        <div class="ok-box">
          <b>${escHtml(r.cmd)}</b>（${escHtml(r.category)}）<br>${escHtml(r.desc)}
        </div>
        ${r.options.length ? `<div class="info-box" style="margin-top:8px"><b>常用参数：</b><br>${r.options.map(o => '· ' + escHtml(o)).join('<br>')}</div>` : ''}`;
    } else {
      const sug = r.suggestion;
      outEl.innerHTML = `<div class="warn-box">未精确匹配「${escHtml(r.input)}」。${sug ? '相似命令：<br>' + sug.map(s => `· ${escHtml(s.cmd)}：${escHtml(s.desc)}`).join('<br>') : '可尝试 git status / git log / git push 等常用命令。'}</div>`;
    }
  }
  taIn.addEventListener('input', run);
  taIn.addEventListener('keydown', e => { if (e.key === 'Enter') run(); });

  // 速查表
  sheetEl.innerHTML = GIT_CHEATSHEET.map(group => `
    <div class="field">
      <label>${escHtml(group.title)}</label>
      <div class="chip-row">
        ${group.cmds.map(c => `<button class="chip" data-cmd="${escHtml(c)}" title="点击复制">${escHtml(c)}</button>`).join('')}
      </div>
    </div>`).join('');
  sheetEl.querySelectorAll('[data-cmd]').forEach(btn => {
    btn.addEventListener('click', () => ctx.copyText(btn.dataset.cmd));
  });

  ctx.handlers = {
    run,
    clear() { taIn.value = ''; outEl.innerHTML = ''; },
    copy() { ctx.copyText(taIn.value || outEl.textContent); },
    example() { taIn.value = ctx.tool.examples[0]; run(); },
    share() { return { cmd: taIn.value }; }
  };

  if (ctx.params.cmd) taIn.value = ctx.params.cmd;
  if (taIn.value) run();
}
