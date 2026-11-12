#!/usr/bin/env node
/**
 * 全栈工程师工具集 — 本地 HTTP 请求调试 Agent（FR-P0-12）
 *
 * 安全约束：
 *  1. 仅监听 127.0.0.1，不暴露到外网
 *  2. 随机 Token（AGENT_TOKEN 环境变量可指定），请求必须携带 X-Agent-Token
 *  3. 校验 Origin，仅允许 127.0.0.1 / localhost 来源
 *  4. 不记录请求内容到任何日志，不做任何云端转发
 *
 * 启动：node agent.js   （或 AGENT_PORT=7420 node agent.js）
 */
'use strict';

const http = require('http');
const https = require('https');
const crypto = require('crypto');
const jsyaml = require('../vendor/js-yaml.min.js');

const PORT = Number(process.env.AGENT_PORT) || 7420;
const TOKEN = process.env.AGENT_TOKEN || crypto.randomBytes(16).toString('hex');
const VERSION = 1;
const METHODS = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']);
const MAX_REDIRECTS = 5;

function isLocalOrigin(origin) {
  try {
    const u = new URL(origin);
    return u.hostname === '127.0.0.1' || u.hostname === 'localhost';
  } catch {
    return false;
  }
}

function setCors(req, res) {
  const origin = req.headers.origin || '';
  if (origin && isLocalOrigin(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
}

function checkAuth(req, res) {
  const origin = req.headers.origin;
  if (!origin || !isLocalOrigin(origin)) {
    res.writeHead(403, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, error: '拒绝访问：Origin 非本地来源' }));
    return false;
  }
  const token = req.headers['x-agent-token'];
  if (!token || token !== TOKEN) {
    res.writeHead(401, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, error: 'Token 校验失败：请核对启动 Agent 时打印的随机 Token' }));
    return false;
  }
  return true;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', c => {
      size += c.length;
      if (size > 10 * 1024 * 1024) { reject(new Error('请求体过大（>10MB）')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

/** 发起一次上游请求 */
function attempt(urlStr, { method, headers, body, timeoutMs }) {
  return new Promise((resolve, reject) => {
    let u;
    try { u = new URL(urlStr); } catch { return reject(new Error('URL 不合法: ' + urlStr)); }
    if (!/^https?:$/.test(u.protocol)) return reject(new Error('仅支持 http/https URL'));
    const mod = u.protocol === 'https:' ? https : http;
    const req = mod.request(u, { method, headers }, resp => {
      const chunks = [];
      let size = 0;
      resp.on('data', c => {
        size += c.length;
        if (size > 20 * 1024 * 1024) { resp.destroy(); reject(new Error('响应过大（>20MB）')); return; }
        chunks.push(c);
      });
      resp.on('end', () => resolve({
        status: resp.statusCode,
        statusText: resp.statusMessage || '',
        headers: resp.headers,
        buffer: Buffer.concat(chunks),
        location: resp.headers.location
      }));
      resp.on('error', reject);
    });
    req.setTimeout(Math.max(100, timeoutMs || 30000), () => {
      req.destroy(new Error(`请求超时（${timeoutMs}ms）`));
    });
    req.on('error', err => reject(err));
    if (body && !['GET', 'HEAD'].includes(method)) req.write(body);
    req.end();
  });
}

async function doProxy(payload) {
  const { method, url, headers = {}, body, timeoutMs = 30000, retries = 0 } = payload;
  if (!METHODS.has(method)) throw new Error('不支持的 HTTP 方法: ' + method);
  let currentUrl = url;
  let redirectCount = 0;
  const maxTries = 1 + Math.min(5, Math.max(0, retries | 0));

  for (let i = 0; i < maxTries; i++) {
    try {
      let resp = await attempt(currentUrl, { method, headers, body, timeoutMs });
      while (resp.status >= 300 && resp.status < 400 && resp.location && redirectCount < MAX_REDIRECTS) {
        redirectCount++;
        currentUrl = new URL(resp.location, currentUrl).href;
        resp = await attempt(currentUrl, { method: method === 'POST' && resp.status === 307 ? 'POST' : 'GET', headers, body, timeoutMs });
      }
      const isText = (() => {
        const ct = resp.headers['content-type'] || '';
        return /json|text|xml|html|javascript|csv|yaml|form/i.test(ct);
      })();
      return {
        ok: true,
        status: resp.status,
        statusText: resp.statusText,
        headers: resp.headers,
        contentType: resp.headers['content-type'] || '',
        size: resp.buffer.length,
        bodyB64: resp.buffer.toString('base64'),
        textPreview: isText ? resp.buffer.toString('utf8').slice(0, 200) : null
      };
    } catch (err) {
      if (i === maxTries - 1) {
        throw new Error(`请求失败（已尝试 ${maxTries} 次）：${err.message}`);
      }
      await new Promise(r => setTimeout(r, 300 * (i + 1)));
    }
  }
  throw new Error('请求失败');
}

// ---------- P1：证书 / HMAC / JWT 验签 / Docker-K8s YAML 校验 ----------

function certInfo(req, res, body) {
  try {
    const payload = JSON.parse(body);
    const pem = String(payload.pem || '').trim();
    if (!pem.includes('-----BEGIN')) {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      return res.end(JSON.stringify({ ok: false, error: '输入中未找到 PEM 内容（应以 -----BEGIN ... 开头）' }));
    }
    const x509 = new crypto.X509Certificate(pem);
    const info = {
      ok: true,
      subject: x509.subject,
      issuer: x509.issuer,
      serial: x509.serialNumber,
      validFrom: x509.validFrom || null,
      validTo: x509.validTo || null,
      validFromISO: x509.validFromDate ? new Date(x509.validFromDate).toISOString() : null,
      validToISO: x509.validToDate ? new Date(x509.validToDate).toISOString() : null,
      subjectAltName: x509.subjectAltName || null,
      fingerprint: x509.fingerprint || null,
      fingerprint256: x509.fingerprint256 || null
    };
    if (info.validToISO) info.expired = new Date(info.validToISO).getTime() < Date.now();
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(info));
  } catch (err) {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, error: '证书解析失败：' + err.message }));
  }
}

