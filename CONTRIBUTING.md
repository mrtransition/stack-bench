# 贡献指南

感谢你愿意为 StackBench 添砖加瓦。本项目坚持 **零构建、原生 ES Module、本地优先**，新增工具不需要引入任何依赖或打包步骤。

## 环境要求

- **Node.js 20+**（仅用于跑测试；页面本身在浏览器中运行）
- 任意静态服务器（`python -m http.server` / `npx serve`）
- 不需要 `npm install` —— 本项目零依赖

## 本地运行

```bash
git clone https://github.com/mrtransition/stack-bench.git
cd stack-bench

# 启动静态服务（任选其一）
python -m http.server 8321
npx serve .

# 浏览器打开 http://127.0.0.1:8321
```

涉及 Agent 的工具（HTTP 调试、证书解析、验签、YAML 校验）：

```bash
node agent/agent.js     # 打印 http://127.0.0.1:7420 与随机 Token
```

## 跑测试

```bash
npm test
# 等价于
node --test "tests/*.test.mjs"
```

CI 会在 Node 20 / 22 上执行同样的命令，以及全部 JS 文件的语法检查，PR 必须全绿才能合并。

## 新增工具的六个步骤

以「文本反转」为例，完整可运行代码见下一节。

1. **注册工具**：在 `js/registry.js` 的 `REGISTRY` 数组中追加一项，至少包含
   `id` / `name` / `category` / `keywords` / `desc` / `executor` / `sensitive` / `shareable` / `module`；
   可选 `aliases` / `inputSchema` / `outputSchema` / `examples` / `layout: 'split'` / `notes` / `security` / `actionLabel`。
2. **实现 UI**：在 `tools/` 新建 `<id>.js`，导出 `async function render(body, ctx)`，负责渲染输入输出与绑定按钮。
3. **抽离算法**：核心逻辑放 `lib/`，写成 **纯函数、不碰 DOM**，这样才能在 Node 中单测。
4. **补测试**：在 `tests/` 新增 `<feature>.test.mjs`，至少覆盖 **正常 / 边界 / 错误输入** 三类用例。
5. **敏感工具走 Agent**：需要密钥、证书或真实网络请求的工具，逻辑放 `agent/agent.js` 新增端点，
   **不要把密钥写进 URL，也不要落 localStorage**；注册时设 `sensitive: true, shareable: false`。
6. **本地全绿后提 PR**：`npm test` 通过 + 页面手工点一遍 + 勾选 PR 模板里的检查清单。

### `render(body, ctx)` 契约

| 参数 | 说明 |
|---|---|
| `body` | 工具内容容器（`#tool-body`），直接写 `innerHTML` 或用 `querySelector` 操作 |
| `ctx.params` | 分享链接带入的参数对象（可能为空 `{}`） |
| `ctx.notify(msg)` | Toast 提示 |
| `ctx.copyText(str)` | 复制到剪贴板 |
| `ctx.setStatus(text, kind)` | 更新吸顶操作栏状态，`kind` 取 `'ok' | 'err' | 'run'` |
| `ctx.handlers.run` | 点「执行」时调用（返回 Promise 则显示耗时） |
| `ctx.handlers.clear` | 点「清空」时调用 |
| `ctx.handlers.copy` | 点「复制结果」时调用 |
| `ctx.handlers.example` | 点「加载示例」时调用 |
| `ctx.handlers.share` | 点「分享」时返回要编码进链接的状态对象 |
| `ctx.tool` | 当前工具的注册信息 |

> 双栏布局：注册项加 `layout: 'split'`，然后把输入块包进 `<div class="pane-in">`、输出块包进 `<div class="pane-out">`，
> 其余需要横跨整行的元素用 `pane-full`。布局、分隔条、响应式都由外壳统一处理。

## 最小示例：文本反转

### 1. `lib/revx.js`

