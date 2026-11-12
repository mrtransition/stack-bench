// Agent 安全冒烟测试：鉴权、Origin 校验、回环绑定、超时、请求体超限
// 会在本地拉起一个临时 Agent 进程（随机端口 + 固定测试 Token），测试结束后关闭。
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import http from 'node:http';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const AGENT_JS = path.join(ROOT, 'agent', 'agent.js');
const PORT = 17000 + Math.floor(Math.random() * 2000);
const TOKEN = 'test-' + crypto.randomBytes(8).toString('hex');
const BASE = `http://127.0.0.1:${PORT}`;
const LOCAL_ORIGIN = 'http://127.0.0.1:8321';

let agent;
let slowServer;

/** 带 Origin / Token 的请求；fetch 失败时返回 { networkError } */
async function req(method, pathname, { origin = LOCAL_ORIGIN, token = TOKEN, body, timeoutMs = 5000 } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (origin) headers.Origin = origin;
  if (token) headers['X-Agent-Token'] = token;
  try {
    const res = await fetch(BASE + pathname, {
      method, headers,
      body: body === undefined ? undefined : (typeof body === 'string' ? body : JSON.stringify(body)),
      signal: AbortSignal.timeout(timeoutMs)
    });
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch { /* 非 JSON */ }
    return { status: res.status, json, text };
  } catch (err) {
    return { networkError: err.message };
  }
}

before(async () => {
  agent = spawn(process.execPath, [AGENT_JS], {
    cwd: path.join(ROOT, 'agent'),
    env: { ...process.env, AGENT_PORT: String(PORT), AGENT_TOKEN: TOKEN },
    stdio: ['ignore', 'pipe', 'pipe']
  });

  // 等待 Agent 就绪（最多 10s）
  const deadline = Date.now() + 10000;
  for (;;) {
    if (agent.exitCode !== null) throw new Error('Agent 启动失败，退出码 ' + agent.exitCode);
    const r = await req('GET', '/ping').catch(() => null);
    if (r && r.status === 200) return;
    if (Date.now() > deadline) throw new Error('Agent 未在 10s 内就绪');
    await new Promise(r2 => setTimeout(r2, 100));
  }
});

after(() => {
  if (agent && agent.exitCode === null) agent.kill();
  if (slowServer) slowServer.close();
});

// ---------- 鉴权 ----------

test('Agent：缺少 Token 返回 401', async () => {
  const r = await req('POST', '/hmac', { token: null, body: { algo: 'sha256', key: 'k', text: 'x' } });
  assert.equal(r.status, 401);
  assert.equal(r.json.ok, false);
});

test('Agent：错误 Token 返回 401', async () => {
  const r = await req('POST', '/hmac', { token: 'wrong-token', body: { algo: 'sha256', key: 'k', text: 'x' } });
  assert.equal(r.status, 401);
});

test('Agent：非法 Origin 返回 403（即使 Token 正确）', async () => {
  const r = await req('POST', '/hmac', { origin: 'https://evil.example.com', body: { algo: 'sha256', key: 'k', text: 'x' } });
  assert.equal(r.status, 403);
});

test('Agent：无 Origin 返回 403', async () => {
  const r = await req('GET', '/ping', { origin: null });
  assert.equal(r.status, 403);
});

test('Agent：合法请求通过（ping）', async () => {
  const r = await req('GET', '/ping');
  assert.equal(r.status, 200);
  assert.equal(r.json.ok, true);
  assert.equal(r.json.auth, 'token');
});

// ---------- 功能正确性（顺带验证鉴权未误伤） ----------

test('Agent：HMAC 签名结果与 node crypto 一致', async () => {
  const r = await req('POST', '/hmac', { body: { algo: 'sha256', key: 'my-secret', text: 'hello world' } });
  assert.equal(r.status, 200);
  const expect = crypto.createHmac('sha256', 'my-secret').update('hello world').digest('hex');
  assert.equal(r.json.signature, expect);
});

test('Agent：JWT 验签正确密钥通过、错误密钥拒绝', async () => {
  const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64url');
  const h = b64({ alg: 'HS256', typ: 'JWT' });
  const p = b64({ sub: 'u1', exp: Math.floor(Date.now() / 1000) + 3600 });
  const s = crypto.createHmac('sha256', 'k1').update(h + '.' + p).digest('base64url');
  const jwt = `${h}.${p}.${s}`;

  const okRes = await req('POST', '/jwt-verify', { body: { token: jwt, key: 'k1' } });
  assert.equal(okRes.json.valid, true);
  assert.equal(okRes.json.expired, false);

  const badRes = await req('POST', '/jwt-verify', { body: { token: jwt, key: 'wrong' } });
  assert.equal(badRes.json.valid, false);
});

// ---------- 网络边界 ----------

test('Agent：仅绑定回环地址（非回环网卡不可达）', async t => {
  const lan = Object.values(os.networkInterfaces()).flat()
    .find(i => i && !i.internal && (i.family === 'IPv4' || i.family === 4));
  if (!lan) { t.skip('当前环境无局域网网卡，跳过'); return; }

  const reachable = await new Promise(resolve => {
    const sock = net.connect({ host: lan.address, port: PORT, timeout: 1500 });
    sock.on('connect', () => { sock.destroy(); resolve(true); });
    sock.on('error', () => resolve(false));
    sock.on('timeout', () => { sock.destroy(); resolve(false); });
  });
  assert.equal(reachable, false, `Agent 不应在 ${lan.address}:${PORT} 上可达`);
});

test('Agent：请求体超过 10MB 被拒绝', async () => {
  const big = 'x'.repeat(11 * 1024 * 1024);
  const r = await req('POST', '/proxy', {
    body: { method: 'POST', url: 'http://127.0.0.1:1/', body: big },
    timeoutMs: 15000
  });
  // 服务端主动 destroy 连接，客户端可能拿到 socket hang up，也可能收到错误 JSON
  if (r.networkError) {
    assert.match(r.networkError, /socket|hang up|fetch failed|terminated/i);
  } else {
    assert.equal(r.json.ok, false);
    assert.match(r.json.error, /请求体过大/);
  }
});

test('Agent：上游超时被中断并返回超时错误', async () => {
  // 一个永不响应的上游
  slowServer = http.createServer(() => { /* 挂住不返回 */ });
  await new Promise(resolve => slowServer.listen(0, '127.0.0.1', resolve));
  const slowPort = slowServer.address().port;

  const r = await req('POST', '/proxy', {
    body: { method: 'GET', url: `http://127.0.0.1:${slowPort}/hang`, timeoutMs: 300 },
    timeoutMs: 8000
  });
  assert.equal(r.status, 200);
  assert.equal(r.json.ok, false);
  assert.match(r.json.error, /超时|timeout/i);
});

// ---------- 拒绝公网协议 / 非法输入 ----------

test('Agent：非 http(s) 协议被拒绝', async () => {
  const r = await req('POST', '/proxy', { body: { method: 'GET', url: 'file:///etc/passwd', timeoutMs: 1000 } });
  assert.equal(r.json.ok, false);
  assert.match(r.json.error, /http\/https/);
});

test('Agent：不支持的 HTTP 方法被拒绝', async () => {
  const r = await req('POST', '/proxy', { body: { method: 'TRACE', url: 'http://127.0.0.1:1/' } });
  assert.equal(r.json.ok, false);
  assert.match(r.json.error, /不支持/);
});
