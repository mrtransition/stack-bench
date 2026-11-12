#!/usr/bin/env node
/**
 * StackBench 本地启动器（零依赖，Node >= 20）
 *
 * 启动后在控制台打印**完整可点击地址**，复制或直接点击即可打开：
 *   node scripts/dev.mjs                  # 静态站点，默认 http://127.0.0.1:8321/
 *   node scripts/dev.mjs --port 9000      # 指定端口（被占用时自动顺延）
 *   node scripts/dev.mjs --open           # 启动后自动打开默认浏览器
 *   node scripts/dev.mjs --agent          # 同时拉起本地 Agent（HTTP 调试 / 证书解析 / 验签）
 *   node scripts/dev.mjs --host 0.0.0.0   # 改监听地址（默认仅本机 127.0.0.1）
 *
 * 仅用于本地开发：不采集数据、不访问外网、不写入任何缓存文件。
 */
import http from 'node:http';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_PORT = 8321;
const AGENT_DEFAULT_PORT = 7420;
const MAX_PORT_TRIES = 20;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.htm': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.yml': 'text/yaml; charset=utf-8',
  '.yaml': 'text/yaml; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.wasm': 'application/wasm',
  '.pdf': 'application/pdf'
};

// ---------- CLI 参数 ----------

function parseArgs(argv) {
  const opts = { port: DEFAULT_PORT, open: false, agent: false, host: '127.0.0.1', verbose: false, help: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const eq = a.indexOf('=');
    const key = a.startsWith('--') && eq > 0 ? a.slice(0, eq) : a;
    const inline = a.startsWith('--') && eq > 0 ? a.slice(eq + 1) : null;
    switch (key) {
      case '--port':
      case '-p': {
        const v = inline ?? argv[++i];
        const n = Number(v);
        if (!Number.isInteger(n) || n <= 0 || n > 65535) throw new Error(`端口不合法：${v}`);
        opts.port = n;
        break;
      }
      case '--host':
        opts.host = inline ?? argv[++i] ?? opts.host;
        break;
      case '--open':
      case '-o':
        opts.open = true;
        break;
      case '--agent':
        opts.agent = true;
        break;
      case '--verbose':
        opts.verbose = true;
        break;
      case '--help':
      case '-h':
        opts.help = true;
        break;
      default:
        if (key.startsWith('-')) throw new Error(`未知参数：${key}（用 --help 查看用法）`);
    }
  }
  return opts;
}

function printHelp() {
  console.log(`
StackBench 本地启动器

用法：
  node scripts/dev.mjs [选项]

选项：
  -p, --port <n>    端口，默认 ${DEFAULT_PORT}（占用时自动顺延最多 ${MAX_PORT_TRIES} 个）
      --host <ip>   监听地址，默认 127.0.0.1（仅本机可访问）
  -o, --open        启动后自动打开默认浏览器
      --agent       同时启动本地 Agent（HTTP 调试 / 证书解析 / JWT 验签）
      --verbose     打印每个请求的访问日志
  -h, --help        显示本帮助

示例：
  npm start                 # http://127.0.0.1:${DEFAULT_PORT}/
  npm run dev               # 静态站点 + Agent
  npm start -- --open       # 启动并自动打开浏览器
  npm start -- --port 9000  # 换端口
`.trim());
}

// ---------- 静态文件服务 ----------

function resolveWithinRoot(urlPath) {
  let decoded;
  try {
    decoded = decodeURIComponent(urlPath.split('?')[0].split('#')[0]);
  } catch {
    return null; // 非法百分号编码
  }
  if (decoded.includes('\0')) return null;
  const rel = decoded.replace(/^[/\\]+/, '');
  const full = path.resolve(ROOT, rel || 'index.html');
  if (full !== ROOT && !full.startsWith(ROOT + path.sep)) return null; // 目录穿越
  return full;
}

