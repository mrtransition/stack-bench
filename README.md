# StackBench — 全栈工程师常用工具集

> 零构建、纯本地运行的全栈开发工具箱。26 个高频工具 + 一个安全本地 Agent，全部逻辑在你的浏览器中执行，**不上传任何数据**。

![License](https://img.shields.io/badge/license-MIT-green) ![Tools](https://img.shields.io/badge/tools-26-blue) ![Tests](https://img.shields.io/badge/tests-68%20passing-brightgreen) ![Build](https://img.shields.io/badge/build-none-orange)

## ✨ 特性

- **零构建**：原生 ES Module + hash 路由，克隆即用，无需 npm install / 打包
- **纯本地**：所有计算在浏览器完成（大文本走 Web Worker），数据不出本机
- **统一框架**：`Ctrl/Cmd + K` 命令面板、收藏与最近使用、Base64URL 分享链接、深浅色与赛博朋克三主题
- **可扩展**：新增工具 = 一条注册信息 + 一个文件，不改通用逻辑
- **本地 Agent**：零依赖 Node 脚本，为浏览器补齐证书解析、验签等系统能力，安全加固（仅监听 127.0.0.1、随机 Token、Origin 校验）

## 🚀 快速开始

```bash
git clone https://github.com/mrtransition/stack-bench.git
cd stack-bench

# 启动静态服务（任选其一）
python -m http.server 8321
npx serve .

# 浏览器打开 http://127.0.0.1:8321
```

### 本地 Agent（HTTP 调试 / 证书 / 验签 / YAML 校验类工具需要）

```bash
cd agent
node agent.js        # 打印监听地址与随机 Token
```

启动后把终端打印的 Token 粘贴到对应工具页（或「设置 → Agent 配置」）保存即可。Agent 仅监听 `127.0.0.1`，校验 `Origin` 与随机 Token，拒绝一切外部访问。

### 运行测试

```bash
node --test "tests/*.test.mjs"    # 68 个单元测试
```

## 🧰 工具清单（26 个）

### 数据格式
| 工具 | 说明 | 执行位置 |
|---|---|---|
| JSON 格式化 / 压缩 / 校验 | 缩进格式化、压缩单行、错误行号列号定位 | 浏览器 (Worker) |
| JSON ↔ YAML 互转 | 双向转换，保留数据类型 | 浏览器 (Worker) |
| JSON Schema 校验 | Schema 校验 JSON，展示错误路径 | 浏览器 |
| .env / 配置格式化 | 排序、重复 key 提示、敏感 key 脱敏 | 浏览器 |
| SQL 格式化 | 常见方言格式化 / 压缩 / 括号配平 | 浏览器 |
| Markdown / CSS 格式化 | Markdown 实时预览与 HTML 导出；CSS 格式化 / 压缩 | 浏览器 |

### 编码转换
| 工具 | 说明 | 执行位置 |
|---|---|---|
| Base64 / URL 编解码 | 标准 / URL-safe，支持 UTF-8 中文 | 浏览器 |
| Hash / UUID 生成 | MD5 / SHA 系列；批量 UUID v4 / v7 | 浏览器 |
| 进制转换 / 二维码 | 2-36 任意进制互转（BigInt 大数）；二维码生成可下载 | 浏览器 |
| 图片转 Base64 / 压缩 | Data URL，本地 Canvas 缩放与质量压缩 | 浏览器 |
| 颜色转换 | HEX / RGB / HSL 互转，实时预览 | 浏览器 |

### 时间与任务
| 工具 | 说明 | 执行位置 |
|---|---|---|
| 时间戳 / Cron 解析 | 秒/毫秒互转；5/6 字段 Cron + 未来执行时间预测 | 浏览器 |

### 安全与鉴权
| 工具 | 说明 | 执行位置 |
|---|---|---|
| JWT 解析 | Header / Payload / 签名，过期高亮（不验签） | 浏览器 |
| HMAC / JWT 签名验签 | 密钥签名与验签（HS256 等） | 本地 Agent |
| 证书 / PEM 解析 | 有效期、主体、SAN、指纹、过期判断 | 本地 Agent |

### 文本处理
| 工具 | 说明 | 执行位置 |
|---|---|---|
| 正则测试 | 匹配 / 分组 / 替换预览，ReDoS 风险提示 | 浏览器 |
| 文本 Diff | Myers 算法，并排 / 统一视图，忽略空白 | 浏览器 (Worker) |
| 日志解析与时间线 | 级别统计、时间线、trace id 提取、关键词高亮 | 浏览器 |
| Git 命令解释 | 命令含义与参数解释，常用命令速查 | 浏览器 |

### API 调试
| 工具 | 说明 | 执行位置 |
|---|---|---|
| curl 转代码 | 生成 fetch / axios / Go / Python / Java | 浏览器 |
| HTTP 请求调试 | 发送请求，查看响应与耗时 | 本地 Agent |
| OpenAPI / Swagger 预览 | 接口列表预览与结构校验 | 浏览器 |
| API Mock | 按 Schema / 示例生成 Mock 响应 | 浏览器 |

### 配置与网络
| 工具 | 说明 | 执行位置 |
|---|---|---|
| CIDR / 端口 / MIME / 状态码 | 子网计算 + 三类速查表 | 浏览器 |
| Docker / K8s YAML 校验 | 语法 + 常见字段问题校验 | 本地 Agent |

### 通用
| 工具 | 说明 | 执行位置 |
|---|---|---|
| 测试数据生成 | 按 Schema / 模板批量生成 JSON 测试数据 | 浏览器 |

## 🏗️ 架构

```
stack-bench/
├─ index.html          页面骨架（顶栏 + 左侧导航 + 主内容）
├─ css/style.css       三主题（赛博朋克默认 / 深色 / 浅色）+ 响应式
├─ js/                 框架层
│  ├─ registry.js      工具注册协议（单一数据源）
│  ├─ app.js           hash 路由与页面调度
│  ├─ shell.js         侧栏导航（收藏/最近/分类，可折叠）
│  ├─ palette.js       Ctrl+K 命令面板
│  ├─ toolpage.js      统一工具页外壳（面包屑/吸顶操作栏/双栏）
│  ├─ settings.js      设置页（主题/Agent/本地数据）
│  ├─ agent-status.js  Agent 状态轮询
│  ├─ worker-client.js Web Worker Promise 封装
│  └─ store.js / toast.js / theme.js
├─ lib/                纯函数库（浏览器 + Node 通用，可单测）
├─ tools/              26 个工具 UI（与逻辑分离）
├─ workers/            JSON / YAML / Diff 三个 Web Worker
├─ vendor/             本地化第三方库（js-yaml、qrcode），离线可用
├─ agent/agent.js      零依赖 Node 本地 Agent
└─ tests/              68 个 node:test 单元测试
```

**设计原则**：

1. **注册协议驱动**——所有工具在 `js/registry.js` 声明（名称/分类/关键词/执行位置/是否可分享），搜索、命令面板、收藏、分享链接均由此驱动
2. **逻辑与 UI 分离**——核心算法在 `lib/` 纯函数中，浏览器与 Node 复用，全部有单测覆盖
3. **敏感操作不降级**——JWT 验签、证书解析等只能走本地 Agent；Agent 未启动时明确提示，绝不偷偷上传云端
4. **分享安全**——Base64URL 分享链接可恢复工具参数；HTTP 调试、验签等敏感工具禁用分享

## 🔒 隐私与安全

- 所有纯浏览器工具的数据 **100% 本地处理**，无任何网络上报
- 本地 Agent：仅绑定 `127.0.0.1`、每次启动生成随机 Token、校验请求 `Origin`，未授权请求返回 401/403
- 敏感工具（验签、证书、HTTP 调试）不支持分享链接，密钥输入不会被持久化到分享参数

## 📄 License

[MIT](./LICENSE) © 2026 mrtransition
