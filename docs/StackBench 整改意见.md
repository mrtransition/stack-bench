# StackBench 整改意见

整改原则：**不改变“零构建 + 原生 ES Module + 本地优先”的技术路线**，只补工程外壳和可验证性。按“先让测试可信、再让人敢贡献、最后让人敢用”排序。

---

## 一、P0 整改：让已有资产可信、可参与

### 1. 补 CI，把 68 个单测变成持续门禁

**问题**：测试只能手动跑，PR 合入前没有自动校验。

**整改**：

新增 `.github/workflows/ci.yml`：

```yaml
name: CI
on:
  push:
    branches: [main]
  pull_request:

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - name: Run unit tests
        run: node --test "tests/*.test.mjs"
```

同时开启 `main` 分支保护，要求 CI 通过才能合并。

**验收**：PR 页面出现 CI 检查；故意改坏一个 `lib/` 函数，CI 变红。

### 2. 补 `CONTRIBUTING.md`，兑现“可扩展”承诺

**问题**：README 说“新增工具只需一条注册信息 + 一个文件”，但没有可执行步骤。

**整改**：新建 `CONTRIBUTING.md`，必须包含：

1. 环境要求：Node 20+，无需安装依赖。
2. 本地运行：`python -m http.server 8080` 或 `npx serve .`。
3. 跑测试：`node --test "tests/*.test.mjs"`。
4. 新增工具六步：
   - 在 `js/registry.js` 注册 `id/name/category/keywords/executor/sensitive/shareable`；
   - 在 `tools/` 新建工具文件，实现输入/输出 UI；
   - 核心算法放 `lib/`，纯函数、无 DOM；
   - 在 `tests/` 补充正常、边界、错误输入三类用例；
   - 敏感工具走 `agent/`，不写 URL、不落 localStorage；
   - 本地跑测试全绿后提交 PR。
5. **最小工具示例**：给一个完整可复制的“文本反转”工具，含注册项、`tools/` 文件、`lib/` 函数、测试文件。
6. PR 检查清单：是否声明执行位置、是否含敏感字段、是否补测试、是否更新 README 工具清单。

**验收**：一个没看过代码的人，按文档能在 30 分钟内新增一个工具并通过测试。

### 3. 修正 README 的“承诺与现状不一致”

**问题**：README 工具清单包含 UI 类工具，但仓库实际 26 个工具不完全对应；未实现项没有标注。

**整改**：

- 工具清单加状态列：`✅ 已实现 / 🚧 规划中 / ⛔ 不包含`。
- 明确“不包含”边界：团队收藏、插件市场、SSO、权限审计、使用统计、云端同步、私有化后台。
- 在顶部加在线 Demo 链接和 CI 徽章。
- Agent 安全描述补一句可验证细节：Token 仅内存有效、仅监听 `127.0.0.1`、校验 Origin、不接受跨站请求。

**验收**：用户对照 README 能准确知道“现在有什么、以后有什么、明确不做什么”。

---

## 二、P1 整改：让人敢用、让项目可被发现

### 4. 部署在线 Demo + README 顶部入口

**问题**：工具集类项目第一反应是“打开试试”，现在只有本地启动命令。

**整改**：

- 新增 `.github/workflows/pages.yml`，`main` 合并后发布到 GitHub Pages。
- README 顶部放：Demo 链接、CI 徽章、License 徽章。
- 在 Demo 页面顶部标注“所有数据在浏览器本地处理”。

**验收**：打开仓库能一键进入可用的工具台，无需克隆。

### 5. 补 `package.json` 与 `.editorconfig`（不引入依赖）

**问题**：项目没有统一元信息和开发入口。

**整改**：

`package.json` 只放元信息，不加依赖：

```json
{
  "name": "stack-bench",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "node --test \"tests/*.test.mjs\"",
    "serve": "python3 -m http.server 8080"
  },
  "engines": { "node": ">=20" }
}
```

`.editorconfig` 统一缩进、换行、UTF-8、末尾空行。

