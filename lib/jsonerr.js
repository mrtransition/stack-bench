// JSON 解析错误定位：尽量给出行号 / 列号 / 原因
export function locateJsonError(text, err) {
  let line = null, col = null;
  let msg = String((err && err.message) || err || '未知错误');
  const m = /position\s+(\d+)/i.exec(msg);
  if (m && typeof text === 'string') {
    const pos = Math.min(Number(m[1]), text.length);
    const upto = text.slice(0, pos);
    line = upto.split('\n').length;
    col = pos - upto.lastIndexOf('\n');
    msg = `${friendly(msg)}（错误位置：第 ${line} 行，第 ${col} 列）`;
  } else {
    msg = friendly(msg);
  }
  return { message: msg, line, col };
}

function friendly(msg) {
  if (/unexpected end/i.test(msg)) return 'JSON 不完整：缺少结尾（可能是括号 / 引号未闭合）';
  if (/unexpected token/i.test(msg)) return '存在无法解析的字符：请检查是否使用了单引号、尾逗号或包含非法字符';
  if (/bad escaped/i.test(msg)) return '转义字符不合法（如反斜杠用法错误）';
  if (/no number/i.test(msg) || /in number/i.test(msg)) return '数字格式不合法';
  if (/unexpected string/i.test(msg)) return '字符串位置不合法（可能是键名缺少引号）';
  return msg.replace(/^JSON\.parse:?\s*/i, '').replace(/^Unexpected token .* in JSON at position \d+\.?$/i, 'JSON 语法错误');
}
