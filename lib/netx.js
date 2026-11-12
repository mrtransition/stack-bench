// CIDR / IP 计算 + 端口 / MIME / HTTP 状态码速查数据
export function ipToInt(ip) {
  const parts = String(ip).trim().split('.');
  if (parts.length !== 4) throw new Error('IPv4 应为 4 段数字: ' + ip);
  let n = 0;
  for (const p of parts) {
    const v = Number(p);
    if (!/^\d{1,3}$/.test(p) || v > 255) throw new Error(`IP 段不合法: ${p}`);
    n = n * 256 + v;
  }
  return n >>> 0;
}

export function intToIp(n) {
  return [24, 16, 8, 0].map(s => (n >>> s) & 255).join('.');
}

/** 解析 CIDR 或裸 IP（裸 IP 视为 /32） */
export function parseCidr(input) {
  const m = /^\s*([\d.]+)(?:\/(\d{1,2}))?\s*$/.exec(String(input));
  if (!m) throw new Error('格式应为 a.b.c.d/prefix，如 192.168.1.10/24');
  const prefix = m[2] === undefined ? 32 : Number(m[2]);
  if (prefix > 32) throw new Error('前缀长度应在 0-32');
  const ipInt = ipToInt(m[1]);
  const mask = prefix === 0 ? 0 : (0xFFFFFFFF << (32 - prefix)) >>> 0;
  const network = (ipInt & mask) >>> 0;
  const broadcast = (network | (~mask >>> 0)) >>> 0;
  const total = 2 ** (32 - prefix);
  const hosts = prefix >= 31 ? (prefix === 32 ? 1 : 2) : total - 2;
  return {
    input: String(input).trim(),
    ip: intToIp(ipInt),
    prefix,
    mask: intToIp(mask),
    wildcard: intToIp(~mask >>> 0),
    network: intToIp(network),
    broadcast: intToIp(broadcast),
    firstHost: prefix >= 31 ? intToIp(network) : intToIp(network + 1),
    lastHost: prefix >= 31 ? intToIp(broadcast) : intToIp(broadcast - 1),
    totalAddresses: total,
    hostCount: hosts,
    binaryIp: intToIp(ipInt).split('.').map(x => Number(x).toString(2).padStart(8, '0')).join('.'),
    isPrivate: isPrivateIp(network)
  };
}

export function isPrivateIp(n) {
  const a = (n >>> 24) & 255;
  const b = (n >>> 16) & 255;
  return a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) ||
    (a === 127) || (a === 169 && b === 254);
}

export function inCidr(cidrStr, ipStr) {
  const c = parseCidr(cidrStr);
  const n = ipToInt(ipStr);
  const mask = c.prefix === 0 ? 0 : (0xFFFFFFFF << (32 - c.prefix)) >>> 0;
  return ((n & mask) >>> 0) === ((ipToInt(c.ip) & mask) >>> 0);
}

export const COMMON_PORTS = [
  { port: 20, name: 'FTP 数据', desc: '文件传输（数据通道）' },
  { port: 21, name: 'FTP 控制', desc: '文件传输（控制通道）' },
  { port: 22, name: 'SSH', desc: '安全登录 / SCP / SFTP' },
  { port: 23, name: 'Telnet', desc: '明文远程登录（不安全）' },
  { port: 25, name: 'SMTP', desc: '邮件发送' },
  { port: 53, name: 'DNS', desc: '域名解析（TCP/UDP）' },
  { port: 67, name: 'DHCP Server', desc: '动态主机配置' },
  { port: 80, name: 'HTTP', desc: '网页服务' },
  { port: 110, name: 'POP3', desc: '邮件收取' },
  { port: 143, name: 'IMAP', desc: '邮件收取（保留服务端）' },
  { port: 443, name: 'HTTPS', desc: 'HTTP over TLS' },
  { port: 465, name: 'SMTPS', desc: 'SMTP over SSL' },
  { port: 993, name: 'IMAPS', desc: 'IMAP over SSL' },
  { port: 1433, name: 'SQL Server', desc: '微软数据库' },
  { port: 1521, name: 'Oracle', desc: 'Oracle 数据库监听' },
  { port: 3306, name: 'MySQL', desc: 'MySQL/MariaDB' },
  { port: 3389, name: 'RDP', desc: 'Windows 远程桌面' },
  { port: 5432, name: 'PostgreSQL', desc: 'PostgreSQL 数据库' },
  { port: 6379, name: 'Redis', desc: 'Redis 缓存' },
  { port: 8080, name: 'HTTP Alt', desc: '常见 Tomcat / 代理端口' },
  { port: 9200, name: 'Elasticsearch', desc: 'ES HTTP 端口' },
  { port: 27017, name: 'MongoDB', desc: 'MongoDB 默认端口' }
];

