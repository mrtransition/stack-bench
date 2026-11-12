# Changelog

本项目的所有重要变更记录在此文件中，格式参考 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

## [Unreleased]

### Planned
- 请求集合与历史持久化（仅本地）
- GraphQL Schema 查看器
- Cron 表达式反向生成
- 离线 PWA（Service Worker 缓存）

详见 [ROADMAP.md](./ROADMAP.md)。

## [0.1.0] - 2026-11-12

首个可用版本：26 个工具 + 本地 Agent + 统一框架。

### Added

**框架**
- 工具注册协议 `js/registry.js`：`id/name/category/keywords/executor/sensitive/shareable` 驱动搜索、路由、收藏、分享
- `Ctrl/Cmd + K` 命令面板（完全匹配 > 关键词 > 最近使用 > 收藏，全键盘操作）
- 顶栏 + 左侧导航骨架（收藏 / 最近使用 / 9 个分类可折叠 / 设置），侧栏可折叠为图标栏并本地记忆
- 首页：大搜索框 + 热门关键词 + 收藏/最近 + 分类卡片网格
- 工具页统一外壳：面包屑 + 标题行 + 吸顶操作栏（状态/耗时）+ 可折叠说明区
- 双栏工作区（可拖拽分隔条，30–70% 比例本地记忆，双击复位），≤900px 自动上下堆叠
- 三主题：赛博朋克（默认）/ 深色 / 浅色
- Base64URL 分享链接（敏感工具禁用）
- 设置页：主题、Agent 地址与 Token、本地数据清理、快捷键说明
- Agent 状态胶囊（30s 轮询 `/ping`）

**工具（26 个）**
- 数据格式：JSON 格式化/压缩/校验、JSON ↔ YAML、JSON Schema 校验、SQL 格式化
- 编码转换：Base64/URL 编解码、Hash/UUID 生成
- 时间与任务：时间戳/Cron 解析（5/6 字段 + 未来执行预测）
- 安全与鉴权：JWT 解析、HMAC/JWT 验签（Agent）、证书/PEM 解析（Agent）
- 文本处理：正则测试、文本 Diff（Myers）、日志解析与时间线、Git 命令解释
- API 调试：curl 转代码、HTTP 请求调试（Agent）、OpenAPI/Swagger 预览、API Mock
- 配置与网络：.env 格式化、CIDR/端口/MIME/状态码、Docker/K8s YAML 校验（Agent）
- 前端资源：图片转 Base64/压缩、颜色转换、Markdown/CSS 格式化
- 通用：进制转换/二维码、测试数据生成

**本地 Agent**
- 零依赖 Node 实现，仅监听 `127.0.0.1`
- 随机 Token（`crypto.randomBytes(16)`，仅进程内存）+ `Origin` 校验
- 端点：`/ping`、`/proxy`、`/cert`、`/hmac`、`/jwt-verify`、`/yaml-check`
- 请求体 >10MB、响应 >20MB 拒绝；默认 30s 超时，支持重试与重定向

**工程**
- 81 个 `node:test` 用例：纯函数单测 + Agent 安全冒烟（401/403/回环绑定/超时/体积）
- GitHub Actions CI（Node 20/22 矩阵：语法检查 + 测试）
- GitHub Pages 自动部署
- `package.json`（零依赖，`npm test` / `npm run serve` / `npm run agent`）
- README / CONTRIBUTING / SECURITY / ROADMAP / Issue 与 PR 模板 / MIT License

### Security
- Markdown 渲染增加链接协议白名单，`javascript:` / `data:` 等降级为 `#`（防 XSS）
- 第三方库（js-yaml 4.1.0、qrcode-generator 1.4.4）本地化到 `vendor/`，不依赖 CDN
- 敏感工具输入不进入分享链接、不落 localStorage
