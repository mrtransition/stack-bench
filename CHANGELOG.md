# Changelog

本项目的所有重要变更记录在此文件中，格式参考 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

## [Unreleased]

### Added — UI/交互/布局整改 P0（依据 docs/StackBench 页面 UI 交互 布局整改方案.md）
- **默认主题切换 + 赛博朋克降噪**：首次访问跟随 `prefers-color-scheme`（默认中性深色），赛博朋克降级为可选彩蛋（循环顺序 深色→浅色→赛博朋克）；去掉三重发光与高亮底纹，只留一档阴影；主题切换 0.2s 平滑过渡
- **SVG 图标系统**：新增 `js/icons.js`（内联线性 SVG，`stroke: currentColor`，零依赖零 CDN），替换框架层全部 UI emoji（导航 / 顶栏 / 卡片 / 徽标 / 收藏星 / 面包屑等）；分类图标、收藏星形、设置页主题卡同步换新
- **首页索引式布局**：hero 升级（搜索占位「搜索 26 个工具…」）；收藏 / 最近使用合并为搜索框下方一行双栏紧凑区；9 分类改为**分类筛选 Tab 行**（带图标与计数徽标，点击即时过滤）；底部安全约定压缩为一行摘要 + 「详情」折叠
- **组件与可访问性**：工具卡片 hover 上浮 + 阴影、`:active` 缩放；badge 改中性灰 + 状态圆点（仅「敏感」保留红色）；卡片描述两行截断；全局 `:focus-visible` 焦点态；`prefers-reduced-motion` 全局降级；补 `favicon.svg`（消除 404）

### Fixed
- **命令面板鼠标点击无法跳转**：悬停时整表重渲染，鼠标按下与抬起落在两个不同节点上，浏览器不派发 `click`。改为悬停只切换高亮类、列表节点保持稳定，点击走 `listEl` 事件委托，整行任意位置（名称 / 描述 / 徽标）点击都直接进入工具
- 键盘 ↑↓ 高亮同步改为原地切类并滚动到可视区，不再重建列表（避免闪烁与选中丢失）

### Planned
- 请求集合与历史持久化（仅本地）
- GraphQL Schema 查看器
- Cron 表达式反向生成
- 离线 PWA（Service Worker 缓存）
- P1：设计 token 收敛（字号/圆角/间距）、工具页三段式骨架、命令面板排序/高亮
- P2：实时处理 + 行内错误定位、首访引导、撤销 toast、快捷键帮助

详见 [ROADMAP.md](./ROADMAP.md)。

## [0.1.3] - 2026-11-12

### Added
- **所有输出区一键复制**：新增 `js/copy-affix.js`，自动给每个输出容器（`pre.out` / `id` 以 `-out` 结尾 / `data-copy` / `.diff-wrap`）右上角挂悬浮「复制」按钮，26 个工具零改动生效
  - 复制内容：`pre` 原样文本；富结果按块分行；表格自动转 TSV，可直接粘贴进 Excel / 飞书表格
  - 输出更新（执行 / 清空 / 报错）时按钮自动同步；占位提示与空输出不显示按钮
  - 切换工具时观察器自动重挂，复制成功按钮短暂显示「✓ 已复制」
- 测试：`tests/copy-affix.test.mjs`（TSV 纯逻辑 4 例）、`tests/manual/copy-affix-check.mjs`（真实浏览器验证 5 个工具的复制内容）、示例自测新增「复制按钮存在性」检查

### Changed
- HTTP 调试工具请求失败时改用输出区样式（`pre.out err`）渲染错误信息，同样支持一键复制

## [0.1.2] - 2026-11-12

### Added
- **`npm start` 启动即给地址**：新增零依赖本地启动器 `scripts/dev.mjs`，启动后在控制台打印完整可点击 URL（首页 / 命令面板 / 设置 / 直达工具），复制或直接点击即可打开
  - `--open` 启动后自动打开默认浏览器
  - `--port <n>` 指定端口，被占用时自动顺延并在横幅中提示实际端口（主动探测端口是否已有服务在响应，避免打印出的地址被其它进程接管）
  - `--host 0.0.0.0` 允许局域网访问，同时打印局域网 IP 地址
  - `--verbose` 打印逐请求访问日志；`--help` 查看全部用法
- `npm run dev`：一条命令同时启动静态站点与本地 Agent，Agent 地址与随机 Token 一并打印
- Agent 启动横幅补充完整地址、Token 与四个工具直达链接；`AGENT_QUIET=1` 供启动器托管时使用

### Changed
- `npm run serve` 不再依赖本机 Python，改用内置 Node 静态服务器（默认 127.0.0.1:8321）
- Agent 端口被占用时输出明确提示与换端口命令，不再落到「未捕获异常」

### Tests
- 新增 `tests/dev-server.test.mjs`：横幅地址、静态资源 MIME、404、目录穿越防护、端口自动顺延、`--help`

## [0.1.1] - 2026-11-12

### Fixed
- **「加载示例」报错（用户首访最常点的入口）**
  - `json-yaml`：示例是 YAML 但默认方向为 JSON→YAML，点击后必报 `Unexpected token 's'`；现在示例会按内容自动切换方向
  - `k8s-yaml`：初始化时调用了不存在的 `ping()`，页面抛 `ReferenceError`；改为 `pingAgent()` 并渲染连接状态
  - `jwt-parse`：示例 Token 已于 2018 年过期，加载即标红；换成 2033 年到期的示例
  - `env-format`：示例故意含非法行，加载即报红；改为合法内容（保留脱敏/排序演示）
  - `cert-parse`：示例为空、只弹提示；内置一张 10 年期自签演示证书，加载即可看到完整解析结果
- 测试命令兼容性：`node --test tests/*.test.mjs`（Node 20 不展开引号 glob，Windows 由 Node 21+ 原生 glob 兜底）

### Added
- `npm run selftest:examples`：用真实浏览器（CDP）逐一点击全部工具「加载示例」，0 失败才退出，防止示例回归
- `vendor/package.json` 固定 CommonJS 作用域，避免根 `type: module` 影响 `require` 加载 js-yaml


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
