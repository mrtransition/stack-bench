// curl 命令解析与代码片段生成（fetch / axios / Go / Python / Java）

/** 将 curl 命令字符串切分为参数 token（处理引号、行续接符） */
export function tokenize(cmd) {
  let s = String(cmd).replace(/\\\r?\n/g, ' ').replace(/\r/g, '\n');
  const toks = [];
  let i = 0;
  while (i < s.length) {
    while (i < s.length && /\s/.test(s[i])) i++;
    if (i >= s.length) break;
    let cur = '', quote = null;
    while (i < s.length) {
      const c = s[i];
      if (quote === '"') {
        if (c === '\\' && i + 1 < s.length && '"\\$`'.includes(s[i + 1])) { cur += s[i + 1]; i += 2; continue; }
        if (c === '"') { i++; quote = null; continue; }
        cur += c; i++; continue;
      }
      if (quote === "'") {
        if (c === "'") { i++; quote = null; continue; }
        cur += c; i++; continue;
      }
      if (c === '"') { quote = '"'; i++; continue; }
      if (c === "'") { quote = "'"; i++; continue; }
      if (c === '$' && s[i + 1] === "'" ) { i += 2; quote = "'"; continue; } // ANSI-C 引号，按普通单引号处理
      if (/\s/.test(c)) break;
      if (c === '\\' && i + 1 < s.length) { cur += s[i + 1]; i += 2; continue; }
      cur += c; i++;
    }
    toks.push(cur);
  }
  return toks;
}

/**
 * 解析 curl 命令 → { method, url, headers, body, notes[] }
 * 不支持的参数记录到 notes，不中断解析。
 */