```js
/**
 * 按 Unicode 码点反转字符串（不会拆坏 emoji / 代理对）。
 * @param {string} text
 * @returns {string}
 */
export function reverseText(text) {
  return Array.from(String(text)).reverse().join('');
}
```

### 2. `tools/text-reverse.js`

```js
// 文本反转：最小工具示例（单栏布局）
import { reverseText } from '../lib/revx.js';

export async function render(body, ctx) {
  body.innerHTML = `
    <div class="field">
      <label for="tr-in">输入文本</label>
      <textarea id="tr-in" class="io" spellcheck="false" placeholder="输入要反转的文本"></textarea>
    </div>
    <div class="field">
      <label>输出</label>
      <pre id="tr-out" class="out"></pre>
    </div>`;

  const input = body.querySelector('#tr-in');
  const out = body.querySelector('#tr-out');

  ctx.handlers.run = () => {
    out.textContent = reverseText(input.value);
  };
  ctx.handlers.clear = () => { input.value = ''; out.textContent = ''; };
  ctx.handlers.copy = () => ctx.copyText(out.textContent);
  ctx.handlers.example = () => { input.value = 'StackBench'; ctx.handlers.run(); };
  ctx.handlers.share = () => ({ text: input.value });
}
```

### 3. `js/registry.js` 中追加注册项

```js
{
  id: 'text-reverse',
  name: '文本反转',
  category: '文本处理',
  keywords: ['reverse', '反转', '倒序'],
  aliases: ['字符串反转'],
  desc: '把文本按字符倒序输出。',
  executor: 'browser', sensitive: false, shareable: true,
  inputSchema: { type: 'object', properties: { text: { type: 'string' } } },
  outputSchema: { type: 'string' },
  examples: ['StackBench'],
  module: '../tools/text-reverse.js',
  actionLabel: '反转',
  notes: '按 Unicode 码点反转，不会拆坏 emoji。',
  security: '输入数据仅在浏览器本地处理，不会离开您的设备。'
},
```

### 4. `tests/text-reverse.test.mjs`

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { reverseText } from '../lib/revx.js';

test('文本反转：普通字符串', () => {
  assert.equal(reverseText('abc'), 'cba');
});

test('文本反转：空字符串（边界）', () => {
  assert.equal(reverseText(''), '');
});

test('文本反转：非字符串输入（错误输入）', () => {
  assert.equal(reverseText(12345), '54321');
});

test('文本反转：中文与 emoji 不拆坏', () => {
  assert.equal(reverseText('你好😀'), '😀好你');
});
```

跑完 `npm test` 全绿，刷新页面即可在左侧「文本处理」和 `Ctrl+K` 里看到新工具——**不需要改搜索、路由、收藏、分享任何一行代码**。

## 代码风格

- ES Module，2 空格缩进，单引号，语句结尾分号
- 纯函数放 `lib/`，禁止在 `lib/` 里访问 `window` / `document`
- 大文本处理（>100KB）放 `workers/`，通过 `js/worker-client.js` 调用
- 所有中文文案直接写中文，不要用 emoji 装饰（项目视觉由 CSS 统一控制）

## 提交信息

```
<type>: <简述>

type 取值：feat | fix | docs | refactor | test | chore
示例：
feat: 新增文本反转工具
fix: 修复 CSS 格式化选择器多加分号
```

## PR 检查清单

- [ ] 已在 `js/registry.js` 注册，`id` 唯一且语义清晰
- [ ] 已声明执行位置 `executor`（`browser` / `worker` / `agent` / `hybrid`）
- [ ] 含密钥、证书、真实网络请求的工具已标记 `sensitive: true, shareable: false`
- [ ] 核心算法在 `lib/`，且补了正常 / 边界 / 错误输入测试
- [ ] `npm test` 全绿
- [ ] 已在 `README.md` 工具清单中补充（含状态列）
- [ ] 手工在浏览器验证过：执行、清空、加载示例、复制、分享（敏感工具应禁用分享）