function sendText(res, status, text, extraHeaders = {}) {
  const body = Buffer.from(text, 'utf8');
  res.writeHead(status, {
    'Content-Type': 'text/plain; charset=utf-8',
    'Content-Length': body.length,
    'Cache-Control': 'no-cache',
    ...extraHeaders
  });
  res.end(res.req.method === 'HEAD' ? undefined : body);
}

function notFound(res, urlPath) {
  const body = Buffer.from(
    `<!DOCTYPE html><html lang="zh-CN"><meta charset="utf-8"><title>404</title>` +
    `<body style="font:15px/1.7 system-ui;padding:48px;background:#05040c;color:#e8e6ff">` +
    `<h1 style="color:#ff2ea6">404 Not Found</h1>` +
    `<p>路径不存在：<code style="color:#00e7ff">${urlPath.replace(/[<>&]/g, '')}</code></p>` +
    `<p><a style="color:#00e7ff" href="/">← 返回 StackBench 首页</a></p></body></html>`,
    'utf8'
  );
  res.writeHead(404, {
    'Content-Type': 'text/html; charset=utf-8',
    'Content-Length': body.length,
    'Cache-Control': 'no-cache'
  });
  res.end(res.req.method === 'HEAD' ? undefined : body);
}

function handleRequest(req, res, opts) {
  const started = Date.now();
  const urlPath = req.url || '/';

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return sendText(res, 405, 'Method Not Allowed', { Allow: 'GET, HEAD' });
  }

  const filePath = resolveWithinRoot(urlPath);
  if (!filePath) return notFound(res, urlPath);

  fs.stat(filePath, (err, stat) => {
    if (err) return notFound(res, urlPath);
    if (stat.isDirectory()) {
      if (!urlPath.endsWith('/')) {
        res.writeHead(302, { Location: urlPath + '/' });
        return res.end();
      }
      const indexPath = path.join(filePath, 'index.html');
      return fs.stat(indexPath, (e2, s2) => (e2 || !s2.isFile() ? notFound(res, urlPath) : sendFile(res, indexPath, s2, opts, started)));
    }
    if (!stat.isFile()) return notFound(res, urlPath);
    return sendFile(res, filePath, stat, opts, started);
  });
}

function sendFile(res, filePath, stat, opts, started) {
  const type = MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
  res.writeHead(200, {
    'Content-Type': type,
    'Content-Length': stat.size,
    'Cache-Control': 'no-cache',
    'X-Content-Type-Options': 'nosniff'
  });
  if (res.req.method === 'HEAD') return res.end();
  const stream = fs.createReadStream(filePath);
  stream.on('error', () => res.destroy());
  stream.pipe(res);
  if (opts.verbose) logRequest(res.req, 200, started);
}

function logRequest(req, status, started) {
  const ms = Date.now() - started;
  console.log(`  ${new Date().toLocaleTimeString('zh-CN', { hour12: false })}  ${String(status)}  ${req.method} ${req.url}  ${ms}ms`);
}

// ---------- 端口与进程 ----------

function tryListen(server, port, host) {
  return new Promise((resolve, reject) => {
    const onError = err => {
      server.removeListener('listening', onListening);
      reject(err);
    };
    const onListening = () => {
      server.removeListener('error', onError);
      resolve();
    };
    server.once('error', onError);
    server.once('listening', onListening);
    server.listen(port, host);
  });
}

/**
 * 端口上是否已有服务在响应。
 * 仅靠 listen 的 EADDRINUSE 不够：Windows 上别的进程绑 0.0.0.0:8321 时，
 * 我们仍可能绑上 127.0.0.1:8321，结果横幅给的地址被对方服务响应。先连一下最稳。
 */
function isPortInUse(port, host = '127.0.0.1') {
  return new Promise(resolve => {
    const sock = net.connect({ port, host });
    let settled = false;
    const finish = value => {
      if (settled) return;
      settled = true;
      sock.destroy();
      resolve(value);
    };
    sock.setTimeout(500, () => finish(false));
    sock.once('connect', () => finish(true));
    sock.once('error', () => finish(false));
  });
}