export function parseCurl(cmd) {
  const toks = tokenize(cmd);
  if (!toks.length) throw new Error('输入为空');
  let start = 0;
  if (toks[0] === 'curl') start = 1;
  else if (/^(sudo\s+)?curl(\.exe)?$/.test(toks[0])) start = 1;
  const flags = toks.slice(start);

  let method = null, url = null, body = null, bodySeen = false;
  const headers = {};
  const notes = [];
  const dataFlags = ['-d', '--data', '--data-raw', '--data-ascii', '--data-urlencode', '--data-binary'];

  for (let i = 0; i < flags.length; i++) {
    const f = flags[i];
    const next = flags[i + 1];
    const hasVal = next !== undefined && !next.startsWith('-');
    switch (f) {
      case '--url':
        if (hasVal) { url = next; i++; }
        break;
      case '-X': case '--request':
        if (hasVal) { method = next.toUpperCase(); i++; }
        break;
      case '-H': case '--header':
        if (hasVal) {
          i++;
          const idx = next.indexOf(':');
          if (idx > 0) headers[next.slice(0, idx).trim()] = next.slice(idx + 1).trim();
          else notes.push(`无法识别的 header: ${next}`);
        }
        break;
      case '-A': case '--user-agent':
        if (hasVal) { headers['User-Agent'] = next; i++; }
        break;
      case '-e': case '--referer':
        if (hasVal) { headers['Referer'] = next; i++; }
        break;
      case '-b': case '--cookie':
        if (hasVal) { headers['Cookie'] = next; i++; }
        break;
      case '-u': case '--user':
        if (hasVal) {
          i++;
          headers['Authorization'] = 'Basic ' + btoaU(next);
          notes.push('-u 已转换为 Authorization: Basic 头（base64）');
        }
        break;
      case '-d': case '--data': case '--data-raw': case '--data-ascii':
        if (hasVal) { body = next; bodySeen = true; i++; }
        break;
      case '--data-urlencode':
        if (hasVal) { notes.push('--data-urlencode 未做 URL 编码转换，请确认 body 已正确编码'); body = next; bodySeen = true; i++; }
        break;
      case '--data-binary':
        if (hasVal) { notes.push('--data-binary 按普通文本处理（不保证二进制正确）'); body = next; bodySeen = true; i++; }
        break;
      case '-F': case '--form': case '--form-string':
        if (hasVal) { notes.push(`不支持表单上传参数 ${f}，已忽略: ${next}`); i++; }
        break;
      case '-T': case '--upload-file':
        if (hasVal) { notes.push(`不支持文件上传参数 ${f}，已忽略: ${next}`); i++; }
        break;
      case '--cert': case '--key': case '--cacert':
        if (hasVal) { notes.push(`证书参数 ${f} 需本地文件，已忽略: ${next}`); i++; }
        break;
      case '--compressed': case '-k': case '--insecure': case '-s': case '--silent':
      case '-v': case '--verbose': case '-i': case '--include': case '-L': case '--location':
      case '--fail': case '-f': case '-o': case '--output': case '-#': case '--progress-bar':
      case '-G': case '--get': case '--no-buffer': case '-N':
        if (['-o', '--output'].includes(f) && hasVal) i++;
        break; // 安全忽略
      case '--max-time': case '--connect-timeout': case '-m':
        if (hasVal) { notes.push(`超时参数 ${f} ${next} 请在目标代码中自行设置`); i++; }
        break;
      default:
        if (f.startsWith('-')) { notes.push(`未识别的参数 ${f}，已忽略`); if (hasVal) i++; }
        else if (url === null) url = f;
        break;
    }
  }

  if (!url) throw new Error('未找到请求 URL');
  if (!/^https?:\/\//i.test(url)) url = 'http://' + url;
  if (!method) method = bodySeen ? 'POST' : 'GET';
  return { method, url, headers, body, notes };
}

function btoaU(s) {
  const bytes = new TextEncoder().encode(s);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

// ---------- 代码生成 ----------

function jsStr(s) { return JSON.stringify(String(s)); }

function pyStr(s) { return JSON.stringify(String(s)).replace(/\\u([0-9a-fA-F]{4})/g, '\\u$1'); }

function goStr(s) {
  let out = '"';
  for (const ch of String(s)) {
    if (ch === '"' || ch === '\\') out += '\\' + ch;
    else if (ch === '\n') out += '\\n';
    else out += ch;
  }
  return out + '"';
}

export function genCode(parsed, target) {
  const { method, url, headers, body, notes } = parsed;
  const hs = Object.entries(headers);
  switch (target) {
    case 'fetch': {
      const lines = [
        `const response = await fetch(${jsStr(url)}, {`,
        `  method: ${jsStr(method)},`,
        `  headers: ${hs.length ? JSON.stringify(headers, null, 2).replace(/\n/g, '\n  ') : '{}'}` + (body !== null ? ',' : '')
      ];
      if (body !== null) lines.push(`  body: ${jsStr(body)}`);
      lines.push('});', '', 'if (!response.ok) throw new Error(`HTTP ${response.status}`);', 'const data = await response.json();', 'console.log(data);');
      return { code: lines.join('\n'), notes };
    }
    case 'axios': {
      const lines = [
        'const { data } = await axios({',
        `  method: ${jsStr(method.toLowerCase())},`,
        `  url: ${jsStr(url)},`,
        `  headers: ${hs.length ? JSON.stringify(headers, null, 2).replace(/\n/g, '\n  ') : 'undefined'}` + (body !== null ? ',' : '')
      ];
      if (body !== null) lines.push(`  data: ${jsStr(body)}`);
      lines.push('});', 'console.log(data);');
      return { code: lines.join('\n'), notes };
    }
    case 'go': {
      const hasBody = body !== null;
      const lines = [
        'package main', '',
        'import (', '\t"fmt"', '\t"io"', '\t"net/http"', hasBody ? '\t"strings"' : null, ')', '',
        'func main() {',
        hasBody
          ? `\treq, _ := http.NewRequest(${goStr(method)}, ${goStr(url)}, strings.NewReader(${goStr(body)}))`
          : `\treq, _ := http.NewRequest(${goStr(method)}, ${goStr(url)}, nil)`
      ].filter(Boolean);
      for (const [k, v] of hs) lines.push(`\treq.Header.Set(${goStr(k)}, ${goStr(v)})`);
      lines.push(
        '\tresp, err := http.DefaultClient.Do(req)',
        '\tif err != nil {', '\t\tpanic(err)', '\t}', '\tdefer resp.Body.Close()',
        '\tbody, _ := io.ReadAll(resp.Body)', '\tfmt.Println(resp.StatusCode)', '\tfmt.Println(string(body))', '}'
      );
      return { code: lines.join('\n'), notes };
    }
    case 'python': {
      const lines = [];
      lines.push('import requests', '');
      const m = method.toLowerCase();
      const hArg = hs.length ? `headers=${pyObj(hs)}, ` : '';
      const bArg = body !== null ? `data=${pyStr(body)}, ` : '';
      lines.push(`resp = requests.${m}(${pyStr(url)}, ${hArg}${bArg}timeout=30)`);
      lines.push('resp.raise_for_status()');
      lines.push('print(resp.json())');
      return { code: lines.join('\n'), notes };
    }
    case 'java': {
      const lines = [
        'import java.net.URI;', 'import java.net.http.*;', 'import java.time.Duration;', '',
        'public class Main {',
        '    public static void main(String[] args) throws Exception {',
        '        HttpClient client = HttpClient.newBuilder()',
        '                .connectTimeout(Duration.ofSeconds(30))',
        '                .build();',
        '        HttpRequest.Builder b = HttpRequest.newBuilder(URI.create(' + jsStr(url) + '))'
      ];
      for (const [k, v] of Object.entries(headers)) lines.push('                .header(' + jsStr(k) + ', ' + jsStr(v) + ')');
      lines.push('                .' + (body !== null
        ? `method(${jsStr(method)}, HttpRequest.BodyPublishers.ofString(${jsStr(body)}))`
        : `method(${jsStr(method)}, HttpRequest.BodyPublishers.noBody())`) + ';');
      lines.push(
        '        HttpResponse<String> resp = client.send(b, HttpResponse.BodyHandlers.ofString());',
        '        System.out.println(resp.statusCode());',
        '        System.out.println(resp.body());',
        '    }', '}'
      );
      return { code: lines.join('\n'), notes };
    }
    default:
      throw new Error('不支持的目标语言: ' + target);
  }
}

function pyObj(entries) {
  return '{' + entries.map(([k, v]) => `${pyStr(k)}: ${pyStr(v)}`).join(', ') + '}';
}

export const TARGETS = [
  { key: 'fetch', label: 'JavaScript fetch' },
  { key: 'axios', label: 'JavaScript axios' },
  { key: 'go', label: 'Go net/http' },
  { key: 'python', label: 'Python requests' },
  { key: 'java', label: 'Java HttpClient' }
];
