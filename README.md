# StackBench — 全栈工程师常用工具集

[![CI](https://github.com/mrtransition/stack-bench/actions/workflows/ci.yml/badge.svg)](https://github.com/mrtransition/stack-bench/actions/workflows/ci.yml)
[![Deploy](https://github.com/mrtransition/stack-bench/actions/workflows/pages.yml/badge.svg)](https://github.com/mrtransition/stack-bench/actions/workflows/pages.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-green)](./LICENSE)
[![Tools](https://img.shields.io/badge/tools-26-blue)](https://mrtransition.github.io/stack-bench/)
[![Node](https://img.shields.io/badge/node-%3E%3D20-informational)](package.json)

> 零构建、本地优先的全栈开发工具箱。26 个高频工具 + 一个安全本地 Agent，**所有数据在浏览器本地处理，不上传服务器**。

**👉 在线试用：[https://mrtransition.github.io/stack-bench/](https://mrtransition.github.io/stack-bench/)**（无需克隆，打开即用）

## ✨ 特性

- **零构建**：原生 ES Module + hash 路由，克隆即用，无需 `npm install`、无打包步骤
- **本地优先**：纯浏览器工具的数据 100% 在本机处理（大文本走 Web Worker），无遥测、无第三方脚本、无 CDN 依赖
- **统一框架**：`Ctrl/Cmd + K` 命令面板、收藏与最近使用、Base64URL 分享链接、深色 / 浅色 / 赛博朋克三主题（默认深色并跟随系统，赛博朋克为可选彩蛋）
- **输出一键复制**：每个输出区右上角自动挂「复制」按钮，表格结果自动转 TSV（可直接粘贴进 Excel）
- **可扩展**：新增工具 = 一条注册信息 + 一个 UI 文件 + 一个纯函数 + 一个测试，通用逻辑零改动（见 [CONTRIBUTING.md](./CONTRIBUTING.md)）
- **本地 Agent**：零依赖 Node 脚本，为浏览器补齐证书解析、验签等系统能力，并做了可验证的鉴权加固

## 🚀 本地运行

```bash
git clone https://github.com/mrtransition/stack-bench.git
cd stack-bench

npm start              # 零依赖本地服务器，无需 npm install
```

启动后控制台会打印**完整可点击地址**，点击或复制即可打开：

```
  ▚ StackBench v0.1.2  本地服务已就绪
  ──────────────────────────────────────────────────────────
  首页       http://127.0.0.1:8321/
  命令面板   http://127.0.0.1:8321/#/  ← Ctrl + K 搜索 26 个工具
  设置       http://127.0.0.1:8321/#/settings
  直达工具   http://127.0.0.1:8321/#/tool/json-format
  ──────────────────────────────────────────────────────────
```

端口被占用时会自动顺延并在横幅里提示实际地址；`Ctrl + C` 停止服务。

| 命令 | 说明 |
|---|---|
| `npm start` | 启动本地站点，默认 `http://127.0.0.1:8321/` |
| `npm run dev` | 同时启动本地 Agent（地址 + Token 一并打印） |
| `npm start -- --open` | 启动后自动打开默认浏览器 |
| `npm start -- --port 9000` | 指定端口（占用自动顺延） |
| `npm start -- --host 0.0.0.0` | 允许局域网访问，额外打印局域网地址 |
| `npm run agent` | 仅启动 Agent，打印地址、Token 与工具直达链接 |

> 也可以用任意静态服务器，例如 `python -m http.server 8321` 或 `npx serve .`。

### 本地 Agent（Agent 类工具需要）

```bash
npm run dev            # 推荐：站点 + Agent 一起启动
# 或
npm run agent          # 仅 Agent，默认 http://127.0.0.1:7420
```

启动后终端会打印 `http://127.0.0.1:7420`、**随机 Token** 以及各工具直达链接，把地址与 Token 填到「设置 → Agent 配置」（或点顶栏 Agent 状态图标）即可。

### 测试

```bash
npm test               # 等价于 node --test tests/*.test.mjs
```

## 🧰 工具清单（26 个）

状态说明：`✅ 已实现` · `🚧 规划中` · `⛔ 不包含`。执行位置：`浏览器` 纯前端 / `Worker` 前端后台线程 / `Agent` 本地 Node 代理。

### 数据格式

| 状态 | 工具 | 说明 | 执行位置 |
|---|---|---|---|
| ✅ | JSON 格式化 / 压缩 / 校验 | 缩进格式化、压缩单行、错误行列定位 | Worker |
| ✅ | JSON ↔ YAML 互转 | 双向转换，保留数据类型 | Worker |
| ✅ | JSON Schema 校验 | Schema 校验 JSON，展示错误路径 | 浏览器 |
| ✅ | SQL 格式化 | 常见方言格式化 / 压缩 / 括号配平 | 浏览器 |

### 编码转换

| 状态 | 工具 | 说明 | 执行位置 |
|---|---|---|---|
| ✅ | Base64 / URL 编解码 | 标准 / URL-safe，支持 UTF-8 中文 | 浏览器 |
| ✅ | Hash / UUID 生成 | MD5 / SHA 系列；批量 UUID v4 / v7 | 浏览器 |

### 时间与任务

| 状态 | 工具 | 说明 | 执行位置 |
|---|---|---|---|
| ✅ | 时间戳 / Cron 解析 | 秒/毫秒互转；5/6 字段 Cron + 未来执行时间预测 | 浏览器 |

### 安全与鉴权

| 状态 | 工具 | 说明 | 执行位置 |
|---|---|---|---|
| ✅ | JWT 解析 | Header / Payload / 签名，过期高亮（只解码，不验签） | 浏览器 🔒 |
| ✅ | HMAC / JWT 签名验签 | HS256/384/512、RS、ES、PS 系列验签 | Agent 🔒 |
| ✅ | 证书 / PEM 解析 | 有效期、主体、SAN、指纹、过期判断 | Agent 🔒 |

### 文本处理

| 状态 | 工具 | 说明 | 执行位置 |
|---|---|---|---|
| ✅ | 正则测试 | 匹配 / 分组 / 替换预览，ReDoS 风险提示 | 浏览器 |
| ✅ | 文本 Diff | Myers 算法，并排 / 统一视图，忽略空白 | Worker |
| ✅ | 日志解析与时间线 | 级别统计、时间线、trace id 提取、关键词高亮 | 浏览器 |
| ✅ | Git 命令解释 | 命令含义与参数解释，常用命令速查 | 浏览器 |

### API 调试

| 状态 | 工具 | 说明 | 执行位置 |
|---|---|---|---|
| ✅ | curl 转代码 | 生成 fetch / axios / Go / Python / Java | 浏览器 |
| ✅ | HTTP 请求调试 | 发送请求，查看状态、响应头、body 与耗时 | Agent 🔒 |
| ✅ | OpenAPI / Swagger 预览 | 接口列表预览与结构校验 | 浏览器 |
| ✅ | API Mock | 按 Schema / 示例生成 Mock 响应 | 浏览器 |

### 配置与网络

| 状态 | 工具 | 说明 | 执行位置 |
|---|---|---|---|
| ✅ | .env / 配置格式化 | 排序、重复 key 提示、敏感 key 脱敏 | 浏览器 |
| ✅ | CIDR / 端口 / MIME / 状态码 | 子网计算 + 三类速查表 | 浏览器 |
| ✅ | Docker / K8s YAML 校验 | 语法 + 常见字段问题校验 | Agent |

### 前端资源

| 状态 | 工具 | 说明 | 执行位置 |
|---|---|---|---|
| ✅ | 图片转 Base64 / 压缩 | Data URL，本地 Canvas 缩放与质量控制 | 浏览器 |
| ✅ | 颜色转换 | HEX / RGB / HSL 互转，实时预览 | 浏览器 |
| ✅ | Markdown / CSS 格式化 | Markdown 实时预览与 HTML 导出；CSS 格式化 / 压缩 | 浏览器 |

### 通用工具

| 状态 | 工具 | 说明 | 执行位置 |
|---|---|---|---|
| ✅ | 进制转换 / 二维码 | 2–36 任意进制互转（BigInt 大数）；二维码生成可下载 | 浏览器 |
| ✅ | 测试数据生成 | 按 Schema / 模板批量生成 JSON 测试数据 | 浏览器 |

🔒 = 敏感工具：不生成分享链接，输入不编码进 URL。

**规划中（🚧）** 见 [ROADMAP.md](./ROADMAP.md)，例如：请求集合与历史持久化、GraphQL Schema 查看器、Cron 表达式反向生成、离线 PWA。

**明确不包含（⛔）**：团队协作收藏、插件市场、SSO / 组织权限与审计、使用统计与埋点、云端同步与账号体系、私有化部署后台。StackBench 是**单机、无账号、无服务端**的工具集，以上能力与定位冲突，不接受相关 PR。

## 🏗️ 架构

```
stack-bench/
├─ index.html            页面骨架（顶栏 + 左侧导航 + 主内容）
├─ css/style.css         三主题（深色默认 / 浅色 / 赛博朋克彩蛋）+ 响应式
├─ js/                   框架层
│  ├─ registry.js        工具注册协议（单一数据源，驱动搜索/路由/收藏/分享）
│  ├─ app.js             hash 路由与页面调度
│  ├─ shell.js           侧栏导航（收藏/最近/分类，可折叠）
│  ├─ palette.js         Ctrl+K 命令面板
│  ├─ toolpage.js        统一工具页外壳（面包屑 / 吸顶操作栏 / 双栏）
│  ├─ settings.js        设置页（主题 / Agent / 本地数据）
│  ├─ agent-status.js    Agent 状态轮询
│  └─ store.js · toast.js · theme.js · worker-client.js
├─ lib/                  纯函数库（浏览器 + Node 通用，可单测）
├─ tools/                26 个工具 UI（与算法分离）
├─ workers/              JSON / YAML / Diff 三个 Web Worker
├─ vendor/               本地化第三方库（js-yaml 4.1.0、qrcode-generator 1.4.4）
├─ agent/agent.js        零依赖 Node 本地 Agent
├─ tests/                node:test 单元测试 + Agent 安全冒烟测试
└─ .github/workflows/    CI（测试 + 语法检查）与 GitHub Pages 部署
```

**设计原则**

1. **注册协议驱动**——所有工具在 `js/registry.js` 声明，搜索、命令面板、收藏、分享均由该声明驱动
2. **逻辑与 UI 分离**——算法在 `lib/` 纯函数中，浏览器与 Node 复用，全部有单测覆盖
3. **敏感操作不降级**——验签、证书、HTTP 调试只能走本地 Agent；Agent 未启动时明确提示，绝不改为云端上传
4. **分享安全**——敏感工具的输入不会进入分享链接

## 🔒 隐私与安全（可验证）

- **Web 端**：所有纯浏览器工具在本地完成计算，无网络请求、无遥测、无 CDN；第三方库固定在 `vendor/` 本地快照
- **本地 Agent**：仅 `server.listen(PORT, '127.0.0.1')`；每次启动 `crypto.randomBytes(16)` 生成 Token，**仅存于进程内存**、重启即变；校验 `Origin` 为 `127.0.0.1`/`localhost`，非本地来源 403，缺 Token 401；请求体 >10MB、响应 >20MB 直接拒绝；不记录请求内容
- **自动保障**：`tests/agent.test.mjs` 在 CI 中实测 401 / 403 / 回环绑定 / 超时 / 请求体超限
- **Markdown 预览**：先转义再解析，链接协议白名单（`http/https/mailto/tel`/相对路径），`javascript:` 降级为 `#`

完整安全模型、报告渠道与已知边界见 [SECURITY.md](./SECURITY.md)。

## 🤝 贡献

新增工具六步流程、`render(body, ctx)` 契约、可复制的最小工具示例见 **[CONTRIBUTING.md](./CONTRIBUTING.md)**。
提交前请跑 `npm test`，CI 会在 Node 20 / 22 上做全量测试与语法检查。

## 📄 License

[MIT](./LICENSE) © 2026 mrtransition

第三方库：[js-yaml](https://github.com/nodeca/js-yaml)（MIT）、[qrcode-generator](https://github.com/kazuhikoarase/qrcode-generator)（MIT）