async function listenWithFallback(handler, startPort, host) {
  const server = http.createServer(handler);
  let lastErr = null;
  for (let i = 0; i < MAX_PORT_TRIES; i++) {
    const port = startPort + i;
    if (port > 65535) break;
    if (await isPortInUse(port)) continue;
    try {
      await tryListen(server, port, host);
      return { server, port, shifted: i > 0 };
    } catch (err) {
      lastErr = err;
      if (err.code !== 'EADDRINUSE' && err.code !== 'EACCES') throw err;
    }
  }
  throw new Error(`端口 ${startPort}~${startPort + MAX_PORT_TRIES - 1} 均不可用：${lastErr ? lastErr.message : '均已被占用'}`);
}

function findFreePort(startPort, host) {
  return new Promise(resolve => {
    const probe = net.createServer();
    probe.unref();
    probe.once('error', () => resolve(null));
    probe.once('listening', () => {
      const p = probe.address().port;
      probe.close(() => resolve(p));
    });
    probe.listen(startPort, host);
  });
}

function openBrowser(url) {
  const [cmd, cmdArgs] =
    process.platform === 'win32' ? ['cmd', ['/c', 'start', '', url]] :
    process.platform === 'darwin' ? ['open', [url]] :
    ['xdg-open', [url]];
  try {
    const child = spawn(cmd, cmdArgs, { stdio: 'ignore', detached: true, windowsHide: true });
    child.on('error', () => { });
    child.unref();
  } catch {
    /* 打不开浏览器不影响服务运行 */
  }
}

async function startAgent() {
  const wanted = Number(process.env.AGENT_PORT) || AGENT_DEFAULT_PORT;
  let agentPort = await findFreePort(wanted, '127.0.0.1');
  for (let i = 1; !agentPort && i < 10; i++) agentPort = await findFreePort(wanted + i, '127.0.0.1');
  if (!agentPort) throw new Error('未找到可用的 Agent 端口');

  const token = process.env.AGENT_TOKEN || crypto.randomBytes(16).toString('hex');
  const child = spawn(process.execPath, [path.join(ROOT, 'agent', 'agent.js')], {
    cwd: ROOT,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, AGENT_PORT: String(agentPort), AGENT_TOKEN: token, AGENT_QUIET: '1' }
  });
  child.stdout.on('data', d => process.stdout.write(String(d)));
  child.stderr.on('data', d => process.stderr.write(String(d)));
  child.on('error', err => console.error('  Agent 启动失败：' + err.message));
  return { child, port: agentPort, token, url: `http://127.0.0.1:${agentPort}` };
}

// ---------- 控制台输出 ----------

const supportsColor = process.stdout.isTTY && !process.env.NO_COLOR;
const paint = code => s => (supportsColor ? `\x1b[${code}m${s}\x1b[0m` : s);
const pink = paint('38;5;205');
const cyan = paint('38;5;51');
const dim = paint('2');
const bold = paint('1');
const green = paint('38;5;114');

function readJson(file, fallback = {}) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
}