function hmacSign(req, res, body) {
  try {
    const { algo = 'sha256', key = '', text = '' } = JSON.parse(body);
    const allowed = ['md5', 'sha1', 'sha256', 'sha512'];
    const a = algo.toLowerCase().replace(/^hmac-/, '');
    if (!allowed.includes(a)) {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      return res.end(JSON.stringify({ ok: false, error: `不支持的算法 ${algo}，可用：${allowed.join(', ')}` }));
    }
    if (!key) {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      return res.end(JSON.stringify({ ok: false, error: '密钥不能为空' }));
    }
    const sig = crypto.createHmac(a, key).update(String(text)).digest('hex');
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: true, algo: a, signature: sig }));
  } catch (err) {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, error: err.message }));
  }
}

const JWT_NODE_ALG = { RS256: 'RSA-SHA256', RS384: 'RSA-SHA384', RS512: 'RSA-SHA512', ES256: 'SHA256', ES384: 'SHA384', ES512: 'SHA512', PS256: 'RSA-SHA256', PS384: 'RSA-SHA384', PS512: 'RSA-SHA512' };

function b64urlToBuf(s) {
  s = s.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  return Buffer.from(s, 'base64');
}

function jwtVerify(req, res, body) {
  try {
    const { token = '', key = '', alg = '' } = JSON.parse(body);
    const parts = String(token).trim().replace(/^Bearer\s+/i, '').split('.');
    if (parts.length !== 3) throw new Error('JWT 应为三段式');
    const header = JSON.parse(b64urlToBuf(parts[0]).toString('utf8'));
    const signed = Buffer.from(parts[0] + '.' + parts[1]);
    const useAlg = (alg || header.alg || '').toUpperCase();
    let valid = false, reason = '';

    if (useAlg.startsWith('HS')) {
      const h = { HS256: 'sha256', HS384: 'sha384', HS512: 'sha512' }[useAlg];
      if (!h) throw new Error('不支持的算法: ' + useAlg);
      const expect = crypto.createHmac(h, String(key)).update(signed).digest();
      valid = crypto.timingSafeEqual(expect, b64urlToBuf(parts[2]));
      if (!valid) reason = '签名不匹配（密钥错误或内容被篡改）';
    } else if (JWT_NODE_ALG[useAlg]) {
      const pub = crypto.createPublicKey(String(key));
      valid = crypto.verify(JWT_NODE_ALG[useAlg], signed, pub, b64urlToBuf(parts[2]));
      if (!valid) reason = '公钥验签失败';
    } else if (useAlg === 'NONE') {
      valid = parts[2] === '';
      reason = valid ? '' : 'alg=none 但签名段非空';
    } else {
      throw new Error('不支持的算法: ' + useAlg + '（支持 HS256/384/512、RS256/384/512、ES256/384/512、PS*）');
    }

    let expired = null;
    try {
      const payload = JSON.parse(b64urlToBuf(parts[1]).toString('utf8'));
      if (typeof payload.exp === 'number') expired = payload.exp * 1000 < Date.now();
    } catch { /* payload 解析失败不影响验签结果 */ }

    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: true, alg: useAlg, valid, reason, expired }));
  } catch (err) {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, error: err.message }));
  }
}

