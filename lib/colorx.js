// 颜色转换：HEX / RGB / HSL 互转
function clamp(v, min, max) { return Math.min(max, Math.max(min, v)); }

/** 解析任意颜色字符串 → {r,g,b} (0-255) */
export function parseColor(input) {
  const s = String(input).trim().toLowerCase();
  if (!s) throw new Error('输入为空');
  let m;
  // #rgb #rrggbb
  if ((m = /^#?([0-9a-f]{3})$/.exec(s))) {
    return { r: parseInt(m[1][0] + m[1][0], 16), g: parseInt(m[1][1] + m[1][1], 16), b: parseInt(m[1][2] + m[1][2], 16) };
  }
  if ((m = /^#?([0-9a-f]{6})([0-9a-f]{2})?$/.exec(s))) {
    return { r: parseInt(m[1].slice(0, 2), 16), g: parseInt(m[1].slice(2, 4), 16), b: parseInt(m[1].slice(4, 6), 16) };
  }
  // rgb(...) rgba(...)
  if ((m = /^rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/.exec(s))) {
    return { r: clamp(+m[1], 0, 255), g: clamp(+m[2], 0, 255), b: clamp(+m[3], 0, 255) };
  }
  // hsl(...) hsla(...)
  if ((m = /^hsla?\(\s*(\d+(?:\.\d+)?)(?:deg)?[,\s]+(\d+(?:\.\d+)?)%[,\s]+(\d+(?:\.\d+)?)%/.exec(s))) {
    return hslToRgb(+m[1], +m[2] / 100, +m[3] / 100);
  }
  // 具名颜色（常用 16 种）
  const NAMED = {
    black: '#000000', white: '#ffffff', red: '#ff0000', green: '#008000', blue: '#0000ff',
    yellow: '#ffff00', orange: '#ffa500', purple: '#800080', gray: '#808080', grey: '#808080',
    cyan: '#00ffff', magenta: '#ff00ff', silver: '#c0c0c0', teal: '#008080', navy: '#000080', pink: '#ffc0cb'
  };
  if (NAMED[s]) return parseColor(NAMED[s]);
  throw new Error(`无法识别的颜色: ${input}（支持 HEX / rgb() / hsl() / 常用英文名）`);
}

export function rgbToHex({ r, g, b }) {
  const h = v => Math.round(clamp(v, 0, 255)).toString(16).padStart(2, '0');
  return `#${h(r)}${h(g)}${h(b)}`;
}

export function rgbToHsl({ r, g, b }) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0, s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      default: h = (r - g) / d + 4;
    }
    h /= 6;
  }
  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}

export function hslToRgb(h, s, l) {
  h = ((h % 360) + 360) % 360 / 360;
  if (s === 0) { const v = Math.round(l * 255); return { r: v, g: v, b: v }; }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const hue2rgb = t => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  return {
    r: Math.round(hue2rgb(h + 1 / 3) * 255),
    g: Math.round(hue2rgb(h) * 255),
    b: Math.round(hue2rgb(h - 1 / 3) * 255)
  };
}

/** 输入任意颜色字符串，输出全部格式 */
export function convertColor(input) {
  const rgb = parseColor(input);
  const hsl = rgbToHsl(rgb);
  const hslStr = `hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)`;
  return {
    hex: rgbToHex(rgb),
    rgb: `rgb(${Math.round(rgb.r)}, ${Math.round(rgb.g)}, ${Math.round(rgb.b)})`,
    hsl: hslStr,
    rgbObj: rgb,
    hslObj: hsl
  };
}
