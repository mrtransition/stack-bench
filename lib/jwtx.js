// JWT 解析（仅解码，不验签）
function b64urlDecode(s) {
  s = s.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  const bin = atob(s);
  const bytes = Uint8Array.from(bin, c => c.charCodeAt(0));
  return new TextDecoder('utf-8').decode(bytes);
}

/**
 * 解析三段式 JWT。
 * 返回 { header, payload, signature, claims: {iat?, exp?, nbf?}, expired, error? }
 * 结构非法时抛出 Error。
 */
export function parseJwt(token) {
  const t = String(token).trim().replace(/^Bearer\s+/i, '');
  const parts = t.split('.');
  if (parts.length !== 3) {
    throw new Error(`JWT 应为三段式（header.payload.signature），当前为 ${parts.length} 段`);
  }
  let header, payload;
  try {
    header = JSON.parse(b64urlDecode(parts[0]));
  } catch (e) {
    throw new Error('Header 段不是合法的 Base64URL JSON：' + e.message);
  }
  try {
    payload = JSON.parse(b64urlDecode(parts[1]));
  } catch (e) {
    throw new Error('Payload 段不是合法的 Base64URL JSON：' + e.message);
  }
  const claims = {};
  for (const k of ['iat', 'exp', 'nbf']) {
    if (typeof payload[k] === 'number') {
      claims[k] = new Date(payload[k] * 1000);
    }
  }
  const now = Date.now();
  let expired = false;
  if (claims.exp) expired = claims.exp.getTime() < now;
  let notYet = false;
  if (claims.nbf) notYet = claims.nbf.getTime() > now;
  return {
    header, payload,
    signature: parts[2],
    claims,
    expired,
    notYet,
    token: t
  };
}

export function fmtDate(d) {
  if (!d) return '-';
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}