function yamlCheck(req, res, body) {
  try {
    const { text = '', kind = 'k8s' } = JSON.parse(body);
    const docs = [];
    const warnings = [];
    try {
      jsyaml.loadAll(String(text), doc => docs.push(doc), { json: true });
    } catch (err) {
      const extra = err.mark ? `（第 ${err.mark.line + 1} 行，第 ${err.mark.column + 1} 列）` : '';
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      return res.end(JSON.stringify({ ok: true, syntaxOk: false, syntaxError: (err.reason || err.message) + extra }));
    }

    const KINDS = ['Pod', 'Service', 'Deployment', 'StatefulSet', 'DaemonSet', 'Job', 'CronJob', 'ConfigMap', 'Secret', 'Ingress', 'Namespace', 'PersistentVolume', 'PersistentVolumeClaim', 'ServiceAccount', 'ReplicaSet', 'NetworkPolicy', 'Role', 'RoleBinding', 'ClusterRole', 'ClusterRoleBinding', 'HPA'];

    docs.forEach((doc, i) => {
      const n = docs.length > 1 ? `文档 ${i + 1}: ` : '';
      if (!doc || typeof doc !== 'object') { warnings.push(n + '内容为空'); return; }
      if (kind === 'k8s') {
        for (const f of ['apiVersion', 'kind', 'metadata']) {
          if (!(f in doc)) warnings.push(`${n}缺少顶层字段 "${f}"`);
        }
        if (doc.kind && !KINDS.includes(doc.kind)) warnings.push(`${n}未知 kind "${doc.kind}"，请确认拼写`);
        if (doc.metadata && !(doc.metadata.name)) warnings.push(`${n}缺少 metadata.name`);
        if (doc.kind === 'Deployment' && doc.spec) {
          if (!doc.spec.selector) warnings.push(`${n}Deployment 建议声明 spec.selector`);
          if (!doc.spec.replicas) warnings.push(`${n}未设置 spec.replicas（默认 1）`);
        }
        if (doc.kind === 'Service' && doc.spec && !doc.spec.selector) warnings.push(`${n}Service 缺少 spec.selector，流量无法转发`);
      } else { // docker-compose
        const topKeys = Object.keys(doc);
        if (!topKeys.includes('services')) warnings.push(`${n}docker-compose 缺少顶层 "services"`);
        if (topKeys.includes('version')) warnings.push(`${n}Compose V2 已弃用顶层 "version" 字段，可删除`);
        if (doc.services && typeof doc.services === 'object') {
          for (const [name, svc] of Object.entries(doc.services)) {
            if (!svc || typeof svc !== 'object') { warnings.push(`${n}服务 ${name} 定义无效`); continue; }
            if (!svc.image && !svc.build) warnings.push(`${n}服务 ${name} 缺少 image 或 build`);
            if (svc.ports && !Array.isArray(svc.ports)) warnings.push(`${n}服务 ${name} 的 ports 应为数组`);
          }
        }
      }
    });

    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: true, syntaxOk: true, docCount: docs.length, warnings, docs: kind === 'k8s' ? docs.map(d => d && { kind: d.kind, name: d.metadata && d.metadata.name, apiVersion: d.apiVersion }) : null }));
  } catch (err) {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, error: err.message }));
  }
}

const server = http.createServer(async (req, res) => {
  setCors(req, res);

  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-Agent-Token',
      'Access-Control-Max-Age': '600'
    });
    return res.end();
  }

  if (req.method === 'GET' && req.url === '/ping') {
    const origin = req.headers.origin;
    if (!origin || !isLocalOrigin(origin)) {
      res.writeHead(403, { 'Content-Type': 'application/json; charset=utf-8' });
      return res.end(JSON.stringify({ ok: false, error: 'Origin 非本地来源' }));
    }
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    return res.end(JSON.stringify({ ok: true, name: 'devtools-agent', version: VERSION, auth: 'token' }));
  }

  if (req.method === 'POST' && req.url === '/proxy') {
    if (!checkAuth(req, res)) return;
    const t0 = Date.now();
    try {
      const payload = JSON.parse(await readBody(req));
      const result = await doProxy(payload);
      result.timeMs = Date.now() - t0;
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      return res.end(JSON.stringify(result));
    } catch (err) {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      return res.end(JSON.stringify({ ok: false, error: err.message, timeMs: Date.now() - t0 }));
    }
  }

  if (req.method === 'POST' && req.url === '/cert') {
    if (!checkAuth(req, res)) return;
    return certInfo(req, res, await readBody(req));
  }

  if (req.method === 'POST' && req.url === '/hmac') {
    if (!checkAuth(req, res)) return;
    return hmacSign(req, res, await readBody(req));
  }

  if (req.method === 'POST' && req.url === '/jwt-verify') {
    if (!checkAuth(req, res)) return;
    return jwtVerify(req, res, await readBody(req));
  }

  if (req.method === 'POST' && req.url === '/yaml-check') {
    if (!checkAuth(req, res)) return;
    return yamlCheck(req, res, await readBody(req));
  }

  res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify({ ok: false, error: 'Not Found' }));
});

// 仅监听回环地址
server.listen(PORT, '127.0.0.1', () => {
  console.log('==============================================');
  console.log('  全栈工具集 · 本地 HTTP 调试 Agent 已启动');
  console.log('  监听地址 : http://127.0.0.1:' + PORT + '（仅本机）');
  console.log('  本机 Token: ' + TOKEN);
  console.log('  请将 Token 粘贴到「HTTP 请求调试」工具页');
  console.log('  本 Agent 不记录请求内容，不连接任何云端服务');
  console.log('==============================================');
});

process.on('uncaughtException', err => {
  console.error('[agent] 未捕获异常:', err.message);
});