function countTools() {
  try {
    const src = fs.readFileSync(path.join(ROOT, 'js', 'registry.js'), 'utf8');
    return (src.match(/^\s{4}id:\s*'/gm) || []).length || null;
  } catch {
    return null;
  }
}

function lanAddresses() {
  const out = [];
  for (const list of Object.values(os.networkInterfaces())) {
    for (const ni of list || []) {
      if (ni.family === 'IPv4' && !ni.internal) out.push(ni.address);
    }
  }
  return out;
}

function printBanner({ base, port, startPort, agent, opts }) {
  const pkg = readJson(path.join(ROOT, 'package.json'));
  const toolCount = countTools();
  const rule = dim('─'.repeat(58));
  const link = u => cyan(u);
  // 中文按 2 列宽对齐，避免控制台里地址参差不齐
  const wide = s => [...s].reduce((w, ch) => w + (/[\u1100-\u115f\u2e80-\ua4cf\uac00-\ud7a3\uf900-\ufaff\ufe30-\ufe6f\uff00-\uff60\uffe0-\uffe6]/.test(ch) ? 2 : 1), 0);
  const pad = (s, width) => s + ' '.repeat(Math.max(0, width - wide(s)));
  const row = (label, value) => `  ${dim(pad(label, 11))}${value}`;

  console.log('');
  console.log(`  ${pink('▚')} ${bold('StackBench')} ${dim('v' + (pkg.version || '0.0.0'))}  ${green('本地服务已就绪')}`);
  console.log('  ' + rule);
  console.log(row('首页', link(base)));
  console.log(row('命令面板', link(base + '#/') + dim(toolCount ? `  ← Ctrl + K 搜索 ${toolCount} 个工具` : '  ← Ctrl + K 搜索工具')));
  console.log(row('设置', link(base + '#/settings')));
  console.log(row('直达工具', link(base + '#/tool/json-format')));
  if (opts.host === '0.0.0.0' || opts.host === '::') {
    for (const ip of lanAddresses()) console.log(row('局域网', link(`http://${ip}:${port}/`)));
  }
  console.log('  ' + rule);
  if (agent) {
    console.log(row('Agent', green('已启动 ') + link(agent.url)));
    console.log(row('Token', cyan(agent.token)));
    console.log(row('', dim('把地址与 Token 填到「设置 → Agent 配置」，或点顶栏 Agent 状态图标')));
    if (agent.port !== AGENT_DEFAULT_PORT) {
      console.log(row('', paint('33')('注意：端口非默认 7420，请在设置里改成 ' + agent.url)));
    }
  } else {
    console.log(row('Agent', dim('未启动（HTTP 调试 / 证书解析 / 验签需要它）')));
    console.log(row('', dim('另开终端执行 ') + cyan('npm run agent') + dim('，或用 ') + cyan('npm run dev') + dim(' 一起启动')));
  }
  console.log('  ' + rule);
  if (startPort !== port) console.log(`  ${dim(`端口 ${startPort} 已被占用，已自动改用 ${port}`)}`);
  console.log(`  ${dim('Ctrl + C 停止服务 · 所有数据仅在本机处理，不上传任何服务器')}`);
  console.log('');
}

// ---------- 入口 ----------

async function main() {
  let opts;
  try {
    opts = parseArgs(process.argv.slice(2));
  } catch (err) {
    console.error('参数错误：' + err.message);
    process.exit(1);
  }
  if (opts.help) return printHelp();

  const hostForUrl = opts.host === '0.0.0.0' || opts.host === '::' ? '127.0.0.1' : opts.host;
  const handler = (req, res) => handleRequest(req, res, opts);
  const { server, port, shifted } = await listenWithFallback(handler, opts.port, opts.host);
  const base = `http://${hostForUrl}:${port}/`;

  let agent = null;
  if (opts.agent) {
    try {
      agent = await startAgent();
    } catch (err) {
      console.error('  Agent 未能启动：' + err.message + '（静态站点不受影响）');
    }
  }

  printBanner({ base, port, startPort: shifted ? opts.port : port, agent, opts });
  if (opts.open) openBrowser(base);

  let closing = false;
  const shutdown = () => {
    if (closing) return;
    closing = true;
    console.log('\n  服务已停止。');
    if (agent) agent.child.kill();
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 1500).unref();
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
  if (agent) agent.child.on('exit', code => { if (!closing) console.log(`  Agent 已退出（code ${code}）`); });
}

main().catch(err => {
  console.error('启动失败：' + err.message);
  process.exit(1);
});