export const MIME_TYPES = [
  { mime: 'application/json', ext: '.json', desc: 'JSON 数据' },
  { mime: 'application/xml', ext: '.xml', desc: 'XML 数据' },
  { mime: 'application/pdf', ext: '.pdf', desc: 'PDF 文档' },
  { mime: 'application/zip', ext: '.zip', desc: 'ZIP 压缩包' },
  { mime: 'application/gzip', ext: '.gz', desc: 'GZIP 压缩' },
  { mime: 'application/octet-stream', ext: '.bin', desc: '二进制流' },
  { mime: 'application/x-www-form-urlencoded', ext: '-', desc: '表单默认编码' },
  { mime: 'multipart/form-data', ext: '-', desc: '文件上传表单' },
  { mime: 'text/html', ext: '.html', desc: 'HTML 页面' },
  { mime: 'text/css', ext: '.css', desc: '样式表' },
  { mime: 'text/plain', ext: '.txt', desc: '纯文本' },
  { mime: 'text/csv', ext: '.csv', desc: 'CSV 表格' },
  { mime: 'text/javascript', ext: '.js', desc: 'JavaScript' },
  { mime: 'image/jpeg', ext: '.jpg/.jpeg', desc: 'JPEG 图片' },
  { mime: 'image/png', ext: '.png', desc: 'PNG 图片' },
  { mime: 'image/gif', ext: '.gif', desc: 'GIF 图片' },
  { mime: 'image/webp', ext: '.webp', desc: 'WebP 图片' },
  { mime: 'image/svg+xml', ext: '.svg', desc: 'SVG 矢量图' },
  { mime: 'video/mp4', ext: '.mp4', desc: 'MP4 视频' },
  { mime: 'audio/mpeg', ext: '.mp3', desc: 'MP3 音频' },
  { mime: 'font/woff2', ext: '.woff2', desc: 'Web 字体' },
  { mime: 'application/wasm', ext: '.wasm', desc: 'WebAssembly' }
];

export const HTTP_STATUS = [
  { code: 100, text: 'Continue', desc: '继续发送请求体' },
  { code: 101, text: 'Switching Protocols', desc: '协议切换（如 WebSocket 升级）' },
  { code: 200, text: 'OK', desc: '请求成功' },
  { code: 201, text: 'Created', desc: '资源创建成功' },
  { code: 204, text: 'No Content', desc: '成功但无返回体' },
  { code: 206, text: 'Partial Content', desc: '范围请求成功' },
  { code: 301, text: 'Moved Permanently', desc: '永久重定向' },
  { code: 302, text: 'Found', desc: '临时重定向' },
  { code: 304, text: 'Not Modified', desc: '缓存有效' },
  { code: 307, text: 'Temporary Redirect', desc: '临时重定向（保持方法）' },
  { code: 308, text: 'Permanent Redirect', desc: '永久重定向（保持方法）' },
  { code: 400, text: 'Bad Request', desc: '请求参数错误' },
  { code: 401, text: 'Unauthorized', desc: '未认证' },
  { code: 403, text: 'Forbidden', desc: '无权限' },
  { code: 404, text: 'Not Found', desc: '资源不存在' },
  { code: 405, text: 'Method Not Allowed', desc: '方法不支持' },
  { code: 408, text: 'Request Timeout', desc: '请求超时' },
  { code: 409, text: 'Conflict', desc: '资源冲突' },
  { code: 413, text: 'Payload Too Large', desc: '请求体过大' },
  { code: 415, text: 'Unsupported Media Type', desc: '媒体类型不支持' },
  { code: 422, text: 'Unprocessable Entity', desc: '校验失败' },
  { code: 429, text: 'Too Many Requests', desc: '请求过于频繁' },
  { code: 500, text: 'Internal Server Error', desc: '服务器内部错误' },
  { code: 501, text: 'Not Implemented', desc: '功能未实现' },
  { code: 502, text: 'Bad Gateway', desc: '网关收到无效响应' },
  { code: 503, text: 'Service Unavailable', desc: '服务暂不可用' },
  { code: 504, text: 'Gateway Timeout', desc: '网关超时' }
];

export function searchList(list, q, fields) {
  q = String(q).trim().toLowerCase();
  if (!q) return list;
  return list.filter(item => fields.some(f => String(item[f]).toLowerCase().includes(q)));
}
