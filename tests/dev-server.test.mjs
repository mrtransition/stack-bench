/**
 * scripts/dev.mjs 集成测试
 *
 * 覆盖：启动横幅是否打印完整地址、静态资源 MIME、404、目录穿越防护、
 *      端口占用自动顺延、--help 输出。
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import net from 'node:net';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEV_SCRIPT = path.join(ROOT, 'scripts', 'dev.mjs');

/** 原样发送路径（fetch 会规范化 %2e%2e，无法用于穿越测试） */
function rawGet(port, rawPath) {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port, path: rawPath, method: 'GET' }, res => {
      res.resume();
      res.on('end', () => resolve({ status: res.statusCode }));
    });
    req.on('error', reject);
    req.end();
  });
}

function randomPort() {
  return 20000 + Math.floor(Math.random() * 20000);
}

/** 启动 dev 服务器，收集 stdout，直到出现监听地址或超时 */
function startDev(args, { expectPort, timeoutMs = 10000 } = {}) {
  const child = spawn(process.execPath, [DEV_SCRIPT, ...args], {
    cwd: ROOT,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, NO_COLOR: '1' }
  });
  let stdout = '';
  let stderr = '';
  child.stdout.on('data', d => { stdout += String(d); });
  child.stderr.on('data', d => { stderr += String(d); });

  const ready = new Promise((resolve, reject) => {
    const deadline = Date.now() + timeoutMs;
    const tick = () => {
      if (expectPort && stdout.includes(`127.0.0.1:${expectPort}/`)) return resolve(stdout);
      if (!expectPort && /127\.0\.0\.1:\d+\//.test(stdout)) return resolve(stdout);
      if (child.exitCode !== null) return reject(new Error(`进程提前退出：${stderr || stdout}`));
      if (Date.now() > deadline) return reject(new Error(`启动超时：${stdout}${stderr}`));
      setTimeout(tick, 80);
    };
    tick();
  });

  return { child, ready, getStdout: () => stdout, getStderr: () => stderr };
}

function stop(child) {
  return new Promise(resolve => {
    if (child.exitCode !== null) return resolve();
    child.once('exit', () => resolve());
    child.kill();
    setTimeout(() => { if (child.exitCode === null) child.kill('SIGKILL'); resolve(); }, 3000).unref?.();
  });
}

test('dev server 打印完整地址，静态资源与防护正常', async t => {
  const port = randomPort();
  const srv = startDev(['--port', String(port)], { expectPort: port });
  t.after(() => stop(srv.child));

  const banner = await srv.ready;
  assert.match(banner, new RegExp(`http://127\\.0\\.0\\.1:${port}/`), '横幅应打印带协议+端口+斜杠的完整地址');
  assert.match(banner, /Ctrl \+ C/, '横幅应提示如何停止');

  const home = await fetch(`http://127.0.0.1:${port}/`);
  assert.equal(home.status, 200);
  assert.match(await home.text(), /StackBench/);

  const js = await fetch(`http://127.0.0.1:${port}/js/app.js`);
  assert.equal(js.status, 200);
  assert.match(js.headers.get('content-type') || '', /text\/javascript/);

  const missing = await fetch(`http://127.0.0.1:${port}/definitely-missing.txt`);
  assert.equal(missing.status, 404);

  const traversal = await rawGet(port, '/%2e%2e/%2e%2e/package.json');
  assert.equal(traversal.status, 404, '目录穿越必须被拒绝');
});

test('端口被占用时自动顺延并提示', async t => {
  const busyPort = randomPort();
  const blocker = net.createServer();
  await new Promise((resolve, reject) => {
    blocker.once('error', reject);
    blocker.listen(busyPort, '127.0.0.1', resolve);
  });
  t.after(() => new Promise(resolve => blocker.close(resolve)));

  const srv = startDev(['--port', String(busyPort)], {});
  t.after(() => stop(srv.child));

  const banner = await srv.ready;
  const hit = banner.match(/127\.0\.0\.1:(\d+)\//);
  assert.ok(hit, '应打印实际监听地址');
  const actual = Number(hit[1]);
  assert.notEqual(actual, busyPort, '应顺延到其它端口');
  assert.match(banner, /已被占用/, '应提示端口被占用');

  const home = await fetch(`http://127.0.0.1:${actual}/`);
  assert.equal(home.status, 200);
});

test('--help 输出用法', async () => {
  const child = spawn(process.execPath, [DEV_SCRIPT, '--help'], { cwd: ROOT });
  let out = '';
  child.stdout.on('data', d => { out += String(d); });
  const code = await new Promise(resolve => child.once('exit', resolve));
  assert.equal(code, 0);
  assert.match(out, /用法/);
  assert.match(out, /--agent/);
});
