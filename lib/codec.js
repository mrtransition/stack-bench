// 分享链接参数编解码：Base64URL(JSON)，纯函数，可在 Node 中测试
function b64urlEncode(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function b64urlDecode(s) {
  s = s.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  const bin = atob(s);
  const bytes = Uint8Array.from(bin, c => c.charCodeAt(0));
  return new TextDecoder('utf-8').decode(bytes);
}

/** 将对象编码为可放入 URL 的字符串 */
export function encodeParams(obj) {
  try { return b64urlEncode(JSON.stringify(obj)); } catch { return ''; }
}

/** 还原分享链接中的参数对象，失败返回 null */
export function decodeParams(str) {
  try { return JSON.parse(b64urlDecode(String(str))); } catch { return null; }
}