**验收**：`npm test` 等价于现有测试命令；不同编辑器提交的格式一致。

### 6. 补 `SECURITY.md`，把安全承诺变成流程

**问题**：项目主打本地优先，但没有漏洞报告渠道和安全边界说明。

**整改**：新建 `SECURITY.md`，写清：

- 支持范围：当前 `main`。
- 报告方式：私下邮件或 GitHub Security Advisory，不走公开 Issue。
- 安全模型：Web 端不上传输入；Agent 仅本地监听、Token 内存有效、校验 Origin；分享链接过滤敏感字段。
- 已知边界：Agent 端口不要暴露公网；HTTP 调试允许访问内网是设计预期。
- 响应时限：确认后 7 天内给出修复计划。

**验收**：安全研究者能在 1 分钟内找到报告路径。

---

## 三、P2 整改：项目治理与长期维护

### 7. 补版本与路线图

- `CHANGELOG.md`：从 `v0.1.0` 开始，按 Added/Changed/Fixed 记录。
- 打 `v0.1.0` tag 和 GitHub Release，附工具清单和已知限制。
- `ROADMAP.md`：P0/P1 未完成项、明确不做项、工具新增优先级规则。

### 8. 补 Issue / PR 模板

- Bug 模板：复现步骤、浏览器版本、是否涉及 Agent、控制台错误。
- 新增工具模板：工具名、用途、执行位置、是否敏感、是否可分享、测试情况。
- PR 模板：关联 Issue、变更说明、测试命令与结果、安全自查项。

### 9. 补 Agent 自动化安全冒烟测试

**问题**：Agent 是差异化亮点，但安全承诺没有自动化保障。

**整改**：新增 `tests/agent.test.mjs`，至少覆盖：

- 无 Token 请求返回 401；
- 非法 Origin 请求被拒；
- 仅监听 `127.0.0.1`；
- 超时和请求体大小限制生效。

**验收**：CI 中能看到 Agent 安全测试通过。

### 10. 补仓库元信息

- About 精简为一句：`Local-first toolbox for full-stack engineers — zero build, no data upload.`
- 补齐 Topics：`developer-tools` `local-first` `fullstack` `javascript` `web-worker` `http-client` `json` `yaml` `jwt` `css-tools`。
- 开启 Issues，关闭空 Wiki，确认 License 在 GitHub 正确识别。

---

## 四、建议整改顺序

| 顺序 | 动作 | 预计工作量 | 收益 |
|---|---|---|---|
| 1 | CI workflow + 分支保护 | 0.5 天 | 测试持续可信 |
| 2 | `CONTRIBUTING.md` + 最小工具示例 | 1 天 | 外部可参与 |
| 3 | README 状态列 + 不包含边界 + 徽章 | 0.5 天 | 承诺与现状一致 |
| 4 | GitHub Pages 部署 + Demo 链接 | 0.5 天 | 打开即用 |
| 5 | `package.json` + `.editorconfig` | 0.5 天 | 开发入口统一 |
| 6 | `SECURITY.md` + Agent 冒烟测试 | 1 天 | 安全可验证 |
| 7 | `CHANGELOG` / `ROADMAP` / Issue 模板 / Release | 1 天 | 长期治理 |

---

## 五、整改完成验收清单

- [ ] PR 自动跑测试，失败不可合并
- [ ] 新贡献者按 `CONTRIBUTING.md` 能独立新增一个工具
- [ ] README 工具清单标注已实现/规划中/不包含
- [ ] README 顶部有 Demo 链接和 CI 徽章
- [ ] 存在 `package.json`，`npm test` 可用
- [ ] Agent 有自动化安全冒烟测试
- [ ] 存在 `SECURITY.md` 和 Issue/PR 模板
- [ ] 有 `v0.1.0` Release 和 `CHANGELOG.md`
- [ ] 仓库 About、Topics、License 显示正确

**一句话总结**：功能层已经够用，现在最该补的是**CI、贡献指南、README 真实性、在线 Demo、Agent 安全可验证**这五件事；其余治理项按顺序跟进即可。